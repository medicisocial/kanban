import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { saveClientAuthMap } from './_lib/clientCredentialsStore.mjs';
import { isSupabaseConfigured } from './_lib/supabase.mjs';
import { normalizeBrandUsers } from './_lib/clientPortalAuth.mjs';
import { assertAuthorizedOrgId } from './_lib/orgContext.mjs';
import {
  badRequest,
  methodNotAllowed,
  ok,
  serverError,
  unauthorized,
  unavailable,
} from './_lib/apiResponse.mjs';

export default async function handler(req, res) {
  if (req.method !== 'PUT') return methodNotAllowed(res, 'PUT');

  const { credentials, orgId: requestedOrgId } = req.body || {};
  if (!credentials || typeof credentials !== 'object') {
    return badRequest(res, 'Invalid credentials payload.');
  }

  // Accept both legacy staff session and Supabase JWT (SaaS staff).
  const orgCheck = await assertAuthorizedOrgId(req, requestedOrgId);
  if (!orgCheck.ok) {
    return unauthorized(res, 'Unauthorized');
  }
  const resolvedOrgId = orgCheck.orgId;

  if (!isSupabaseConfigured()) {
    return unavailable(res, 'Cloud sync is not configured. Add Supabase in Vercel, then redeploy.');
  }

  try {
    // Save directly to client_portal_credentials table (migration 018+).
    // Legacy clients blob write has been removed — triggers keep it in sync.
    await saveClientAuthMap(credentials, resolvedOrgId);
  } catch (error) {
    console.error('[client-credentials] save failed:', error?.message || error);
    return serverError(res, error.message || 'Could not save client logins to cloud.');
  }

  const savedAuth = credentials;
  const brandsWithPasswords = Object.entries(savedAuth)
    .filter(([, entry]) => normalizeBrandUsers(entry).some((user) => user.passwordHash))
    .map(([brand]) => brand);
  const userCount = Object.values(savedAuth).reduce(
    (total, entry) => total + normalizeBrandUsers(entry).filter((user) => user.passwordHash).length,
    0,
  );

  return ok(res, { brands: brandsWithPasswords, userCount });
}
