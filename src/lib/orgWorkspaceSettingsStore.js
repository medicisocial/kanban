import { SUPABASE_ENABLED, supabase } from './supabaseClient';
import { fetchOrgWorkspaceSettings } from '../utils/orgWorkspaceSettingsCloud.js';

/** Load org-level workspace settings for an org. */
export async function loadOrgWorkspaceSettings(orgId) {
  if (!SUPABASE_ENABLED || !orgId) return null;
  return fetchOrgWorkspaceSettings(orgId);
}

/** Subscribe to org_workspace_settings changes for an org. */
export function subscribeOrgWorkspaceSettings(orgId, onChange) {
  if (!SUPABASE_ENABLED || !supabase || !orgId) return () => {};

  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => onChange(), 120);
  };

  const channel = supabase
    .channel(`org_workspace_settings:${orgId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'org_workspace_settings',
        filter: `org_id=eq.${orgId}`,
      },
      schedule,
    )
    .subscribe();

  return () => {
    clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
