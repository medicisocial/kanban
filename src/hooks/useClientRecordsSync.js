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

const HYDRATE_RETRY_MS = 600;
const HYDRATE_MAX_ATTEMPTS = 8;

async function fetchClientRecordRowsWithRetry(orgId) {
  for (let attempt = 0; attempt < HYDRATE_MAX_ATTEMPTS; attempt += 1) {
    const rows = await fetchClientRecordRows(orgId);
    if (Array.isArray(rows)) return rows;
    if (attempt < HYDRATE_MAX_ATTEMPTS - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, HYDRATE_RETRY_MS);
      });
    }
  }
  return [];
}

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
        const rows = await fetchClientRecordRowsWithRetry(getOrgId());
        if (cancelled) return;
        if (rows.length) {
          hydrateBrandFileTombstonesFromRows(rows);
          syncLocalTombstonesToCloudIfNeeded();
          setWorkspaceState((prev) => mergeClientRecordRowsIntoWorkspace(prev, rows));
        } else {
          console.warn('[client_records] hydrate — no rows yet; Supabase saves still enabled');
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
