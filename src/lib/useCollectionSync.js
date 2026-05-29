import { useEffect, useRef } from 'react';
import { SUPABASE_ENABLED } from './supabaseClient';
import { createCollectionStore } from './supabaseSync';

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
export function useCollectionSync({ table, items, setItems, getId, normalize, loadLocal }) {
  const storeRef = useRef(null);
  const syncedRef = useRef(null); // Map<id, JSON string of last-synced record>
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
          const local = loadLocal();
          if (local.length) {
            await store.upsertRecords(local.map((r) => ({ id: getId(r), data: r })));
            applyingRemoteRef.current = true;
            syncedRef.current = new Map(local.map((r) => [String(getId(r)), JSON.stringify(r)]));
            loadedRef.current = true;
            setItems(local.map((r) => (normalize ? normalize(r) : r)));
            return;
          }
        }

        applyingRemoteRef.current = true;
        syncedRef.current = new Map(rows.map((row) => [String(row.id), JSON.stringify(row.data)]));
        loadedRef.current = true;
        setItems(rows.map((row) => (normalize ? normalize(row.data) : row.data)));
      } catch (err) {
        console.error(`[supabase:${table}] load/seed failed:`, err?.message || err, err);
        if (loadLocal) {
          const local = loadLocal();
          if (local.length) {
            applyingRemoteRef.current = true;
            syncedRef.current = new Map(local.map((r) => [String(getId(r)), JSON.stringify(r)]));
            setItems(local.map((r) => (normalize ? normalize(r) : r)));
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
  }, []);

  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    if (!loadedRef.current) return;

    // This change came from a remote pull — don't echo it back to the server.
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      syncedRef.current = new Map(items.map((r) => [String(getId(r)), JSON.stringify(r)]));
      return;
    }

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

    syncedRef.current = next;
    const store = storeRef.current;
    if (changed.length) {
      store
        .upsertRecords(changed.map((r) => ({ id: getId(r), data: r })))
        .catch((err) => console.error(`[supabase:${table}] upsert failed:`, err?.message || err, err));
    }
    if (removed.length) {
      store
        .deleteRecords(removed)
        .catch((err) => console.error(`[supabase:${table}] delete failed:`, err?.message || err, err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
}
