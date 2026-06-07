import {
  createClientSession,
  findClientLoginAcrossOrgs,
  verifyClientPassword,
} from './_lib/clientPortalAuth.mjs';
import {
  canUseSupabaseForAuth,
  fetchClientPortalCredentialsRows,
  isSupabaseAuthMisconfigured,
} from './_lib/supabase.mjs';
import { repairPortalCredentialFromVault } from './_lib/authCriticalSync.mjs';
import { checkRateLimit, rateLimitKeyFromRequest } from './_lib/rateLimit.mjs';
import {
  badRequest,
  methodNotAllowed,
  ok,
  serverError,
  tooManyRequests,
  unauthorized,
  unavailable,
} from './_lib/apiResponse.mjs';

async function resolveClientLogin(username, password) {
  if (isSupabaseAuthMisconfigured()) {
    return { misconfigured: true };
  }

  if (!canUseSupabaseForAuth()) {
    return { unavailable: true };
  }

  const rows = await fetchClientPortalCredentialsRows();
  if (!rows?.length) return { empty: true };

  let match = findClientLoginAcrossOrgs(rows, username);
  if (!match) return null;

  if (!verifyClientPassword(match.user, password)) {
    const repaired = await repairPortalCredentialFromVault({
      brand: match.brand,
      orgId: match.org_id,
      user: match.user,
      password,
    });
    if (repaired) {
      match = { ...match, user: repaired };
    }
  }

  return match ? { brand: match.brand, orgId: match.org_id, user: match.user } : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  // Rate limit: 10 login attempts per minute per IP
  const rlKey = rateLimitKeyFromRequest(req);
  const rl = checkRateLimit(rlKey, { maxRequests: 10, windowMs: 60000 });
  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  res.setHeader('X-RateLimit-Reset', String(rl.resetIn));
  if (rl.limited) return tooManyRequests(res);

  const username = req.body?.username?.trim().toLowerCase();
  const password = String(req.body?.password || '').trim();
  if (!username || !password) {
    return badRequest(res, 'Username and password are required.');
  }

  try {
    const result = await resolveClientLogin(username, password);
    if (result?.unavailable) {
      return unavailable(res, 'Client portal requires cloud sync. Connect Supabase in Vercel, then redeploy.');
    }
    if (result?.misconfigured) {
      return unavailable(res, 'Client portal login is misconfigured. In Vercel → Settings → Environment Variables, add SUPABASE_SERVICE_ROLE_KEY (no VITE_ prefix) and redeploy. Also ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
    }
    if (result?.empty) {
      return unavailable(res, 'No client portal logins are synced yet. Staff must save portal users under Clients → Users and confirm cloud sync.');
    }

    if (!result || !verifyClientPassword(result.user, password)) {
      return unauthorized(res, 'Invalid username or password.');
    }

    const orgId = result.orgId || 'medici';
    const session = createClientSession(result.brand, result.user.username || username, orgId);
    return ok(res, { session, brand: result.brand });
  } catch (error) {
    console.error('[client-auth] failed:', error?.message || error);
    return serverError(res, 'Could not sign in. Try again in a moment.');
  }
}