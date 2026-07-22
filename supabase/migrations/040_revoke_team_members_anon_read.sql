-- Phase 0 (urgent): stop anonymous reads of team_members.
--
-- Background: migration 002 created team_members_anon_legacy_read:
--   create policy team_members_anon_legacy_read on public.team_members
--     for select to anon
--     using (org_id = 'medici');
--
-- Password lives inside the jsonb `data` column (data->>'password'), so Postgres
-- cannot strip that field alone via RLS or column privileges while still allowing
-- anon SELECT on the row. Revoke the anon SELECT policy entirely.
--
-- Authenticated staff keep team_members_tenant_write (org-scoped).
-- Server routes keep service_role access (bypasses RLS).
-- Public share links do not need team_members; assignee names are denormalized
-- onto cards/events. Client sync prefers /api/staff-sync (service role).

drop policy if exists team_members_anon_legacy_read on public.team_members;

-- Defense in depth: ensure anon has no table-level SELECT grant either.
-- (Supabase often grants SELECT broadly and relies on RLS; revoke is explicit.)
revoke select on table public.team_members from anon;
