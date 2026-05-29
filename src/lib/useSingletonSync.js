import { useEffect, useRef } from 'react';
import { SUPABASE_ENABLED } from './supabaseClient';
import { createCollectionStore } from './supabaseSync';

/**
 * Like useCollectionSync, but for a single composite object stored as one row
 * (e.g. the clients settings blob: names, colors, logos, contacts, ...).
 *
 * The whole value is stored as a single row keyed by `recordId`.
 *
 * When Supabase is disabled this is a no-op and the hook keeps using localStorage.
 */
export function useSingletonSync({ table, value, setValue, loadLocal, recordId = 'state' }) {
  const storeRef = useRef(null);
  const syncedRef = useRef(null); // JSON string of last-synced value
  const applyingRemoteRef = useRef(false);
  const loadedRef = useRef(!SUPABASE_ENABLED);

  if (SUPABASE_ENABLED && !storeRef.current) {
    storeRef.current = createCollectionStore(table);
  }

  useEffect(() => {
    if (!SUPABASE_ENABLED) return undefined;
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

        // First run with an empty table: seed it from existing local data.
        const local = loadLocal ? loadLocal() : value;
        if (local) {
          await store.upsertRecords([{ id: recordId, data: local }]);
          applyingRemoteRef.current = true;
          syncedRef.current = JSON.stringify(local);
          loadedRef.current = true;
          setValue(local);
          return;
        }
        loadedRef.current = true;
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
  }, []);

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
