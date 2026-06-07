# Auth & Multi-tenancy Architect — Generalized Skill File

> Focus: Authentication architectures, session management strategies, multi-tenant data isolation patterns, RLS policy design, and auth-critical data protection applicable to any SaaS application.

---

## 1. Authentication Strategy Selection

### Decision Matrix

| Strategy | Best For | Trade-offs |
|---|---|---|
| **Platform Auth** (Supabase/Firebase/Auth0/Clerk) | Fast time-to-market, small teams | Vendor lock-in, cost at scale |
| **Custom Password Hash** (SHA-256/BCrypt/Argon2) | Ops/admin backdoors, self-contained deployments | You own the security audit surface |
| **OAuth 2.0 / OpenID Connect** | Enterprise SSO, social login | Increased token validation complexity |
| **JWT + Refresh Token** | Stateless microservices, high-read APIs | No server-side session revocation |
| **Session ID (stateful)** | Monoliths, instant revocation | DB/Redis lookup on every request |

### Auth Chain Pattern

Try strategies progressively — never reveal which step matched:

```
1. Admin override?        → Check hardcoded env-var hash
2. Internal/team user?    → Query internal users table
3. External/SaaS user?    → Platform Auth (Supabase/Firebase/etc.)
4. API key?               → Validate against stored keys table
5. Fallback               → "Invalid credentials" (all strategies)
```

---

## 2. Session Management Architectures

### Self-Contained (Stateless) Sessions

```typescript
// JWT or HMAC-signed payload
{
  sub: string,              // user ID
  org_id: string,           // tenant ID
  role: string,             // RBAC role
  exp: number,              // expiry timestamp
  iat: number,              // issued at
  jti: string               // unique token ID (for optional blocklist)
}
// Pro: No DB lookup. Con: Cannot revoke without blocklist.
// Best for: Microservices, APIs with many consumers
```

### Server-Side (Stateful) Sessions

```typescript
// Random session ID stored in Redis/DB
{
  session_id: string,       // random UUID
  user_id: string,
  tenant_id: string,
  role: string,
  expires_at: timestamp,
  ip_address?: string,      // optional security binding
}
// Pro: Instant revocation. Con: DB/Redis lookup per request.
// Best for: Monoliths, admin dashboards
```

### Token Hierarchy (Recommended)

```
Access Token   (15 min TTL)  →  Carries identity + scopes
Refresh Token  (30 day TTL)  →  Rotated on each use, stored securely
Session Cookie (7 day TTL)   →  HMAC-signed, HttpOnly for web UI
```

---

## 3. Multi-Tenancy Models

### Three Approaches

| Model | Isolation | Cost | Complexity | Best For |
|---|---|---|---|---|
| **Column-based** (`org_id` on every table) | Shared infrastructure | Lowest | Low risk of cross-tenant leaks | 80% of SaaS apps |
| **Schema-based** (`tenant_xxx` per customer) | Strong schema isolation | Medium | Migration pain at scale | Enterprise, compliance-heavy |
| **Database-based** (separate DB per tenant) | Complete isolation | Highest | Most expensive to operate | Finance/healthcare, strict compliance |

**Recommended for most SaaS: Column-based with RLS**

```
Every table:   org_id TEXT NOT NULL
Every PK:      (org_id, id)  composite
Every query:   WHERE org_id = current_tenant_id
```

### Tenant Resolution Flow

```
Request arrives
  ↓
Extract auth token (cookie/Bearer)
  ↓
Verify token → get user identity
  ↓
Query membership table (user_id → tenant_id)
  ↓
Store tenant_id in request context
  ↓
All subsequent DB queries filter by tenant_id
```

### Migrating Single-Tenant → Multi-Tenant

```
1. Add org_id column (nullable, default to legacy value)
2. Backfill all existing rows with legacy org ID
3. Add NOT NULL constraint
4. Update composite PKs to include org_id
5. Enable RLS with tenant-scoped policies
6. Add tenant membership table
7. Update all query builders to inject org_id
8. Remove legacy org default — require explicit tenant
```

---

## 4. Row Level Security (RLS) Design Patterns

### Universal RLS Setup

```sql
-- 1. Membership helper function
create or replace function public.user_tenant_ids()
returns setof text
language sql stable security definer set search_path = public
as $$
  select tenant_id from public.tenant_members where user_id = auth.uid();
$$;

-- 2. Template policy — applied to every tenant-scoped table
create policy tenant_isolation on public.<table>
  for all to authenticated
  using (org_id in (select public.user_tenant_ids()))
  with check (org_id in (select public.user_tenant_ids()));

-- 3. Public read (for landing pages, shared content)
create policy anon_read_public_tenant on public.<table>
  for select to anon
  using (org_id = 'public');
```

### RLS Performance Optimization

```sql
-- AVOID: auth.uid() evaluates per row (slow on large tables)
org_id = (select tenant_id from members where user_id = auth.uid())

-- PREFER: scalar subselect evaluates once per query
org_id in (select public.user_tenant_ids())
```

### RLS Testing Checklist

- [ ] Anon user: can only read public/default tenant data
- [ ] Authenticated user: sees ONLY their tenant's rows
- [ ] Cross-tenant query: returns empty (not error or data leak)
- [ ] INSERT: org_id is locked to user's tenant (cannot inject different one)
- [ ] Service role: bypasses ALL RLS (for admin endpoints)
- [ ] New tables: RLS enabled before first data insert

---

## 5. API Auth Middleware Patterns

### Universal Token Verification

```typescript
async function verifyRequest(req): Promise<AuthContext> {
  // 1. Extract token
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return unauthenticated();

  const token = auth.slice(7).trim();

  // 2. Quick structural check
  if (!looksLikeToken(token)) return unauthenticated();

  // 3. Verify against auth provider
  try {
    const user = await verifyWithProvider(token);
    if (!user) return unauthenticated();
    return { ok: true, userId: user.id, tenantId: user.org_id, role: user.role };
  } catch (e) {
    if (e.name === 'FetchError') return { ok: false, status: 503 };
    return { ok: false, status: 401 };
  }
}
```

### Key Resolution Strategy

```typescript
function resolveDbCredentials(operation) {
  if (operation === 'read' && isPublic) {
    return { key: ANON_KEY };          // RLS scopes to public tenant
  }
  if (operation === 'read' && isAuthd) {
    return { key: ANON_KEY, user };    // RLS uses auth.uid()
  }
  if (operation === 'write') {
    return { key: SERVICE_ROLE_KEY };  // Bypasses RLS, server-only
  }
}
```

**The service role key must NEVER appear in browser-bundled code.**

---

## 6. Protecting Auth-Critical Data

### The Two-Write-Path Problem

Auth data (passwords, roles) can be written from multiple paths:
```
Path 1: Client-side SDK → direct DB (via RLS-allowed endpoints)
Path 2: Admin API → service role (bypasses RLS)
Path 3: Background jobs → eventual consistency
```

### Solution: Database Triggers for Invariant Enforcement

```sql
create or replace function protect_auth_fields()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  -- Prevent blanking password hash
  if new.data->>'passwordHash' = '' and old.data->>'passwordHash' <> '' then
    new.data := jsonb_set(new.data, '{passwordHash}',
      to_jsonb(old.data->>'passwordHash'));
  end if;

  -- Prevent removing all configured users
  if count_valid_users(new.data) = 0 and count_valid_users(old.data) > 0 then
    raise exception 'Cannot remove all configured users';
  end if;

  return new;
end;
$$;
```

### Auth Data Invariants

```
WRITE INVARIANTS:
  Every credential: must have username AND passwordHash+expiry
  Blanking a field: must use explicit flag (e.g., _passwordChangeAuthorized)
  Deleting a row: must confirm with authDeleteConfirmed flag

READ INVARIANTS:
  Password hashes: never returned in non-admin API responses
  Session tokens: never logged, never in error messages
  API keys: masked in responses (sk-****...xyz)

AUDIT INVARIANTS:
  Every credential change: logged (user, timestamp, field)
  Role promotions: require secondary approval
  Failed logins: rate-limited, logged for anomaly detection
```

---

## 7. Password Security Standards

### Hashing (pick one, use everywhere)

```
SHA-256:  crypto.createHash('sha256').update(pw).digest('hex').toLowerCase()
BCrypt:   bcrypt.hashSync(password, 10)   // cost factor >= 10
Argon2id: argon2.hash(password, { type: argon2.Argon2id }) // OWASP recommended
```

### Password Policy

| Rule | Rationale |
|---|---|
| Min 8 chars | Standard minimum |
| Max 128 chars | Prevent DoS via hash computation |
| Unicode allowed | Don't alienate international users |
| Rate-limited attempts | Prevent brute force |
| Time-limited reset tokens (15-60 min) | Limit exposure window |
| Single-use tokens | Prevent replay attacks |

---

## 8. Session Lifecycle Management

### Logout: Complete Cleanup Sequence

```
1. Clear browser storage (localStorage, sessionStorage, cookies)
2. Clear in-memory caches (context state, token variables)
3. Signal auth provider to invalidate session (if applicable)
4. Reset tenant isolation caches
5. Clear app-level auth context
6. Redirect to login/public page
```

### Token Refresh Flow

```
1. API returns 401 → intercepted by auth middleware
2. Check refresh token expiry locally
3. If valid: exchange refresh token for new access token
4. Atomically update stored tokens
5. Retry original failed request with new token
6. If refresh fails: force re-login (redirect)
```

### Tenant Switching

```
1. Persist current unsaved work
2. Clear tenant-scoped caches
3. Derive new tenant_id from session (never from URL/user input)
4. Re-fetch all data scoped to new tenant
5. Re-establish realtime subscriptions for new tenant
6. Clear stale UI state
```

---

## 9. Common Anti-Patterns

| Anti-pattern | Risk | Fix |
|---|---|---|
| Service key in `src/` / client bundle | Exposed in browser → full DB access | Server-only env vars, no VITE_ prefix |
| Single users table for all tenants | Cross-tenant data leak | tenant_members join table |
| No RLS on new tables | Anon key = full access | Enable RLS + policies before insert |
| Session never expires | Token theft = permanent access | Short TTL + refresh rotation |
| Revealing which auth strategy matched | Helps attackers enumerate valid accounts | "Invalid credentials" always |
| Mixing hash algorithms | Inconsistent verification → lockouts | One hash, one format, everywhere |
| Trusting client-reported tenant_id | User can access other tenant's data | Derive tenant_id from verified session |

---

## 10. Implementation Checklist for New SaaS

- [ ] Choose auth strategy (platform vs custom vs hybrid)
- [ ] Choose multi-tenancy model (column/schema/database)
- [ ] Set up tenant membership table
- [ ] Add org_id/tenant_id column to all data tables
- [ ] Enable RLS on all tables
- [ ] Add tenant isolation policies
- [ ] Implement token verification middleware
- [ ] Set up key hierarchy (anon → authenticated → service role)
- [ ] Add DB triggers for auth-critical data protection
- [ ] Implement session lifecycle (login → refresh → logout)
- [ ] Test cross-tenant isolation (automated security tests)
- [ ] Set up rate limiting on auth endpoints
- [ ] Audit logs for credential changes
- [ ] Document key rotation procedure