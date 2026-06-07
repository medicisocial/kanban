# Medici Social Kanban — agent notes

## Workspace sync (staff app)

When `VITE_USE_SUPABASE=true`, production **must** have:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only, no `VITE_` prefix) for `/api/staff-sync` GET/POST
- Staff Supabase user in `organization_members` for org `medici` (see `supabase/migrations/002_organizations.sql`)

Browser reads use anon REST for legacy `medici`, then Supabase client, then **staff-sync GET**.
Legacy Redis/Upstash sync has been removed — all cloud data flows through Supabase.
Local-only data is auto-uploaded via `bootstrapLocalWorkspaceToCloud` after sign-in.

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

## Agent skill files

When a task involves one of the domains below, first read the corresponding `.agents/<FILE>.md` and apply its generalized patterns to the current project.

| Domain | File |
|---|---|
| Database schema & migrations | `.agents/DATABASE_ENGINEER.md` |
| Supabase platform auth | `.agents/SUPABASE_EXPERT.md` |
| Auth & multi-tenancy | `.agents/AUTH_MULTITENANCY_ARCHITECT.md` |
| API design & integration | `.agents/API_INTEGRATION_SPECIALIST.md` |
| Frontend SPA architecture | `.agents/FRONTEND_SPA_ARCHITECT.md` |
| Offline-first sync | `.agents/OFFLINE_FIRST_SYNC_ARCHITECT.md` |
| Project workspace summary | `.agents/WORKSPACE_SUMMARY.md` |

## Migration 018 — normalized architecture

The `018_architectural_refactor` migration introduces proper relational tables:

- **`brands`** — stable internal `brand_key` (set-once) + editable `display_name`. All content tables (`cards`, `shoot_plans`, etc.) get a `brand_id` FK.
- **`portal_users`** — one row per portal user (replaces JSONB arrays inside `client_portal_credentials`).
- **`portal_password_vault`** — encrypted vault, service_role only (no plaintext passwords in workspace blob).
- **`client_records`** — typed columns (`colors`, `logos`, `contacts`, `social_logins`, `company_files`, `special_menus`, `photo_gallery_link`, `business_type`, `account_manager`) instead of one JSONB blob.
- **Audit columns** — `created_by`, `updated_by` on all workspace tables.

### Dual-write pattern

During transition, all content tables have FK references to `brands`. API endpoints write to the new normalized tables, and DB triggers keep the legacy blob in sync for backward compatibility. **Legacy blob writes have been removed from the API code** — all writes go through the new tables.

### Client portal brand-scoped queries

`/api/client-portal` now queries Supabase by `brand_id` FK instead of downloading the full workspace blob and filtering client-side. Use `fetchBrandContent(orgId, brand)` from `api/_lib/portalBrandProfile.mjs`.

### Client-side brand-scoped sync hooks

`supabaseSync.js` now exports `createBrandScopedStore(table, brandId)` which filters by `brand_id` in Supabase queries and realtime subscriptions. The sync hooks (`useCollectionSync`, `useMapSync`, `useSingletonSync`) accept an optional `brandId` parameter.

### Brand name scope

`client_brand_names.name_normalized` is still globally unique (legacy). The new `brands` table uses `unique(org_id, brand_key)` — per-org uniqueness. New brand creation goes through both tables.

### Brand key stability

`brand_key` = `lower(trim(display_name))`, set once at creation. Never change it — it's referenced by FKs across content tables. The display name can change without cascading to children.

## Local dev

`npm run dev` serves `/api/*` through `scripts/vite-local-api.mjs`. Use `vercel env pull .env.local` for secrets.

To set `SUPABASE_SERVICE_ROLE_KEY` on Vercel + `.env`: close Edge, run `npm run setup:service-role:edge` (uses your Edge login), or `npm run setup:service-role` with `SUPABASE_ACCESS_TOKEN` via `node scripts/setup-supabase-service-role.mjs`.
