import { useEffect, useRef, useState } from 'react';

const REALTIME_REFETCH_DEBOUNCE_MS = 80;
const SYNC_PUSH_DEBOUNCE_MS = 40;
const FOCUS_REFETCH_MIN_MS = 30_000;
import { supabase, SUPABASE_ENABLED } from './supabaseClient';
import { createCollectionStore } from './supabaseSync';
import { ensureStaffSupabaseSession, hasStaffSupabaseSession } from './staffSupabaseAuth';
import { pushStaffSyncRows } from './staffSyncApi';
import { seedRecordsToCloud } from './syncSeed';
import { reportSyncIssue } from './workspaceSyncHealth';
import { subscribeWorkspaceRefetch } from '../utils/workspaceReload';
import { useStaffAuth } from '../context/StaffAuthContext';
import {
  augmentLocalMapWithPendingCreates,
  fetchRowsWithTimeout,
  filterProtectedSyncRemovals,
  filterProtectedSyncUpserts,
  loadPendingCreates,
  loadPendingRemoved,
  localCollectionHasRecords,
  clearCredentialPasswordChanges,
  loadCredentialPasswordChanges,
  markPendingCreates,
  markPendingRemoved,
  mapMatchesSnapshot,
  mergePortalCredentialDataForPush,
  mergeRemoteMapWithLocalPending,
  mergeRemoteRecordWithLocal,
  mergePortalCredentialValue,
  readSyncedLocalMap,
  savePendingCreates,
  savePendingRemoved,
  unmarkPendingCreates,
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
  const [syncLoaded, setSyncLoaded] = useState(!SUPABASE_ENABLED);
  const pendingWriteRef = useRef(false);
  const pendingRemovedRef = useRef(new Set());
  const pendingLocalCreatesRef = useRef(new Set());
  const localMapRef = useRef(map);
  const [writeNonce, setWriteNonce] = useState(0);

  const markSyncLoaded = () => {
    loadedRef.current = true;
    setSyncLoaded(true);
  };

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
    const hasCachedItems = localCollectionHasRecords(localMapRef.current);
    loadedRef.current = hasCachedItems;
    if (!hasCachedItems) {
      setSyncLoaded(false);
    } else {
      markSyncLoaded();
    }
    pendingRemovedRef.current = loadPendingRemoved(orgId, table);
    pendingLocalCreatesRef.current = loadPendingCreates(orgId, table);

    const store = storeRef.current;
    let active = true;
    let refetchTimer = null;
    const protectCredentialEntries = table === 'client_portal_credentials';

    const applyRemote = async () => {
      pendingRemovedRef.current = loadPendingRemoved(orgId, table);
      pendingLocalCreatesRef.current = loadPendingCreates(orgId, table);

      const readLocal = () =>
        loadLocal ? readSyncedLocalMap(loadLocal, orgId, table) : {};

      try {
        const rows = await fetchRowsWithTimeout(store);
        if (!active) return;

        const local = readLocal();
        const localKeys = Object.keys(local);

        // Empty cloud table: keep local cache when it still has records (any org).
        if (rows.length === 0) {
          if (localKeys.length) {
            let seedRows = localKeys.map((key) => ({ id: key, data: local[key] }));
            seedRows = filterProtectedSyncUpserts(table, seedRows);
            if (seedRows.length) {
              void seedRecordsToCloud({ table, orgId, store, rows: seedRows });
            }
            applyingRemoteRef.current = true;
            syncedRef.current = new Map(localKeys.map((key) => [key, JSON.stringify(local[key])]));
            markSyncLoaded();
            setMap(local);
            pendingWriteRef.current = true;
            queueMicrotask(() => setWriteNonce((current) => current + 1));
            return;
          }

          applyingRemoteRef.current = true;
          syncedRef.current = new Map();
          markSyncLoaded();
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
          localMap: augmentLocalMapWithPendingCreates(
            localMapRef.current,
            loadLocal ? readLocal : null,
            pendingLocalCreatesRef.current,
          ),
          pendingRemoved: pendingRemovedRef.current,
          pendingLocalCreates: pendingLocalCreatesRef.current,
          protectCredentialEntries: table === 'client_portal_credentials',
          orgId,
        });
        const hasUnsyncedLocalChanges = !mapMatchesSnapshot(mergedMap, syncedRef.current);

        applyingRemoteRef.current = true;
        markSyncLoaded();
        setMap(mergedMap);

        if (hasUnsyncedLocalChanges) {
          pendingWriteRef.current = true;
          queueMicrotask(() => setWriteNonce((current) => current + 1));
        }
      } catch (err) {
        console.error(`[supabase:${table}] load/seed failed:`, err?.message || err, err);
        if (loadLocal) {
          const local = readLocal();
          const keys = Object.keys(local);
          if (localCollectionHasRecords(local)) {
            applyingRemoteRef.current = true;
            syncedRef.current = new Map(keys.map((key) => [key, JSON.stringify(local[key])]));
            setMap(local);
          }
        }
        markSyncLoaded();
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
      pendingLocalCreatesRef.current = loadPendingCreates(orgId, table);

      if (payload.eventType === 'DELETE') {
        const key = String(payload.old?.id || '');
        if (!key || pendingRemovedRef.current.has(key)) return;

        applyingRemoteRef.current = true;
        const snapshot = syncedRef.current || new Map();
        snapshot.delete(key);
        syncedRef.current = snapshot;
        setMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        return;
      }

      if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') {
        scheduleApplyRemote();
        return;
      }

      const row = payload.new;
      if (!row?.id || row.data === undefined) {
        scheduleApplyRemote();
        return;
      }

      const key = String(row.id);
      if (pendingRemovedRef.current.has(key)) return;

      const remoteValue = row.data;
      applyingRemoteRef.current = true;
      setMap((prev) => {
        const localValue = prev[key];
        const previousSynced = syncedRef.current || new Map();

        if (localValue === undefined) {
          if (previousSynced.has(key)) return prev;
          const next = { ...prev, [key]: remoteValue };
          syncedRef.current = new Map(previousSynced);
          syncedRef.current.set(key, JSON.stringify(remoteValue));
          return next;
        }

        const merged = protectCredentialEntries
          ? mergePortalCredentialValue({
              remote: remoteValue,
              local: localValue,
              syncedStr: previousSynced.get(key),
            })
          : mergeRemoteRecordWithLocal({
              remote: remoteValue,
              local: localValue,
              syncedStr: previousSynced.get(key),
            });

        syncedRef.current = new Map(previousSynced);
        syncedRef.current.set(key, JSON.stringify(merged));
        return { ...prev, [key]: merged };
      });
    };

    let lastFetchAt = 0;

    const onFocus = () => {
      if (!active || !loadedRef.current) return;
      const isEmpty = !localCollectionHasRecords(localMapRef.current);
      if (!isEmpty && Date.now() - lastFetchAt < FOCUS_REFETCH_MIN_MS) return;
      applyRemote();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });

    const unsubscribeRefetch = subscribeWorkspaceRefetch(() => {
      if (!active) return;
      applyRemote();
    });

    applyRemote().then(() => { lastFetchAt = Date.now(); }).catch(() => {});
    const unsubscribe = store.subscribe((payload) => {
      lastFetchAt = Date.now();
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
      unsubscribeRefetch();
      window.removeEventListener('focus', onFocus);
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
    let pushTimer = null;

    const pushChanges = async () => {
      const prev = syncedRef.current || new Map();
      const next = new Map(entries.map(([key, value]) => [key, JSON.stringify(value)]));

      const changed = [];
      for (const [key, value] of entries) {
        if (prev.get(key) !== next.get(key)) changed.push({ id: key, data: value });
      }
      const safeChanged = filterProtectedSyncUpserts(table, changed);
      const rawRemoved = [];
      for (const key of prev.keys()) {
        if (!next.has(key)) rawRemoved.push(key);
      }
      const removed = filterProtectedSyncRemovals(table, rawRemoved, pendingRemovedRef.current);
      if (rawRemoved.length > removed.length) {
        console.warn(
          `[supabase:${table}] blocked ${rawRemoved.length - removed.length} accidental delete(s) — re-sync from cloud`,
        );
      }

      if (removed.length) {
        markPendingRemoved(orgId, table, removed);
        unmarkPendingCreates(orgId, table, removed);
        for (const id of removed) {
          pendingRemovedRef.current.add(id);
          pendingLocalCreatesRef.current.delete(id);
        }
        savePendingRemoved(orgId, table, pendingRemovedRef.current);
      }

      const newKeys = [];
      for (const key of entries.map(([key]) => key)) {
        if (!prev.has(key)) newKeys.push(key);
      }
      if (newKeys.length) {
        markPendingCreates(orgId, table, newKeys);
        for (const key of newKeys) pendingLocalCreatesRef.current.add(key);
        savePendingCreates(orgId, table, pendingLocalCreatesRef.current);
      }

      if (!safeChanged.length && !removed.length) return;

      const store = storeRef.current;

      let canWrite = await hasStaffSupabaseSession();
      if (!canWrite) {
        await ensureStaffSupabaseSession();
        canWrite = await hasStaffSupabaseSession();
      }

      try {
        let rowsToWrite = safeChanged;
        const passwordChangeBrands =
          table === 'client_portal_credentials' ? [...loadCredentialPasswordChanges(orgId)] : [];

        if (table === 'client_portal_credentials' && rowsToWrite.length) {
          const existingRows = await fetchRowsWithTimeout(store);
          const existingByBrand = Object.fromEntries(existingRows.map((row) => [row.id, row.data]));
          rowsToWrite = rowsToWrite.map((row) => ({
            id: row.id,
            data: mergePortalCredentialDataForPush(existingByBrand[row.id], row.data, {
              allowPasswordChange: passwordChangeBrands.includes(String(row.id)),
            }),
          }));
          rowsToWrite = filterProtectedSyncUpserts(table, rowsToWrite);
        }

        if (canWrite) {
          if (rowsToWrite.length) await store.upsertRecords(rowsToWrite);
          if (removed.length) await store.deleteRecords(removed);
        } else {
          const ok = await pushStaffSyncRows(table, rowsToWrite, removed, orgId, {
            credentialPasswordChanges: passwordChangeBrands,
          });
          if (!ok) {
            pendingWriteRef.current = true;
            reportSyncIssue({
              level: 'warn',
              table,
              message:
                'Changes are saved on this device but could not reach the cloud. Stay signed in and reload, or sign in again.',
            });
            return;
          }
        }

        if (!cancelled) {
          if (table === 'client_portal_credentials' && passwordChangeBrands.length) {
            clearCredentialPasswordChanges(orgId, passwordChangeBrands);
          }
          for (const id of removed) pendingRemovedRef.current.delete(id);
          for (const key of [...pendingLocalCreatesRef.current]) {
            if (next.has(key)) pendingLocalCreatesRef.current.delete(key);
          }
          savePendingRemoved(orgId, table, pendingRemovedRef.current);
          savePendingCreates(orgId, table, pendingLocalCreatesRef.current);
          syncedRef.current = next;
          pendingWriteRef.current = false;
        }
      } catch (err) {
        console.error(`[supabase:${table}] sync failed:`, err?.message || err, err);
        pendingWriteRef.current = true;
        reportSyncIssue({
          level: 'error',
          table,
          message: err?.message || `Could not save ${table} to the cloud.`,
        });
      }
    };

    const schedulePushChanges = () => {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => {
        if (!cancelled) pushChanges();
      }, SYNC_PUSH_DEBOUNCE_MS);
    };

    schedulePushChanges();

    return () => {
      cancelled = true;
      clearTimeout(pushTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, writeNonce, orgId, table]);

  return syncLoaded;
}
