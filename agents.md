# Medici Social Kanban — agent notes

## Workspace sync (staff app)

When `VITE_USE_SUPABASE=true`, production **must** have:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only, no `VITE_` prefix) for `/api/staff-sync` GET/POST
- Staff Supabase user in `organization_members` for org `medici` (see `supabase/migrations/002_organizations.sql`)

Browser reads use anon REST for legacy `medici`, then Supabase client, then **staff-sync GET**, then legacy Redis blob. Local-only data is auto-uploaded via `bootstrapLocalWorkspaceToCloud` after sign-in.

Sync issues surface in the top banner via `workspaceSyncHealth`.

## Local dev

`npm run dev` serves `/api/*` through `scripts/vite-local-api.mjs`. Use `vercel env pull .env.local` for secrets.

To set `SUPABASE_SERVICE_ROLE_KEY` on Vercel + `.env`: close Edge, run `npm run setup:service-role:edge` (uses your Edge login), or `npm run setup:service-role` with `SUPABASE_ACCESS_TOKEN` via `node scripts/setup-supabase-service-role.mjs`.
