import { useCallback, useEffect, useRef, useState } from 'react';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import {
  loadOrgWorkspaceSettings,
  subscribeOrgWorkspaceSettings,
} from '../lib/orgWorkspaceSettingsStore.js';
import { mergeOrgSettingsIntoWorkspace } from '../utils/orgWorkspaceSettingsCloud.js';
import { withTimeout } from '../utils/withTimeout.js';

const LOAD_TIMEOUT_MS = 10000;

/**
 * Cloud mode: load org-level settings (tombstones, palettes) from org_workspace_settings.
 * Replaces the slim clients blob singleton sync. Does not gate the client list UI.
 */
export function useOrgWorkspaceSettingsFromSupabase({ setWorkspaceState, orgId }) {
  const setWorkspaceStateRef = useRef(setWorkspaceState);
  setWorkspaceStateRef.current = setWorkspaceState;

  const loadGenerationRef = useRef(0);
  const loadedOrgRef = useRef(null);

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

    void (async () => {
      try {
        await withTimeout(
          pullFromSupabase(activeOrgId),
          LOAD_TIMEOUT_MS,
          'Org settings load timed out.',
        );
      } catch (err) {
        console.warn('[org_workspace_settings] Supabase load failed:', err?.message || err);
      } finally {
        if (!cancelled && loadGenerationRef.current === generation) {
          loadedOrgRef.current = activeOrgId;
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

  return {};
}
