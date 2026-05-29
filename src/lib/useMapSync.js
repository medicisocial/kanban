import { useEffect, useRef } from 'react';
import { SUPABASE_ENABLED } from './supabaseClient';
import { createCollectionStore } from './supabaseSync';

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
  const storeRef = useRef(null);
  const syncedRef = useRef(null); // Map<key, JSON string of last-synced value>
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

        // First run with an empty table: seed it from existing local data.
        if (rows.length === 0 && loadLocal) {
          const local = loadLocal() || {};
          const keys = Object.keys(local);
          if (keys.length) {
            await store.upsertRecords(keys.map((key) => ({ id: key, data: local[key] })));
            applyingRemoteRef.current = true;
            syncedRef.current = new Map(keys.map((key) => [key, JSON.stringify(local[key])]));
            loadedRef.current = true;
            setMap(local);
            return;
          }
        }

        const obj = {};
        for (const row of rows) obj[row.id] = row.data;
        applyingRemoteRef.current = true;
        syncedRef.current = new Map(rows.map((row) => [String(row.id), JSON.stringify(row.data)]));
        loadedRef.current = true;
        setMap(obj);
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

    const entries = Object.entries(map || {});

    // This change came from a remote pull — don't echo it back to the server.
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      syncedRef.current = new Map(entries.map(([key, value]) => [key, JSON.stringify(value)]));
      return;
    }

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

    syncedRef.current = next;
    const store = storeRef.current;
    if (changed.length) {
      store
        .upsertRecords(changed)
        .catch((err) => console.error(`[supabase:${table}] upsert failed:`, err?.message || err, err));
    }
    if (removed.length) {
      store
        .deleteRecords(removed)
        .catch((err) => console.error(`[supabase:${table}] delete failed:`, err?.message || err, err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
}
