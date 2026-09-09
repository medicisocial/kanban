import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { assertAuthorizedOrgId } from './_lib/orgContext.mjs';
import { getSupabaseUrl, isSupabaseConfigured, resolveServerKeyOrAnon } from './_lib/supabase.mjs';
import { mergeOrgWorkspaceSettingsWrite } from './_lib/orgWorkspaceSettingsMerge.mjs';

function unauthorized(res) {
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({ ok: false, error: 'Cloud sync is not configured.' });
}

async function isAuthorized(req) {
  const staffSession = getSessionFromRequest(req);
  if (isStaffSessionValid(staffSession)) return true;

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  if (typeof token !== 'string' || token.split('.').length !== 3) return false;

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey) return false;

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

function settingsFromRow(row) {
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

async function restFetch(path, { method = 'GET', body, prefer } = {}) {
  const url = getSupabaseUrl();
  const key = resolveServerKeyOrAnon();
  if (!url || !key) return null;

  const preferHeader =
    prefer ||
    (method === 'GET'
      ? 'return=representation'
      : method === 'POST'
        ? 'resolution=merge-duplicates,return=minimal'
        : 'return=minimal');

  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: preferHeader,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}

async function syncClientsBlobTombstones(orgId, settings) {
  try {
    const blobRes = await restFetch(
      `clients?id=eq.workspace&org_id=eq.${encodeURIComponent(orgId)}&select=id,data`,
    );
    if (!blobRes?.ok) return;
    const blobRows = await blobRes.json().catch(() => []);
    const existing = Array.isArray(blobRows) ? blobRows[0] : null;
    const data = existing?.data && typeof existing.data === 'object' ? { ...existing.data } : {};
    const nextRemoved = settings.removedNames || {};
    const nextRestored = settings.restoredNames || {};
    if (
      JSON.stringify(data.removedNames || {}) === JSON.stringify(nextRemoved) &&
      JSON.stringify(data.restoredNames || {}) === JSON.stringify(nextRestored)
    ) {
      return;
    }
    data.removedNames = nextRemoved;
    data.restoredNames = nextRestored;
    if (settings.contentTypeColors !== undefined) {
      data.contentTypeColors = settings.contentTypeColors;
    }
    if (settings.customColorPalette !== undefined) {
      data.customColorPalette = settings.customColorPalette;
    }
    await restFetch(`clients?id=eq.workspace&org_id=eq.${encodeURIComponent(orgId)}`, {
      method: 'PATCH',
      body: { data, updated_at: new Date().toISOString() },
    });
  } catch (syncErr) {
    console.warn(
      '[org-workspace-settings] clients blob tombstone sync failed:',
      syncErr?.message || syncErr,
    );
  }
}

/** Staff-only: read/write org_workspace_settings (delete tombstones, palette, etc.). */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!(await isAuthorized(req))) return unauthorized(res);
  if (!isSupabaseConfigured()) return unavailable(res);

  const orgId =
    req.method === 'GET' ? req.query?.orgId || req.body?.orgId : req.body?.orgId;
  const orgCheck = await assertAuthorizedOrgId(req, orgId);
  if (!orgCheck.ok) {
    return res.status(403).json({ ok: false, error: orgCheck.error || 'Forbidden org scope.' });
  }

  try {
    if (req.method === 'GET') {
      const response = await restFetch(
        `org_workspace_settings?org_id=eq.${encodeURIComponent(orgCheck.orgId)}&select=org_id,removed_names,restored_names,content_type_colors,custom_color_palette,updated_at`,
      );
      if (!response) return unavailable(res);
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error('[org-workspace-settings] read failed:', response.status, detail);
        return res.status(500).json({ ok: false, error: 'Could not load workspace settings.' });
      }
      const rows = await response.json().catch(() => []);
      const settings = settingsFromRow(Array.isArray(rows) ? rows[0] : rows);
      if (settings) {
        // Heal stale clients.workspace tombstones so old fallbacks stop resurrecting brands.
        void syncClientsBlobTombstones(orgCheck.orgId, settings);
      }
      return res.status(200).json({ ok: true, settings: settings || null });
    }

    const { settings } = req.body || {};
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ ok: false, error: 'Missing settings.' });
    }

    const existingRes = await restFetch(
      `org_workspace_settings?org_id=eq.${encodeURIComponent(orgCheck.orgId)}&select=org_id,removed_names,restored_names,content_type_colors,custom_color_palette,updated_at`,
    );
    const existingRows = existingRes?.ok ? await existingRes.json().catch(() => []) : [];
    const existing = Array.isArray(existingRows) ? existingRows[0] : null;
    const merged = mergeOrgWorkspaceSettingsWrite(existing, settings);

    const row = {
      org_id: orgCheck.orgId,
      ...merged,
      updated_at: new Date().toISOString(),
    };

    const response = await restFetch('org_workspace_settings?on_conflict=org_id', {
      method: 'POST',
      body: row,
    });
    if (!response) return unavailable(res);
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[org-workspace-settings] upsert failed:', response.status, detail);
      return res.status(500).json({ ok: false, error: 'Could not save workspace settings.' });
    }

    await syncClientsBlobTombstones(orgCheck.orgId, {
      removedNames: row.removed_names,
      restoredNames: row.restored_names,
      contentTypeColors: row.content_type_colors,
      customColorPalette: row.custom_color_palette,
    });

    return res.status(200).json({ ok: true, settings: settingsFromRow(row) });
  } catch (error) {
    console.error('[org-workspace-settings] failed:', error?.message || error);
    return res.status(500).json({
      ok: false,
      error:
        req.method === 'GET'
          ? 'Could not load workspace settings.'
          : 'Could not save workspace settings.',
    });
  }
}
