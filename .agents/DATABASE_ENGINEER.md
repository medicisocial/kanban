# Database Engineer — Skill File

> Focus: PostgreSQL schema design, JSONB patterns, triggers, functions, referential integrity, autovacuum tuning, RLS policies, and data migration strategies for the Medici Social Kanban.

---

## 1. Schema Architecture

### Workspace Tables (JSONB Pattern)

9 core workspace tables share an identical generic structure (`supabase/schema.sql`):

```sql
create table if not exists public.<name> (
  id text not null,
  org_id text not null default 'medici',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);
```

**Tables:**
- `cards` — Kanban board cards
- `shoot_plans` — Shoot day plans (composite key: `"client|date"`)
- `video_ideas` — Client-submitted video ideas
- `admin_tasks` — Role-specific todo items
- `events` — Industry events
- `meetings` — Recurring meetings
- `clients` — Client workspace blob (single hot row, primary key is always `'workspace'`)
- `team_members` — Staff login records
- `client_portal_credentials` — Client portal login records

**Design rationale:**
- JSONB `data` column allows schema evolution without migrations during the pilot phase
- `org_id` is part of the primary key so multi-tenancy later is a filter change, not a rebuild
- `id` is text to support both UUIDs and composite keys like `"client|date"`

### Structured Tables (Added Later)

| Table | File | Purpose |
|---|---|---|
| `organizations` | `002_organizations.sql` | SaaS orgs with plan_type, slug, trial_ends_at |
| `organization_members` | `002_organizations.sql` | User-to-org membership with roles |
| `client_brand_names` | `004_client_brand_names.sql` | Globally unique brand names |
| `client_records` | `017_normalize_clients_and_fks.sql` | Normalized client records with brand_key |

---

## 2. JSONB Patterns & Anti-Patterns

### The `clients` Hot Row Problem

The `clients` table has only one row per org (id = `'workspace'`) with a JSONB blob storing ALL client data. This single row is:

- **Constantly updated** — every client operation rewrites the blob
- **Large** — logos, contacts, files for all brands live in this one row (historically exceeded 1 MB with base64 logos)
- **Subject to TOAST bloat** — without aggressive autovacuum, dead tuples accumulate

**Solution:** Migration `015_tune_clients_autovacuum_hot_row.sql` sets aggressive autovacuum:
```sql
ALTER TABLE public.clients SET (
  autovacuum_vacuum_scale_factor = 0,
  autovacuum_vacuum_threshold = 10,
  autovacuum_vacuum_insert_scale_factor = 0,
  autovacuum_vacuum_insert_threshold = 10,
  autovacuum_vacuum_cost_delay = 0,
  autovacuum_vacuum_cost_limit = 10000,
  toast.autovacuum_enabled = true,
  toast.autovacuum_vacuum_scale_factor = 0,
  toast.autovacuum_vacuum_threshold = 10,
  toast.autovacuum_vacuum_cost_delay = 0,
  toast.autovacuum_vacuum_cost_limit = 10000
);
```

### Clients Workspace JSONB Structure

```json
{
  "names": ["Brand A", "Brand B"],
  "colors": { "Brand A": "#ff0000", "Brand B": "#00ff00" },
  "logos": { "Brand A": { ... }, "Brand B": { ... } },
  "accountManagers": { "Brand A": "user-id", "Brand B": "user-id" },
  "businessTypes": { "Brand A": "restaurant", "Brand B": "retail" },
  "contacts": { "Brand A": [...], "Brand B": [...] },
  "socialLogins": { "Brand A": { ... }, "Brand B": { ... } },
  "companyFiles": { "Brand A": [...], "Brand B": [...] },
  "specialMenus": { "Brand A": [...], "Brand B": [...] },
  "photoGalleryLinks": { "Brand A": "https://...", "Brand B": "https://..." },
  "portalPasswordVault": { "Brand A": { "user-id": "password" }, ... },
  "contentTypeColors": { "Brand A": "#ff0000", "Brand B": "#00ff00" },
  "customColorPalette": { "Brand A": [...], "Brand B": [...] },
  "removedNames": ["Deleted Brand"],
  "restoredNames": []
}
```

### Normalization: `client_records` (Migration 017)

To support foreign key relationships and avoid JSONB query complexity, client data is being normalized into `client_records`:

```sql
create table if not exists public.client_records (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  brand_key text not null,
  display_name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, brand_key)
);
```

A trigger `trg_sync_client_record_to_blob` syncs changes back to the `clients` JSONB blob for backward compatibility.

---

## 3. Database Triggers — Login Data Protection

### Source: `supabase/migrations/007`, `008`, `009`

Three layers of trigger-based protection on auth-critical tables:

#### Layer 1: Hash Preservation (007)
`trg_protect_client_portal_credentials` (BEFORE UPDATE on `client_portal_credentials`):
- Re-attaches blanked `passwordHash` from the existing row (matched by id or username)
- Refuses to reduce a configured row to zero valid logins

`trg_protect_team_member_login` (BEFORE UPDATE on `team_members`):
- Preserves `password`, `email`, `username` when an edit omits them

#### Layer 2: Role/Name Preservation (008)
Extends `protect_team_member_login()` to also preserve `roles` and `name`:
```sql
if coalesce(jsonb_array_length(case when jsonb_typeof(new.data->'roles')='array' then new.data->'roles' else '[]'::jsonb end), 0) = 0
   and coalesce(jsonb_array_length(case when jsonb_typeof(old.data->'roles')='array' then old.data->'roles' else '[]'::jsonb end), 0) > 0 then
  new.data := jsonb_set(new.data, '{roles}', old.data->'roles', true);
end if;
```

#### Layer 3: Block Silent Hash Replacement (009)
Replaces `protect_client_portal_credentials()` to also block unauthorized password hash changes. Only updates where `_passwordChangeAuthorized = true` are allowed to change the hash:
```sql
when exists (
  select 1 from jsonb_array_elements(...) ou
  where ...
    and lower(coalesce(ou->>'passwordHash','')) <> lower(coalesce(nu->>'passwordHash',''))
)
and coalesce(nu->>'_passwordChangeAuthorized','') <> 'true' then
  -- Restore existing hash
```

### Helper function: `count_valid_portal_users`
```sql
create or replace function public.count_valid_portal_users(p_data jsonb)
returns integer language sql immutable set search_path = public, pg_temp
as $$
  select count(*)::int
  from jsonb_array_elements(
    case when jsonb_typeof(p_data) = 'array' then p_data else '[]'::jsonb end
  ) as u
  where coalesce(u->>'username','') <> ''
    and coalesce(u->>'passwordHash','') <> '';
$$;
```

---

## 4. Functions & RPCs

### Organization Management
- `handle_new_saas_user()` — Trigger function on `auth.users` INSERT. Auto-provisions org + membership. Updated across migrations 002–006 as plan types evolved.

### Brand Name Management
- `normalize_client_brand_name(raw_name text)` → text — Lowercases, trims, collapses whitespace. Immutable.
- `reserve_client_brand_name(display_name, org_id)` → jsonb — Security-definer RPC. Checks auth, checks org membership, inserts into `client_brand_names`.
- `release_client_brand_name(display_name, org_id)` → jsonb — Deletes brand name reservation.

### Portal Data Access
- `get_portal_brand_profile(org_id, brand)` → jsonb — Returns single brand's profile without downloading the full clients workspace row. Used by `api/client-portal.js`.
- `resolve_client_brand_key(names jsonb, brand text)` → text — Case-insensitive brand key resolution.
- `patch_clients_portal_password_vault(org_id, brand, vault_json)` → void — Partial vault update without full row rewrite. Has org-membership guard (added in 012).

### Utility Functions
- `user_org_ids()` → setof text — Returns org IDs for current authenticated user. Used by all RLS policies.
- `strip_portal_password_change_marker(user jsonb)` → jsonb — Removes `_passwordChangeAuthorized` before persist.
- `sync_client_record_to_blob()` — Trigger function that syncs `client_records` changes back to the `clients` workspace blob.

---

## 5. Autovacuum Configuration

### Problem
Frequent updates to small tables (especially `cards` for realtime, and `clients` for the hot row) accumulate dead tuples that bloat the table and slow down logical decoding.

### Per-table Tuning

| Table | Scale Factor | Threshold | Notes |
|---|---|---|---|
| `events` | 0.05 | 25 | Per 014 |
| `shoot_plans` | 0.05 | 25 | Per 014 |
| `meetings` | 0.05 | 25 | Per 014 |
| `video_ideas` | 0.05 | 25 | Per 014 |
| `client_portal_credentials` | 0.05 | 25 | Per 014 |
| `team_members` | 0.05 | 25 | Per 014 |
| `admin_tasks` | 0.05 | 25 | Per 014 |
| `clients` | 0 | 10 | Aggressive, per 015 |
| `clients` TOAST | 0 | 10 | Per 015 |
| `cards` | 0.05 | 50 | Per 016 |

### Why `clients` is special
- Single hot row → every UPDATE creates a new tuple version
- JSONB can TOAST → dead TOAST entries accumulate independently
- Without aggressive tuning, tuple count grew to millions even though there's only 1 logical row

---

## 6. Row Level Security (RLS) Design

### Policy Evolution

**Pilot:** `_pilot_all` — `for all to anon, authenticated using (true) with check (true)`

**Lockdown (rls-lockdown.sql):**
- SELECT: `anon, authenticated` (share links need anon)
- INSERT: `authenticated` only
- UPDATE: `authenticated` only
- DELETE: `authenticated` only

**Multi-tenant (002_organizations.sql):**
```sql
create policy <table>_tenant_write on <table>
  for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));
```

Legacy anon read for Medici deployment:
```sql
create policy <table>_anon_legacy_read on <table>
  for select to anon
  using (org_id = 'medici');
```

**Performance optimization (016):**
Wrapped `auth.uid()` in `(select auth.uid())` — scalar subselect executes once per query instead of once per row.

### Storage RLS (`010_brand_assets_storage.sql`)

```sql
create policy "brand_assets_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] in (select public.user_org_ids())
  );
```

---

## 7. Referential Integrity (Migration 017)

Foreign keys added to all workspace tables referencing `organizations(id)`:
```
<tablename>_org_id_fkey → organizations(id) on delete cascade
```

New normalized structure with FK constraints:
```
client_records.org_id → organizations(id)
client_portal_credentials (org_id, id) → client_records(org_id, brand_key)
client_brand_names (org_id, name_normalized) → client_records(org_id, brand_key)
```

---

## 8. Realtime Publication

All workspace tables are published to `supabase_realtime`:
```sql
alter publication supabase_realtime add table public.<table_name>;
```

Tables in the publication: `cards`, `shoot_plans`, `video_ideas`, `admin_tasks`, `events`, `meetings`, `clients`, `team_members`, `client_portal_credentials`, `client_records`.

Adding a new table:
```sql
alter publication supabase_realtime add table public.<new_table>;
```

---

## 9. Migration Best Practices

### Pattern
1. Create with `if not exists` / add column with `if not exists`
2. Use `do $$` blocks for dynamic SQL over multiple tables
3. Set `search_path = public, pg_temp` on all trigger functions to suppress advisory warnings
4. Revoke EXECUTE from public/anon/authenticated on security-definer functions after creation (migration 014)

### Example trigger function pattern:
```sql
create or replace function public.<name>()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- trigger logic
  return new;
end;
$$;

drop trigger if exists <trigger_name> on public.<table>;
create trigger <trigger_name>
  before update on public.<table>
  for each row execute function public.<name>();
```

### Example RPC pattern:
```sql
create or replace function public.<name>(<params>)
returns <type>
language <sql|plpgsql>
<volatility>
security definer
set search_path = public, pg_temp
as $$ ... $$;

revoke all on function public.<name>(<types>) from public;
grant execute on function public.<name>(<types>) to <role>;
```

---

## 10. Security Considerations

### Function Permissions
- `handle_new_saas_user()` — EXECUTE revoked from public/anon/authenticated in migration 014 (only runs via trigger as table owner)
- RPCs are `security definer` to bypass RLS for specific operations
- Utility functions (`normalize_client_brand_name`, `user_org_ids`) have targeted `grant execute` to authenticated

### Data Protection
- `client_portal_credentials` and `team_members` have multi-layer trigger protection
- Password hashes: SHA-256 lowercase hex on both client (`hashValue` in `api/_lib/clientPortalAuth.mjs`) and staff (`hashPassword` in `src/utils/staffAuth.js`) paths
- `authDeleteConfirmed` flag required for row deletion from auth-critical tables

### RLS Bypass
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS entirely — used by serverless functions
- Anon key has SELECT-only access to `org_id = 'medici'` for legacy share links