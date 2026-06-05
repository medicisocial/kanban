-- Durable, app-independent safeguards so login data can never be silently wiped
-- by any write path (desktop direct upsert, staff-sync API, scripts, or future code).
--
-- Login data lives in JSONB workspace rows and is written by two separate paths
-- (browser Supabase client on desktop, /api/staff-sync on mobile) each with its
-- own app-level guard. These triggers enforce the invariant at the database layer
-- so the two paths — and any future change — can never drop a client or staff login.

-- Count portal users that carry both a username and a password hash.
create or replace function public.count_valid_portal_users(p_data jsonb)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select count(*)::int
  from jsonb_array_elements(
    case when jsonb_typeof(p_data) = 'array' then p_data else '[]'::jsonb end
  ) as u
  where coalesce(u->>'username','') <> ''
    and coalesce(u->>'passwordHash','') <> '';
$$;

-- BEFORE UPDATE guard for client portal logins:
--   1. Re-attach any password hash that an incoming write blanked out
--      (matched by user id or username) using the existing row.
--   2. Refuse to reduce a configured credentials row down to zero valid logins
--      (the classic "client login stopped working" failure) by keeping the old row.
create or replace function public.protect_client_portal_credentials()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  old_valid int;
  new_valid int;
  repaired jsonb;
begin
  old_valid := public.count_valid_portal_users(old.data);

  if jsonb_typeof(new.data) = 'array' then
    select jsonb_agg(
      case
        when coalesce(nu->>'passwordHash','') = '' then
          coalesce(
            (
              select ou
              from jsonb_array_elements(
                case when jsonb_typeof(old.data) = 'array' then old.data else '[]'::jsonb end
              ) ou
              where (
                  coalesce(ou->>'id','') = coalesce(nu->>'id','')
                  or lower(coalesce(ou->>'username','')) = lower(coalesce(nu->>'username',''))
                )
                and coalesce(ou->>'passwordHash','') <> ''
              limit 1
            ),
            nu
          )
        else nu
      end
    )
    into repaired
    from jsonb_array_elements(new.data) nu;

    new.data := coalesce(repaired, new.data);
  end if;

  new_valid := public.count_valid_portal_users(new.data);

  if old_valid > 0 and new_valid = 0 then
    raise warning 'protect_client_portal_credentials: blocked wipe of % (had % valid logins); keeping existing row', new.id, old_valid;
    new.data := old.data;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_client_portal_credentials on public.client_portal_credentials;
create trigger trg_protect_client_portal_credentials
before update on public.client_portal_credentials
for each row execute function public.protect_client_portal_credentials();

-- BEFORE UPDATE guard for team member logins: preserve the login secret and
-- identity if an edit to other fields omits or blanks them.
create or replace function public.protect_team_member_login()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(new.data) = 'object' and jsonb_typeof(old.data) = 'object' then
    if coalesce(new.data->>'password','') = '' and coalesce(old.data->>'password','') <> '' then
      new.data := jsonb_set(new.data, '{password}', old.data->'password', true);
    end if;
    if coalesce(new.data->>'email','') = '' and coalesce(old.data->>'email','') <> '' then
      new.data := jsonb_set(new.data, '{email}', old.data->'email', true);
    end if;
    if coalesce(new.data->>'username','') = '' and coalesce(old.data->>'username','') <> '' then
      new.data := jsonb_set(new.data, '{username}', old.data->'username', true);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_team_member_login on public.team_members;
create trigger trg_protect_team_member_login
before update on public.team_members
for each row execute function public.protect_team_member_login();

-- Resolve the mutable search_path advisory on the brand-name normalizer.
alter function public.normalize_client_brand_name(text) set search_path = public, pg_temp;
