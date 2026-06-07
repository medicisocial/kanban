# Supabase Expert

> Skill file for AI agents working with Supabase projects. Provides foundational knowledge about Supabase architecture, configuration, and best practices — not tied to any specific project.

---

## 1. Supabase Client Setup

### Browser Client

```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Server Client (Service Role)

```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Service role client bypasses RLS — use only on the server, never in browser
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
```

### Environment Variables

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Project API URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Public anon key (safe in browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin privileges, bypasses RLS |
| `SUPABASE_URL` | Server | Same as above, often needed server-side |

**Rules:**
- `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to the browser or bundled in client code
- Anon key is considered public and safe to bundle (it's designed for public usage with RLS protection)
- Feature-gate Supabase usage with an env var like `VITE_USE_SUPABASE` when you need to toggle between localStorage and Supabase

---

## 2. Authentication

### Auth Methods

1. **Supabase Auth** — Built-in auth with email/password, OAuth, magic links
   ```js
   const { data, error } = await supabase.auth.signInWithPassword({
     email: 'user@example.com',
     password: 'password123',
   });
   ```

2. **Custom Auth** — Use custom password hashing with SHA-256 when you need full control:
   ```js
   function hashPassword(password) {
     return crypto.createHash('sha256').update(password).digest('hex').toLowerCase();
   }
   ```

3. **Service Role** — Server-to-server operations bypass RLS entirely. Use for admin endpoints.

### Session Management

- Supabase JS client auto-manages session tokens
- Sessions are stored in localStorage under `supabase.auth.token`
- Use `supabase.auth.getSession()` to check current session
- Use `supabase.auth.onAuthStateChanged()` to listen for auth state changes

---

## 3. Row Level Security (RLS)

### Basic RLS Policy Patterns

```sql
-- Enable RLS
alter table public.<table_name> enable row level security;

-- User can only see their own data
create policy "user_own_data" on public.<table_name>
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Authenticated users can read, only owners can write
create policy "authenticated_read" on public.<table_name>
  for select to authenticated using (true);

create policy "owner_write" on public.<table_name>
  for insert to authenticated with check (auth.uid() = owner_id);

-- Admin role bypass
create policy "admin_all" on public.<table_name>
  for all using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );
```

### Multi-tenant RLS Pattern

```sql
-- Helper function to get user's orgs
create or replace function public.user_org_ids()
returns setof text
language sql stable security definer set search_path = public
as $$
  select org_id from public.organization_members where user_id = auth.uid()
$$;

-- Scoped to user's organizations
create policy "tenant_isolation" on public.<table_name>
  for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));
```

### RLS Performance

- Wrap `auth.uid()` in a scalar subselect `(select auth.uid())` to evaluate once per query instead of once per row
- Use `security definer` on helper functions to ensure they run with function owner's privileges
- The `auth_rls_initplan` advisory warns when auth.uid() is evaluated row-by-row

---

## 4. Database Schema Design

### JSONB Workspace Pattern

Use JSONB for flexible schemas where the data shape evolves rapidly:

```sql
create table if not exists public.workspace_items (
  id text not null,
  org_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);
```

**Pros:** Schema-less, no migrations needed for new fields
**Cons:** No referential integrity, harder to query, potential bloat

### Structured Tables

For well-defined entities with relationships, use structured columns:

```sql
create table if not exists public.organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  plan_type text not null check (plan_type in ('free', 'starter', 'pro')),
  trial_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  unique (org_id, user_id)
);
```

---

## 5. Realtime Subscriptions

### Enabling Realtime

```sql
alter publication supabase_realtime add table public.<table_name>;
```

### Client Subscription

```js
const channel = supabase
  .channel('table-changes')
  .on(
    'postgres_changes',
    {
      event: '*', // 'INSERT' | 'UPDATE' | 'DELETE' | '*'
      schema: 'public',
      table: 'table_name',
    },
    (payload) => {
      console.log('Change received!', payload);
    }
  )
  .subscribe();
```

### Merge Strategy for Real-time

When receiving realtime updates while local state may have unsynced edits:
- Always compare timestamps: prefer the version with the more recent `updatedAt`
- Track sync state with a snapshot of the last-synced version
- Local unsynced edits should win over stale realtime payloads
- Use a three-way merge: local ↔ synced ↔ remote

---

## 6. Storage

### Creating a Bucket

```sql
insert into storage.buckets (id, name, public)
values ('my-bucket', 'my-bucket', true)
on conflict (id) do update set public = excluded.public;
```

- `public = true` files are accessible via CDN URLs
- `public = false` files require signed URLs to access

### Storage RLS Policies

```sql
-- Public read (for public buckets, files are accessible via CDN anyway)
create policy "public_read" on storage.objects
  for select to public
  using (bucket_id = 'my-bucket');

-- Authenticated users can only access their own org's files
create policy "org_based_access" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'my-bucket'
    and (storage.foldername(name))[1] in (select public.user_org_ids())
  );

-- Authenticated users can upload to their own org prefix
create policy "org_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'my-bucket'
    and (storage.foldername(name))[1] in (select public.user_org_ids())
  );
```

### File Path Convention

```
{orgId}/{entityId}/{category}/{uuid}.{ext}
```

Example: `org_abc123/client_xyz/photos/a1b2c3d4.jpg`

### Client Upload Flow

1. Server generates a signed upload URL (using service role)
2. Browser uploads directly to the signed URL
3. Browser stores the resulting file path/reference in the database

```js
// Get signed upload URL (server endpoint)
const { data } = await supabaseAdmin
  .storage
  .from('my-bucket')
  .createSignedUploadUrl(`${orgId}/${clientId}/photos/${uuid}.jpg`);
```

---

## 7. Database Functions & Triggers

### Trigger Pattern

```sql
create or replace function public.my_trigger_function()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Access NEW and OLD rows
  -- For INSERT: NEW contains the new row
  -- For DELETE: OLD contains the deleted row
  -- For UPDATE: both NEW and OLD are available
  return new; -- or return old to cancel the operation
end;
$$;

drop trigger if exists my_trigger on public.my_table;
create trigger my_trigger
  before insert or update on public.my_table
  for each row execute function public.my_trigger_function();
```

### RPC Function Pattern

```sql
create or replace function public.my_rpc(param1 text, param2 jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Validate auth
  if auth.role() = 'authenticated' then
    -- Check permissions
    if not exists (select 1 from ... where user_id = auth.uid()) then
      raise exception 'not authorized';
    end if;
  end if;

  -- Business logic
  return jsonb_build_object('ok', true, 'data', '...');
end;
$$;

revoke all on function public.my_rpc(text, jsonb) from public;
grant execute on function public.my_rpc(text, jsonb) to authenticated;
grant execute on function public.my_rpc(text, jsonb) to service_role;
```

### Common Trigger Use Cases

- **Protect critical data**: Re-attach blanked fields from existing rows
- **Sync denormalized data**: Keep a summary table or search index in sync
- **Audit logging**: Log changes to an audit table
- **Auto-generate IDs**: Normalize or format incoming data
- **Prevent destructive operations**: Block deletion of protected records

---

## 8. Autovacuum Tuning

### Why Tune Autovacuum

Small tables updated frequently (especially those in the realtime publication) accumulate dead tuples quickly. Default thresholds rarely trigger on small tables.

### Aggressive Settings for Hot Rows

```sql
ALTER TABLE public.hot_table SET (
  autovacuum_enabled = true,
  autovacuum_vacuum_scale_factor = 0,        -- Disable scale-based triggering
  autovacuum_vacuum_threshold = 10,          -- Vacuum after 10 dead tuples
  autovacuum_vacuum_insert_scale_factor = 0,  -- Disable insert scale
  autovacuum_vacuum_insert_threshold = 10,   -- Vacuum after 10 inserts
  autovacuum_vacuum_cost_delay = 0,           -- No delay, maximum speed
  autovacuum_vacuum_cost_limit = 10000,       -- Max cost limit
  toast.autovacuum_enabled = true,            -- Also vacuum TOAST
  toast.autovacuum_vacuum_scale_factor = 0,
  toast.autovacuum_vacuum_threshold = 10,
  toast.autovacuum_vacuum_cost_delay = 0,
  toast.autovacuum_vacuum_cost_limit = 10000
);
```

### Moderate Settings for Active Tables

```sql
ALTER TABLE public.active_table SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 50,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_analyze_threshold = 50
);
```

---

## 9. Edge Functions

### Structure

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const { method } = req;
  const body = method === 'POST' ? await req.json() : null;

  const data = { message: "Hello from Edge Function!" };

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### Deployment

```bash
supabase functions deploy my-function --project-ref <project-id>
```

### Key Points
- Edge Functions run on Deno, not Node.js
- Use `Deno.serve()` instead of Express-style handlers
- Environment variables are inherited from the Supabase project
- Functions can access Supabase via the service role key
- JWT verification can be enabled/disabled per function

---

## 10. Migration Management

### File Convention

```
supabase/migrations/
├── 001_initial.sql
├── 002_feature_x.sql
├── 003_fix_y.sql
└── ...
```

### Best Practices

1. **Always idempotent**: Use `if not exists`, `drop ... if exists`, `or replace`
2. **Sequential numbering**: Easy to track order and dependencies
3. **Descriptive names**: Make the purpose clear from the filename
4. **Self-contained**: Each migration should work independently
5. **Dynamic SQL**: Use `do $$` blocks for operations over multiple tables
6. **Search path**: Set `search_path = public, pg_temp` on trigger/function definitions to suppress advisory warnings
7. **Revoke permissions**: After creating security-definer functions, revoke EXECUTE from public roles if they should not be callable over REST

### Migration Pattern

```sql
-- 001_initial.sql
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users_self" on public.users
  for all using (id = auth.uid())
  with check (id = auth.uid());
```

---

## 11. Common Pitfalls

1. **Service Key in Browser**: Never embed `SUPABASE_SERVICE_ROLE_KEY` in client code — it bypasses RLS
2. **Missing RLS**: New tables default to no RLS, meaning the anon key has full access
3. **Hot Row JSONB**: A single JSONB row updated constantly causes TOAST bloat — needs aggressive autovacuum
4. **Stale Realtime**: Always merge realtime payloads with local state; never blindly apply
5. **Function EXECUTE**: RPC functions created with `security definer` are callable by anyone unless you `REVOKE ... FROM public`
6. **auth.uid() Perf**: Without scalar subselect wrapping, `auth.uid()` evaluates per row
7. **on_conflict Do Nothing Silent**: `on conflict do nothing` suppresses errors but also silently skips — use carefully in data migrations where you want visibility into conflicts