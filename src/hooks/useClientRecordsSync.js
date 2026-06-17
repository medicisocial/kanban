import { useEffect, useRef, useState } from 'react';
import { CLIENTS_STORAGE_KEY } from '../constants';
import { readOrgScopedJson } from '../lib/orgStorage';
import { SUPABASE_ENABLED, supabase } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { hasStaffSupabaseSession } from '../lib/staffSupabaseAuth';
import {
  fetchClientRecordRows,
  mergeClientRecordRowsIntoWorkspace,
} from '../utils/clientRecordsCloud.js';
import {
  hydrateBrandFileTombstonesFromRows,
  syncLocalTombstonesToCloudIfNeeded,
} from '../utils/brandFileTombstones.js';

const ORG_WAIT_MS = 4000;
const HYDRATE_RETRY_MS = 500;
const HYDRATE_MAX_ATTEMPTS = 10;

function hasCachedClientNames() {
  try {
    const cached = readOrgScopedJson(CLIENTS_STORAGE_KEY, null);
    return Boolean(cached?.names?.length);
  } catch {
    return false;
  }
}

/**
 * Hydrate brand profile maps from Supabase client_records (direct read, API fallback).
 * Writes go to Supabase via pushBrandProfilePatches in useClients.
 */
export function useClientRecordsSync({ setWorkspaceState, orgReady, orgId }) {
  const setWorkspaceStateRef = useRef(setWorkspaceState);
  setWorkspaceStateRef.current = setWorkspaceState;

  const hydratedOrgRef = useRef(null);
  const [hydrateNonce, setHydrateNonce] = useState(0);
  const [recordsHydrated, setRecordsHydrated] = useState(
    () => !SUPABASE_ENABLED || hasCachedClientNames(),
  );

  useEffect(() => {
    if (!SUPABASE_ENABLED || !supabase) return undefined;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return;
      hydratedOrgRef.current = null;
      setHydrateNonce((current) => current + 1);
    });
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!SUPABASE_ENABLED) {
      setRecordsHydrated(true);
      return undefined;
    }

    if (!orgReady) {
      const orgWaitTimeout = setTimeout(() => setRecordsHydrated(true), ORG_WAIT_MS);
      return () => clearTimeout(orgWaitTimeout);
    }

    const activeOrgId = orgId || getOrgId();
    if (hydratedOrgRef.current === activeOrgId) {
      setRecordsHydrated(true);
      return undefined;
    }

    let cancelled = false;
    if (!hasCachedClientNames()) {
      setRecordsHydrated(false);
    }

    void (async () => {
      try {
        for (let attempt = 0; attempt < HYDRATE_MAX_ATTEMPTS; attempt += 1) {
          if (cancelled) return;

          const rows = await fetchClientRecordRows(activeOrgId);
          if (cancelled) return;

          if (rows.length) {
            hydrateBrandFileTombstonesFromRows(rows);
            syncLocalTombstonesToCloudIfNeeded();
            setWorkspaceStateRef.current((prev) => mergeClientRecordRowsIntoWorkspace(prev, rows));
            hydratedOrgRef.current = activeOrgId;
            break;
          }

          if (attempt < HYDRATE_MAX_ATTEMPTS - 1) {
            await hasStaffSupabaseSession();
            await new Promise((resolve) => {
              setTimeout(resolve, HYDRATE_RETRY_MS * (attempt + 1));
            });
          }
        }
      } catch (err) {
        console.warn('[client_records] hydrate failed:', err?.message || err);
      } finally {
        if (!cancelled) setRecordsHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgReady, orgId, hydrateNonce]);

  return { recordsHydrated };
}
