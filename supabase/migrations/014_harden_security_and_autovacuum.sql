-- Structural hardening so future features don't reintroduce timeouts/leaks.
--
-- 1. handle_new_saas_user() only ever runs from the on_auth_user_created
--    trigger (as the table owner). It does not need to be callable over the
--    REST RPC surface, so revoke EXECUTE from the public-facing roles.
-- 2. brand-assets is a public bucket: object content is served via its public
--    URL without an RLS SELECT policy. The broad public SELECT policy only
--    enabled anonymous *listing* of every file in the bucket. Scope SELECT to
--    signed-in staff within their own org (the app only ever reads via public
--    URLs and deletes via the existing DELETE policy).
-- 3. Several per-row tables in the realtime publication accumulate dead tuples
--    because the default autovacuum thresholds rarely trip on small tables.
--    Tighten their thresholds so logical decoding and reads stay lean.

-- PUBLIC carries an implicit EXECUTE grant, so revoke from it too (the trigger
-- still fires — trigger invocation does not check EXECUTE on the function).
revoke execute on function public.handle_new_saas_user() from public, anon, authenticated;

drop policy if exists brand_assets_read on storage.objects;
create policy brand_assets_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] in (select public.user_org_ids())
  );

do $$
declare
  t text;
begin
  foreach t in array array[
    'events',
    'shoot_plans',
    'meetings',
    'video_ideas',
    'client_portal_credentials',
    'team_members',
    'admin_tasks'
  ]
  loop
    execute format(
      'alter table public.%I set ('
      || 'autovacuum_vacuum_scale_factor = 0.05, '
      || 'autovacuum_vacuum_threshold = 25, '
      || 'autovacuum_analyze_scale_factor = 0.05, '
      || 'autovacuum_analyze_threshold = 25)',
      t
    );
  end loop;
end $$;
