import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { assertAuthorizedOrgId } from './_lib/orgContext.mjs';
import { getSupabaseUrl, isSupabaseConfigured, resolveServerKeyOrAnon } from './_lib/supabase.mjs';

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

/** Staff-only: persist org_workspace_settings (delete tombstones, palette, etc.). */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!(await isAuthorized(req))) return unauthorized(res);
  if (!isSupabaseConfigured()) return unavailable(res);

  const { orgId, settings } = req.body || {};
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ ok: false, error: 'Missing settings.' });
  }

  const orgCheck = await assertAuthorizedOrgId(req, orgId);
  if (!orgCheck.ok) {
    return res.status(403).json({ ok: false, error: orgCheck.error || 'Forbidden org scope.' });
  }

  const url = getSupabaseUrl();
  const key = resolveServerKeyOrAnon();
  if (!url || !key) return unavailable(res);

  try {
    const response = await fetch(`${url}/rest/v1/org_workspace_settings?on_conflict=org_id`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        org_id: orgCheck.orgId,
        removed_names: settings.removedNames || {},
        restored_names: settings.restoredNames || {},
        content_type_colors: settings.contentTypeColors || {},
        custom_color_palette: settings.customColorPalette || [],
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[org-workspace-settings] upsert failed:', response.status, detail);
      return res.status(500).json({
        ok: false,
        error: 'Could not save workspace settings.',
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[org-workspace-settings] failed:', error?.message || error);
    return res.status(500).json({ ok: false, error: 'Could not save workspace settings.' });
  }
}
