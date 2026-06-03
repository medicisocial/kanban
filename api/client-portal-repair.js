import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { assertAuthorizedOrgId } from './_lib/orgContext.mjs';
import {
  fetchCollectionMap,
  fetchRecord,
  isSupabaseConfigured,
  upsertRecord,
} from './_lib/supabase.mjs';
import { hashValue, normalizeBrandUsers } from './_lib/clientPortalAuth.mjs';
import { hasConfiguredPortalUsers } from './_lib/authCriticalSync.mjs';

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({ error: 'Cloud sync is not configured.' });
}

/**
 * Rebuild portal password hashes from the staff password vault when hashes drift
 * or were accidentally wiped by a bad sync. Staff-only maintenance endpoint.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const staffSession = getSessionFromRequest(req);
  if (!isStaffSessionValid(staffSession)) {
    return unauthorized(res);
  }

  if (!isSupabaseConfigured()) {
    return unavailable(res);
  }

  const orgCheck = await assertAuthorizedOrgId(req, req.body?.orgId);
  if (!orgCheck.ok) {
    return unauthorized(res);
  }
  const orgId = orgCheck.orgId;

  try {
    const [credentialMap, clientsWorkspace] = await Promise.all([
      fetchCollectionMap('client_portal_credentials', orgId),
      fetchRecord('clients', 'workspace', orgId),
    ]);

    const vault = clientsWorkspace?.portalPasswordVault || {};
    const nextMap = { ...(credentialMap || {}) };
    let repairedUsers = 0;
    const repairedBrands = [];

    for (const [brand, brandVault] of Object.entries(vault)) {
      if (!brandVault || typeof brandVault !== 'object') continue;

      const users = normalizeBrandUsers(nextMap[brand]);
      if (!users.length) continue;

      let brandRepaired = false;
      const nextUsers = users.map((user) => {
        const plainPassword = brandVault[user.id];
        if (!plainPassword) return user;
        const passwordHash = hashValue(String(plainPassword).trim());
        if (passwordHash === user.passwordHash?.trim().toLowerCase()) return user;
        repairedUsers += 1;
        brandRepaired = true;
        return { ...user, passwordHash };
      });

      if (brandRepaired && hasConfiguredPortalUsers(nextUsers)) {
        nextMap[brand] = nextUsers;
        await upsertRecord('client_portal_credentials', brand, nextUsers, orgId);
        repairedBrands.push(brand);
      }
    }

    return res.status(200).json({
      ok: true,
      repairedUsers,
      repairedBrands,
    });
  } catch (error) {
    console.error('[client-portal-repair] failed:', error?.message || error);
    return res.status(500).json({ error: 'Could not repair portal credentials.' });
  }
}
