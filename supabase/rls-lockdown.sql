-- RLS hardening (Phase: write-lockdown).
--
-- Threat closed: the publishable/anon key ships in the browser bundle and is
-- trivially extractable. Under the old `_pilot_all` policy that key could
-- INSERT/UPDATE/DELETE anything — i.e. anyone could wipe or tamper with the
-- whole database. After this migration:
--
--   * READ  (select): allowed for anon + authenticated. Public share links
--     (?client=, ?calendar=, ?content=, ?shoot=) read via the anon key, so this
--     must stay open. (Full read-confidentiality is a later phase that moves
--     share-link reads behind the server.)
--   * WRITE (insert/update/delete): authenticated staff session only. The anon
--     key can no longer modify data.
--   * The server (client portal write-back, auth endpoints) uses the
--     service-role key, which bypasses RLS entirely — so clients are unaffected.

do $$
declare
  tbl text;
  tables text[] := array[
    'cards','shoot_plans','video_ideas','admin_tasks','events',
    'meetings','clients','team_members','client_portal_credentials'
  ];
begin
  foreach tbl in array tables loop
    -- Remove the permissive pilot policy.
    execute format('drop policy if exists %I on public.%I;', tbl || '_pilot_all', tbl);

    -- Read: public (share links) + staff.
    execute format('drop policy if exists %I on public.%I;', tbl || '_read', tbl);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true);',
      tbl || '_read', tbl);

    -- Writes: authenticated staff session only (anon blocked).
    execute format('drop policy if exists %I on public.%I;', tbl || '_insert', tbl);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (true);',
      tbl || '_insert', tbl);

    execute format('drop policy if exists %I on public.%I;', tbl || '_update', tbl);
    execute format(
      'create policy %I on public.%I for update to authenticated using (true) with check (true);',
      tbl || '_update', tbl);

    execute format('drop policy if exists %I on public.%I;', tbl || '_delete', tbl);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (true);',
      tbl || '_delete', tbl);
  end loop;
end $$;
