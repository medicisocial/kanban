import { getSessionFromRequest, isStaffSessionValid } from './staffAuth.mjs';
import { isSuperAdminSessionValid } from './superAdminAuth.mjs';


const LEGACY_ORG_ID = (process.env.ORG_ID || process.env.VITE_ORG_ID || 'medici').trim();

function getSupabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
}

function getServerKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
}

async function getUserIdFromJwt(token) {
  const url = getSupabaseUrl();
  const key = getServerKey();
  if (!url || !key || !token) return null;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ?? null;
}

const ORG_FETCH_TIMEOUT_MS = 8000;

async function fetchMemberOrgId(userId) {
  const url = getSupabaseUrl();
  const key = getServerKey();
  if (!url || !key || !userId) return null;

  const endpoint = `${url}/rest/v1/organization_members?select=org_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ORG_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const rows = await response.json();
    return rows?.[0]?.org_id ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getDefaultOrgId() {
  return LEGACY_ORG_ID;
}

/**
 * Resolve the org this request is allowed to read/write.
 * Returns the orgId string, or null when the caller is unauthenticated /
 * cannot be mapped to any org. Callers that need a hard 403 should check for
 * null rather than accepting the legacy fallback.
 */
export async function resolveAuthorizedOrgId(req) {
  const adminSession = getSessionFromRequest(req);
  if (isSuperAdminSessionValid(adminSession)) {
    return '__super_admin__';
  }

  const staffSession = getSessionFromRequest(req);
  if (isStaffSessionValid(staffSession)) {
    return LEGACY_ORG_ID;
  }

  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token.split('.').length === 3) {
      const userId = await getUserIdFromJwt(token);
      if (userId) {
        const orgId = await fetchMemberOrgId(userId);
        // Return the org if found, or null — never fall back to the legacy org
        // for a valid JWT that has no membership (that would allow any
        // Supabase Auth user to read/write the Medici workspace).
        return orgId || null;
      }
    }
  }

  return null;
}

export async function assertAuthorizedOrgId(req, requestedOrgId) {
  const authorized = await resolveAuthorizedOrgId(req);
  if (!authorized) {
    return { ok: false, orgId: null, error: 'Unauthorized.' };
  }

  if (authorized === '__super_admin__') {
    const target =
      typeof requestedOrgId === 'string' && requestedOrgId.trim()
        ? requestedOrgId.trim()
        : 'medici';
    return { ok: true, orgId: target };
  }

  const target =
    typeof requestedOrgId === 'string' && requestedOrgId.trim()
      ? requestedOrgId.trim()
      : authorized;

  if (target !== authorized) {
    return { ok: false, orgId: authorized, error: 'Forbidden org scope.' };
  }

  return { ok: true, orgId: target };
}
