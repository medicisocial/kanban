import { getRedis, loadWorkspace } from './_lib/redis.mjs';
import {
  createClientSession,
  findClientLogin,
  getClientPortalAuthMap,
  verifyClientPassword,
} from './_lib/clientPortalAuth.mjs';
import { isSupabaseConfigured, fetchCollectionMap } from './_lib/supabase.mjs';

function unavailable(res) {
  return res.status(503).json({
    error: 'Client portal requires cloud sync. Connect Supabase (or Upstash Redis) in Vercel, then redeploy.',
  });
}

/**
 * Supabase is the source of truth: client_portal_credentials rows are keyed by
 * brand (client name) with the user list in `data`, which is exactly the authMap
 * shape the verifier expects. Fall back to the Upstash KV blob only if Supabase
 * isn't configured or the request fails.
 */
async function loadClientAuthMap() {
  if (isSupabaseConfigured()) {
    try {
      const map = await fetchCollectionMap('client_portal_credentials');
      if (map) return map;
    } catch (error) {
      console.error('[client-auth] Supabase fetch failed, falling back to KV:', error?.message || error);
    }
  }

  const redis = getRedis();
  if (!redis) return null;
  const workspace = await loadWorkspace(redis);
  return getClientPortalAuthMap(workspace);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = req.body?.username?.trim().toLowerCase();
  const password = req.body?.password || '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const authMap = await loadClientAuthMap();
  if (!authMap) return unavailable(res);
  if (!Object.keys(authMap).length) {
    return res.status(503).json({
      error:
        'No client portal logins are synced yet. Staff must save portal users under Clients → Users (or Team logins) and confirm cloud sync.',
    });
  }

  const login = findClientLogin(authMap, username);
  if (!login) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!verifyClientPassword(login.user, password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const session = createClientSession(login.brand, login.user.username || username);
  return res.status(200).json({ session, brand: login.brand });
}
