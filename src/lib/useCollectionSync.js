import { useEffect, useRef, useState } from 'react';
import { supabase, SUPABASE_ENABLED } from './supabaseClient';
import { createCollectionStore } from './supabaseSync';
import { ensureStaffSupabaseSession, hasStaffSupabaseSession } from './staffSupabaseAuth';
import { pushStaffSync } from './staffSyncApi';
import { useStaffAuth } from '../context/StaffAuthContext';
import {
  fetchRowsWithTimeout,
  loadPendingRemoved,
  markPendingRemoved,
  mergeRemoteListWithLocalPending,
  mergeRemoteRecordWithLocal,
  recordsMatchSnapshot,
  savePendingRemoved,
} from './syncHelpers';

const REALTIME_REFETCH_DEBOUNCE_MS = 350;

function attachRowUpdatedAt(record, rowUpdatedAt) {
  if (!rowUpdatedAt) return record;
  const rowTs = new Date(rowUpdatedAt).getTime();
  const dataTs = record?.updatedAt || record?.createdAt || 0;
  if (rowTs <= dataTs) return record;
  return { ...record, updatedAt: rowTs };
}

function excludePendingRemoved(items, getId, pendingRemoved) {
  if (!pendingRemoved.size) return items;
  return items.filter((record) => !pendingRemoved.has(String(getId(record))));
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
    let refetchTimer = null;

    const applyRemote = async () => {
      try {
        pendingRemovedRef.current = loadPendingRemoved(orgId, table);

        const rows = await fetchRowsWithTimeout(store);
        if (!active) return;

        const mapRow = (row) => {
          const base = normalize ? normalize(row.data ?? row) : row.data ?? row;
          return attachRowUpdatedAt(base, row.updated_at);
        };

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
          const local = loadLocal ? loadLocal() : [];
          if (local.length && isLegacyOrg) {
            applyingRemoteRef.current = true;
            syncedRef.current = new Map(local.map((r) => [String(getId(r)), JSON.stringify(r)]));
            loadedRef.current = true;
            setItems(local);
            pendingWriteRef.current = true;
            queueMicrotask(() => setWriteNonce((current) => current + 1));
            return;
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

        const remoteIds = new Set(filteredItems.map((record) => String(getId(record))));
        // Clear tombstones only once the row is gone from the cloud — not when we filtered it out.
        for (const id of [...pendingRemovedRef.current]) {
          if (!remoteIds.has(id)) {
            pendingRemovedRef.current.delete(id);
          }
        }
        savePendingRemoved(orgId, table, pendingRemovedRef.current);

        const droppedIds = filteredItems
          .map((record) => String(getId(record)))
          .filter((id) => pendingRemovedRef.current.has(id));

        if (droppedIds.length) {
          let canWrite = await hasStaffSupabaseSession();
          if (!canWrite) {
            await ensureStaffSupabaseSession();
            canWrite = await hasStaffSupabaseSession();
          }
          try {
            if (canWrite) {
              await store.deleteRecords(droppedIds);
            } else {
              await pushStaffSync({ table, changed: [], removed: droppedIds, orgId });
            }
          } catch (err) {
            console.warn(`[supabase:${table}] retry delete failed:`, err?.message || err);
          }
        }

        const previousSynced = syncedRef.current || new Map();
        syncedRef.current = new Map(
          keptItems.map((record) => [String(getId(record)), JSON.stringify(record)]),
        );

        const mergedItems = mergeRemoteListWithLocalPending({
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
        if (loadLocal && isLegacyOrg) {
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

    const scheduleApplyRemote = () => {
      clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => {
        if (active) applyRemote();
      }, REALTIME_REFETCH_DEBOUNCE_MS);
    };

    const applyRealtimePayload = (payload) => {
      if (!active || !loadedRef.current || !payload?.eventType) {
        scheduleApplyRemote();
        return;
      }

      const rowOrg = payload.new?.org_id ?? payload.old?.org_id;
      if (rowOrg && rowOrg !== orgId) return;

      pendingRemovedRef.current = loadPendingRemoved(orgId, table);

      const mapRow = (row) => {
        const base = normalize ? normalize(row.data ?? row) : row.data ?? row;
        return attachRowUpdatedAt(base, row.updated_at);
      };

      if (payload.eventType === 'DELETE') {
        const id = String(payload.old?.id || '');
        if (!id || pendingRemovedRef.current.has(id)) return;

        applyingRemoteRef.current = true;
        const snapshot = syncedRef.current || new Map();
        snapshot.delete(id);
        syncedRef.current = snapshot;
        setItems((prev) => prev.filter((record) => String(getId(record)) !== id));
        return;
      }

      if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') {
        scheduleApplyRemote();
        return;
      }

      const row = payload.new;
      if (!row?.data) {
        scheduleApplyRemote();
        return;
      }

      let remote = mapRow(row);
      if (filterItems) {
        const filtered = filterItems([remote]);
        if (!filtered.length) {
          if (payload.eventType === 'UPDATE') {
            const id = String(getId(remote));
            applyingRemoteRef.current = true;
            setItems((prev) => prev.filter((record) => String(getId(record)) !== id));
          }
          return;
        }
        remote = filtered[0];
      }

      const id = String(getId(remote));
      if (pendingRemovedRef.current.has(id)) return;

      applyingRemoteRef.current = true;
      setItems((prev) => {
        const local = prev.find((record) => String(getId(record)) === id);
        const previousSynced = syncedRef.current || new Map();

        if (!local) {
          if (previousSynced.has(id)) return prev;
          const next = [...prev, remote];
          syncedRef.current = new Map(previousSynced);
          syncedRef.current.set(id, JSON.stringify(remote));
          return next;
        }

        const merged = mergeRemoteRecordWithLocal({
          remote,
          local,
          syncedStr: previousSynced.get(id),
        });
        syncedRef.current = new Map(previousSynced);
        syncedRef.current.set(id, JSON.stringify(merged));
        return prev.map((record) => (String(getId(record)) === id ? merged : record));
      });
    };

    applyRemote();
    const unsubscribe = store.subscribe((payload) => {
      if (payload && typeof payload === 'object' && payload.eventType) {
        applyRealtimePayload(payload);
        return;
      }
      scheduleApplyRemote();
    });
    return () => {
      active = false;
      clearTimeout(refetchTimer);
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
        markPendingRemoved(orgId, table, removed);
        for (const id of removed) pendingRemovedRef.current.add(String(id));
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
          for (const id of removed) pendingRemovedRef.current.delete(String(id));
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
