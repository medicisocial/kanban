import { useEffect, useRef, useState } from 'react';

const FOCUS_REFETCH_MIN_MS = 30_000;
import { supabase, SUPABASE_ENABLED } from './supabaseClient';
import { createCollectionStore } from './supabaseSync';
import { ensureStaffSupabaseSession, hasStaffSupabaseSession } from './staffSupabaseAuth';
import { pushStaffSyncSingleton } from './staffSyncApi';
import { seedRecordsToCloud } from './syncSeed';
import { subscribeWorkspaceRefetch } from '../utils/workspaceReload';
import { useStaffAuth } from '../context/StaffAuthContext';
import {
  fetchRowsWithTimeout,
  localCollectionHasRecords,
  mergeClientsWorkspaceState,
  mergeRemoteSingletonWithLocal,
  singletonMatchesSnapshot,
} from './syncHelpers';

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
    loadedRef.current = false;
    setSyncLoaded(false);

    const store = storeRef.current;
    let active = true;

    const applyRemote = async () => {
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
          await seedRecordsToCloud({
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

    let lastFetchAt = 0;

    const onFocus = () => {
      if (!active || !loadedRef.current) return;
      const isEmpty = !localCollectionHasRecords(localValueRef.current);
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
    const unsubscribe = store.subscribe(() => {
      lastFetchAt = Date.now();
      applyRemote();
    });
    return () => {
      active = false;
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

    const pushChanges = async () => {
      const store = storeRef.current;

      let canWrite = await hasStaffSupabaseSession();
      if (!canWrite) {
        await ensureStaffSupabaseSession();
        canWrite = await hasStaffSupabaseSession();
      }

      try {
        if (canWrite) {
          await store.upsertRecords([{ id: recordId, data: value }]);
        } else {
          const ok = await pushStaffSyncSingleton(table, recordId, value);
          if (!ok) {
            pendingWriteRef.current = true;
            console.warn(
              `[supabase:${table}] skipped write — no database session. Log out and log in again.`,
            );
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
      }
    };

    pushChanges();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, writeNonce, orgId, table, recordId]);

  return syncLoaded;
}
