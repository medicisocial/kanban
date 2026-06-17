import { useCallback, useEffect, useRef, useState } from 'react';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { loadClientRecords, subscribeClientRecords } from '../lib/clientRecordsStore.js';
import { mergeClientRecordRowsIntoWorkspace } from '../utils/clientRecordsCloud.js';
import { hydrateBrandFileTombstonesFromRows } from '../utils/brandFileTombstones.js';
import { withTimeout } from '../utils/withTimeout.js';

const LOAD_TIMEOUT_MS = 10000;

/**
 * Cloud mode: load client names + profiles directly from Supabase client_records.
 * No localStorage bootstrap, no multi-path "hydration" — fetch once + realtime.
 */
export function useClientRecordsFromSupabase({ setWorkspaceState, orgId }) {
  const setWorkspaceStateRef = useRef(setWorkspaceState);
  setWorkspaceStateRef.current = setWorkspaceState;

  const [recordsLoaded, setRecordsLoaded] = useState(!SUPABASE_ENABLED);
  const loadGenerationRef = useRef(0);
  const loadedOrgRef = useRef(null);

  const applyRows = useCallback((rows) => {
    if (!Array.isArray(rows)) return;
    if (rows.length) {
      hydrateBrandFileTombstonesFromRows(rows);
    }
    setWorkspaceStateRef.current((prev) => mergeClientRecordRowsIntoWorkspace(prev, rows));
  }, []);

  const pullFromSupabase = useCallback(async (activeOrgId) => {
    const rows = await loadClientRecords(activeOrgId);
    applyRows(rows);
    return rows;
  }, [applyRows]);

  useEffect(() => {
    if (!SUPABASE_ENABLED) {
      setRecordsLoaded(true);
      return undefined;
    }

    const activeOrgId = orgId || getOrgId();
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    const isNewOrg = loadedOrgRef.current !== activeOrgId;
    if (isNewOrg) {
      setRecordsLoaded(false);
    }

    let cancelled = false;

    void (async () => {
      try {
        await withTimeout(
          pullFromSupabase(activeOrgId),
          LOAD_TIMEOUT_MS,
          'Client records load timed out.',
        );
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
      if (cancelled || loadGenerationRef.current !== generation) return;
      void pullFromSupabase(activeOrgId).catch((err) => {
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
