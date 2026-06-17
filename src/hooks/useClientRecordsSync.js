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

const HYDRATE_RETRY_MS = 500;
const HYDRATE_MAX_ATTEMPTS = 10;

const AUTH_EVENTS_THAT_RETRY_HYDRATE = new Set(['SIGNED_IN', 'INITIAL_SESSION']);

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
export function useClientRecordsSync({ setWorkspaceState, orgId, hasClientNames }) {
  const setWorkspaceStateRef = useRef(setWorkspaceState);
  setWorkspaceStateRef.current = setWorkspaceState;

  const hasClientNamesRef = useRef(hasClientNames);
  hasClientNamesRef.current = hasClientNames;

  const hydratedOrgRef = useRef(null);
  const hydrateGenerationRef = useRef(0);
  const [hydrateNonce, setHydrateNonce] = useState(0);
  const [recordsHydrated, setRecordsHydrated] = useState(
    () => !SUPABASE_ENABLED || hasCachedClientNames(),
  );

  useEffect(() => {
    if (!SUPABASE_ENABLED || !supabase) return undefined;
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || !AUTH_EVENTS_THAT_RETRY_HYDRATE.has(event)) return;
      const activeOrgId = orgId || getOrgId();
      if (hydratedOrgRef.current === activeOrgId) return;
      if (hasClientNamesRef.current?.() || hasCachedClientNames()) return;
      setHydrateNonce((current) => current + 1);
    });
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [orgId]);

  useEffect(() => {
    if (!SUPABASE_ENABLED) {
      setRecordsHydrated(true);
      return undefined;
    }

    const activeOrgId = orgId || getOrgId();
    if (hydratedOrgRef.current === activeOrgId) {
      setRecordsHydrated(true);
      return undefined;
    }

    const generation = hydrateGenerationRef.current + 1;
    hydrateGenerationRef.current = generation;

    const namesAlreadyLoaded = hasClientNamesRef.current?.() || hasCachedClientNames();
    if (!namesAlreadyLoaded) {
      setRecordsHydrated(false);
    }

    let cancelled = false;

    void (async () => {
      try {
        for (let attempt = 0; attempt < HYDRATE_MAX_ATTEMPTS; attempt += 1) {
          if (cancelled || hydrateGenerationRef.current !== generation) return;

          const rows = await fetchClientRecordRows(activeOrgId);
          if (cancelled || hydrateGenerationRef.current !== generation) return;

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
        if (!cancelled && hydrateGenerationRef.current === generation) {
          setRecordsHydrated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgId, hydrateNonce]);

  return { recordsHydrated };
}
