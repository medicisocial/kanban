import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { assertAuthorizedOrgId } from './_lib/orgContext.mjs';
import { isSupabaseConfigured } from './_lib/supabase.mjs';
import { patchBrandProfileRecord } from './_lib/brandRecordStore.mjs';

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({ error: 'Cloud sync is not configured.' });
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

/** Staff-only: patch one brand's normalized client_records row. */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await isAuthorized(req))) return unauthorized(res);
  if (!isSupabaseConfigured()) return unavailable(res);

  const { brand, orgId, patch } = req.body || {};
  if (!brand || !patch || typeof patch !== 'object') {
    return res.status(400).json({ error: 'Missing brand or patch.' });
  }

  const orgCheck = await assertAuthorizedOrgId(req, orgId);
  if (!orgCheck.ok) {
    return res.status(403).json({ error: orgCheck.error || 'Forbidden org scope.' });
  }

  try {
    await patchBrandProfileRecord(orgCheck.orgId, brand, patch);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[brand-record] patch failed:', error?.message || error);
    return res.status(500).json({ error: 'Could not save brand profile.' });
  }
}
