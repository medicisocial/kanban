# Medici Social Kanban — Workspace Summary

> Quick-reference guide for AI agents. Last updated: 2026-06-07

---

## 1. What This Is

A **SaaS platform** for social media marketing agencies and content creators to manage the full content lifecycle: ideation → production → client review → scheduling → posting. Replaces email/chat chaos with a single source of truth.

**Founder:** Non-technical, relies on AI assistance for development.

---

## 2. Two Audiences

| Audience | Plans | Price range |
|---|---|---|
| Solo creators | Starter (Creator) | $12/mo |
| Agencies (3–25 brands) | Essential → Pro → Scale | $29–$99/mo |

---

## 3. Key Architecture

```
React 19 SPA (Vite 6 + TailwindCSS v4)
├── UnifiedAppGate — URL-param based routing (no React Router)
│   ├── MarketingSite (landing, pricing, signup)
│   ├── StaffConsole (kanban + all agency tools) — uses StaffAuthProvider + ClientsProvider + WorkspaceSyncProvider
│   └── ClientPortal (brand-specific client UI) — uses ClientAuthProvider
├── Context providers: StaffAuthContext, ClientAuthContext, ClientsContext, WorkspaceSyncContext
├── ~100 components in src/components/
└── Data: localStorage (default) OR Supabase (when VITE_USE_SUPABASE=true)
```

**API layer** — Vercel serverless functions in `api/`:
- `/api/staff-sync` — Supabase CRUD for workspace data
- `/api/client-portal` — Client portal endpoints (now uses brand-scoped queries directly)
- `/api/client-auth` / `/api/team-auth` — Authentication
- `/api/brand-asset-sign-upload` — Storage uploads

**Database** — Supabase with normalized tables after migration 018:
- `brands` — stable brand identities (set-once brand_key + editable display_name)
- `portal_users` — per-user rows (replaces JSONB arrays in client_portal_credentials)
- `portal_password_vault` — service_role-only encrypted vault
- `client_records` — per-brand data with typed columns (colors, logos, contacts, etc.)
- Legacy JSONB tables (`clients`, `client_portal_credentials`) still exist with sync triggers

---

## 4. Critical Rules (DO NOT BREAK)

### Login Data Protection
- `client_portal_credentials` and `team_members` are **auth-critical**. Two write paths exist:
  1. Desktop: browser Supabase client via `syncHelpers.js`
  2. Mobile/API: `/api/staff-sync` via `authCriticalSync.mjs`
- **Database triggers** enforce invariants — a password row cannot be blanked by app code bugs.
- **Never write credentials without** a `username` AND `passwordHash` (client) or `password` (staff).
- **Deletes** require `authDeleteConfirmed: true`.
- **Password hash** must be SHA-256 lowercase hex (`hashPassword` in staffAuth.js / `hashValue` in clientPortalAuth.mjs).
- Build runs `scripts/test-sync-merge.mjs` — keep it green.
- **New normalized tables** (`portal_users`) stay in sync via `trg_sync_credentials_to_portal_users` trigger.
- Legacy Redis/Upstash store has been removed entirely.

### Architecture Constraints
- URL-param routing only — no React Router.
- `agents.md` at repo root contains agent instructions — read it first.
- `npm run dev` serves `/api/*` via `scripts/vite-local-api.mjs`.

### Migration 018+ Rules
- **Brands have stable keys**: `brand_key` is set-once (lower(trim(name))). Never change it.
- **New code should prefer** `brands`, `portal_users`, `client_records` over legacy `clients` blob.
- **Legacy blob writes have been removed** — all writes go to the new normalized tables. DB triggers keep legacy tables in sync for backward compatibility.
- **Client portal** queries Supabase by `brand_id` FK instead of filtering the full workspace blob.
- **Client-side sync hooks** (`useCollectionSync`, `useMapSync`, `useSingletonSync`) now support optional `brandId` parameter for brand-scoped queries via `createBrandScopedStore()`.
- **Audit columns** (`created_by`, `updated_by`) exist on all workspace tables — populate them.
- **Brand name scope** is per-org (`unique(org_id, brand_key)`), no longer globally unique.

---

## 5. Core Features (Production)

- **Kanban Board** — 7 columns, drag-and-drop via @dnd-kit
- **Video Ideas** — client-submitted ideas → approve/decline → becomes board card
- **Shoot Day Planning** — per-client shoot schedules with timeline
- **Content Calendars** — month & week views
- **Client Portal** — authenticated view: brand profile, ideas review, content review, shoot schedule, calendar
- **Team Management** — roles: Owner, Creative Director, Account Manager, Editor, Content Creator; scope filtering
- **Staff Auth** — Supabase Auth + legacy session cookies
- **Client Auth** — SHA-256 passwords, password reset flow
- **Cloud Sync** — localStorage default, Supabase optional via env var
- **Undo History** — batch-aware, multi-type
- **Meetings / Events** — recurring meetings, industry events calendar
- **Admin Tasks / Account Manager Queue** — role-specific todo lists
- **File Preview** — PDF viewer, Dropbox links
- **Marketing Site** — landing page, pricing, signup

---

## 6. Partially Built / Not Yet Active

- Stripe billing (prices defined, no integration)
- Production Supabase (localStorage still default)
- Email delivery (API endpoints exist, transport pending)
- Brand assets storage (bucket integration exists but may not be deployed)
- Enterprise portal layout (component exists, not in use)
- Mobile-responsive polish
- Full migration of client-side hooks to use normalized tables directly (Phase 2)

---

## 7. Tech Stack

| Layer | Tech | Version |
|---|---|---|
| Framework | React | 19.1.0 |
| Build | Vite | 6.3.5 |
| CSS | TailwindCSS | 4.1.8 |
| DB/Backend | Supabase | 2.106.2 |
| DnD | @dnd-kit | 6.3.1 |
| PDF | jsPDF / pdfjs-dist | 4.2.1 / 6.0.227 |
| Redis | Upstash Redis | 1.38.0 |
| Testing | Playwright | 1.60.0 |
| Deploy | Vercel | — |
| Icons | Inline SVG (no library) | — |
| Auth | Custom SHA-256 + Supabase Auth | — |

---

## 8. File Layout Quick Reference

```
.
├── api/               — Vercel serverless (14 endpoints)
│   └── _lib/          — Shared lib (supabase, auth, redis, etc.)
├── scripts/           — 30+ build/test/dev scripts
├── src/
│   ├── App.jsx        — Root: public share link → StaffConsole, else UnifiedAppGate
│   ├── ClientPortalApp.jsx — Client portal shell (auth-gated)
│   ├── components/    — ~100 UI components
│   │   ├── clientPortal/ — 33 portal components
│   │   └── marketing/    — Landing, pricing
│   ├── constants/     — Columns, plans, config
│   ├── context/       — 4 providers (StaffAuth, ClientAuth, Clients, WorkspaceSync)
│   ├── hooks/         — 14 custom hooks
│   ├── lib/           — Supabase client, sync engine, health
│   └── utils/         — 70 utility modules
├── supabase/          — Schema + 17 migrations + RLS files
├── agents.md          — Agent instructions at repo root
└── .agents/           — AI workspace summary
```

---

## 9. Starting Point for Common Tasks

**"Add a feature to X":**
1. Check if X is a context value, a hook, or a util function
2. Most data flows: Context (source of truth) → Hook (computed/derived) → Component (renders) → Util (transform/API)
3. Sync: `WorkspaceSyncContext` + `lib/useCollectionSync.js / useMapSync.js`

**"Fix login issue":**
1. Check DB triggers (`007_protect_login_data.sql` first)
2. Verify hash algorithm matches (`staffAuth.js` vs `clientPortalAuth.mjs`)
3. Check both write paths: `syncHelpers.js` (desktop) and `authCriticalSync.mjs` (API)
4. For new code, also check `portal_users` table + `trg_sync_credentials_to_portal_users` trigger

**"Add a new API endpoint":**
1. Create file in `api/`
2. If it needs Supabase, import from `api/_lib/supabase.mjs`
3. If it needs auth, use `staffAuth.mjs` or `teamAuth.mjs`
4. For brand-scoped data, prefer querying `brands` + `brand_id` FK over filtering the workspace blob
5. Restart dev server (Vite caches local-API plugin)

**"Debug sync/boot issues":**
1. Check `workspaceSyncHealth` banner
2. Check `lib/workspaceBootstrap.js` load order
3. Check `lib/syncHelpers.js` for filter logic

**"Work with client/brand data":**
1. New architecture: `client_records` (typed columns per brand) + `brands` (stable key + display name)
2. Legacy fallback: `clients` (single JSONB blob, `id = 'workspace'`)
3. DB triggers keep both in sync during transition
4. Client portal API (`/api/client-portal`) queries by `brand_id` FK on content tables when available