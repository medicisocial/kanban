import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { assertAuthorizedOrgId } from './_lib/orgContext.mjs';
import { isSupabaseConfigured } from './_lib/supabase.mjs';
import {
  reserveClientBrandNameOnServer,
  releaseClientBrandNameOnServer,
} from './_lib/clientBrandNames.mjs';

function unauthorized(res) {
  return res.status(401).json({ ok: false, error: 'Sign in to add a client.' });
}

function unavailable(res) {
  return res.status(503).json({ ok: false, error: 'Cloud sync is not configured.' });
}

function isLikelyJwt(token) {
  return typeof token === 'string' && token.split('.').length === 3;
}

async function verifySupabaseAccessToken(token) {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey || !token) return false;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  return response.ok;
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
 * Staff/SaaS: reserve or release a globally unique client brand name without
 * relying on a browser Supabase Auth session (avoids supabase-js RPC deadlocks).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!(await isAuthorized(req))) return unauthorized(res);
  if (!isSupabaseConfigured()) return unavailable(res);

  const { action = 'reserve', displayName, orgId } = req.body || {};
  if (!displayName) {
    return res.status(400).json({ ok: false, error: 'Missing client name.' });
  }

  const orgCheck = await assertAuthorizedOrgId(req, orgId);
  if (!orgCheck.ok) {
    return res.status(403).json({ ok: false, error: orgCheck.error || 'Forbidden org scope.' });
  }

  try {
    const result =
      action === 'release'
        ? await releaseClientBrandNameOnServer(orgCheck.orgId, displayName)
        : await reserveClientBrandNameOnServer(orgCheck.orgId, displayName);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[client-brand-name] failed:', error?.message || error);
    return res.status(500).json({
      ok: false,
      error: 'Could not verify client name availability. Try again in a moment.',
    });
  }
}
