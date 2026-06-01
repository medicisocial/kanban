import { useEffect, useRef, useState } from 'react';
import { supabase, SUPABASE_ENABLED } from './supabaseClient';
import { createCollectionStore } from './supabaseSync';
import { ensureStaffSupabaseSession, hasStaffSupabaseSession } from './staffSupabaseAuth';
import { pushStaffSyncRows } from './staffSyncApi';
import { useStaffAuth } from '../context/StaffAuthContext';
import {
  fetchRowsWithTimeout,
  loadPendingRemoved,
  mapMatchesSnapshot,
  mergeRemoteMapWithLocalPending,
  savePendingRemoved,
} from './syncHelpers';

/**
 * Like useCollectionSync, but for collections stored as a plain object map
 * (e.g. shoot plans keyed by "client|date", portal credentials keyed by client).
 *
 * Each map entry becomes a row: { id: key, data: value }. Remote rows are
 * rebuilt back into an object before being applied to state.
 *
 * When Supabase is disabled this is a no-op and the hook keeps using localStorage.
 */
export function useMapSync({ table, map, setMap, loadLocal }) {
  const { orgId, orgReady, isLegacyOrg } = useStaffAuth();
  const storeRef = useRef(null);
  const syncedRef = useRef(null); // Map<key, JSON string of last-synced value>
  const applyingRemoteRef = useRef(false);
  const loadedRef = useRef(!SUPABASE_ENABLED);
  const pendingWriteRef = useRef(false);
  const pendingRemovedRef = useRef(new Set());
  const localMapRef = useRef(map);
  const [writeNonce, setWriteNonce] = useState(0);

  localMapRef.current = map;

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

        const local = loadLocal ? loadLocal() || {} : {};
        const localKeys = Object.keys(local);

        // First run with an empty table: seed from local data for the legacy org only.
        if (rows.length === 0 && localKeys.length && isLegacyOrg) {
          const canWrite = await hasStaffSupabaseSession();
          if (!canWrite) {
            console.warn(
              `[supabase:${table}] using local data — cloud write session not ready yet`,
            );
            applyingRemoteRef.current = true;
            syncedRef.current = new Map(localKeys.map((key) => [key, JSON.stringify(local[key])]));
            loadedRef.current = true;
            setMap(local);
            return;
          }
          await store.upsertRecords(localKeys.map((key) => ({ id: key, data: local[key] })));
          applyingRemoteRef.current = true;
          syncedRef.current = new Map(localKeys.map((key) => [key, JSON.stringify(local[key])]));
          loadedRef.current = true;
          setMap(local);
          return;
        }

        if (rows.length === 0) {
          if (localKeys.length) {
            applyingRemoteRef.current = true;
            syncedRef.current = new Map(localKeys.map((key) => [key, JSON.stringify(local[key])]));
            loadedRef.current = true;
            setMap(local);
            pendingWriteRef.current = true;
            queueMicrotask(() => setWriteNonce((current) => current + 1));
            return;
          }

          applyingRemoteRef.current = true;
          syncedRef.current = new Map();
          loadedRef.current = true;
          setMap({});
          return;
        }

        const remoteMap = {};
        for (const row of rows) remoteMap[row.id] = row.data;

        const previousSynced = syncedRef.current || new Map();
        syncedRef.current = new Map(
          Object.entries(remoteMap).map(([key, value]) => [key, JSON.stringify(value)]),
        );

        const mergedMap = mergeRemoteMapWithLocalPending({
          remoteMap,
          syncedSnapshot: previousSynced,
          localMap: localMapRef.current,
          pendingRemoved: pendingRemovedRef.current,
        });
        const hasUnsyncedLocalChanges = !mapMatchesSnapshot(mergedMap, syncedRef.current);

        applyingRemoteRef.current = true;
        loadedRef.current = true;
        setMap(mergedMap);

        if (hasUnsyncedLocalChanges) {
          pendingWriteRef.current = true;
          queueMicrotask(() => setWriteNonce((current) => current + 1));
        }
      } catch (err) {
        console.error(`[supabase:${table}] load/seed failed:`, err?.message || err, err);
        if (loadLocal) {
          const local = loadLocal() || {};
          const keys = Object.keys(local);
          if (keys.length) {
            applyingRemoteRef.current = true;
            syncedRef.current = new Map(keys.map((key) => [key, JSON.stringify(local[key])]));
            setMap(local);
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

    const entries = Object.entries(map || {});

    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      const snapshot = syncedRef.current || new Map();
      if (mapMatchesSnapshot(map, snapshot)) {
        return;
      }
    }

    let cancelled = false;

    const pushChanges = async () => {
      const prev = syncedRef.current || new Map();
      const next = new Map(entries.map(([key, value]) => [key, JSON.stringify(value)]));

      const changed = [];
      for (const [key, value] of entries) {
        if (prev.get(key) !== next.get(key)) changed.push({ id: key, data: value });
      }
      const removed = [];
      for (const key of prev.keys()) {
        if (!next.has(key)) removed.push(key);
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
          if (changed.length) await store.upsertRecords(changed);
          if (removed.length) await store.deleteRecords(removed);
        } else {
          const ok = await pushStaffSyncRows(table, changed, removed);
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
  }, [map, writeNonce, orgId, table]);
}
