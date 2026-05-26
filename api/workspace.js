import { Redis } from '@upstash/redis';
import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { mergeClientPortalAuth } from './_lib/clientPortalAuth.mjs';

const WORKSPACE_KEY = 'medici:workspace';
const CLIENT_PORTAL_AUTH_KEY = 'medici-client-portal-auth';

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function mergeWorkspacePayload(remote, incoming) {
  if (!remote?.data) return incoming;
  if (!incoming?.data) return incoming;

  const merged = {
    ...remote,
    ...incoming,
    data: {
      ...remote.data,
      ...incoming.data,
    },
  };

  const remoteAuth = remote.data[CLIENT_PORTAL_AUTH_KEY];
  const incomingAuth = incoming.data[CLIENT_PORTAL_AUTH_KEY];
  if (remoteAuth || incomingAuth) {
    merged.data[CLIENT_PORTAL_AUTH_KEY] = mergeClientPortalAuth(
      remoteAuth && typeof remoteAuth === 'object' ? remoteAuth : {},
      incomingAuth && typeof incomingAuth === 'object' ? incomingAuth : {},
    );
  }

  return merged;
}

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({
    error: 'Cloud sync is not configured. Add Upstash Redis in Vercel project Storage, then redeploy.',
  });
}

export default async function handler(req, res) {
  const session = getSessionFromRequest(req);
  if (!isStaffSessionValid(session)) {
    return unauthorized(res);
  }

  const redis = getRedis();
  if (!redis) {
    return unavailable(res);
  }

  if (req.method === 'GET') {
    const workspace = await redis.get(WORKSPACE_KEY);
    return res.status(200).json(workspace || null);
  }

  if (req.method === 'PUT') {
    const payload = req.body;
    if (!payload?.data || typeof payload.data !== 'object') {
      return res.status(400).json({ error: 'Invalid workspace payload.' });
    }

    const remote = await redis.get(WORKSPACE_KEY);
    const merged = mergeWorkspacePayload(remote, payload);
    await redis.set(WORKSPACE_KEY, merged);
    return res.status(200).json({ ok: true, exportedAt: merged.exportedAt || null });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
