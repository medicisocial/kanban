import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { saveClientAuthMap } from './_lib/clientCredentialsStore.mjs';
import { isSupabaseConfigured } from './_lib/supabase.mjs';
import { getRedis } from './_lib/redis.mjs';
import { normalizeBrandUsers } from './_lib/clientPortalAuth.mjs';
import { assertAuthorizedOrgId } from './_lib/orgContext.mjs';

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({
    error: 'Cloud sync is not configured. Add Supabase or Upstash Redis, then redeploy.',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { credentials, orgId: requestedOrgId } = req.body || {};
  if (!credentials || typeof credentials !== 'object') {
    return res.status(400).json({ error: 'Invalid credentials payload.' });
  }

  // Accept both legacy staff session and Supabase JWT (SaaS staff).
  const orgCheck = await assertAuthorizedOrgId(req, requestedOrgId);
  if (!orgCheck.ok) {
    return unauthorized(res);
  }
  const resolvedOrgId = orgCheck.orgId;

  if (!isSupabaseConfigured() && !getRedis()) {
    return unavailable(res);
  }

  try {
    await saveClientAuthMap(credentials, resolvedOrgId);
  } catch (error) {
    console.error('[client-credentials] save failed:', error?.message || error);
    return res.status(500).json({ error: error.message || 'Could not save client logins to cloud.' });
  }

  const savedAuth = credentials;
  const brandsWithPasswords = Object.entries(savedAuth)
    .filter(([, entry]) => normalizeBrandUsers(entry).some((user) => user.passwordHash))
    .map(([brand]) => brand);
  const userCount = Object.values(savedAuth).reduce(
    (total, entry) => total + normalizeBrandUsers(entry).filter((user) => user.passwordHash).length,
    0,
  );

  return res.status(200).json({ ok: true, brands: brandsWithPasswords, userCount });
}
