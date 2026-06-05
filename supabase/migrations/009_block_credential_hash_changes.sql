-- Block silent password-hash replacement on client_portal_credentials.
-- Stale workspace sync could overwrite plumehtx (and other brands) with a wrong
-- non-empty hash; migration 007 only re-attached blank hashes.
--
-- Authorized password changes set _passwordChangeAuthorized on the user object
-- (staff set-password API / emergency reset). The marker is stripped before persist.

create or replace function public.strip_portal_password_change_marker(p_user jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_user - '_passwordChangeAuthorized';
$$;

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
          public.strip_portal_password_change_marker(
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
          )
        when exists (
          select 1
          from jsonb_array_elements(
            case when jsonb_typeof(old.data) = 'array' then old.data else '[]'::jsonb end
          ) ou
          where (
              coalesce(ou->>'id','') = coalesce(nu->>'id','')
              or lower(coalesce(ou->>'username','')) = lower(coalesce(nu->>'username',''))
            )
            and coalesce(ou->>'passwordHash','') <> ''
            and lower(coalesce(ou->>'passwordHash','')) <> lower(coalesce(nu->>'passwordHash',''))
        )
        and coalesce(nu->>'_passwordChangeAuthorized','') <> 'true' then
          public.strip_portal_password_change_marker(
            coalesce(
              (
                select (nu - '_passwordChangeAuthorized')
                  || jsonb_build_object('passwordHash', ou->>'passwordHash')
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
          )
        else
          public.strip_portal_password_change_marker(nu)
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
