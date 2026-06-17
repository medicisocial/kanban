import { useCallback, useEffect, useRef, useState } from 'react';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { isCloudSourceOfTruth } from '../lib/cloudSourceOfTruth';
import { getOrgId } from '../lib/orgSession';
import { loadPortalUsers, subscribePortalUsers } from '../lib/portalUsersStore.js';

/**
 * Cloud mode: load portal credentials from portal_users (direct Supabase + realtime).
 */
export function usePortalUsersSync({ setCredentials, orgReady, orgId }) {
  const setCredentialsRef = useRef(setCredentials);
  setCredentialsRef.current = setCredentials;

  const [portalUsersLoaded, setPortalUsersLoaded] = useState(
    () => !SUPABASE_ENABLED || !isCloudSourceOfTruth(),
  );
  const loadGenerationRef = useRef(0);

  const pullFromSupabase = useCallback(async (activeOrgId) => {
    const map = await loadPortalUsers(activeOrgId);
    setCredentialsRef.current(map);
    return map;
  }, []);

  const reloadPortalUsers = useCallback(async () => {
    if (!SUPABASE_ENABLED || !isCloudSourceOfTruth()) return;
    const activeOrgId = orgId || getOrgId();
    await pullFromSupabase(activeOrgId);
  }, [orgId, pullFromSupabase]);

  useEffect(() => {
    if (!SUPABASE_ENABLED || !orgReady || !isCloudSourceOfTruth()) {
      setPortalUsersLoaded(true);
      return undefined;
    }

    const activeOrgId = orgId || getOrgId();
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    setPortalUsersLoaded(false);

    let cancelled = false;

    void (async () => {
      try {
        await pullFromSupabase(activeOrgId);
      } catch (err) {
        console.warn('[portal_users] Supabase load failed:', err?.message || err);
      } finally {
        if (!cancelled && loadGenerationRef.current === generation) {
          setPortalUsersLoaded(true);
        }
      }
    })();

    const unsubscribe = subscribePortalUsers(activeOrgId, () => {
      if (cancelled || loadGenerationRef.current !== generation) return;
      void pullFromSupabase(activeOrgId).catch((err) => {
        console.warn('[portal_users] Supabase refresh failed:', err?.message || err);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [orgId, orgReady, pullFromSupabase]);

  return { portalUsersLoaded, reloadPortalUsers };
}

export function mergePortalUserDraftIntoMap(map, brandKey, users) {
  return { ...map, [brandKey]: users };
}
