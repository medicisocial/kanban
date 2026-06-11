-- ============================================================================
-- Migration 021: Normalize remaining workspace blobs
-- ============================================================================
-- Moves per-brand profile data to typed client_records columns, portal reset
-- tokens and staff logins to dedicated tables, and adds brand_id FKs on content.
-- Legacy clients / team_members / client_portal_credentials rows remain for sync
-- compatibility; triggers keep them updated during transition.
-- ============================================================================

-- ── 1. TYPED COLUMNS ON client_records (one row = one brand) ────────────────

alter table public.client_records
  add column if not exists client_color text not null default '',
  add column if not exists logo jsonb not null default '{}'::jsonb,
  add column if not exists contacts jsonb not null default '[]'::jsonb,
  add column if not exists social_logins jsonb not null default '{}'::jsonb,
  add column if not exists company_files jsonb not null default '[]'::jsonb,
  add column if not exists special_menus jsonb not null default '[]'::jsonb,
  add column if not exists photo_gallery_link text not null default '',
  add column if not exists business_type text not null default '',
  add column if not exists account_manager text not null default '';

-- Backfill typed columns from legacy data jsonb + clients workspace blob
do $$
declare
  rec record;
  ws jsonb;
  brand_name text;
begin
  select c.data into ws
  from public.clients c
  where c.id = 'workspace' and c.org_id = 'medici'
  limit 1;

  for rec in select * from public.client_records loop
    brand_name := rec.display_name;
    update public.client_records cr
    set
      client_color = coalesce(
        nullif(trim(ws->'colors'->>brand_name), ''),
        nullif(trim(ws->'colors'->>rec.brand_key), ''),
        nullif(trim(rec.data->>'colors'), ''),
        nullif(trim(rec.data->'colors'->>rec.brand_key), ''),
        cr.client_color
      ),
      logo = coalesce(
        ws->'logos'->brand_name,
        ws->'logos'->rec.brand_key,
        rec.data->'logos',
        cr.logo
      ),
      contacts = coalesce(
        ws->'contacts'->brand_name,
        ws->'contacts'->rec.brand_key,
        rec.data->'contacts',
        cr.contacts
      ),
      social_logins = coalesce(
        ws->'socialLogins'->brand_name,
        ws->'socialLogins'->rec.brand_key,
        rec.data->'socialLogins',
        cr.social_logins
      ),
      company_files = coalesce(
        ws->'companyFiles'->brand_name,
        ws->'companyFiles'->rec.brand_key,
        rec.data->'companyFiles',
        cr.company_files
      ),
      special_menus = coalesce(
        ws->'specialMenus'->brand_name,
        ws->'specialMenus'->rec.brand_key,
        rec.data->'specialMenus',
        cr.special_menus
      ),
      photo_gallery_link = coalesce(
        nullif(trim(ws->'photoGalleryLinks'->>brand_name), ''),
        nullif(trim(ws->'photoGalleryLinks'->>rec.brand_key), ''),
        nullif(trim(rec.data->>'photoGalleryLink'), ''),
        cr.photo_gallery_link
      ),
      business_type = coalesce(
        nullif(trim(ws->'businessTypes'->>brand_name), ''),
        nullif(trim(ws->'businessTypes'->>rec.brand_key), ''),
        nullif(trim(rec.data->>'businessType'), ''),
        cr.business_type
      ),
      account_manager = coalesce(
        nullif(trim(ws->'accountManagers'->>brand_name), ''),
        nullif(trim(ws->'accountManagers'->>rec.brand_key), ''),
        nullif(trim(rec.data->>'accountManager'), ''),
        cr.account_manager
      ),
      updated_at = now()
    where cr.id = rec.id;
  end loop;

  -- Create records for brands listed in workspace names but missing from client_records
  if ws is not null and jsonb_typeof(ws->'names') = 'array' then
    for brand_name in
      select jsonb_array_elements_text(ws->'names')
    loop
      if trim(brand_name) = '' or brand_name like '\__%' escape '\' then
        continue;
      end if;
      insert into public.client_records (
        org_id, brand_key, display_name,
        client_color, logo, contacts, social_logins, company_files, special_menus,
        photo_gallery_link, business_type, account_manager, data
      )
      values (
        'medici',
        lower(trim(brand_name)),
        trim(brand_name),
        coalesce(nullif(trim(ws->'colors'->>brand_name), ''), '#9ca3af'),
        coalesce(ws->'logos'->brand_name, '{}'::jsonb),
        coalesce(ws->'contacts'->brand_name, '[]'::jsonb),
        coalesce(ws->'socialLogins'->brand_name, '{}'::jsonb),
        coalesce(ws->'companyFiles'->brand_name, '[]'::jsonb),
        coalesce(ws->'specialMenus'->brand_name, '[]'::jsonb),
        coalesce(ws->'photoGalleryLinks'->>brand_name, ''),
        coalesce(ws->'businessTypes'->>brand_name, ''),
        coalesce(ws->'accountManagers'->>brand_name, ''),
        '{}'::jsonb
      )
      on conflict (org_id, brand_key) do nothing;
    end loop;
  end if;
end $$;

-- Keep legacy clients blob in sync for apps not yet on normalized reads
create or replace function public.sync_client_record_to_blob()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_name text := new.display_name;
  v_data jsonb;
begin
  select c.data into v_data
  from public.clients c
  where c.id = 'workspace' and c.org_id = new.org_id
  for update;

  if v_data is null then
    v_data := '{}'::jsonb;
  end if;

  if not coalesce(v_data->'names', '[]'::jsonb) @> to_jsonb(v_name) then
    v_data := jsonb_set(
      v_data,
      '{names}',
      coalesce(v_data->'names', '[]'::jsonb) || to_jsonb(v_name),
      true
    );
  end if;

  v_data := jsonb_set(v_data, array['colors', v_name], to_jsonb(coalesce(new.client_color, '')), true);
  v_data := jsonb_set(v_data, array['logos', v_name], coalesce(new.logo, '{}'::jsonb), true);
  v_data := jsonb_set(v_data, array['contacts', v_name], coalesce(new.contacts, '[]'::jsonb), true);
  v_data := jsonb_set(v_data, array['socialLogins', v_name], coalesce(new.social_logins, '{}'::jsonb), true);
  v_data := jsonb_set(v_data, array['companyFiles', v_name], coalesce(new.company_files, '[]'::jsonb), true);
  v_data := jsonb_set(v_data, array['specialMenus', v_name], coalesce(new.special_menus, '[]'::jsonb), true);
  v_data := jsonb_set(v_data, array['photoGalleryLinks', v_name], to_jsonb(coalesce(new.photo_gallery_link, '')), true);
  v_data := jsonb_set(v_data, array['businessTypes', v_name], to_jsonb(coalesce(new.business_type, '')), true);
  v_data := jsonb_set(
    v_data,
    array['accountManagers', v_name],
    to_jsonb(coalesce(new.account_manager, '')),
    true
  );

  update public.clients
  set data = v_data, updated_at = greatest(updated_at, new.updated_at)
  where id = 'workspace' and org_id = new.org_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_client_record_to_blob on public.client_records;
create trigger trg_sync_client_record_to_blob
  after insert or update on public.client_records
  for each row execute function public.sync_client_record_to_blob();

-- ── 2. PORTAL PASSWORD RESET TOKENS (leave clients blob) ─────────────────────

create table if not exists public.portal_password_reset_tokens (
  token text primary key,
  org_id text not null references public.organizations (id) on delete cascade,
  brand_key text not null,
  username text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists portal_password_reset_tokens_expires_idx
  on public.portal_password_reset_tokens (expires_at);

-- Migrate existing tokens out of clients blob
do $$
declare
  ws jsonb;
  token_entry record;
begin
  select c.data into ws from public.clients c
  where c.id = 'workspace' and c.org_id = 'medici' limit 1;
  if ws is null or not (ws ? '_passwordResetTokens') then return; end if;
  for token_entry in select key, value from jsonb_each(ws->'_passwordResetTokens') loop
    insert into public.portal_password_reset_tokens (token, org_id, brand_key, username, expires_at)
    values (
      token_entry.key,
      coalesce(token_entry.value->>'orgId', 'medici'),
      lower(trim(coalesce(token_entry.value->>'brand', ''))),
      lower(trim(coalesce(token_entry.value->>'username', ''))),
      to_timestamp((coalesce((token_entry.value->>'expires')::bigint, 0)) / 1000.0)
    )
    on conflict (token) do nothing;
  end loop;
end $$;

alter table public.portal_password_reset_tokens enable row level security;
drop policy if exists portal_password_reset_tokens_service on public.portal_password_reset_tokens;
create policy portal_password_reset_tokens_service on public.portal_password_reset_tokens
  for all to service_role using (true) with check (true);

-- ── 3. STAFF ACCOUNTS (typed login rows) ─────────────────────────────────────

create table if not exists public.staff_accounts (
  member_id text not null,
  org_id text not null references public.organizations (id) on delete cascade,
  username text not null default '',
  email text not null default '',
  password text not null default '',
  name text not null default '',
  roles jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (org_id, member_id)
);

create index if not exists staff_accounts_org_username_idx
  on public.staff_accounts (org_id, lower(trim(username)));

insert into public.staff_accounts (member_id, org_id, username, email, password, name, roles, updated_at)
select
  tm.id,
  tm.org_id,
  lower(trim(coalesce(tm.data->>'username', tm.data->>'email', ''))),
  lower(trim(coalesce(tm.data->>'email', tm.data->>'username', ''))),
  coalesce(tm.data->>'password', ''),
  coalesce(tm.data->>'name', ''),
  case when jsonb_typeof(tm.data->'roles') = 'array' then tm.data->'roles' else '[]'::jsonb end,
  tm.updated_at
from public.team_members tm
on conflict (org_id, member_id) do update
  set username = excluded.username,
      email = excluded.email,
      password = excluded.password,
      name = excluded.name,
      roles = excluded.roles,
      updated_at = excluded.updated_at;

create or replace function public.sync_team_member_to_staff_account()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.staff_accounts where org_id = old.org_id and member_id = old.id;
    return old;
  end if;
  insert into public.staff_accounts (member_id, org_id, username, email, password, name, roles, updated_at)
  values (
    new.id,
    new.org_id,
    lower(trim(coalesce(new.data->>'username', new.data->>'email', ''))),
    lower(trim(coalesce(new.data->>'email', new.data->>'username', ''))),
    coalesce(new.data->>'password', ''),
    coalesce(new.data->>'name', ''),
    case when jsonb_typeof(new.data->'roles') = 'array' then new.data->'roles' else '[]'::jsonb end,
    now()
  )
  on conflict (org_id, member_id) do update
    set username = excluded.username,
        email = excluded.email,
        password = coalesce(nullif(excluded.password, ''), staff_accounts.password),
        name = coalesce(nullif(excluded.name, ''), staff_accounts.name),
        roles = case
          when jsonb_array_length(excluded.roles) > 0 then excluded.roles
          else staff_accounts.roles
        end,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_team_member_to_staff_account on public.team_members;
create trigger trg_sync_team_member_to_staff_account
  after insert or update or delete on public.team_members
  for each row execute function public.sync_team_member_to_staff_account();

alter table public.staff_accounts enable row level security;
drop policy if exists staff_accounts_service on public.staff_accounts;
create policy staff_accounts_service on public.staff_accounts
  for all to service_role using (true) with check (true);

-- ── 4. brand_id ON CONTENT TABLES ────────────────────────────────────────────

do $$
declare
  tbl text;
  tables text[] := array[
    'cards', 'shoot_plans', 'video_ideas', 'admin_tasks', 'events', 'meetings'
  ];
begin
  foreach tbl in array tables loop
    begin
      execute format(
        'alter table public.%I add column brand_id uuid references public.brands(id) on delete set null;',
        tbl
      );
    exception when duplicate_column then null;
    end;
  end loop;
end $$;

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

-- ── 5. RPC: brand profile read/write ─────────────────────────────────────────

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
    'clientColor', nullif(trim(cr.client_color), ''),
    'clientLogo',  cr.logo,
    'contacts',    coalesce(cr.contacts, '[]'::jsonb),
    'socialLogins', coalesce(cr.social_logins, '{}'::jsonb),
    'companyFiles', coalesce(cr.company_files, '[]'::jsonb),
    'specialMenus', coalesce(cr.special_menus, '[]'::jsonb),
    'photoGalleryLink', nullif(trim(cr.photo_gallery_link), ''),
    'businessType', cr.business_type,
    'accountManager', cr.account_manager
  )
  from public.brands b
  left join public.client_records cr
    on cr.org_id = b.org_id and cr.brand_key = b.brand_key
  where b.org_id = p_org_id
    and b.brand_key = lower(trim(p_brand_key));
$$;

create or replace function public.patch_brand_profile(
  p_org_id text,
  p_brand_key text,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_brand_key text := lower(trim(p_brand_key));
begin
  if v_brand_key = '' then
    raise exception 'brand key required';
  end if;

  insert into public.client_records (
    org_id, brand_key, display_name,
    client_color, logo, contacts, social_logins, company_files, special_menus,
    photo_gallery_link, business_type, account_manager, data, updated_at
  )
  values (
    p_org_id,
    v_brand_key,
    coalesce(nullif(trim(p_patch->>'displayName'), ''), v_brand_key),
    coalesce(p_patch->>'clientColor', ''),
    coalesce(p_patch->'clientLogo', '{}'::jsonb),
    coalesce(p_patch->'contacts', '[]'::jsonb),
    coalesce(p_patch->'socialLogins', '{}'::jsonb),
    coalesce(p_patch->'companyFiles', '[]'::jsonb),
    coalesce(p_patch->'specialMenus', '[]'::jsonb),
    coalesce(p_patch->>'photoGalleryLink', ''),
    coalesce(p_patch->>'businessType', ''),
    coalesce(p_patch->>'accountManager', ''),
    '{}'::jsonb,
    now()
  )
  on conflict (org_id, brand_key) do update
    set
      display_name = coalesce(nullif(excluded.display_name, ''), client_records.display_name),
      client_color = case when p_patch ? 'clientColor' then excluded.client_color else client_records.client_color end,
      logo = case when p_patch ? 'clientLogo' then excluded.logo else client_records.logo end,
      contacts = case when p_patch ? 'contacts' then excluded.contacts else client_records.contacts end,
      social_logins = case when p_patch ? 'socialLogins' then excluded.social_logins else client_records.social_logins end,
      company_files = case when p_patch ? 'companyFiles' then excluded.company_files else client_records.company_files end,
      special_menus = case when p_patch ? 'specialMenus' then excluded.special_menus else client_records.special_menus end,
      photo_gallery_link = case when p_patch ? 'photoGalleryLink' then excluded.photo_gallery_link else client_records.photo_gallery_link end,
      business_type = case when p_patch ? 'businessType' then excluded.business_type else client_records.business_type end,
      account_manager = case when p_patch ? 'accountManager' then excluded.account_manager else client_records.account_manager end,
      updated_at = now();
end;
$$;

revoke all on function public.get_brand_profile(text, text) from public;
grant execute on function public.get_brand_profile(text, text) to service_role, authenticated, anon;

revoke all on function public.patch_brand_profile(text, text, jsonb) from public;
grant execute on function public.patch_brand_profile(text, text, jsonb) to service_role;
