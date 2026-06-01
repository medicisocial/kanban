import { getRedis, loadWorkspace } from './_lib/redis.mjs';
import {
  createClientSession,
  findClientLogin,
  findClientLoginAcrossOrgs,
  getClientPortalAuthMap,
  verifyClientPassword,
} from './_lib/clientPortalAuth.mjs';
import { isSupabaseConfigured, fetchRowsAcrossOrgs } from './_lib/supabase.mjs';

function unavailable(res) {
  return res.status(503).json({
    error: 'Client portal requires cloud sync. Connect Supabase (or Upstash Redis) in Vercel, then redeploy.',
  });
}

function supabaseEnabled() {
  try {
    return isSupabaseConfigured();
  } catch (error) {
    console.error('[client-auth] Supabase config error, falling back to KV:', error?.message || error);
    return false;
  }
}

/**
 * Resolve a client login across all tenants. Supabase is the source of truth:
 * client_portal_credentials rows are keyed by brand with the user list in `data`
 * and carry an org_id, so the session can be scoped to the owning org. Falls back
 * to the Upstash KV blob (legacy single-tenant) only if Supabase isn't available.
 *
 * Returns { brand, orgId, user } or null when no match is found, and
 * { unavailable: true } / { empty: true } for surfaced error states.
 */
async function resolveClientLogin(username) {
  if (supabaseEnabled()) {
    try {
      const rows = await fetchRowsAcrossOrgs('client_portal_credentials');
      if (rows) {
        if (!rows.length) return { empty: true };
        const match = findClientLoginAcrossOrgs(rows, username);
        return match ? { brand: match.brand, orgId: match.org_id, user: match.user } : null;
      }
    } catch (error) {
      console.error('[client-auth] Supabase fetch failed, falling back to KV:', error?.message || error);
    }
  }

  const redis = getRedis();
  if (!redis) return { unavailable: true };
  const workspace = await loadWorkspace(redis);
  const authMap = getClientPortalAuthMap(workspace);
  if (!authMap || !Object.keys(authMap).length) return { empty: true };
  const login = findClientLogin(authMap, username);
  return login ? { brand: login.brand, orgId: undefined, user: login.user } : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = req.body?.username?.trim().toLowerCase();
  const password = req.body?.password || '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const result = await resolveClientLogin(username);
  if (result?.unavailable) return unavailable(res);
  if (result?.empty) {
    return res.status(503).json({
      error:
        'No client portal logins are synced yet. Staff must save portal users under Clients → Users (or Team logins) and confirm cloud sync.',
    });
  }

  if (!result || !verifyClientPassword(result.user, password)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const session = createClientSession(result.brand, result.user.username || username, result.orgId);
  return res.status(200).json({ session, brand: result.brand });
}
