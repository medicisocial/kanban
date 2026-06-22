-- Finances table — tracks revenue (retainers per-client + one-off projects),
-- payroll, and expenses per month.
--
-- Design: follows the standard JSONB workspace table pattern.
-- One row per finance category:
--   id = 'revenue'      → { "2026-01": { "Plume": 2000, "retainerTotal": 2000, "oneOff": 500 }, ... }
--   id = 'payroll'      → { "2026-01": 12000, "2026-02": 12500, ... }
--   id = 'expenses'     → { "2026-01": 3500, "2026-02": 4000, ... }

create table if not exists public.finances (
  id text not null,
  org_id text not null default 'medici',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

alter table public.finances enable row level security;

-- Pilot policy: allow anon key full access (single agency, no per-user rules yet).
drop policy if exists finances_pilot_all on public.finances;
create policy finances_pilot_all on public.finances
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Enable realtime broadcasts.
alter publication supabase_realtime add table public.finances;