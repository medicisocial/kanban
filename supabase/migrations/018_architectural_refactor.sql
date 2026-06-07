-- ============================================================================
-- Phase 1: Architectural refactor — normalized tables, proper FKs, audit trail
-- ============================================================================
-- This migration completes the normalization started by 017_normalize_clients_and_fks.
-- It creates stable brand identities, per-user portal credentials, an encrypted
-- password vault, typed columns on record tables, and audit columns throughout.
--
-- All new tables are created alongside existing ones. Legacy tables remain for
-- backward compatibility and are kept in sync via triggers.
-- ============================================================================

-- ── 1. BRANDS (stable internal key + editable display name) ────────────────

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  brand_key text not null,                        -- set-once, never changes
  display_name text not null,                     -- user-editable
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, brand_key)
);

-- Backfill brands from client_records (which was backfilled from clients blob + client_portal_credentials)
insert into public.brands (org_id, brand_key, display_name, created_at, updated_at)
select
  cr.org_id,
  cr.brand_key,
  cr.display_name,
  cr.created_at,
  cr.updated_at
from public.client_records cr
on conflict (org_id, brand_key) do nothing;

-- Trigger: auto-create brand when client_records gets a new row
create or replace function public.sync_client_record_to_brand()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.brands (org_id, brand_key, display_name)
  values (new.org_id, new.brand_key, new.display_name)
  on conflict (org_id, brand_key) do update
    set display_name = new.display_name, updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_client_record_to_brand on public.client_records;
create trigger trg_sync_client_record_to_brand
  after insert or update on public.client_records
  for each row execute function public.sync_client_record_to_brand();

-- ── 2. PORTAL USERS (one row per user, replaces JSONB array) ──────────────

create table if not exists public.portal_users (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  username text not null,
  password_hash text not null,
  display_name text not null default '',
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, lower(trim(username)))
);

create index if not exists portal_users_brand_id_idx on public.portal_users (brand_id);

-- Migrate existing portal credentials
do $$
declare
  cred record;
  brand_record record;
  user_rec record;
begin
  for cred in
    select cpc.org_id, cpc.id as brand_key, cpc.data
    from public.client_portal_credentials cpc
    where jsonb_typeof(cpc.data) = 'array'
  loop
    -- Find the brand id
    select id into brand_record from public.brands
    where org_id = cred.org_id and brand_key = lower(trim(cred.brand_key))
    limit 1;
    
    if brand_record.id is not null then
      for user_rec in
        select
          u->>'id' as user_id,
          u->>'username' as username,
          u->>'passwordHash' as password_hash,
          coalesce(u->>'displayName', '') as display_name,
          u->>'avatar' as avatar
        from jsonb_array_elements(cred.data) u
        where coalesce(u->>'username', '') <> ''
          and coalesce(u->>'passwordHash', '') <> ''
      loop
        insert into public.portal_users (id, brand_id, username, password_hash, display_name, avatar)
        values (
          coalesce(user_rec.user_id, gen_random_uuid()::text)::uuid,
          brand_record.id,
          user_rec.username,
          user_rec.password_hash,
          user_rec.display_name,
          user_rec.avatar
        )
        on conflict (brand_id, lower(trim(username))) do update
          set password_hash = excluded.password_hash,
              display_name = excluded.display_name,
              avatar = coalesce(excluded.avatar, portal_users.avatar),
              updated_at = now();
      end loop;
    end if;
  end loop;
end $$;

-- Trigger: keep portal_users in sync with client_portal_credentials writes
-- (so the legacy write path still works during transition)
create or replace function public.sync_credentials_to_portal_users()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_brand_id uuid;
  v_org_id text;
  v_brand_key text;
begin
  if tg_op = 'DELETE' then
    v_brand_key := lower(trim(old.id));
    select org_id into v_org_id from public.client_portal_credentials where id = old.id;
    if v_org_id is null then
      -- Fallback: try to find org from the brand
      select b.org_id into v_org_id from public.brands b
      where b.brand_key = v_brand_key
      limit 1;
    end if;
    select id into v_brand_id from public.brands
    where org_id = v_org_id and brand_key = v_brand_key
    limit 1;
    if v_brand_id is not null then
      delete from public.portal_users where brand_id = v_brand_id;
    end if;
    return old;
  end if;

  -- For INSERT/UPDATE, use new
  v_brand_key := lower(trim(new.id));
  select org_id into v_org_id from public.client_portal_credentials where id = new.id;
  select id into v_brand_id from public.brands
  where org_id = v_org_id and brand_key = v_brand_key
  limit 1;
  
  if v_brand_id is null then
    return new;
  end if;

  if jsonb_typeof(new.data) = 'array' then
    -- Delete users no longer in the array
    delete from public.portal_users pu
    where pu.brand_id = v_brand_id
      and pu.username not in (
        select coalesce(u->>'username', '')
        from jsonb_array_elements(new.data) u
        where coalesce(u->>'username', '') <> ''
      );

    -- Upsert users from the array
    insert into public.portal_users (brand_id, username, password_hash, display_name, avatar)
    select
      v_brand_id,
      u->>'username',
      u->>'passwordHash',
      coalesce(u->>'displayName', ''),
      u->>'avatar'
    from jsonb_array_elements(new.data) u
    where coalesce(u->>'username', '') <> ''
      and coalesce(u->>'passwordHash', '') <> ''
    on conflict (brand_id, lower(trim(username))) do update
      set password_hash = excluded.password_hash,
          display_name = excluded.display_name,
          avatar = coalesce(excluded.avatar, portal_users.avatar),
          updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_credentials_to_portal_users on public.client_portal_credentials;
create trigger trg_sync_credentials_to_portal_users
  after insert or update or delete on public.client_portal_credentials
  for each row execute function public.sync_credentials_to_portal_users();

-- ── 3. ENCRYPTED PASSWORD VAULT (service_role only) ────────────────────────

create table if not exists public.portal_password_vault (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  encrypted_vault jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Migrate existing vault data from clients blob
do $$
declare
  vault_data jsonb;
  brand_record record;
begin
  for vault_data in
    select c.data->'portalPasswordVault' as vault
    from public.clients c
    where c.id = 'workspace'
      and c.data ? 'portalPasswordVault'
  loop
    for brand_record in
      select key, value from jsonb_each(vault_data.vault)
    loop
      insert into public.portal_password_vault (brand_id, encrypted_vault)
      select b.id, brand_record.value
      from public.brands b
      where b.brand_key = lower(trim(brand_record.key))
      on conflict (brand_id) do update
        set encrypted_vault = excluded.encrypted_vault, updated_at = now();
    end loop;
  end loop;
end $$;

-- ── 4. ADD TYPED COLUMNS TO client_records ─────────────────────────────────

-- Add proper columns for data that was previously only in the blob
do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'client_records' and column_name = 'colors')
  then
    alter table public.client_records add column colors jsonb not null default '{}'::jsonb;
    alter table public.client_records add column logos jsonb not null default '{}'::jsonb;
    alter table public.client_records add column contacts jsonb not null default '[]'::jsonb;
    alter table public.client_records add column social_logins jsonb not null default '{}'::jsonb;
    alter table public.client_records add column company_files jsonb not null default '[]'::jsonb;
    alter table public.client_records add column special_menus jsonb not null default '[]'::jsonb;
    alter table public.client_records add column photo_gallery_link text not null default '';
    alter table public.client_records add column business_type text not null default '';
    alter table public.client_records add column account_manager text not null default '';
  end if;
end $$;

-- Backfill typed columns from existing data
update public.client_records cr
set
  colors = coalesce(cr.data->'colors', '{}'::jsonb),
  logos = coalesce(cr.data->'logos', '{}'::jsonb),
  contacts = coalesce(cr.data->'contacts', '[]'::jsonb),
  social_logins = coalesce(cr.data->'socialLogins', '{}'::jsonb),
  company_files = coalesce(cr.data->'companyFiles', '[]'::jsonb),
  special_menus = coalesce(cr.data->'specialMenus', '[]'::jsonb),
  photo_gallery_link = coalesce(cr.data->>'photoGalleryLink', ''),
  business_type = coalesce(cr.data->>'businessType', ''),
  account_manager = coalesce(cr.data->>'accountManager', '')
where cr.data is not null and cr.data <> '{}'::jsonb;

-- ── 5. ADD AUDIT COLUMNS TO WORKSPACE TABLES ──────────────────────────────

do $$
declare
  tbl text;
  tables text[] := array[
    'cards', 'shoot_plans', 'video_ideas', 'admin_tasks', 'events',
    'meetings', 'team_members', 'client_records', 'brands', 'portal_users'
  ];
begin
  foreach tbl in array tables loop
    begin
      execute format('alter table public.%I add column created_by uuid references auth.users(id) default null;', tbl);
    exception when duplicate_column then null; end;
    begin
      execute format('alter table public.%I add column updated_by uuid references auth.users(id) default null;', tbl);
    exception when duplicate_column then null; end;
  end loop;
end $$;

-- ── 6. ADD brand_id FK TO CARDS AND OTHER CONTENT TABLES ───────────────────

-- This lets us query by brand directly instead of filtering by text client name
do $$
declare
  tbl text;
  tables text[] := array[
    'cards', 'shoot_plans', 'video_ideas', 'admin_tasks', 'events', 'meetings'
  ];
begin
  foreach tbl in array tables loop
    begin
      execute format('alter table public.%I add column brand_id uuid references public.brands(id) on delete set null;', tbl);
    exception when duplicate_column then null; end;
  end loop;
end $$;

-- Backfill brand_id on content tables by matching client name text -> brand_key
do $$
declare
  tbl text;
  tables text[] := array[
    'cards', 'shoot_plans', 'video_ideas', 'admin_tasks', 'events', 'meetings'
  ];
begin
  foreach tbl in array tables loop
    execute format($f$
      update public.%I t
      set brand_id = b.id
      from public.brands b
      where t.org_id = b.org_id
        and lower(trim(t.data->>'client')) = b.brand_key
        and t.brand_id is null
        and t.data ? 'client';
    $f$, tbl);
  end loop;
end $$;

-- ── 7. RLS POLICIES FOR NEW TABLES ─────────────────────────────────────────

-- brands
alter table public.brands enable row level security;

drop policy if exists brands_tenant_write on public.brands;
create policy brands_tenant_write on public.brands
  for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

drop policy if exists brands_anon_legacy_read on public.brands;
create policy brands_anon_legacy_read on public.brands
  for select to anon
  using (org_id = 'medici');

-- portal_users
alter table public.portal_users enable row level security;

drop policy if exists portal_users_tenant_write on public.portal_users;
create policy portal_users_tenant_write on public.portal_users
  for all to authenticated
  using (
    brand_id in (
      select b.id from public.brands b
      where b.org_id in (select public.user_org_ids())
    )
  )
  with check (
    brand_id in (
      select b.id from public.brands b
      where b.org_id in (select public.user_org_ids())
    )
  );

drop policy if exists portal_users_anon_legacy_read on public.portal_users;
create policy portal_users_anon_legacy_read on public.portal_users
  for select to anon
  using (
    brand_id in (
      select b.id from public.brands b where b.org_id = 'medici'
    )
  );

-- portal_password_vault — only service_role can read/write
alter table public.portal_password_vault enable row level security;

drop policy if exists portal_password_vault_service_role on public.portal_password_vault;
create policy portal_password_vault_service_role on public.portal_password_vault
  for all to service_role
  using (true)
  with check (true);

-- ── 8. REALTIME PUBLICATION ────────────────────────────────────────────────

alter publication supabase_realtime add table public.brands;
alter publication supabase_realtime add table public.portal_users;

-- ── 9. HELPER FUNCTION: get brand profile from normalized tables ───────────

create or replace function public.get_brand_profile(p_org_id text, p_brand_key text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'brandKey',    b.brand_key,
    'brandId',     b.id::text,
    'displayName', b.display_name,
    'clientColor', cr.colors->>b.brand_key,
    'clientLogo',  cr.logos->b.brand_key,
    'contacts',    coalesce(cr.contacts, '[]'::jsonb),
    'socialLogins', coalesce(cr.social_logins, '{}'::jsonb),
    'companyFiles', coalesce(cr.company_files, '[]'::jsonb),
    'specialMenus', coalesce(cr.special_menus, '[]'::jsonb),
    'photoGalleryLink', nullif(trim(cr.photo_gallery_link), ''),
    'businessType', cr.business_type,
    'accountManager', cr.account_manager,
    'contentTypeColors', coalesce(cr.data->'contentTypeColors', '{}'::jsonb)
  )
  from public.brands b
  left join public.client_records cr on cr.org_id = b.org_id and cr.brand_key = b.brand_key
  where b.org_id = p_org_id and b.brand_key = lower(trim(p_brand_key));
$$;

revoke all on function public.get_brand_profile(text, text) from public;
grant execute on function public.get_brand_profile(text, text) to service_role;

-- ── 10. HELPER FUNCTION: get portal users for a brand ──────────────────────

create or replace function public.get_brand_portal_users(p_org_id text, p_brand_key text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pu.id::text,
      'username', pu.username,
      'passwordHash', pu.password_hash,
      'displayName', pu.display_name,
      'avatar', pu.avatar
    )
  ), '[]'::jsonb)
  from public.portal_users pu
  join public.brands b on b.id = pu.brand_id
  where b.org_id = p_org_id and b.brand_key = lower(trim(p_brand_key));
$$;

revoke all on function public.get_brand_portal_users(text, text) from public;
grant execute on function public.get_brand_portal_users(text, text) to service_role;