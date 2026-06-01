import { useEffect, useRef, useState } from 'react';
import { supabase, SUPABASE_ENABLED } from './supabaseClient';
import { createCollectionStore } from './supabaseSync';
import { ensureStaffSupabaseSession, hasStaffSupabaseSession } from './staffSupabaseAuth';
import { pushStaffSync } from './staffSyncApi';
import { useStaffAuth } from '../context/StaffAuthContext';

const FETCH_TIMEOUT_MS = 12000;

function pendingRemovedKey(orgId, table) {
  return `medici-pending-removed:${orgId}:${table}`;
}

function loadPendingRemoved(orgId, table) {
  try {
    const raw = sessionStorage.getItem(pendingRemovedKey(orgId, table));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function savePendingRemoved(orgId, table, ids) {
  const key = pendingRemovedKey(orgId, table);
  if (!ids.size) {
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, JSON.stringify([...ids]));
}

function excludePendingRemoved(items, getId, pendingRemoved) {
  if (!pendingRemoved.size) return items;
  return items.filter((record) => !pendingRemoved.has(String(getId(record))));
}

/** Keep unsynced local edits when a realtime pull returns stale cloud data. */
function mergeRemoteWithLocalPending({
  remoteItems,
  getId,
  syncedSnapshot,
  localItems,
  pendingRemoved,
}) {
  const synced = syncedSnapshot || new Map();
  const localById = new Map(localItems.map((record) => [String(getId(record)), record]));
  const remoteIds = new Set();

  const merged = remoteItems.map((remote) => {
    const id = String(getId(remote));
    remoteIds.add(id);
    const local = localById.get(id);
    if (!local) return remote;

    const localStr = JSON.stringify(local);
    const remoteStr = JSON.stringify(remote);
    if (localStr === remoteStr) return remote;

    const syncedStr = synced.get(id);
    if (syncedStr === undefined || (syncedStr !== localStr && localStr !== remoteStr)) {
      return local;
    }
    return remote;
  });

  for (const local of localItems) {
    const id = String(getId(local));
    if (pendingRemoved.has(id) || remoteIds.has(id)) continue;
    merged.push(local);
  }

  return merged;
}

function recordsMatchSnapshot(items, snapshot, getId) {
  const next = new Map(items.map((record) => [String(getId(record)), JSON.stringify(record)]));
  if (snapshot.size !== next.size) return false;
  for (const [id, value] of next.entries()) {
    if (snapshot.get(id) !== value) return false;
  }
  return true;
}

async function fetchRowsWithTimeout(store) {
  return Promise.race([
    store.fetchAll(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Supabase fetch timed out')), FETCH_TIMEOUT_MS);
    }),
  ]);
}

/**
 * Mirrors an array of records to a Supabase table with per-record writes and
 * live updates — without changing any of the hook's existing mutation logic.
 *
 * How it works:
 *   - On mount, loads rows from Supabase (or seeds from localStorage on first run).
 *   - Subscribes to realtime so other tabs/devices update this one live.
 *   - Whenever `items` changes locally, diffs against the last-synced snapshot and
 *     upserts only the changed records / deletes removed ones.
 *
 * When Supabase is disabled, this is a no-op and the hook keeps using localStorage.
 */
export function useCollectionSync({
  table,
  items,
  setItems,
  getId,
  normalize,
  filterItems,
  loadLocal,
}) {
  const { orgId, orgReady, isLegacyOrg } = useStaffAuth();
  const storeRef = useRef(null);
  const syncedRef = useRef(null); // Map<id, JSON string of last-synced record>
  const applyingRemoteRef = useRef(false);
  const loadedRef = useRef(!SUPABASE_ENABLED);
  const pendingWriteRef = useRef(false);
  const pendingRemovedRef = useRef(new Set());
  const localItemsRef = useRef(items);
  const [writeNonce, setWriteNonce] = useState(0);

  localItemsRef.current = items;

  if (SUPABASE_ENABLED && orgReady && orgId) {
    storeRef.current = createCollectionStore(table);
  }

  useEffect(() => {
    if (!SUPABASE_ENABLED || !supabase) return undefined;

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && pendingWriteRef.current) {
        setWriteNonce((current) => current + 1);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!SUPABASE_ENABLED || !orgReady || !orgId) return undefined;

    storeRef.current = createCollectionStore(table);
    syncedRef.current = null;
    applyingRemoteRef.current = false;
    loadedRef.current = false;
    pendingRemovedRef.current = loadPendingRemoved(orgId, table);

    const store = storeRef.current;
    let active = true;

    const applyRemote = async () => {
      try {
        const rows = await fetchRowsWithTimeout(store);
        if (!active) return;

        const mapRow = (row) => (normalize ? normalize(row.data ?? row) : row.data ?? row);

        // First run with an empty table: seed from local data for the legacy org only.
        if (rows.length === 0 && loadLocal && isLegacyOrg) {
          const local = loadLocal();
          if (local.length) {
            const canWrite = await hasStaffSupabaseSession();
            if (!canWrite) {
              console.warn(
                `[supabase:${table}] using local data — cloud write session not ready yet`,
              );
              applyingRemoteRef.current = true;
              syncedRef.current = new Map(local.map((r) => [String(getId(r)), JSON.stringify(r)]));
              loadedRef.current = true;
              setItems(local);
              return;
            }
            await store.upsertRecords(local.map((r) => ({ id: getId(r), data: r })));
            applyingRemoteRef.current = true;
            syncedRef.current = new Map(local.map((r) => [String(getId(r)), JSON.stringify(r)]));
            loadedRef.current = true;
            setItems(local);
            return;
          }
        }

        if (rows.length === 0) {
          if (loadLocal && isLegacyOrg) {
            const local = loadLocal();
            if (local.length) {
              applyingRemoteRef.current = true;
              syncedRef.current = new Map(local.map((r) => [String(getId(r)), JSON.stringify(r)]));
              loadedRef.current = true;
              setItems(local);
              return;
            }
          }

          applyingRemoteRef.current = true;
          syncedRef.current = new Map();
          loadedRef.current = true;
          setItems([]);
          return;
        }

        const allItems = rows.map(mapRow);
        const filteredItems = filterItems ? filterItems(allItems) : allItems;
        const keptItems = excludePendingRemoved(
          filteredItems,
          getId,
          pendingRemovedRef.current,
        );

        const keptIds = new Set(keptItems.map((record) => String(getId(record))));
        const droppedIds = filteredItems
          .map((record) => String(getId(record)))
          .filter((id) => !keptIds.has(id));

        if (droppedIds.length) {
          const canWrite = await hasStaffSupabaseSession();
          if (canWrite) {
            await store.deleteRecords(droppedIds);
          }
        }

        const previousSynced = syncedRef.current || new Map();
        syncedRef.current = new Map(
          keptItems.map((record) => [String(getId(record)), JSON.stringify(record)]),
        );

        const mergedItems = mergeRemoteWithLocalPending({
          remoteItems: keptItems,
          getId,
          syncedSnapshot: previousSynced,
          localItems: localItemsRef.current,
          pendingRemoved: pendingRemovedRef.current,
        });
        const hasUnsyncedLocalChanges = !recordsMatchSnapshot(
          mergedItems,
          syncedRef.current,
          getId,
        );

        applyingRemoteRef.current = true;
        loadedRef.current = true;
        setItems(mergedItems);

        if (hasUnsyncedLocalChanges) {
          pendingWriteRef.current = true;
          queueMicrotask(() => setWriteNonce((current) => current + 1));
        }
      } catch (err) {
        console.error(`[supabase:${table}] load/seed failed:`, err?.message || err, err);
        if (loadLocal) {
          const local = excludePendingRemoved(loadLocal(), getId, pendingRemovedRef.current);
          if (local.length) {
            applyingRemoteRef.current = true;
            syncedRef.current = new Map(local.map((r) => [String(getId(r)), JSON.stringify(r)]));
            setItems(local);
          }
        }
        loadedRef.current = true;
      }
    };

    applyRemote();
    const unsubscribe = store.subscribe(() => applyRemote());
    return () => {
      active = false;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, orgReady, table, isLegacyOrg]);

  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    if (!loadedRef.current) return;

    // This change came from a remote pull — skip only when state matches the cloud snapshot.
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      const snapshot = syncedRef.current || new Map();
      if (recordsMatchSnapshot(items, snapshot, getId)) {
        return;
      }
    }

    let cancelled = false;

    const pushChanges = async () => {
      const prev = syncedRef.current || new Map();
      const next = new Map(items.map((r) => [String(getId(r)), JSON.stringify(r)]));

      const changed = [];
      for (const record of items) {
        const id = String(getId(record));
        if (prev.get(id) !== next.get(id)) changed.push(record);
      }
      const removed = [];
      for (const id of prev.keys()) {
        if (!next.has(id)) removed.push(id);
      }

      if (removed.length) {
        for (const id of removed) pendingRemovedRef.current.add(id);
        savePendingRemoved(orgId, table, pendingRemovedRef.current);
      }

      if (!changed.length && !removed.length) return;

      const store = storeRef.current;

      let canWrite = await hasStaffSupabaseSession();
      if (!canWrite) {
        await ensureStaffSupabaseSession();
        canWrite = await hasStaffSupabaseSession();
      }

      try {
        if (canWrite) {
          if (changed.length) {
            await store.upsertRecords(changed.map((r) => ({ id: getId(r), data: r })));
          }
          if (removed.length) {
            await store.deleteRecords(removed);
          }
        } else {
          const ok = await pushStaffSync({ table, changed, removed });
          if (!ok) {
            pendingWriteRef.current = true;
            console.warn(
              `[supabase:${table}] skipped write — no database session. Log out and log in again.`,
            );
            return;
          }
        }

        if (!cancelled) {
          for (const id of removed) pendingRemovedRef.current.delete(id);
          savePendingRemoved(orgId, table, pendingRemovedRef.current);
          syncedRef.current = next;
          pendingWriteRef.current = false;
        }
      } catch (err) {
        console.error(`[supabase:${table}] sync failed:`, err?.message || err, err);
        pendingWriteRef.current = true;
      }
    };

    pushChanges();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, writeNonce, orgId, table]);
}
