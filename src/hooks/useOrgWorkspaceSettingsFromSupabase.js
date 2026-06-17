import { useCallback, useEffect, useRef } from 'react';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import {
  loadOrgWorkspaceSettings,
  subscribeOrgWorkspaceSettings,
} from '../lib/orgWorkspaceSettingsStore.js';
import { mergeOrgSettingsIntoWorkspace } from '../utils/orgWorkspaceSettingsCloud.js';

/**
 * Cloud mode: load org-level settings in the background — never blocks client list UI.
 */
export function useOrgWorkspaceSettingsFromSupabase({ setWorkspaceState, orgId }) {
  const setWorkspaceStateRef = useRef(setWorkspaceState);
  setWorkspaceStateRef.current = setWorkspaceState;

  const loadGenerationRef = useRef(0);

  const applySettings = useCallback((settings) => {
    if (!settings) return;
    setWorkspaceStateRef.current((prev) => mergeOrgSettingsIntoWorkspace(prev, settings));
  }, []);

  const pullFromSupabase = useCallback(async (activeOrgId) => {
    const settings = await loadOrgWorkspaceSettings(activeOrgId);
    applySettings(settings);
    return settings;
  }, [applySettings]);

  useEffect(() => {
    if (!SUPABASE_ENABLED) return undefined;

    const activeOrgId = orgId || getOrgId();
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;

    let cancelled = false;

    void pullFromSupabase(activeOrgId).catch((err) => {
      console.warn('[org_workspace_settings] Supabase load failed:', err?.message || err);
    });

    const unsubscribe = subscribeOrgWorkspaceSettings(activeOrgId, () => {
      if (cancelled || loadGenerationRef.current !== generation) return;
      void pullFromSupabase(activeOrgId).catch((err) => {
        console.warn('[org_workspace_settings] Supabase refresh failed:', err?.message || err);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [orgId, pullFromSupabase]);

  return {};
}
