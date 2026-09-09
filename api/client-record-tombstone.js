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

function normalizeBrandKey(brand) {
  return String(brand || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

async function callRpc(fnName, body) {
  const url = getSupabaseUrl();
  const key = resolveServerKeyOrAnon();
  if (!url || !key) return { ok: false, error: 'Cloud sync is not configured.' };

  const response = await fetch(`${url}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return { ok: false, error: detail || `${fnName} failed (${response.status}).` };
  }

  const payload = await response.json().catch(() => ({}));
  if (payload && typeof payload === 'object' && payload.ok === false) {
    return { ok: false, error: payload.error || `${fnName} failed.` };
  }
  return { ok: true, ...(payload && typeof payload === 'object' ? payload : {}) };
}

/** Staff-only: soft-delete or restore a client_records row (deleted_at tombstone). */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!(await isAuthorized(req))) return unauthorized(res);
  if (!isSupabaseConfigured()) return unavailable(res);

  const { action = 'tombstone', brand, brandKey, orgId } = req.body || {};
  const key = normalizeBrandKey(brandKey || brand);
  if (!key) {
    return res.status(400).json({ ok: false, error: 'Missing brand.' });
  }

  const orgCheck = await assertAuthorizedOrgId(req, orgId);
  if (!orgCheck.ok) {
    return res.status(403).json({ ok: false, error: orgCheck.error || 'Forbidden org scope.' });
  }

  try {
    if (action === 'restore') {
      const result = await callRpc('restore_client_record', {
        p_org_id: orgCheck.orgId,
        p_brand_key: key,
      });
      if (!result.ok) {
        return res.status(500).json(result);
      }
      return res.status(200).json({ ok: true, brandKey: key, restored: true });
    }

    if (action !== 'tombstone' && action !== 'delete') {
      return res.status(400).json({ ok: false, error: 'Unknown action.' });
    }

    const result = await callRpc('tombstone_client_record', {
      p_org_id: orgCheck.orgId,
      p_brand_key: key,
    });
    if (!result.ok) {
      return res.status(500).json(result);
    }
    return res.status(200).json({ ok: true, brandKey: key, tombstoned: true });
  } catch (error) {
    console.error('[client-record-tombstone] failed:', error?.message || error);
    return res.status(500).json({ ok: false, error: 'Could not update client record tombstone.' });
  }
}
