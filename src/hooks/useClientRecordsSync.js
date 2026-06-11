import { useEffect, useRef } from 'react';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { fetchStaffSyncRows } from '../lib/staffSyncApi';
import { getOrgId } from '../lib/orgSession';
import {
  diffBrandProfilePatches,
  mergeClientRecordRowsIntoWorkspace,
} from '../utils/clientRecordsAssembly.js';
import { pushBrandProfilePatches } from '../utils/clientRecordsCloud.js';

/**
 * Hydrate brand profile maps from normalized client_records and push diffs to cloud.
 */
export function useClientRecordsSync({ workspaceState, setWorkspaceState, orgReady }) {
  const hydratedRef = useRef(false);
  const pushTimerRef = useRef(null);
  const prevStateRef = useRef(workspaceState);

  useEffect(() => {
    prevStateRef.current = workspaceState;
  }, [workspaceState]);

  useEffect(() => {
    if (!SUPABASE_ENABLED || !orgReady) return undefined;

    let cancelled = false;
    hydratedRef.current = false;

    void (async () => {
      const rows = await fetchStaffSyncRows('client_records', getOrgId());
      if (cancelled || !Array.isArray(rows) || !rows.length) {
        hydratedRef.current = true;
        return;
      }
      setWorkspaceState((prev) => mergeClientRecordRowsIntoWorkspace(prev, rows));
      hydratedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [orgReady, setWorkspaceState]);

  useEffect(() => {
    if (!SUPABASE_ENABLED || !orgReady || !hydratedRef.current) return undefined;

    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      const prev = prevStateRef.current;
      const next = workspaceState;
      const names = Array.isArray(next?.names) ? next.names : [];
      const patches = diffBrandProfilePatches(prev, next, names);
      if (patches.length) {
        void pushBrandProfilePatches(getOrgId(), patches);
      }
      prevStateRef.current = next;
    }, 500);

    return () => clearTimeout(pushTimerRef.current);
  }, [workspaceState, orgReady]);

  return { recordsHydrated: hydratedRef.current };
}
