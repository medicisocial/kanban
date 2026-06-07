# Agent Skill Files — Reference Index

> The `.agents/` directory contains generalized skill files for AI agents. Each file covers architecture patterns and best practices applicable across SaaS projects, with examples drawn from this codebase where relevant.

---

## How to Use These Files

When a task touches a domain listed below, read the corresponding `.agents/<FILE>.md` and apply its patterns.

| Domain | File | Key Topics |
|---|---|---|
| Database schema & migrations | `DATABASE_ENGINEER.md` | JSONB patterns, triggers, RLS, autovacuum, FK design |
| Platform auth | `SUPABASE_EXPERT.md` | Supabase client, RLS, storage, edge functions |
| Auth & multi-tenancy | `AUTH_MULTITENANCY_ARCHITECT.md` | Session management, tenant isolation, RLS design |
| API design & integration | `API_INTEGRATION_SPECIALIST.md` | REST patterns, errors, pagination, webhooks, idempotency |
| Frontend SPA architecture | `FRONTEND_SPA_ARCHITECT.md` | URL-param routing, context hierarchy, lazy loading, modals |
| Offline-first sync | `OFFLINE_FIRST_SYNC_ARCHITECT.md` | Three-way merge, bootstrap/seed, realtime, conflict resolution |
| Project workspace summary | `WORKSPACE_SUMMARY.md` | Quickref for this specific project |

---

## Priority for New Skill Files

If a new domain skill is needed, prioritize:

```
Tier 1 (Do Not Break):
  - Auth & login systems
  - Data persistence (local + cloud sync)
  - API security and idempotency

Tier 2 (Dev Velocity):
  - Frontend component architecture
  - Database performance (autovacuum, indexes)
  - Testing patterns

Tier 3 (Nice-to-Have):
  - Billing/subscription architecture
  - Analytics instrumentation
  - Admin dashboard patterns
```

---

## Maintaining Skill Files

1. Keep skill files **generalized** — describe the pattern, not just this project's implementation
2. Use concrete examples from the codebase as illustrations
3. Update when a migration changes a core pattern (e.g., migration 018 changed the auth table structure)
4. Keep `WORKSPACE_SUMMARY.md` in sync with the actual project state
5. Keep `agents.md` at the root referencing these files