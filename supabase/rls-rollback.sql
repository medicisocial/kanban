-- Emergency rollback for rls-lockdown.sql.
-- Restores the permissive pilot policy (anon + authenticated full access) on
-- every workspace table. Use only if the lockdown breaks staff writes and a fix
-- can't be applied immediately.

do $$
declare
  tbl text;
  tables text[] := array[
    'cards','shoot_plans','video_ideas','admin_tasks','events',
    'meetings','clients','team_members','client_portal_credentials'
  ];
begin
  foreach tbl in array tables loop
    execute format('drop policy if exists %I on public.%I;', tbl || '_read', tbl);
    execute format('drop policy if exists %I on public.%I;', tbl || '_insert', tbl);
    execute format('drop policy if exists %I on public.%I;', tbl || '_update', tbl);
    execute format('drop policy if exists %I on public.%I;', tbl || '_delete', tbl);

    execute format('drop policy if exists %I on public.%I;', tbl || '_pilot_all', tbl);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true);',
      tbl || '_pilot_all', tbl);
  end loop;
end $$;
