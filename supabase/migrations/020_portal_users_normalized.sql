-- ============================================================================
-- Migration 020: Normalized portal users + password vault (018 portal subset)
-- ============================================================================
-- Creates brands, portal_users, portal_password_vault with backfill from
-- client_records / client_portal_credentials / clients blob vault.
-- Adds service-role RPCs for vault read/write on the normalized table.
-- Legacy client_portal_credentials + triggers remain for auth-critical path.
-- ============================================================================

-- ── 1. BRANDS ───────────────────────────────────────────────────────────────

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  brand_key text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, brand_key)
);

insert into public.brands (org_id, brand_key, display_name, created_at, updated_at)
select cr.org_id, cr.brand_key, cr.display_name, cr.created_at, cr.updated_at
from public.client_records cr
on conflict (org_id, brand_key) do update
  set display_name = excluded.display_name,
      updated_at = now();

create or replace function public.sync_client_record_to_brand()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.brands (org_id, brand_key, display_name)
  values (new.org_id, new.brand_key, new.display_name)
  on conflict (org_id, brand_key) do update
    set display_name = excluded.display_name, updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_client_record_to_brand on public.client_records;
create trigger trg_sync_client_record_to_brand
  after insert or update on public.client_records
  for each row execute function public.sync_client_record_to_brand();

-- ── 2. PORTAL USERS ─────────────────────────────────────────────────────────

create table if not exists public.portal_users (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  username text not null,
  password_hash text not null,
  display_name text not null default '',
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists portal_users_brand_username_idx
  on public.portal_users (brand_id, lower(trim(username)));

create index if not exists portal_users_brand_id_idx on public.portal_users (brand_id);

-- Backfill from client_portal_credentials
do $$
declare
  cred record;
  v_brand_id uuid;
  user_rec record;
  v_user_id uuid;
begin
  for cred in
    select cpc.org_id, cpc.id as brand_key, cpc.data
    from public.client_portal_credentials cpc
    where jsonb_typeof(cpc.data) = 'array'
  loop
    select id into v_brand_id
    from public.brands
    where org_id = cred.org_id and brand_key = lower(trim(cred.brand_key))
    limit 1;

    if v_brand_id is null then
      continue;
    end if;

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
      begin
        v_user_id := user_rec.user_id::uuid;
      exception when others then
        v_user_id := gen_random_uuid();
      end;

      insert into public.portal_users (id, brand_id, username, password_hash, display_name, avatar)
      values (
        v_user_id,
        v_brand_id,
        user_rec.username,
        lower(trim(user_rec.password_hash)),
        user_rec.display_name,
        user_rec.avatar
      )
      on conflict (brand_id, lower(trim(username))) do update
        set password_hash = excluded.password_hash,
            display_name = excluded.display_name,
            avatar = coalesce(excluded.avatar, portal_users.avatar),
            updated_at = now();
    end loop;
  end loop;
end $$;

-- Keep portal_users in sync when legacy credentials row changes
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
    v_org_id := old.org_id;
    select id into v_brand_id from public.brands
    where org_id = v_org_id and brand_key = v_brand_key limit 1;
    if v_brand_id is not null then
      delete from public.portal_users where brand_id = v_brand_id;
    end if;
    return old;
  end if;

  v_brand_key := lower(trim(new.id));
  v_org_id := new.org_id;
  select id into v_brand_id from public.brands
  where org_id = v_org_id and brand_key = v_brand_key limit 1;

  if v_brand_id is null then
    return new;
  end if;

  if jsonb_typeof(new.data) = 'array' then
    delete from public.portal_users pu
    where pu.brand_id = v_brand_id
      and lower(trim(pu.username)) not in (
        select lower(trim(coalesce(u->>'username', '')))
        from jsonb_array_elements(new.data) u
        where coalesce(u->>'username', '') <> ''
      );

    insert into public.portal_users (id, brand_id, username, password_hash, display_name, avatar)
    select
      coalesce(
        case
          when coalesce(u->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (u->>'id')::uuid
          else gen_random_uuid()
        end,
        gen_random_uuid()
      ),
      v_brand_id,
      u->>'username',
      lower(trim(u->>'passwordHash')),
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

-- ── 3. PASSWORD VAULT (normalized table) ────────────────────────────────────

create table if not exists public.portal_password_vault (
  brand_id uuid primary key references public.brands (id) on delete cascade,
  encrypted_vault jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Backfill from clients workspace blob
do $$
declare
  vault_root jsonb;
  brand_entry record;
  v_brand_id uuid;
begin
  select c.data->'portalPasswordVault' into vault_root
  from public.clients c
  where c.id = 'workspace' and c.org_id = 'medici'
  limit 1;

  if vault_root is null or jsonb_typeof(vault_root) <> 'object' then
    return;
  end if;

  for brand_entry in
    select key, value from jsonb_each(vault_root)
  loop
    select id into v_brand_id
    from public.brands
    where org_id = 'medici' and brand_key = lower(trim(brand_entry.key))
    limit 1;

    if v_brand_id is not null and jsonb_typeof(brand_entry.value) = 'object' then
      insert into public.portal_password_vault (brand_id, encrypted_vault, updated_at)
      values (v_brand_id, brand_entry.value, now())
      on conflict (brand_id) do update
        set encrypted_vault = excluded.encrypted_vault,
            updated_at = now();
    end if;
  end loop;
end $$;

-- ── 4. RPC: normalized vault read/write (service_role only) ─────────────────

create or replace function public.get_portal_password_vault(p_org_id text, p_brand_key text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(ppv.encrypted_vault, '{}'::jsonb)
  from public.portal_password_vault ppv
  join public.brands b on b.id = ppv.brand_id
  where b.org_id = p_org_id
    and b.brand_key = lower(trim(p_brand_key));
$$;

create or replace function public.patch_portal_password_vault(
  p_org_id text,
  p_brand_key text,
  p_brand_vault jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_brand_id uuid;
begin
  select id into v_brand_id
  from public.brands
  where org_id = p_org_id and brand_key = lower(trim(p_brand_key))
  limit 1;

  if v_brand_id is null then
    raise exception 'brand not found for org % key %', p_org_id, p_brand_key;
  end if;

  insert into public.portal_password_vault (brand_id, encrypted_vault, updated_at)
  values (v_brand_id, coalesce(p_brand_vault, '{}'::jsonb), now())
  on conflict (brand_id) do update
    set encrypted_vault = portal_password_vault.encrypted_vault || coalesce(p_brand_vault, '{}'::jsonb),
        updated_at = now();
end;
$$;

revoke all on function public.get_portal_password_vault(text, text) from public;
grant execute on function public.get_portal_password_vault(text, text) to service_role;

revoke all on function public.patch_portal_password_vault(text, text, jsonb) from public;
grant execute on function public.patch_portal_password_vault(text, text, jsonb) to service_role;

-- ── 5. RPC: portal users (from 018) ─────────────────────────────────────────

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

-- ── 6. RLS ──────────────────────────────────────────────────────────────────

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
    brand_id in (select b.id from public.brands b where b.org_id = 'medici')
  );

alter table public.portal_password_vault enable row level security;

drop policy if exists portal_password_vault_service_role on public.portal_password_vault;
create policy portal_password_vault_service_role on public.portal_password_vault
  for all to service_role
  using (true)
  with check (true);

-- ── 7. REALTIME ─────────────────────────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.brands;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.portal_users;
exception when duplicate_object then null;
end $$;
