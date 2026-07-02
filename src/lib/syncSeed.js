import { pushStaffSyncRows } from './staffSyncApi';
import { ensureStaffSupabaseSession, hasStaffSupabaseSession } from './staffSupabaseAuth';
import { reportSyncIssue } from './workspaceSyncHealth';

/**
 * Upload local records when Supabase is empty but this browser still has data.
 * Uses the server staff-sync API when the browser DB session is unavailable.
 */
export async function seedRecordsToCloud({ table, orgId, store, rows }) {
  if (!rows?.length) return true;

  let canWrite = await hasStaffSupabaseSession();
  if (!canWrite) {
    await ensureStaffSupabaseSession();
    canWrite = await hasStaffSupabaseSession();
  }

  try {
    if (canWrite && store && table !== 'cards') {
      await store.upsertRecords(rows);
      return true;
    }

    const ok = await pushStaffSyncRows(
      table,
      rows.map((row) => ({
        id: String(row.id),
        data: row.data ?? row,
      })),
      [],
      orgId,
    );

    if (!ok) {
      reportSyncIssue({
        level: 'warn',
        table,
        message:
          'Could not upload local data to the cloud. Open the app on desktop once while signed in, or check Vercel env (SUPABASE_SERVICE_ROLE_KEY).',
      });
    }
    return ok;
  } catch (error) {
    console.warn(`[supabase:${table}] seed failed:`, error?.message || error);
    reportSyncIssue({
      level: 'warn',
      table,
      message: `Could not upload ${table} to the cloud: ${error?.message || 'sync failed'}.`,
    });
    return false;
  }
}
