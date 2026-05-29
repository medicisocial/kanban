-- Medici Social — workspace schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
--
-- Design notes:
--   * One row per record. The full record lives in a JSONB `data` column so the
--     app schema can evolve without migrations during the pilot.
--   * `org_id` is on every table now (defaulted to a single agency) so multi-tenancy
--     later is a filter change, not a rebuild.
--   * `id` is text so it works for uuid card ids AND composite keys like shoot plans
--     ("client|date").
--   * Realtime is enabled per table so other tabs/devices update live.

create extension if not exists "pgcrypto";

-- Generic helper to (re)create a workspace collection table.
do $$
declare
  tbl text;
  tables text[] := array[
    'cards',
    'shoot_plans',
    'video_ideas',
    'admin_tasks',
    'events',
    'meetings',
    'clients',
    'team_members',
    'client_portal_credentials'
  ];
begin
  foreach tbl in array tables loop
    execute format($f$
      create table if not exists public.%I (
        id text not null,
        org_id text not null default 'medici',
        data jsonb not null,
        updated_at timestamptz not null default now(),
        primary key (org_id, id)
      );
    $f$, tbl);

    -- Enable Row Level Security.
    execute format('alter table public.%I enable row level security;', tbl);

    -- PILOT POLICY: allow the anon key full access (single agency, no per-user rules yet).
    -- Tighten this later: replace `true` with `org_id = auth.jwt() ->> 'org_id'` once
    -- staff auth is wired to Supabase Auth.
    execute format('drop policy if exists %I on public.%I;', tbl || '_pilot_all', tbl);
    execute format($f$
      create policy %I on public.%I
        for all
        to anon, authenticated
        using (true)
        with check (true);
    $f$, tbl || '_pilot_all', tbl);
  end loop;
end $$;

-- Enable realtime broadcasts for every workspace table.
do $$
declare
  tbl text;
  tables text[] := array[
    'cards',
    'shoot_plans',
    'video_ideas',
    'admin_tasks',
    'events',
    'meetings',
    'clients',
    'team_members',
    'client_portal_credentials'
  ];
begin
  foreach tbl in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', tbl);
    exception
      when duplicate_object then null; -- already in the publication
    end;
  end loop;
end $$;
