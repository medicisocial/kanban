import { useCallback, useEffect, useRef, useState } from 'react';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import {
  loadOrgWorkspaceSettings,
  subscribeOrgWorkspaceSettings,
} from '../lib/orgWorkspaceSettingsStore.js';
import { mergeOrgSettingsIntoWorkspace } from '../utils/orgWorkspaceSettingsCloud.js';

/**
 * Cloud mode: load org-level settings (tombstones, palettes) from org_workspace_settings.
 * Replaces the slim clients blob singleton sync.
 */
export function useOrgWorkspaceSettingsFromSupabase({ setWorkspaceState, orgId }) {
  const setWorkspaceStateRef = useRef(setWorkspaceState);
  setWorkspaceStateRef.current = setWorkspaceState;

  const [settingsLoaded, setSettingsLoaded] = useState(!SUPABASE_ENABLED);
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
    if (!SUPABASE_ENABLED) {
      setSettingsLoaded(true);
      return undefined;
    }

    const activeOrgId = orgId || getOrgId();
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    setSettingsLoaded(false);

    let cancelled = false;

    void (async () => {
      try {
        await pullFromSupabase(activeOrgId);
      } catch (err) {
        console.warn('[org_workspace_settings] Supabase load failed:', err?.message || err);
      } finally {
        if (!cancelled && loadGenerationRef.current === generation) {
          setSettingsLoaded(true);
        }
      }
    })();

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

  return { settingsLoaded };
}
