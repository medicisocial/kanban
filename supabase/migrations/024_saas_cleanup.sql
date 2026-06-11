-- SaaS cleanup: client names off clients blob; portal_users as primary auth store.

-- ── 1. Strip names from clients workspace blob (names live on brands/client_records) ──

update public.clients
set data = jsonb_strip_nulls(
  jsonb_build_object(
    'removedNames', coalesce(data->'removedNames', '{}'::jsonb),
    'restoredNames', coalesce(data->'restoredNames', '{}'::jsonb),
    'contentTypeColors', coalesce(data->'contentTypeColors', '{}'::jsonb),
    'customColorPalette', coalesce(data->'customColorPalette', '[]'::jsonb)
  )
)
where id = 'workspace';

insert into public.brands (org_id, brand_key, display_name)
select cr.org_id, cr.brand_key, cr.display_name
from public.client_records cr
on conflict (org_id, brand_key) do update
  set display_name = excluded.display_name,
      updated_at = now();

-- ── 2. Protect portal_users (mirror client_portal_credentials guards) ─────────

create or replace function public.protect_portal_users_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  allow_change boolean := coalesce(current_setting('app.portal_password_change_ok', true), '') = 'true';
  old_hash text := lower(trim(coalesce(old.password_hash, '')));
  new_hash text := lower(trim(coalesce(new.password_hash, '')));
  remaining int;
begin
  if tg_op = 'DELETE' then
    select count(*)::int into remaining
    from public.portal_users pu
    where pu.brand_id = old.brand_id
      and pu.id <> old.id
      and coalesce(pu.username, '') <> ''
      and coalesce(pu.password_hash, '') <> '';

    if remaining = 0 then
      select count(*)::int into remaining
      from public.portal_users pu
      where pu.brand_id = old.brand_id
        and pu.id <> old.id;
      if remaining = 0 then
        -- Allow deleting the last row when the brand is being removed.
        return old;
      end if;
      raise exception 'Cannot remove the last configured portal login for this brand.';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new_hash = '' then
      raise exception 'Portal user password hash is required.';
    end if;
    return new;
  end if;

  -- UPDATE
  if new_hash = '' and old_hash <> '' then
    new.password_hash := old.password_hash;
    new_hash := old_hash;
  end if;

  if old_hash <> '' and new_hash <> old_hash and not allow_change then
    new.password_hash := old.password_hash;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_portal_users_row on public.portal_users;
create trigger trg_protect_portal_users_row
  before insert or update or delete on public.portal_users
  for each row execute function public.protect_portal_users_row();

-- ── 3. RPC: replace all portal users for one brand (service_role) ─────────────

create or replace function public.replace_brand_portal_users(
  p_org_id text,
  p_brand_key text,
  p_users jsonb,
  p_allow_password_change boolean default false,
  p_allow_empty boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_brand_id uuid;
  v_brand_key text := lower(trim(p_brand_key));
  v_user jsonb;
  v_user_id uuid;
  v_username text;
  v_hash text;
  v_display text;
  v_avatar text;
  v_keep_usernames text[] := array[]::text[];
  v_result jsonb := '[]'::jsonb;
begin
  if v_brand_key = '' then
    raise exception 'brand key required';
  end if;

  select id into v_brand_id
  from public.brands
  where org_id = p_org_id and brand_key = v_brand_key
  limit 1;

  if v_brand_id is null then
    raise exception 'brand not found';
  end if;

  if p_allow_password_change then
    perform set_config('app.portal_password_change_ok', 'true', true);
  end if;

  if jsonb_typeof(p_users) <> 'array' then
    raise exception 'users must be an array';
  end if;

  for v_user in select value from jsonb_array_elements(p_users) loop
    v_username := lower(trim(coalesce(v_user->>'username', '')));
    v_hash := lower(trim(coalesce(v_user->>'passwordHash', '')));
    if v_username = '' or v_hash = '' then
      continue;
    end if;
    v_keep_usernames := array_append(v_keep_usernames, v_username);

    begin
      v_user_id := (v_user->>'id')::uuid;
    exception when others then
      v_user_id := gen_random_uuid();
    end;

    v_display := coalesce(v_user->>'displayName', '');
    v_avatar := v_user->>'avatar';

    insert into public.portal_users (id, brand_id, username, password_hash, display_name, avatar, updated_at)
    values (v_user_id, v_brand_id, v_user->>'username', v_hash, v_display, v_avatar, now())
    on conflict (brand_id, lower(trim(username))) do update
      set password_hash = excluded.password_hash,
          display_name = excluded.display_name,
          avatar = coalesce(excluded.avatar, portal_users.avatar),
          updated_at = now();

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'id', v_user_id::text,
        'username', v_user->>'username',
        'passwordHash', v_hash,
        'displayName', v_display,
        'avatar', v_avatar
      )
    );
  end loop;

  if coalesce(array_length(v_keep_usernames, 1), 0) = 0 then
    if not p_allow_empty then
      raise exception 'At least one portal user with username and password is required.';
    end if;
    delete from public.portal_users pu where pu.brand_id = v_brand_id;
    delete from public.client_portal_credentials
    where org_id = p_org_id and id = v_brand_key;
    return '[]'::jsonb;
  end if;

  delete from public.portal_users pu
  where pu.brand_id = v_brand_id
    and lower(trim(pu.username)) <> all (v_keep_usernames);

  return v_result;
end;
$$;

revoke all on function public.replace_brand_portal_users(text, text, jsonb, boolean, boolean) from public;
grant execute on function public.replace_brand_portal_users(text, text, jsonb, boolean, boolean) to service_role;

-- ── 4. RPC: cross-org login lookup from portal_users ──────────────────────────

create or replace function public.fetch_portal_users_for_login()
returns table (
  brand_key text,
  org_id text,
  user_id text,
  username text,
  password_hash text,
  display_name text,
  avatar text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.brand_key,
    b.org_id,
    pu.id::text,
    pu.username,
    pu.password_hash,
    pu.display_name,
    pu.avatar
  from public.portal_users pu
  join public.brands b on b.id = pu.brand_id
  where coalesce(pu.username, '') <> ''
    and coalesce(pu.password_hash, '') <> ''
    and not b.brand_key like '__%';
$$;

revoke all on function public.fetch_portal_users_for_login() from public;
grant execute on function public.fetch_portal_users_for_login() to service_role;

-- ── 5. Keep legacy client_portal_credentials in sync (read compat / staff-sync) ─

create or replace function public.sync_portal_users_to_credentials()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_brand_id uuid;
  v_org_id text;
  v_brand_key text;
  v_users jsonb;
begin
  if tg_op = 'DELETE' then
    v_brand_id := old.brand_id;
  else
    v_brand_id := new.brand_id;
  end if;

  select b.org_id, b.brand_key into v_org_id, v_brand_key
  from public.brands b
  where b.id = v_brand_id
  limit 1;

  if v_org_id is null or v_brand_key is null then
    return coalesce(new, old);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pu.id::text,
      'username', pu.username,
      'passwordHash', pu.password_hash,
      'displayName', pu.display_name,
      'avatar', pu.avatar
    )
  ), '[]'::jsonb)
  into v_users
  from public.portal_users pu
  where pu.brand_id = v_brand_id
    and coalesce(pu.username, '') <> ''
    and coalesce(pu.password_hash, '') <> '';

  if coalesce(jsonb_array_length(v_users), 0) = 0 then
    delete from public.client_portal_credentials
    where org_id = v_org_id and id = v_brand_key;
  else
    insert into public.client_portal_credentials (id, org_id, data, updated_at)
    values (v_brand_key, v_org_id, v_users, now())
    on conflict (org_id, id) do update
      set data = excluded.data,
          updated_at = now();
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_portal_users_to_credentials on public.portal_users;
create trigger trg_sync_portal_users_to_credentials
  after insert or update or delete on public.portal_users
  for each row execute function public.sync_portal_users_to_credentials();

-- Legacy direction superseded — portal_users is now source of truth.
drop trigger if exists trg_sync_credentials_to_portal_users on public.client_portal_credentials;

-- ── 6. Org brand list RPC (replaces clients.data.names) ─────────────────────

create or replace function public.get_org_brand_names(p_org_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(b.display_name order by lower(b.display_name)), '[]'::jsonb)
  from public.brands b
  where b.org_id = p_org_id
    and not b.brand_key like '__%';
$$;

revoke all on function public.get_org_brand_names(text) from public;
grant execute on function public.get_org_brand_names(text) to service_role, authenticated, anon;
