import { useCallback, useEffect, useRef, useState } from 'react';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import {
  loadClientRecords,
  loadClientRecordsFull,
  subscribeClientRecords,
} from '../lib/clientRecordsStore.js';
import { mergeClientRecordRowsIntoWorkspace, ensureAgencyBrandInWorkspace } from '../utils/clientRecordsCloud.js';
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
  // Separate from recordsLoaded: list rows (fast, for sidebar/filters) land first and
  // don't carry profile fields like deliverableTarget — full-profile-dependent UI
  // (e.g. Deliverables page) should wait for this so it never flashes a stale "0"
  // that looks like a save didn't stick.
  const [fullRecordsLoaded, setFullRecordsLoaded] = useState(!SUPABASE_ENABLED);
  const loadGenerationRef = useRef(0);
  const loadedOrgRef = useRef(null);
  const pullingRef = useRef(false);

  const applyRows = useCallback((rows, activeOrgId = orgId) => {
    if (Array.isArray(rows) && rows.length) {
      hydrateBrandFileTombstonesFromRows(rows);
      setWorkspaceStateRef.current((prev) =>
        ensureAgencyBrandInWorkspace(mergeClientRecordRowsIntoWorkspace(prev, rows), activeOrgId),
      );
    } else {
      setWorkspaceStateRef.current((prev) => ensureAgencyBrandInWorkspace(prev, activeOrgId));
    }
    setRecordsLoaded(true);
  }, [orgId]);

  const pullFromSupabase = useCallback(async (activeOrgId, { includeFull = true } = {}) => {
    if (pullingRef.current) return [];
    pullingRef.current = true;
    try {
      const listRows = await loadClientRecords(activeOrgId);
      applyRows(listRows, activeOrgId);

      if (includeFull && listRows.length) {
        void loadClientRecordsFull(activeOrgId)
          .then((fullRows) => {
            if (fullRows.length) applyRows(fullRows, activeOrgId);
          })
          .catch((err) => {
            console.warn('[client_records] full profile load failed:', err?.message || err);
          })
          .finally(() => {
            setFullRecordsLoaded(true);
          });
      } else if (includeFull) {
        // No rows to fetch profiles for — nothing to wait on.
        setFullRecordsLoaded(true);
      }

      return listRows;
    } finally {
      pullingRef.current = false;
    }
  }, [applyRows]);

  useEffect(() => {
    if (!SUPABASE_ENABLED) {
      setRecordsLoaded(true);
      setFullRecordsLoaded(true);
      return undefined;
    }

    const activeOrgId = orgId || getOrgId();
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;

    if (loadedOrgRef.current !== activeOrgId) {
      setRecordsLoaded(false);
      setFullRecordsLoaded(false);
    }

    let cancelled = false;

    // Independent safety timeout so a hung full-profile fetch can't leave
    // profile-dependent UI (e.g. Deliverables targets) stuck loading forever.
    const fullLoadFailsafe = setTimeout(() => {
      if (!cancelled && loadGenerationRef.current === generation) setFullRecordsLoaded(true);
    }, PULL_TIMEOUT_MS);

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
      clearTimeout(fullLoadFailsafe);
      unsubscribe();
    };
  }, [orgId, pullFromSupabase]);

  return { recordsLoaded, fullRecordsLoaded };
}
