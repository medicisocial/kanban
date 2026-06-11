import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { assertAuthorizedOrgId } from './_lib/orgContext.mjs';
import {
  getPortalPasswordVault,
  isSupabaseConfigured,
  patchPortalPasswordVault,
} from './_lib/supabase.mjs';

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({ error: 'Cloud sync is not configured.' });
}

function isLikelyJwt(token) {
  return typeof token === 'string' && token.split('.').length === 3;
}

const AUTH_FETCH_TIMEOUT_MS = 8000;

async function verifySupabaseAccessToken(token) {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey || !token) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function isAuthorized(req) {
  const staffSession = getSessionFromRequest(req);
  if (isStaffSessionValid(staffSession)) return true;

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  if (!isLikelyJwt(token)) return false;

  try {
    return await verifySupabaseAccessToken(token);
  } catch {
    return false;
  }
}

/**
 * Staff-only: read or patch the normalized portal password vault for one brand.
 * GET  ?brand=&orgId=  → { vault: { [userId]: plaintextPassword } }
 * POST { brand, orgId, brandVault } → patch vault entries
 */
export default async function handler(req, res) {
  if (!(await isAuthorized(req))) return unauthorized(res);
  if (!isSupabaseConfigured()) return unavailable(res);

  const brandRaw = req.method === 'GET' ? req.query?.brand : req.body?.brand;
  const orgIdRaw = req.method === 'GET' ? req.query?.orgId : req.body?.orgId;

  if (!brandRaw) {
    return res.status(400).json({ error: 'Missing brand.' });
  }

  const orgCheck = await assertAuthorizedOrgId(req, orgIdRaw);
  if (!orgCheck.ok) {
    return res.status(403).json({ error: orgCheck.error || 'Forbidden org scope.' });
  }

  const brandKey = String(brandRaw).trim().toLowerCase();

  if (req.method === 'GET') {
    try {
      const vault = await getPortalPasswordVault(brandKey, orgCheck.orgId);
      return res.status(200).json({ ok: true, vault: vault || {} });
    } catch (error) {
      console.error('[client-portal-vault] read failed:', error?.message || error);
      return res.status(500).json({ error: 'Could not load portal password vault.' });
    }
  }

  if (req.method === 'POST') {
    const brandVault = req.body?.brandVault;
    if (!brandVault || typeof brandVault !== 'object') {
      return res.status(400).json({ error: 'Missing brandVault object.' });
    }

    try {
      await patchPortalPasswordVault(brandKey, brandVault, orgCheck.orgId);
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('[client-portal-vault] patch failed:', error?.message || error);
      return res.status(500).json({ error: 'Could not save portal password vault.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
