-- Phases 1–4: staff password hashing + force reset of exposed accounts.
-- Depends on 040_revoke_team_members_anon_read.sql (anon SELECT revoked).

-- ── 1. password_hash column on staff_accounts ────────────────────────────────

alter table public.staff_accounts
  add column if not exists password_hash text not null default '';

-- ── 2. Replace guards BEFORE mutating rows (old protect_* reattached plaintext) ─

create or replace function public.protect_team_member_login()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(new.data) = 'object' then
    -- Always strip secrets from the blob (hashes live on staff_accounts).
    new.data := new.data - 'password' - 'password_hash' - 'passwordHash';

    if jsonb_typeof(old.data) = 'object' then
      if coalesce(new.data->>'email', '') = '' and coalesce(old.data->>'email', '') <> '' then
        new.data := jsonb_set(new.data, '{email}', old.data->'email', true);
      end if;
      if coalesce(new.data->>'username', '') = '' and coalesce(old.data->>'username', '') <> '' then
        new.data := jsonb_set(new.data, '{username}', old.data->'username', true);
      end if;
      if coalesce(jsonb_array_length(case when jsonb_typeof(new.data->'roles')='array' then new.data->'roles' else '[]'::jsonb end), 0) = 0
         and coalesce(jsonb_array_length(case when jsonb_typeof(old.data->'roles')='array' then old.data->'roles' else '[]'::jsonb end), 0) > 0 then
        new.data := jsonb_set(new.data, '{roles}', old.data->'roles', true);
      end if;
      if coalesce(new.data->>'name', '') = '' and coalesce(old.data->>'name', '') <> '' then
        new.data := jsonb_set(new.data, '{name}', old.data->'name', true);
      end if;
      if new.data->>'hasPassword' is null and old.data ? 'hasPassword' then
        new.data := jsonb_set(new.data, '{hasPassword}', old.data->'hasPassword', true);
      end if;
    end if;
  end if;
  return new;
end;
$$;

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

  insert into public.staff_accounts (
    member_id, org_id, username, email, password, password_hash, name, roles, updated_at
  )
  values (
    new.id,
    new.org_id,
    lower(trim(coalesce(new.data->>'username', new.data->>'email', ''))),
    lower(trim(coalesce(new.data->>'email', new.data->>'username', ''))),
    '', -- never store plaintext
    coalesce(nullif(new.data->>'password_hash', ''), nullif(new.data->>'passwordHash', ''), ''),
    coalesce(new.data->>'name', ''),
    case when jsonb_typeof(new.data->'roles') = 'array' then new.data->'roles' else '[]'::jsonb end,
    now()
  )
  on conflict (org_id, member_id) do update
    set username = excluded.username,
        email = excluded.email,
        password = '',
        password_hash = case
          when coalesce(excluded.password_hash, '') <> '' then excluded.password_hash
          else staff_accounts.password_hash
        end,
        name = coalesce(nullif(excluded.name, ''), staff_accounts.name),
        roles = case
          when jsonb_array_length(excluded.roles) > 0 then excluded.roles
          else staff_accounts.roles
        end,
        updated_at = now();
  return new;
end;
$$;

-- ── 3. Force-reset exposed accounts (do NOT silently re-hash plaintext) ──────

update public.staff_accounts
set
  password = '',
  password_hash = '',
  updated_at = now()
where org_id = 'medici'
  and member_id in (
    '221c3dc0-128e-48e6-91b6-1d96bb766ecf', -- Jonathan Nguyễn
    'team-valerie-landeros'                 -- Valerie Landeros
  );

-- Clear any remaining plaintext leftovers on all orgs.
update public.staff_accounts
set
  password = '',
  updated_at = now()
where coalesce(password, '') <> '';

-- Strip plaintext / hash keys from team_members blobs.
update public.team_members
set
  data = (coalesce(data, '{}'::jsonb) - 'password' - 'password_hash' - 'passwordHash')
    || jsonb_build_object('hasPassword', false),
  updated_at = now()
where data ? 'password'
   or data ? 'password_hash'
   or data ? 'passwordHash'
   or coalesce(data->>'password', '') <> '';

-- Ensure the two exposed members are flagged as needing a new password.
update public.team_members
set
  data = (coalesce(data, '{}'::jsonb) - 'password' - 'password_hash' - 'passwordHash')
    || jsonb_build_object('hasPassword', false),
  updated_at = now()
where org_id = 'medici'
  and id in (
    '221c3dc0-128e-48e6-91b6-1d96bb766ecf',
    'team-valerie-landeros'
  );

-- Re-clear hashes after team_members updates (sync trigger preserves hash when
-- incoming blob has no password_hash — keep force-reset authoritative).
update public.staff_accounts
set
  password = '',
  password_hash = '',
  updated_at = now()
where org_id = 'medici'
  and member_id in (
    '221c3dc0-128e-48e6-91b6-1d96bb766ecf',
    'team-valerie-landeros'
  );
