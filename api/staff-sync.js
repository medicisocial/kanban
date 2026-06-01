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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!isStaffSessionValid(session)) {
    return unauthorized(res);
  }

  if (!isSupabaseConfigured()) {
    return unavailable(res);
  }

  const { table, upserts, deleteIds } = req.body || {};
  if (!table || !ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: 'Invalid table.' });
  }

  try {
    if (Array.isArray(deleteIds) && deleteIds.length) {
      await deleteRecords(table, deleteIds);
    }
    if (Array.isArray(upserts) && upserts.length) {
      await upsertRecords(
        table,
        upserts.map((row) => ({ id: row.id, data: row.data })),
      );
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[staff-sync] failed:', error?.message || error);
    return res.status(500).json({ error: 'Sync failed.' });
  }
}
