# Medici Social Kanban — agent notes

## Workspace sync (staff app)

When `VITE_USE_SUPABASE=true`, production **must** have:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only, no `VITE_` prefix) for `/api/staff-sync` GET/POST
- Staff Supabase user in `organization_members` for org `medici` (see `supabase/migrations/002_organizations.sql`)

Browser reads use anon REST for legacy `medici`, then Supabase client, then **staff-sync GET**, then legacy Redis blob. Local-only data is auto-uploaded via `bootstrapLocalWorkspaceToCloud` after sign-in.

Sync issues surface in the top banner via `workspaceSyncHealth`.

## Login data is protected — do not bypass it

`client_portal_credentials` (client portal logins) and `team_members` (staff logins)
are **auth-critical**. They are written by two paths that must stay in lockstep:

1. Desktop: browser Supabase client → direct `upsert` (guarded by `filterProtectedSyncUpserts` in `src/lib/syncHelpers.js`).
2. Mobile / no session: `/api/staff-sync` → `sanitizeAuthCriticalUpserts` in `api/_lib/authCriticalSync.mjs`.

Because two paths exist, app-level guards alone are fragile — a change to one path,
a normalization tweak, or a new feature can drop a `passwordHash`/`username` and
break logins. To make this **impossible regardless of app code**, the database
enforces the invariant (`supabase/migrations/007_protect_login_data.sql`):

- `trg_protect_client_portal_credentials` re-attaches blanked password hashes from the
  existing row and refuses to reduce a configured row to zero valid logins.
- `trg_protect_team_member_login` preserves `password`/`email`/`username`/`roles`/`name` when an edit omits them, so a staff (agency team) account can't be blanked or lose access.

Rules when changing anything that touches these tables:

- Never write credentials without a username **and** `passwordHash` (client logins) or `password` (staff).
- Deletes on these tables require `authDeleteConfirmed` (see `filterAuthCriticalDeletes`); a row delete (not an empty update) is the only way to remove a login.
- Password hashing must stay SHA-256 lowercase hex on both sides (`hashPassword` in `src/utils/staffAuth.js` and `hashValue` in `api/_lib/clientPortalAuth.mjs`).
- `npm run build` runs `scripts/test-sync-merge.mjs`, which locks in these merge invariants. Keep those tests green.

## Local dev

`npm run dev` serves `/api/*` through `scripts/vite-local-api.mjs`. Use `vercel env pull .env.local` for secrets.

To set `SUPABASE_SERVICE_ROLE_KEY` on Vercel + `.env`: close Edge, run `npm run setup:service-role:edge` (uses your Edge login), or `npm run setup:service-role` with `SUPABASE_ACCESS_TOKEN` via `node scripts/setup-supabase-service-role.mjs`.
