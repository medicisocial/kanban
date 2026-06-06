import { useEffect, useRef, useState } from 'react';

const REALTIME_REFETCH_DEBOUNCE_MS = 80;
const SYNC_PUSH_DEBOUNCE_MS = 40;
const FOCUS_REFETCH_MIN_MS = 30_000;
import { supabase, SUPABASE_ENABLED } from './supabaseClient';
import { createCollectionStore } from './supabaseSync';
import { ensureStaffSupabaseSession, hasStaffSupabaseSession } from './staffSupabaseAuth';
import { pushStaffSyncSingleton } from './staffSyncApi';
import { reportSyncIssue } from './workspaceSyncHealth';
import { seedRecordsToCloud } from './syncSeed';
import { isEditorFilePickActive } from '../utils/editorPickGuard';
import { subscribeWorkspaceRefetch } from '../utils/workspaceReload';
import { useStaffAuth } from '../context/StaffAuthContext';
import {
  fetchRowsWithTimeout,
  localCollectionHasRecords,
  mergeClientsWorkspaceState,
  mergeRemoteSingletonWithLocal,
  singletonMatchesSnapshot,
} from './syncHelpers';
import {
  mergeBrandCompanyFiles,
  mergeBrandSpecialMenus,
  mergeClientsWorkspaceData,
  mergeClientsWorkspaceFileMap,
} from '../utils/clientsWorkspaceMerge';

/**
 * Like useCollectionSync, but for a single composite object stored as one row
 * (e.g. the clients settings blob: names, colors, logos, contacts, ...).
 *
 * The whole value is stored as a single row keyed by `recordId`.
 *
 * When Supabase is disabled this is a no-op and the hook keeps using localStorage.
 */
export function useSingletonSync({ table, value, setValue, loadLocal, recordId = 'state' }) {
  const { orgId, orgReady, isLegacyOrg } = useStaffAuth();
  const storeRef = useRef(null);
  const syncedRef = useRef(null); // JSON string of last-synced value
  const applyingRemoteRef = useRef(false);
  const loadedRef = useRef(!SUPABASE_ENABLED);
  const pendingWriteRef = useRef(false);
  const localValueRef = useRef(value);
  const [writeNonce, setWriteNonce] = useState(0);
  const [syncLoaded, setSyncLoaded] = useState(!SUPABASE_ENABLED);

  localValueRef.current = value;

  const markSyncLoaded = () => {
    loadedRef.current = true;
    setSyncLoaded(true);
  };

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
    const hasCachedItems = localCollectionHasRecords(localValueRef.current);
    loadedRef.current = hasCachedItems;
    if (!hasCachedItems) {
      setSyncLoaded(false);
    } else {
      markSyncLoaded();
    }

    const store = storeRef.current;
    let active = true;
    let refetchTimer = null;

    const applyRemote = async () => {
      if (isEditorFilePickActive()) return;
      try {
        const rows = await fetchRowsWithTimeout(store);
        if (!active) return;

        const row = rows.find((entry) => String(entry.id) === recordId) || rows[0];
        const local = loadLocal ? loadLocal() : value;

        if (row) {
          const previousSynced = syncedRef.current;
          const merged =
            table === 'clients'
              ? mergeClientsWorkspaceState({
                  remote: row.data,
                  syncedStr: previousSynced,
                  local: localValueRef.current,
                })
              : mergeRemoteSingletonWithLocal({
                  remote: row.data,
                  syncedStr: previousSynced,
                  local: localValueRef.current,
                });
          syncedRef.current = JSON.stringify(row.data);
          const hasUnsyncedLocalChanges = !singletonMatchesSnapshot(merged, syncedRef.current);

          applyingRemoteRef.current = true;
          markSyncLoaded();
          setValue(merged);

          if (hasUnsyncedLocalChanges) {
            pendingWriteRef.current = true;
            queueMicrotask(() => setWriteNonce((current) => current + 1));
          }
          return;
        }

        // Empty cloud table: keep local cache when it still has records (any org).
        if (localCollectionHasRecords(local)) {
          void seedRecordsToCloud({
            table,
            orgId,
            store,
            rows: [{ id: recordId, data: local }],
          });
          applyingRemoteRef.current = true;
          syncedRef.current = JSON.stringify(local);
          markSyncLoaded();
          setValue(local);
          pendingWriteRef.current = true;
          queueMicrotask(() => setWriteNonce((current) => current + 1));
          return;
        }

        applyingRemoteRef.current = true;
        syncedRef.current = JSON.stringify(local ?? null);
        markSyncLoaded();
        if (loadLocal) setValue(local ?? loadLocal());
      } catch (err) {
        console.error(`[supabase:${table}] load/seed failed:`, err?.message || err, err);
        if (loadLocal) {
          const local = loadLocal();
          if (localCollectionHasRecords(local)) {
            applyingRemoteRef.current = true;
            syncedRef.current = JSON.stringify(local);
            setValue(local);
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
      if (isEditorFilePickActive()) return;
      if (!active || !loadedRef.current || !payload?.eventType) {
        scheduleApplyRemote();
        return;
      }

      const rowOrg = payload.new?.org_id ?? payload.old?.org_id;
      if (rowOrg && rowOrg !== orgId) return;

      const rowId = String(payload.new?.id ?? payload.old?.id ?? '');
      if (rowId && rowId !== recordId) return;

      if (payload.eventType === 'DELETE') {
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

      const previousSynced = syncedRef.current;
      const merged =
        table === 'clients'
          ? mergeClientsWorkspaceState({
              remote: row.data,
              syncedStr: previousSynced,
              local: localValueRef.current,
            })
          : mergeRemoteSingletonWithLocal({
              remote: row.data,
              syncedStr: previousSynced,
              local: localValueRef.current,
            });

      applyingRemoteRef.current = true;
      syncedRef.current = JSON.stringify(row.data);
      markSyncLoaded();
      setValue(merged);
    };

    let lastFetchAt = 0;

    const onFocus = () => {
      if (!active || !loadedRef.current || isEditorFilePickActive()) return;
      const isEmpty = !localCollectionHasRecords(localValueRef.current);
      if (!isEmpty && Date.now() - lastFetchAt < FOCUS_REFETCH_MIN_MS) return;
      applyRemote();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });

    const unsubscribeRefetch = subscribeWorkspaceRefetch(() => {
      if (!active || isEditorFilePickActive()) return;
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
  }, [orgId, orgReady, table, recordId, isLegacyOrg]);

  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    if (!loadedRef.current) return;

    const json = JSON.stringify(value);

    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      if (singletonMatchesSnapshot(value, syncedRef.current)) {
        return;
      }
    }

    if (syncedRef.current === json) return;

    let cancelled = false;
    let pushTimer = null;

    const pushChanges = async () => {
      const store = storeRef.current;

      let canWrite = await hasStaffSupabaseSession();
      if (!canWrite) {
        await ensureStaffSupabaseSession();
        canWrite = await hasStaffSupabaseSession();
      }

      try {
        let dataToWrite = value;
        if (table === 'clients') {
          try {
            const rows = await fetchRowsWithTimeout(store);
            const existing = rows.find((entry) => String(entry.id) === recordId)?.data;
            dataToWrite = mergeClientsWorkspaceData(existing, value);

            let syncedParsed = null;
            try {
              syncedParsed = syncedRef.current ? JSON.parse(syncedRef.current) : null;
            } catch {
              syncedParsed = null;
            }

            if (value?.companyFiles) {
              dataToWrite.companyFiles = mergeClientsWorkspaceFileMap(
                existing?.companyFiles,
                value?.companyFiles,
                syncedParsed?.companyFiles ?? existing?.companyFiles,
                mergeBrandCompanyFiles,
              );
            }
            if (value?.specialMenus) {
              dataToWrite.specialMenus = mergeClientsWorkspaceFileMap(
                existing?.specialMenus,
                value?.specialMenus,
                syncedParsed?.specialMenus ?? existing?.specialMenus,
                mergeBrandSpecialMenus,
              );
            }
          } catch (mergeErr) {
            console.warn(`[supabase:${table}] merge-before-write failed:`, mergeErr?.message || mergeErr);
          }
        }

        if (canWrite) {
          await store.upsertRecords([{ id: recordId, data: dataToWrite }]);
        } else {
          const ok = await pushStaffSyncSingleton(table, recordId, dataToWrite);
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
          syncedRef.current = json;
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
  }, [value, writeNonce, orgId, table, recordId]);

  return syncLoaded;
}
