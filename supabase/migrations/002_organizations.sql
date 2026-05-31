-- SaaS foundation: organizations + membership (billing deferred).
-- Run in Supabase SQL editor after schema.sql (and optional rls-lockdown.sql).
--
-- Medici Social legacy workspace is seeded as org_id = 'medici'. Existing rows
-- already use that org_id. Link your staff Supabase Auth user after running:
--
--   insert into organization_members (org_id, user_id, role)
--   select 'medici', id, 'owner' from auth.users
--   where email = 'info@medicisocial.com'
--   on conflict do nothing;

-- ── Organizations ────────────────────────────────────────────────────────────

create table if not exists public.organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  plan_type text not null default 'agency'
    check (plan_type in ('agency', 'creator')),
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name, slug, plan_type)
values ('medici', 'Medici Social', 'medici', 'agency')
on conflict (id) do nothing;

-- ── Membership ───────────────────────────────────────────────────────────────

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);

-- ── RLS on org tables ────────────────────────────────────────────────────────

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations
  for select to authenticated
  using (
    id in (
      select om.org_id from public.organization_members om
      where om.user_id = auth.uid()
    )
  );

drop policy if exists organization_members_own_read on public.organization_members;
create policy organization_members_own_read on public.organization_members
  for select to authenticated
  using (user_id = auth.uid());

-- ── Auto-provision org on SaaS signup ────────────────────────────────────────

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

  -- Legacy Medici staff account: attach to existing medici org only.
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
  org_plan := coalesce(new.raw_user_meta_data ->> 'plan_type', 'agency');
  if org_plan not in ('agency', 'creator') then
    org_plan := 'agency';
  end if;

  new_org_id := replace(gen_random_uuid()::text, '-', '');

  insert into public.organizations (id, name, slug, plan_type)
  values (new_org_id, org_name, new_org_id, org_plan);

  insert into public.organization_members (org_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_saas_user();

-- ── Workspace collection RLS (replace pilot / lockdown policies) ─────────────

create or replace function public.user_org_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.organization_members where user_id = auth.uid()
$$;

revoke all on function public.user_org_ids() from public;
grant execute on function public.user_org_ids() to authenticated;

do $$
declare
  tbl text;
  tables text[] := array[
    'cards', 'shoot_plans', 'video_ideas', 'admin_tasks', 'events',
    'meetings', 'clients', 'team_members', 'client_portal_credentials'
  ];
begin
  foreach tbl in array tables loop
    execute format('drop policy if exists %I on public.%I;', tbl || '_pilot_all', tbl);
    execute format('drop policy if exists %I on public.%I;', tbl || '_read', tbl);
    execute format('drop policy if exists %I on public.%I;', tbl || '_insert', tbl);
    execute format('drop policy if exists %I on public.%I;', tbl || '_update', tbl);
    execute format('drop policy if exists %I on public.%I;', tbl || '_delete', tbl);
    execute format('drop policy if exists %I on public.%I;', tbl || '_tenant_read', tbl);
    execute format('drop policy if exists %I on public.%I;', tbl || '_tenant_write', tbl);
    execute format('drop policy if exists %I on public.%I;', tbl || '_anon_legacy_read', tbl);

    -- Authenticated staff: only their organization(s).
    execute format($f$
      create policy %I on public.%I
        for all to authenticated
        using (org_id in (select public.user_org_ids()))
        with check (org_id in (select public.user_org_ids()));
    $f$, tbl || '_tenant_write', tbl);

    -- Legacy public share links (Medici deployment): anon read medici org only.
    execute format($f$
      create policy %I on public.%I
        for select to anon
        using (org_id = 'medici');
    $f$, tbl || '_anon_legacy_read', tbl);
  end loop;
end $$;
