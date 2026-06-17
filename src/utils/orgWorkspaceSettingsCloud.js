import { SUPABASE_ENABLED, supabase } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { fetchStaffSyncRows } from '../lib/staffSyncApi';
import { withTimeout } from './withTimeout.js';

export { mergeOrgSettingsIntoWorkspace } from './clientsWorkspacePush.js';

const SUPABASE_READ_TIMEOUT_MS = 8000;

const ORG_SETTINGS_SELECT =
  'org_id,removed_names,restored_names,content_type_colors,custom_color_palette,updated_at';

function rowToSettings(row) {
  if (!row?.org_id) return null;
  return {
    orgId: row.org_id,
    removedNames: row.removed_names || {},
    restoredNames: row.restored_names || {},
    contentTypeColors: row.content_type_colors || {},
    customColorPalette: Array.isArray(row.custom_color_palette) ? row.custom_color_palette : [],
    updatedAt: row.updated_at,
  };
}

function settingsFromSlimClientsBlob(data = {}) {
  if (!data || typeof data !== 'object') return null;
  return {
    removedNames: data.removedNames || {},
    restoredNames: data.restoredNames || {},
    contentTypeColors: data.contentTypeColors || {},
    customColorPalette: Array.isArray(data.customColorPalette) ? data.customColorPalette : [],
  };
}

async function fetchOrgSettingsDirect(orgId) {
  if (!supabase) return null;
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('org_workspace_settings')
        .select(ORG_SETTINGS_SELECT)
        .eq('org_id', orgId)
        .maybeSingle(),
      SUPABASE_READ_TIMEOUT_MS,
    );
    if (error) {
      console.warn('[org_workspace_settings] Supabase read failed:', error.message || error);
      return null;
    }
    return rowToSettings(data);
  } catch (err) {
    console.warn('[org_workspace_settings] Supabase read failed:', err?.message || err);
    return null;
  }
}

async function fetchOrgSettingsFallback(orgId) {
  const apiRows = await fetchStaffSyncRows('clients', orgId);
  if (!Array.isArray(apiRows)) return null;
  const workspace = apiRows.find((entry) => String(entry.id) === 'workspace');
  return settingsFromSlimClientsBlob(workspace?.data);
}

/** Load org-level settings — Supabase direct read, slim clients blob fallback. */
export async function fetchOrgWorkspaceSettings(orgId = getOrgId()) {
  if (!SUPABASE_ENABLED || !orgId) return null;

  const direct = await fetchOrgSettingsDirect(orgId);
  if (direct) return direct;

  return fetchOrgSettingsFallback(orgId);
}

let pushTimer = null;
let pendingPush = null;

/** Upsert org-level settings (debounced). */
export function pushOrgWorkspaceSettings(orgId, settings) {
  if (!SUPABASE_ENABLED || !orgId || !settings) return Promise.resolve({ ok: true });

  pendingPush = { orgId, settings };
  clearTimeout(pushTimer);

  return new Promise((resolve) => {
    pushTimer = setTimeout(async () => {
      const payload = pendingPush;
      pendingPush = null;
      if (!payload) {
        resolve({ ok: true });
        return;
      }

      const row = {
        org_id: payload.orgId,
        removed_names: payload.settings.removedNames || {},
        restored_names: payload.settings.restoredNames || {},
        content_type_colors: payload.settings.contentTypeColors || {},
        custom_color_palette: payload.settings.customColorPalette || [],
        updated_at: new Date().toISOString(),
      };

      if (!supabase) {
        resolve({ ok: false, error: 'Supabase not configured.' });
        return;
      }

      const { error } = await supabase.from('org_workspace_settings').upsert(row, {
        onConflict: 'org_id',
      });

      if (error) {
        console.warn('[org_workspace_settings] Supabase write failed:', error.message || error);
        resolve({ ok: false, error: error.message || 'Could not save org settings.' });
        return;
      }

      resolve({ ok: true });
    }, 400);
  });
}
