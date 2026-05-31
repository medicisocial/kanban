-- 7-day trial on all paid plans (stored on the org at signup).

alter table public.organizations
  add column if not exists trial_ends_at timestamptz;

create or replace function public.handle_new_saas_user()
returns trigger
language plpgsql
security definer
set search_path = public
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
    nullif(trim(new.raw_user_meta_data ->> 'org_name'), ''),
    split_part(new.email, '@', 1) || '''s workspace'
  );
  org_plan := coalesce(new.raw_user_meta_data ->> 'plan_type', 'starter');
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
