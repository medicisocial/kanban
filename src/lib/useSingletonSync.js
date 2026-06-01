import { useEffect, useRef, useState } from 'react';
import { supabase, SUPABASE_ENABLED } from './supabaseClient';
import { createCollectionStore } from './supabaseSync';
import { ensureStaffSupabaseSession, hasStaffSupabaseSession } from './staffSupabaseAuth';
import { pushStaffSyncSingleton } from './staffSyncApi';
import { useStaffAuth } from '../context/StaffAuthContext';
import {
  fetchRowsWithTimeout,
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

  localValueRef.current = value;

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
          loadedRef.current = true;
          setValue(merged);

          if (hasUnsyncedLocalChanges) {
            pendingWriteRef.current = true;
            queueMicrotask(() => setWriteNonce((current) => current + 1));
          }
          return;
        }

        // First run with an empty table: seed from local data for the legacy org only.
        if (local && isLegacyOrg) {
          const canWrite = await hasStaffSupabaseSession();
          if (!canWrite) {
            console.warn(
              `[supabase:${table}] using local data — cloud write session not ready yet`,
            );
            applyingRemoteRef.current = true;
            syncedRef.current = JSON.stringify(local);
            loadedRef.current = true;
            setValue(local);
            return;
          }
          await store.upsertRecords([{ id: recordId, data: local }]);
          applyingRemoteRef.current = true;
          syncedRef.current = JSON.stringify(local);
          loadedRef.current = true;
          setValue(local);
          return;
        }

        if (local) {
          applyingRemoteRef.current = true;
          syncedRef.current = JSON.stringify(local);
          loadedRef.current = true;
          setValue(local);
          pendingWriteRef.current = true;
          queueMicrotask(() => setWriteNonce((current) => current + 1));
          return;
        }

        applyingRemoteRef.current = true;
        syncedRef.current = JSON.stringify(local);
        loadedRef.current = true;
        if (loadLocal) setValue(local);
      } catch (err) {
        console.error(`[supabase:${table}] load/seed failed:`, err?.message || err, err);
        if (loadLocal) {
          const local = loadLocal();
          if (local) {
            applyingRemoteRef.current = true;
            syncedRef.current = JSON.stringify(local);
            setValue(local);
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
}
