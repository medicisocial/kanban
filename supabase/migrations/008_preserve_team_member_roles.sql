-- Extend the team member login guard to also preserve roles and name, so an edit
-- that omits/blanks them can't strip a staff member's access or hide the account.
-- Mirrors the server-side sanitizer (sanitizeAuthCriticalUpserts) so the desktop
-- direct-write path and the staff-sync API path behave identically.
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
    -- Preserve roles when the incoming write has none but the existing record does.
    if coalesce(jsonb_array_length(case when jsonb_typeof(new.data->'roles')='array' then new.data->'roles' else '[]'::jsonb end), 0) = 0
       and coalesce(jsonb_array_length(case when jsonb_typeof(old.data->'roles')='array' then old.data->'roles' else '[]'::jsonb end), 0) > 0 then
      new.data := jsonb_set(new.data, '{roles}', old.data->'roles', true);
    end if;
    -- Preserve the member name too — an empty name would hide the account.
    if coalesce(new.data->>'name','') = '' and coalesce(old.data->>'name','') <> '' then
      new.data := jsonb_set(new.data, '{name}', old.data->'name', true);
    end if;
  end if;
  return new;
end;
$$;
