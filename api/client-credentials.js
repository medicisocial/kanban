import { getRedis, loadWorkspace, saveWorkspace } from './_lib/redis.mjs';
import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';

const CLIENT_PORTAL_AUTH_KEY = 'medici-client-portal-auth';

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({
    error: 'Cloud sync is not configured. Add Upstash Redis in Vercel, then redeploy.',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!isStaffSessionValid(session)) {
    return unauthorized(res);
  }

  const redis = getRedis();
  if (!redis) return unavailable(res);

  const { credentials } = req.body || {};
  if (!credentials || typeof credentials !== 'object') {
    return res.status(400).json({ error: 'Invalid credentials payload.' });
  }

  const workspace = (await loadWorkspace(redis)) || {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'medici-social-kanban',
    data: {},
  };
  workspace.data = workspace.data || {};
  workspace.data[CLIENT_PORTAL_AUTH_KEY] = {
    ...(workspace.data[CLIENT_PORTAL_AUTH_KEY] || {}),
    ...credentials,
  };
  workspace.exportedAt = new Date().toISOString();

  await saveWorkspace(redis, workspace);
  return res.status(200).json({ ok: true, brands: Object.keys(workspace.data[CLIENT_PORTAL_AUTH_KEY]) });
}
