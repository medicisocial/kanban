import { useCallback, useEffect, useRef, useState } from 'react';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import {
  loadClientRecords,
  loadClientRecordsFull,
  subscribeClientRecords,
} from '../lib/clientRecordsStore.js';
import { mergeClientRecordRowsIntoWorkspace } from '../utils/clientRecordsCloud.js';
import { hydrateBrandFileTombstonesFromRows } from '../utils/brandFileTombstones.js';

const PULL_TIMEOUT_MS = 12000;

/**
 * Cloud mode: load client names + profiles directly from Supabase client_records.
 * List rows load first; full profiles follow in the background.
 */
export function useClientRecordsFromSupabase({ setWorkspaceState, orgId }) {
  const setWorkspaceStateRef = useRef(setWorkspaceState);
  setWorkspaceStateRef.current = setWorkspaceState;

  const [recordsLoaded, setRecordsLoaded] = useState(!SUPABASE_ENABLED);
  const loadGenerationRef = useRef(0);
  const loadedOrgRef = useRef(null);
  const pullingRef = useRef(false);

  const applyRows = useCallback((rows) => {
    if (!Array.isArray(rows) || !rows.length) return;
    hydrateBrandFileTombstonesFromRows(rows);
    setWorkspaceStateRef.current((prev) => mergeClientRecordRowsIntoWorkspace(prev, rows));
    setRecordsLoaded(true);
  }, []);

  const pullFromSupabase = useCallback(async (activeOrgId, { includeFull = true } = {}) => {
    if (pullingRef.current) return [];
    pullingRef.current = true;
    try {
      const listRows = await loadClientRecords(activeOrgId);
      applyRows(listRows);

      if (includeFull && listRows.length) {
        void loadClientRecordsFull(activeOrgId)
          .then((fullRows) => {
            if (fullRows.length) applyRows(fullRows);
          })
          .catch((err) => {
            console.warn('[client_records] full profile load failed:', err?.message || err);
          });
      }

      return listRows;
    } finally {
      pullingRef.current = false;
    }
  }, [applyRows]);

  useEffect(() => {
    if (!SUPABASE_ENABLED) {
      setRecordsLoaded(true);
      return undefined;
    }

    const activeOrgId = orgId || getOrgId();
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;

    if (loadedOrgRef.current !== activeOrgId) {
      setRecordsLoaded(false);
    }

    let cancelled = false;

    void (async () => {
      try {
        await Promise.race([
          pullFromSupabase(activeOrgId),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Client records load timed out.')), PULL_TIMEOUT_MS);
          }),
        ]);
      } catch (err) {
        console.warn('[client_records] Supabase load failed:', err?.message || err);
      } finally {
        if (!cancelled && loadGenerationRef.current === generation) {
          loadedOrgRef.current = activeOrgId;
          setRecordsLoaded(true);
        }
      }
    })();

    const unsubscribe = subscribeClientRecords(activeOrgId, () => {
      if (cancelled || loadGenerationRef.current !== generation || pullingRef.current) return;
      void pullFromSupabase(activeOrgId, { includeFull: false }).catch((err) => {
        console.warn('[client_records] Supabase refresh failed:', err?.message || err);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [orgId, pullFromSupabase]);

  return { recordsLoaded };
}
