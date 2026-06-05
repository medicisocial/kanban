import { getRedis, loadWorkspace } from './_lib/redis.mjs';
import {
  createClientSession,
  findClientLogin,
  findClientLoginAcrossOrgs,
  getClientPortalAuthMap,
  verifyClientPassword,
} from './_lib/clientPortalAuth.mjs';
import {
  canUseSupabaseForAuth,
  fetchClientPortalCredentialsRows,
  isSupabaseAuthMisconfigured,
} from './_lib/supabase.mjs';
import { repairPortalCredentialFromVault } from './_lib/authCriticalSync.mjs';

function unavailable(res) {
  return res.status(503).json({
    error: 'Client portal requires cloud sync. Connect Supabase (or Upstash Redis) in Vercel, then redeploy.',
  });
}

function misconfigured(res) {
  return res.status(503).json({
    error:
      'Client portal login is misconfigured. In Vercel → Settings → Environment Variables, add SUPABASE_SERVICE_ROLE_KEY (no VITE_ prefix) and redeploy. Also ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.',
  });
}

async function resolveFromSupabase(username, password) {
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

async function resolveFromRedis(username) {
  const redis = getRedis();
  if (!redis) return { unavailable: true };
  const workspace = await loadWorkspace(redis);
  const authMap = getClientPortalAuthMap(workspace);
  if (!authMap || !Object.keys(authMap).length) return { empty: true };
  const login = findClientLogin(authMap, username);
  return login ? { brand: login.brand, orgId: undefined, user: login.user } : null;
}

/**
 * Resolve a client login across all tenants. Supabase is the source of truth;
 * falls back to Upstash KV when Supabase is unavailable.
 */
async function resolveClientLogin(username, password) {
  if (isSupabaseAuthMisconfigured()) {
    return { misconfigured: true };
  }

  if (canUseSupabaseForAuth()) {
    try {
      const result = await resolveFromSupabase(username, password);
      if (result && !result.empty) return result;
      if (result?.empty) {
        const redisResult = await resolveFromRedis(username);
        if (redisResult && !redisResult.unavailable && !redisResult.empty) return redisResult;
        if (redisResult?.unavailable) return { unavailable: true };
        return { empty: true };
      }
      return result;
    } catch (error) {
      console.error('[client-auth] Supabase fetch failed:', error?.message || error);
    }
  }

  const redisResult = await resolveFromRedis(username);
  if (redisResult?.unavailable) return { unavailable: true };
  if (redisResult?.empty) return { empty: true };
  if (redisResult) return redisResult;

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = req.body?.username?.trim().toLowerCase();
  const password = String(req.body?.password || '').trim();
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const result = await resolveClientLogin(username, password);
  if (result?.unavailable) return unavailable(res);
  if (result?.misconfigured) return misconfigured(res);
  if (result?.empty) {
    return res.status(503).json({
      error:
        'No client portal logins are synced yet. Staff must save portal users under Clients → Users (or Team logins) and confirm cloud sync.',
    });
  }

  if (!result || !verifyClientPassword(result.user, password)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const orgId = result.orgId || 'medici';
  const session = createClientSession(result.brand, result.user.username || username, orgId);
  return res.status(200).json({ session, brand: result.brand });
}
