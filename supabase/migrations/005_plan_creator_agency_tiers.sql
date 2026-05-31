-- Creator (starter) + 3 agency tiers. Legacy free/advanced map in app code.

alter table public.organizations
  drop constraint if exists organizations_plan_type_check;

update public.organizations
set plan_type = case plan_type
  when 'free' then 'starter'
  when 'creator' then 'starter'
  when 'agency' then 'agency_pro'
  when 'advanced' then 'agency_pro'
  else plan_type
end;

update public.organizations
set plan_type = 'agency_scale'
where id = 'medici';

alter table public.organizations
  add constraint organizations_plan_type_check
  check (plan_type in ('starter', 'agency_essential', 'agency_pro', 'agency_scale'));

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

  insert into public.organizations (id, name, slug, plan_type)
  values (new_org_id, org_name, new_org_id, org_plan);

  insert into public.organization_members (org_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;
