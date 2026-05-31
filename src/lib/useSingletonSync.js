import { useEffect, useRef } from 'react';
import { SUPABASE_ENABLED } from './supabaseClient';
import { createCollectionStore } from './supabaseSync';
import { useStaffAuth } from '../context/StaffAuthContext';

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
        const rows = await store.fetchAll();
        if (!active) return;

        const row = rows.find((r) => String(r.id) === recordId) || rows[0];
        if (row) {
          applyingRemoteRef.current = true;
          syncedRef.current = JSON.stringify(row.data);
          loadedRef.current = true;
          setValue(row.data);
          return;
        }

        // First run with an empty table: seed from local data for the legacy org only.
        const local = loadLocal ? loadLocal() : value;
        if (!row && local && isLegacyOrg) {
          await store.upsertRecords([{ id: recordId, data: local }]);
          applyingRemoteRef.current = true;
          syncedRef.current = JSON.stringify(local);
          loadedRef.current = true;
          setValue(local);
          return;
        }

        if (!row) {
          applyingRemoteRef.current = true;
          const empty = loadLocal ? loadLocal() : value;
          syncedRef.current = JSON.stringify(empty);
          loadedRef.current = true;
          if (loadLocal) setValue(empty);
          return;
        }
      } catch (err) {
        console.error(`[supabase:${table}] load/seed failed:`, err?.message || err, err);
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

    // This change came from a remote pull — don't echo it back to the server.
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      syncedRef.current = json;
      return;
    }

    if (syncedRef.current === json) return;
    syncedRef.current = json;
    storeRef.current
      .upsertRecords([{ id: recordId, data: value }])
      .catch((err) => console.error(`[supabase:${table}] upsert failed:`, err?.message || err, err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}
