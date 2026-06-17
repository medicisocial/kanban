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

/**
 * Cloud mode: load client names + profiles directly from Supabase client_records.
 * List rows load first (fast); full profiles follow in the background.
 */
export function useClientRecordsFromSupabase({ setWorkspaceState, orgId }) {
  const setWorkspaceStateRef = useRef(setWorkspaceState);
  setWorkspaceStateRef.current = setWorkspaceState;

  const [recordsLoaded, setRecordsLoaded] = useState(!SUPABASE_ENABLED);
  const loadGenerationRef = useRef(0);
  const loadedOrgRef = useRef(null);

  const applyRows = useCallback((rows, { markReady = false } = {}) => {
    if (!Array.isArray(rows)) return;
    if (rows.length) {
      hydrateBrandFileTombstonesFromRows(rows);
    }
    setWorkspaceStateRef.current((prev) => mergeClientRecordRowsIntoWorkspace(prev, rows));
    if (markReady && rows.length) {
      setRecordsLoaded(true);
    }
  }, []);

  const pullFromSupabase = useCallback(async (activeOrgId) => {
    const listRows = await loadClientRecords(activeOrgId);
    applyRows(listRows, { markReady: true });

    void loadClientRecordsFull(activeOrgId)
      .then((fullRows) => {
        if (fullRows.length) applyRows(fullRows);
      })
      .catch((err) => {
        console.warn('[client_records] full profile load failed:', err?.message || err);
      });

    return listRows;
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
        await pullFromSupabase(activeOrgId);
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
