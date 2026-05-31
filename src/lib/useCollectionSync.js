import { useEffect, useRef, useState } from 'react';
import { supabase, SUPABASE_ENABLED } from './supabaseClient';
import { createCollectionStore } from './supabaseSync';
import { hasStaffSupabaseSession } from './staffSupabaseAuth';
import { useStaffAuth } from '../context/StaffAuthContext';

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
  const [writeNonce, setWriteNonce] = useState(0);

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

    const store = storeRef.current;
    let active = true;

    const applyRemote = async () => {
      try {
        const rows = await store.fetchAll();
        if (!active) return;

        const mapRow = (row) => (normalize ? normalize(row.data ?? row) : row.data ?? row);

        // First run with an empty table: seed from local data for the legacy org only.
        if (rows.length === 0 && loadLocal && isLegacyOrg) {
          const local = loadLocal();
          if (local.length) {
            const canWrite = await hasStaffSupabaseSession();
            if (!canWrite) {
              console.warn(
                `[supabase:${table}] skipped seed — no authenticated session (log in again)`,
              );
              loadedRef.current = true;
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
          applyingRemoteRef.current = true;
          syncedRef.current = new Map();
          loadedRef.current = true;
          setItems([]);
          return;
        }

        const allItems = rows.map(mapRow);
        const keptItems = filterItems ? filterItems(allItems) : allItems;
        const keptIds = new Set(keptItems.map((record) => String(getId(record))));
        const droppedIds = allItems
          .map((record) => String(getId(record)))
          .filter((id) => !keptIds.has(id));

        if (droppedIds.length) {
          const canWrite = await hasStaffSupabaseSession();
          if (canWrite) {
            await store.deleteRecords(droppedIds);
          }
        }

        applyingRemoteRef.current = true;
        syncedRef.current = new Map(
          keptItems.map((record) => [String(getId(record)), JSON.stringify(record)]),
        );
        loadedRef.current = true;
        setItems(keptItems);
      } catch (err) {
        console.error(`[supabase:${table}] load/seed failed:`, err?.message || err, err);
        if (loadLocal) {
          const local = loadLocal();
          if (local.length) {
            applyingRemoteRef.current = true;
            syncedRef.current = new Map(local.map((r) => [String(getId(r)), JSON.stringify(r)]));
            setItems(local);
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

    // This change came from a remote pull — don't echo it back to the server.
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      syncedRef.current = new Map(items.map((r) => [String(getId(r)), JSON.stringify(r)]));
      return;
    }

    let cancelled = false;

    const pushChanges = async () => {
      const canWrite = await hasStaffSupabaseSession();
      if (!canWrite) {
        pendingWriteRef.current = true;
        console.warn(
          `[supabase:${table}] skipped write — no authenticated database session. Log out and log in again.`,
        );
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

      if (!changed.length && !removed.length) return;

      const store = storeRef.current;
      try {
        if (changed.length) {
          await store.upsertRecords(changed.map((r) => ({ id: getId(r), data: r })));
        }
        if (removed.length) {
          await store.deleteRecords(removed);
        }
        if (!cancelled) {
          syncedRef.current = next;
          pendingWriteRef.current = false;
        }
      } catch (err) {
        console.error(`[supabase:${table}] sync failed:`, err?.message || err, err);
      }
    };

    pushChanges();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, writeNonce]);
}
