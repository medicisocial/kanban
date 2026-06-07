# Offline-First Sync Architect — Generalized Skill File

> Focus: Local-first data architecture, conflict resolution, three-way merge algorithms, bootstrap/seed patterns, realtime subscriptions, sync health monitoring, and tombstone tracking applicable to any offline-capable application.

---

## 1. Local-First Architecture Overview

### Data Flow

```
User Input → localStorage ←→ Cloud Sync ←→ Server
              │                     │
              ▼                     ▼
         Immediate UI          Background sync
         update                (debounced)
```

### Three Layers of Storage

| Layer | Technology | Purpose | Characteristics |
|---|---|---|---|
| **1. In-memory** (React state, stores) | Context, hooks | UI rendering, immediate feedback | Fast, ephemeral, lost on refresh |
| **2. Local persistence** | localStorage, IndexedDB | Offline survival, cache | Slow writes, syncs to cloud |
| **3. Cloud** | Supabase, Firebase, custom API | Multi-device, backup, sharing | Network-dependent, eventual consistency |

### The Core Challenge

```
localStorage and cloud are BOTH sources of truth initially.
The sync engine must reconcile them into a consistent state.
```

---

## 2. Bootstrap & Seed Pattern

### Startup Sequence

```
App launches
  ↓
1. Load from localStorage (instant UI)
  ↓
2. Check if Supabase/cloud is configured
  │   NO  → Run in local-only mode (done)
  │   YES → ↓
  │
3. Check cloud for existing data
  │   EMPTY → Seed local data to cloud (first-time upload)
  │   HAS DATA → ↓
  │
4. Three-way merge (local ↔ last-synced ↔ remote)
  ↓
5. Apply merged state to UI
  ↓
6. Subscribe to realtime changes
```

### Seed Logic

```typescript
async function bootstrapLocalToCloud(table, localData, orgId) {
  const cloudRows = await fetchFromCloud(table, orgId);
  
  if (cloudRows.length === 0) {
    // First time — push all local data to cloud
    const seeded = await seedRecordsToCloud(table, localData, orgId);
    return { seeded, skipped: false };
  }
  
  // Cloud has data — merge, don't seed
  return { seeded: [], skipped: true };
}
```

### Bootstrap Timing

```
Initial:    Delay bootstrap by 2-3 seconds after sign-in (let UI paint first)
Retry:      On failure, retry once after session is established
Skip:       If local data is empty (nothing to seed)
```

---

## 3. Sync Primitives

### Three Sync Hooks

| Hook | Data Shape | Use Case |
|---|---|---|
| **useCollectionSync** | Array of records | Cards, tasks, events |
| **useMapSync** | Object map (key → record) | Shoot plans, credentials |
| **useSingletonSync** | Single record | Workspace blob, settings |

### Common Hook Signature

```typescript
interface SyncConfig {
  table: string;          // DB table name
  loadLocal: () => any;   // read from localStorage
  orgId?: string;         // tenant scope
  brandId?: string;       // optional brand scope (for multi-brand apps)
}

// Returns: boolean — has initial sync loaded?
function useCollectionSync(config: SyncConfig): boolean;
```

### Internal Sync Engine

Each hook manages:

```
1. A store ref (created by createCollectionStore)
2. A synced ref (snapshot of last-pushed state for merge comparison)
3. Pending creates/removes sets (for optimistic updates during offline)
4. An "applying remote" flag (prevents feedback loops)
5. Debounced push timer
6. Realtime subscription
```

---

## 4. Three-Way Merge Algorithm

### The Merge Problem

```
You have three versions of data:
  - LOCAL:    Current state in memory (may have unsaved edits)
  - SYNCED:   Last known cloud state (snapshot from last push)
  - REMOTE:   Fresh state from cloud (possibly changed by another device)
```

### Merge Logic

```typescript
function mergeRemoteWithLocal({ remote, local, synced }) {
  if (synced === null) {
    // First sync — prefer local
    return local;
  }

  if (remote changed && local unchanged) {
    // Only remote changed → accept remote
    return remote;
  }

  if (remote unchanged && local changed) {
    // Only local changed → keep local (will push later)
    return local;
  }

  if (remote changed && local changed) {
    // Both changed → compare timestamps or do field-level merge
    if (local.updatedAt > remote.updatedAt) {
      return local; // local wins (will overwrite cloud)
    }
    return remote; // remote wins (or do smart merge)
  }

  // Neither changed
  return local;
}
```

### Field-Level Merge Strategy

```typescript
function smartMerge(remote, local, synced) {
  const merged = { ...remote };
  
  for (const key of Object.keys(local)) {
    if (!remote.hasOwnProperty(key)) {
      // New field added locally → keep
      merged[key] = local[key];
      continue;
    }
    
    if (JSON.stringify(remote[key]) === JSON.stringify(synced?.[key])) {
      // Remote hasn't changed this field → local edit wins
      merged[key] = local[key];
    }
    // else: both changed → remote wins (or timestamp check)
  }
  
  return merged;
}
```

### Rules for Auth-Critical Data (Passwords, Roles)

```
For credential tables, NEVER let remote auto-override local changes.
Use a stricter merge that preserves local password hashes unless
the change is explicitly authorized.
```

---

## 5. Conflict Resolution Strategies

| Strategy | When to Use | Pros | Cons |
|---|---|---|---|
| **Last-write-wins (timestamp)** | Simple data, logs, non-critical | Easy to implement | Data loss if clocks drift |
| **Field-level merge** | Structured records with independent fields | Preserves most changes | Complex to implement |
| **Manual resolution** | Financial, legal, settings | No data loss | Poor UX, blocks the user |
| **CRDT (Conflict-free Replicated Data Types)** | Collaborative editing | Automatic convergence | Complex, library-dependent |

**Recommended default: Field-level merge with timestamp tiebreaker.**

---

## 6. Optimistic Updates & Pending State

### Optimistic Update Flow

```
1. User makes change
2. Apply to local state immediately (UI updates instantly)
3. Add to "pending creates" / "pending removes" sets
4. Debounce (40-100ms) before pushing to cloud
5. On successful push → clear pending sets
6. On failed push → retry, show sync warning
```

### Pending State Tracking

```typescript
// localStorage-based pending tracking (survives page refresh)
const PENDING_CREATES_KEY = 'sync:pending-creates:{orgId}:{table}';
const PENDING_REMOVED_KEY = 'sync:pending-removed:{orgId}:{table}';

function loadPendingCreates(orgId, table): Set<string> {
  const raw = localStorage.getItem(PENDING_CREATES_KEY.replace('{orgId}', orgId).replace('{table}', table));
  return new Set(raw ? JSON.parse(raw) : []);
}

function savePendingCreates(orgId, table, set: Set<string>) {
  localStorage.setItem(/* ... */, JSON.stringify([...set]));
}
```

### Debounce Timing

```
Local push to cloud:     40-100ms  (batch rapid edits)
Realtime refetch:         80ms      (debounce rapid remote changes)
Focus refetch cooldown:   30s       (don't refetch too often on tab-switch)
```

---

## 7. Realtime Subscriptions

### Setup

```typescript
const channel = supabase
  .channel(`${table}_${orgId}_changes`)
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table, filter: `org_id=eq.${orgId}` },
    (payload) => handleRealtimeEvent(payload)
  )
  .subscribe();
```

### Realtime Event Handling

```typescript
function handleRealtimeEvent(payload) {
  if (payload.eventType === 'DELETE') {
    // Remove from local state if not a pending local delete
    if (!pendingRemoved.has(payload.old.id)) {
      removeFromLocal(payload.old.id);
    }
    return;
  }

  if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
    const { id, data } = payload.new;
    
    if (pendingRemoved.has(id)) return; // We just deleted this
    
    if (localData[id] === undefined) {
      // New record from another device → add to local
      localData[id] = data;
    } else {
      // Both may have changed → three-way merge
      localData[id] = mergeRemoteWithLocal({
        remote: data,
        local: localData[id],
        synced: syncedSnapshot.get(id),
      });
    }
  }
}
```

### Subscription Lifecycle

```
1. Subscribe on mount (after org is known)
2. Unsubscribe on unmount
3. Resubscribe on org/tenant change
4. Use channel name scoped to {table}_{orgId} for isolation
```

---

## 8. Sync Health Monitoring

### Health States

| State | Meaning | UI Treatment |
|---|---|---|
| `idle` | No sync needed | Nothing shown |
| `syncing` | Push in progress | Subtle spinner |
| `in_sync` | Everything synced | Brief green checkmark |
| `local_only` | Cloud not configured | Persistent info banner |
| `error` | Sync failed | Red/orange warning banner |
| `degraded` | Intermittent failures | Yellow caution banner |

### Health Check Service

```typescript
interface SyncIssue {
  level: 'error' | 'warn' | 'info';
  table: string;
  message: string;
  timestamp: number;
}

function subscribeSyncIssues(callback: (issue: SyncIssue | null) => void) {
  // Listens to error events from sync hooks
  // Clears issue after timeout or on successful re-sync
}
```

---

## 9. Write Path Protection

### The Two-Path Problem

```
Path 1: Client SDK → direct DB (via row-level security)
Path 2: Admin API → service role (bypasses RLS)
```

### Protection Layers

```
Layer 1 (App): Filter functions guard upserts/deletes before sending
Layer 2 (DB): Triggers re-attach blanked fields, prevent zero-user rows
Layer 3 (API): Server-side sanitization of incoming data
```

### Filter Functions

```typescript
function filterProtectedSyncUpserts(table, changes) {
  if (table === 'credentials') {
    return changes.filter(row => row.data?.username && row.data?.passwordHash);
  }
  return changes;
}

function filterProtectedSyncRemovals(table, removed, pendingRemoved) {
  if (table === 'credentials') {
    // Only allow deletes that were explicitly confirmed
    return removed.filter(id => pendingRemoved.has(String(id)));
  }
  return removed;
}
```

---

## 10. Common Sync Anti-Patterns

| Anti-pattern | Why It's Bad | Fix |
|---|---|---|
| Blindly applying remote changes | Overwrites user's unsaved work | Three-way merge with snapshot comparison |
| No debounce on push | Floods network with tiny writes | Debounce 40-100ms, batch changes |
| No pending state tracking | Offline edits lost on page refresh | Persist pending creates/removes in localStorage |
| No realtime subscription | Stale data until manual refresh | Subscribe to table changes |
| Same channel for all users | Cross-tenant data leak | Scope channels to {table}_{orgId} |
| No sync health monitoring | Silent data loss | Report errors to UI banner |
| Sync on every keystroke | Wastes bandwidth, kills battery | Debounce + only sync when component unmounts or timer fires |

---

## 11. Implementation Checklist for New Sync System

- [ ] Choose local persistence layer (localStorage vs IndexedDB vs SQLite)
- [ ] Implement bootstrap/seed pattern
- [ ] Set up three sync primitives (collection, map, singleton)
- [ ] Implement three-way merge with field-level strategy
- [ ] Add pending state tracking for optimistic updates
- [ ] Set up realtime subscriptions with tenant-scoped channels
- [ ] Implement debounced push (40-100ms)
- [ ] Add sync health monitoring + UI banner
- [ ] Set up write path protection (app-level guards + DB triggers)
- [ ] Handle focus/visibility change (refetch on tab return)
- [ ] Implement retry with exponential backoff on push failure
- [ ] Add offline detection and graceful degradation