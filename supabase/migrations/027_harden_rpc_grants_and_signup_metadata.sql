-- Security hardening only: function grants + signup trigger metadata source.
-- Does NOT update cards, client_records, portal_users, credentials, or other workspace rows.

-- ── 1. Signup plan tier from app_metadata (not user-editable user_metadata) ───

create or replace function public.handle_new_saas_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_org_id text;
  org_name text;
  org_plan text;
  legacy_staff_email text := 'info@medicisocial.com';
begin
  if exists (select 1 from public.organization_members where user_id = new.id) then
    return new;
  end if;

  if lower(coalesce(new.email, '')) = legacy_staff_email then
    insert into public.organization_members (org_id, user_id, role)
    values ('medici', new.id, 'owner')
    on conflict do nothing;
    return new;
  end if;

  org_name := coalesce(
    nullif(trim(new.raw_app_meta_data ->> 'org_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'org_name'), ''),
    split_part(new.email, '@', 1) || '''s workspace'
  );
  org_plan := coalesce(nullif(trim(new.raw_app_meta_data ->> 'plan_type'), ''), 'starter');
  if org_plan not in ('starter', 'agency_essential', 'agency_pro', 'agency_scale') then
    org_plan := 'starter';
  end if;

  new_org_id := replace(gen_random_uuid()::text, '-', '');

  insert into public.organizations (id, name, slug, plan_type, trial_ends_at)
  values (new_org_id, org_name, new_org_id, org_plan, now() + interval '7 days');

  insert into public.organization_members (org_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

revoke execute on function public.handle_new_saas_user() from public, anon, authenticated;

-- ── 2. Lock search_path on content brand sync trigger ─────────────────────────

create or replace function public.sync_content_brand_id()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_client text;
  v_brand_id uuid;
begin
  if new.data is null or not (new.data ? 'client') then
    return new;
  end if;

  v_client := nullif(trim(new.data->>'client'), '');
  if v_client is null then
    return new;
  end if;

  select b.id
  into v_brand_id
  from public.brands b
  where b.org_id = new.org_id
    and (
      lower(trim(v_client)) = b.brand_key
      or lower(trim(v_client)) = lower(trim(b.display_name))
    )
  order by b.created_at nulls last
  limit 1;

  if v_brand_id is not null then
    new.brand_id := v_brand_id;
  end if;

  return new;
end;
$$;

-- ── 3. Revoke anon execute on sensitive SECURITY DEFINER RPCs ───────────────
-- Server routes use service_role; staff browser uses authenticated where needed.

revoke execute on function public.fetch_portal_users_for_login() from public, anon, authenticated;
grant execute on function public.fetch_portal_users_for_login() to service_role;

revoke execute on function public.get_portal_password_vault(text, text) from public, anon, authenticated;
grant execute on function public.get_portal_password_vault(text, text) to service_role;

revoke execute on function public.patch_portal_password_vault(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.patch_portal_password_vault(text, text, jsonb) to service_role;

revoke execute on function public.get_brand_portal_users(text, text) from public, anon, authenticated;
grant execute on function public.get_brand_portal_users(text, text) to service_role;

revoke execute on function public.replace_brand_portal_users(text, text, jsonb, boolean, boolean) from public, anon, authenticated;
grant execute on function public.replace_brand_portal_users(text, text, jsonb, boolean, boolean) to service_role;

revoke execute on function public.get_portal_brand_profile(text, text) from public, anon, authenticated;
grant execute on function public.get_portal_brand_profile(text, text) to service_role;

revoke execute on function public.patch_brand_profile(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.patch_brand_profile(text, text, jsonb) to service_role;

revoke execute on function public.get_brand_profile(text, text) from public, anon;
grant execute on function public.get_brand_profile(text, text) to service_role, authenticated;

revoke execute on function public.get_org_brand_names(text) from public, anon;
grant execute on function public.get_org_brand_names(text) to service_role, authenticated;

revoke execute on function public.reserve_client_brand_name(text, text) from public, anon;
grant execute on function public.reserve_client_brand_name(text, text) to authenticated, service_role;

revoke execute on function public.release_client_brand_name(text, text) from public, anon;
grant execute on function public.release_client_brand_name(text, text) to authenticated, service_role;

revoke execute on function public.user_org_ids() from public, anon;
grant execute on function public.user_org_ids() to authenticated, service_role;
