import { SUPABASE_ENABLED, supabase } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { fetchStaffSyncRows } from '../lib/staffSyncApi';
import { mustUseStaffSyncOnly } from '../lib/staffSyncReadPolicy.js';
import { buildStaffApiAuthHeaders } from '../lib/staffApiAuth';
import { ensureStaffSupabaseSession } from '../lib/staffSupabaseAuth';

export { mergeOrgSettingsIntoWorkspace } from './clientsWorkspacePush.js';

const ORG_SETTINGS_SELECT =
  'org_id,removed_names,restored_names,content_type_colors,custom_color_palette,updated_at';

const DIRECT_WRITE_TIMEOUT_MS = 8000;
const API_WRITE_TIMEOUT_MS = 12000;
const DEBOUNCE_MS = 400;

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
  if (mustUseStaffSyncOnly()) return null;
  const { data, error } = await supabase
    .from('org_workspace_settings')
    .select(ORG_SETTINGS_SELECT)
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) {
    console.warn('[org_workspace_settings] Supabase read failed:', error.message || error);
    return null;
  }
  return rowToSettings(data);
}

async function fetchOrgSettingsFallback(orgId) {
  const apiRows = await fetchStaffSyncRows('clients', orgId);
  if (!Array.isArray(apiRows)) return null;
  const workspace = apiRows.find((entry) => String(entry.id) === 'workspace');
  return settingsFromSlimClientsBlob(workspace?.data);
}

/** Load org-level settings — staff-sync for personal sessions; direct only for ops. */
export async function fetchOrgWorkspaceSettings(orgId = getOrgId()) {
  if (!SUPABASE_ENABLED || !orgId) return null;

  if (mustUseStaffSyncOnly()) {
    return fetchOrgSettingsFallback(orgId);
  }

  const [direct, fallback] = await Promise.all([
    fetchOrgSettingsDirect(orgId),
    fetchOrgSettingsFallback(orgId),
  ]);

  return direct || fallback;
}

function withTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    }),
  ]);
}

function mergePendingSettings(existing = {}, incoming = {}) {
  return {
    removedNames: {
      ...(existing.removedNames || {}),
      ...(incoming.removedNames || {}),
    },
    restoredNames: {
      ...(existing.restoredNames || {}),
      ...(incoming.restoredNames || {}),
    },
    contentTypeColors:
      incoming.contentTypeColors !== undefined
        ? incoming.contentTypeColors
        : existing.contentTypeColors,
    customColorPalette:
      incoming.customColorPalette !== undefined
        ? incoming.customColorPalette
        : existing.customColorPalette,
  };
}

async function upsertOrgSettingsDirect(orgId, settings) {
  if (!supabase) return { ok: false, error: 'Supabase not configured.' };
  await ensureStaffSupabaseSession();
  try {
    const result = await withTimeout(
      supabase.from('org_workspace_settings').upsert(
        {
          org_id: orgId,
          removed_names: settings.removedNames || {},
          restored_names: settings.restoredNames || {},
          content_type_colors: settings.contentTypeColors || {},
          custom_color_palette: settings.customColorPalette || [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id' },
      ),
      DIRECT_WRITE_TIMEOUT_MS,
      'Org settings save timed out.',
    );
    if (result?.error) {
      console.warn('[org_workspace_settings] Supabase write failed:', result.error.message || result.error);
      return { ok: false, error: result.error.message || 'Could not save org settings.' };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[org_workspace_settings] Supabase write timed out:', err.message || err);
    return { ok: false, error: err.message || 'Org settings save timed out.' };
  }
}

async function upsertOrgSettingsViaApi(orgId, settings) {
  const headers = await buildStaffApiAuthHeaders({ preferSupabaseJwt: false });
  if (!headers) {
    return { ok: false, error: 'Sign in to save workspace settings.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_WRITE_TIMEOUT_MS);
  try {
    const response = await fetch('/api/org-workspace-settings', {
      method: 'POST',
      headers,
      body: JSON.stringify({ orgId, settings }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error: payload.error || `Could not save org settings (${response.status}).`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err?.name === 'AbortError'
          ? 'Org settings API timed out.'
          : err?.message || 'Could not reach org settings API.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function writeOrgWorkspaceSettings(orgId, settings) {
  const direct = await upsertOrgSettingsDirect(orgId, settings);
  if (direct.ok) return direct;
  const viaApi = await upsertOrgSettingsViaApi(orgId, settings);
  if (viaApi.ok) return viaApi;
  return {
    ok: false,
    error: viaApi.error || direct.error || 'Could not save org settings.',
  };
}

let pushTimer = null;
let pendingPush = null;
let pendingWaiters = [];
let flushing = false;

async function flushPendingPush() {
  if (flushing) return;
  flushing = true;
  clearTimeout(pushTimer);
  pushTimer = null;
  try {
    while (pendingPush || pendingWaiters.length) {
      const payload = pendingPush;
      pendingPush = null;
      const waiters = pendingWaiters;
      pendingWaiters = [];
      if (!payload) {
        for (const resolve of waiters) resolve({ ok: true });
        continue;
      }
      const result = await writeOrgWorkspaceSettings(payload.orgId, payload.settings);
      for (const resolve of waiters) resolve(result);
    }
  } finally {
    flushing = false;
    if (pendingPush || pendingWaiters.length) {
      void flushPendingPush();
    }
  }
}

/**
 * Upsert org-level settings.
 * Debounced by default; pass `{ flush: true }` for deletes so the caller does not hang.
 * Multiple callers share one write and all promises resolve when it finishes.
 */
export function pushOrgWorkspaceSettings(orgId, settings, { flush = false } = {}) {
  if (!SUPABASE_ENABLED || !orgId || !settings) return Promise.resolve({ ok: true });

  pendingPush = {
    orgId,
    settings: mergePendingSettings(pendingPush?.settings, settings),
  };

  return new Promise((resolve) => {
    pendingWaiters.push(resolve);
    if (flush) {
      clearTimeout(pushTimer);
      pushTimer = null;
      void flushPendingPush();
      return;
    }
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      void flushPendingPush();
    }, DEBOUNCE_MS);
  });
}
