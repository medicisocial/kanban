import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import {
  deleteRecords,
  fetchSyncRows,
  getSupabaseUrl,
  isSupabaseConfigured,
  resolveAuthReadKey,
  upsertRecords,
} from './_lib/supabase.mjs';
import { assertAuthorizedOrgId } from './_lib/orgContext.mjs';
import {
  filterAuthCriticalDeletes,
  sanitizeAuthCriticalUpserts,
} from './_lib/authCriticalSync.mjs';
import {
  badRequest,
  forbidden,
  methodNotAllowed,
  ok,
  serverError,
  unavailable,
  unauthorized,
} from './_lib/apiResponse.mjs';

const ALLOWED_TABLES = new Set([
  'cards',
  'shoot_plans',
  'video_ideas',
  'admin_tasks',
  'events',
  'meetings',
  'clients',
  'team_members',
  'client_portal_credentials',
  'brands',
  'portal_users',
  'client_records',
]);

function isLikelyJwt(token) {
  return typeof token === 'string' && token.split('.').length === 3;
}

async function verifySupabaseAccessToken(token) {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  )
    .trim()
    .replace(/\/$/, '');
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!url || !anonKey || !token) return false;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  return response.ok;
}

async function safeVerifySupabaseToken(token) {
  try {
    return await verifySupabaseAccessToken(token);
  } catch {
    return false;
  }
}

async function isAuthorized(req) {
  const staffSession = getSessionFromRequest(req);
  if (isStaffSessionValid(staffSession)) return true;

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;

  const token = auth.slice(7).trim();
  if (!isLikelyJwt(token)) return false;

  return safeVerifySupabaseToken(token);
}

async function fetchClientRecordRows(orgId) {
  const url = getSupabaseUrl();
  const key = resolveAuthReadKey();
  if (!url || !key) return [];

  const endpoint =
    `${url}/rest/v1/client_records?select=id,org_id,brand_key,display_name,client_color,logo,contacts,social_logins,company_files,special_menus,photo_gallery_link,business_type,account_manager,updated_at&org_id=eq.${encodeURIComponent(orgId)}`;
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) return [];
  return response.json();
}

async function fetchPortalUserRows(orgId) {
  const url = getSupabaseUrl();
  const key = resolveAuthReadKey();
  if (!url || !key) return [];

  const endpoint =
    `${url}/rest/v1/portal_users?select=id,username,password_hash,display_name,avatar,updated_at,brands!inner(brand_key,display_name,org_id)&brands.org_id=eq.${encodeURIComponent(orgId)}`;
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) return [];
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id,
    username: row.username,
    password_hash: row.password_hash,
    display_name: row.display_name,
    avatar: row.avatar,
    updated_at: row.updated_at,
    brand_key: row.brands?.brand_key || '',
    brands: row.brands,
  }));
}

export default async function handler(req, res) {
  if (!(await isAuthorized(req))) {
    return unauthorized(res, 'Unauthorized');
  }

  if (!isSupabaseConfigured()) {
    return unavailable(res, 'Cloud sync is not configured.');
  }

  if (req.method === 'GET') {
    const table = String(req.query?.table || '').trim();
    if (!table || !ALLOWED_TABLES.has(table)) {
      return badRequest(res, 'Invalid table.');
    }

    const orgCheck = await assertAuthorizedOrgId(req, req.query?.orgId);
    if (!orgCheck.ok) {
      return forbidden(res, orgCheck.error || 'Forbidden org scope.');
    }

    try {
      const rows =
        table === 'client_records'
          ? await fetchClientRecordRows(orgCheck.orgId)
          : table === 'portal_users'
            ? await fetchPortalUserRows(orgCheck.orgId)
            : await fetchSyncRows(table, orgCheck.orgId);
      return ok(res, { rows: rows || [] });
    } catch (error) {
      console.error('[staff-sync] fetch failed:', error?.message || error);
      return serverError(res, 'Could not load workspace data.');
    }
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'GET, POST');
  }

  const {
    table,
    upserts,
    deleteIds,
    orgId,
    authDeleteConfirmed = false,
    credentialPasswordChanges = [],
  } = req.body || {};
  if (!table || !ALLOWED_TABLES.has(table)) {
    return badRequest(res, 'Invalid table.');
  }

  const orgCheck = await assertAuthorizedOrgId(req, orgId);
  if (!orgCheck.ok) {
    return forbidden(res, orgCheck.error || 'Forbidden org scope.');
  }
  const resolvedOrgId = orgCheck.orgId;

  try {
    const safeDeleteIds = filterAuthCriticalDeletes(table, deleteIds, authDeleteConfirmed);
    const safeUpserts = await sanitizeAuthCriticalUpserts(table, upserts, resolvedOrgId, {
      credentialPasswordChanges,
    });

    if (safeDeleteIds.length) {
      await deleteRecords(table, safeDeleteIds, resolvedOrgId);
    }
    if (safeUpserts.length) {
      await upsertRecords(
        table,
        safeUpserts.map((row) => ({ id: row.id, data: row.data })),
        resolvedOrgId,
      );
    }
    return ok(res);
  } catch (error) {
    console.error('[staff-sync] failed:', error?.message || error);
    return serverError(res, 'Sync failed.');
  }
}