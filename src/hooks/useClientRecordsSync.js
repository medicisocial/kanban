import { useEffect, useRef, useState } from 'react';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import {
  fetchClientRecordRows,
  mergeClientRecordRowsIntoWorkspace,
} from '../utils/clientRecordsCloud.js';
import {
  hydrateBrandFileTombstonesFromRows,
  syncLocalTombstonesToCloudIfNeeded,
} from '../utils/brandFileTombstones.js';

/**
 * Hydrate brand profile maps from Supabase client_records (direct read, API fallback).
 * Writes go to Supabase via pushBrandProfilePatches in useClients.
 */
export function useClientRecordsSync({ workspaceState, setWorkspaceState, orgReady }) {
  const [recordsHydrated, setRecordsHydrated] = useState(!SUPABASE_ENABLED);
  const hydratingRef = useRef(false);

  useEffect(() => {
    if (!SUPABASE_ENABLED || !orgReady) {
      setRecordsHydrated(!SUPABASE_ENABLED);
      return undefined;
    }

    let cancelled = false;
    hydratingRef.current = true;
    setRecordsHydrated(false);

    void (async () => {
      try {
        const rows = await fetchClientRecordRows(getOrgId());
        if (cancelled) return;
        if (rows.length) {
          hydrateBrandFileTombstonesFromRows(rows);
          syncLocalTombstonesToCloudIfNeeded();
          setWorkspaceState((prev) => mergeClientRecordRowsIntoWorkspace(prev, rows));
        }
      } finally {
        if (!cancelled) {
          hydratingRef.current = false;
          setRecordsHydrated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgReady, setWorkspaceState]);

  return { recordsHydrated };
}
