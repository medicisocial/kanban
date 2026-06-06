-- Patch only portalPasswordVault for one brand without rewriting the full clients
-- workspace JSON (~1 MB). Full-row upserts were timing out under concurrent sync.

create or replace function public.patch_clients_portal_password_vault(
  p_org_id text,
  p_brand text,
  p_brand_vault jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
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
$$;

revoke all on function public.patch_clients_portal_password_vault(text, text, jsonb) from public;
grant execute on function public.patch_clients_portal_password_vault(text, text, jsonb) to service_role;
