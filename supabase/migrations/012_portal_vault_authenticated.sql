-- Allow the authenticated staff browser (not just the service role) to patch the
-- portal password vault, so the desktop direct-write path persists the plaintext
-- vault that the staff editor displays. Adds an org-membership guard so an
-- authenticated user can only patch their own org's vault.

create or replace function public.patch_clients_portal_password_vault(
  p_org_id text,
  p_brand text,
  p_brand_vault jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Service role (server API) bypasses the guard; authenticated callers must
  -- belong to the org they are patching.
  if auth.role() = 'authenticated' then
    if not exists (
      select 1
      from public.organization_members m
      where m.org_id = p_org_id
        and m.user_id = auth.uid()
    ) then
      raise exception 'not authorized for org %', p_org_id;
    end if;
  end if;

  update public.clients
  set
    data = jsonb_set(
      coalesce(data, '{}'::jsonb),
      '{portalPasswordVault}',
      coalesce(data->'portalPasswordVault', '{}'::jsonb)
        || jsonb_build_object(
          p_brand,
          coalesce(data->'portalPasswordVault'->p_brand, '{}'::jsonb)
            || coalesce(p_brand_vault, '{}'::jsonb)
        ),
      true
    ),
    updated_at = now()
  where id = 'workspace' and org_id = p_org_id;
end;
$$;

revoke all on function public.patch_clients_portal_password_vault(text, text, jsonb) from public;
grant execute on function public.patch_clients_portal_password_vault(text, text, jsonb) to authenticated;
grant execute on function public.patch_clients_portal_password_vault(text, text, jsonb) to service_role;
