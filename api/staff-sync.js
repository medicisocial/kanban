import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { deleteRecords, isSupabaseConfigured, upsertRecords } from './_lib/supabase.mjs';

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
]);

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({ error: 'Cloud sync is not configured.' });
}

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

async function isAuthorized(req) {
  const staffSession = getSessionFromRequest(req);
  if (isStaffSessionValid(staffSession)) return true;

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;

  const token = auth.slice(7).trim();
  if (!isLikelyJwt(token)) return false;

  return verifySupabaseAccessToken(token);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await isAuthorized(req))) {
    return unauthorized(res);
  }

  if (!isSupabaseConfigured()) {
    return unavailable(res);
  }

  const { table, upserts, deleteIds, orgId } = req.body || {};
  if (!table || !ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Invalid table.' });
  }

  const resolvedOrgId = typeof orgId === 'string' && orgId.trim() ? orgId.trim() : undefined;

  try {
    if (Array.isArray(deleteIds) && deleteIds.length) {
      await deleteRecords(table, deleteIds, resolvedOrgId);
    }
    if (Array.isArray(upserts) && upserts.length) {
      await upsertRecords(
        table,
        upserts.map((row) => ({ id: row.id, data: row.data })),
        resolvedOrgId,
      );
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[staff-sync] failed:', error?.message || error);
    return res.status(500).json({ error: 'Sync failed.' });
  }
}
