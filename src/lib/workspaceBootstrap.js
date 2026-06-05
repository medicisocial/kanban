import {
  ADMIN_TASKS_STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  EVENTS_STORAGE_KEY,
  MEETINGS_STORAGE_KEY,
  SHOOT_PLANS_STORAGE_KEY,
  STORAGE_KEY,
  TEAM_STORAGE_KEY,
  VIDEO_IDEAS_STORAGE_KEY,
} from '../constants';
import { SUPABASE_ENABLED } from './supabaseClient';
import { getOrgId } from './orgSession';
import { readOrgScopedJson } from './orgStorage';
import { fetchStaffSyncRows, pushStaffSyncRows } from './staffSyncApi';
import { ensureStaffSupabaseSession } from './staffSupabaseAuth';
import { localCollectionHasRecords } from './syncHelpers';
import { loadStaffSession } from '../utils/staffAuth';
import { reportSyncIssue, clearSyncIssue } from './workspaceSyncHealth';

const COLLECTION_LOADERS = [
  { table: 'cards', load: () => readOrgScopedJson(STORAGE_KEY, []) },
  { table: 'video_ideas', load: () => readOrgScopedJson(VIDEO_IDEAS_STORAGE_KEY, []) },
  { table: 'meetings', load: () => readOrgScopedJson(MEETINGS_STORAGE_KEY, []) },
  { table: 'admin_tasks', load: () => readOrgScopedJson(ADMIN_TASKS_STORAGE_KEY, []) },
  { table: 'events', load: () => readOrgScopedJson(EVENTS_STORAGE_KEY, []) },
  { table: 'team_members', load: () => readOrgScopedJson(TEAM_STORAGE_KEY, []) },
];

const MAP_LOADERS = [
  { table: 'shoot_plans', load: () => readOrgScopedJson(SHOOT_PLANS_STORAGE_KEY, {}) },
];

const SINGLETON_LOADERS = [
  { table: 'clients', recordId: 'state', load: () => readOrgScopedJson(CLIENTS_STORAGE_KEY, null) },
];

/**
 * After sign-in, push any local-only workspace data to Supabase so mobile and other
 * devices can load it through staff-sync / RLS-safe server reads.
 */
export async function bootstrapLocalWorkspaceToCloud() {
  if (!SUPABASE_ENABLED || !loadStaffSession()?.username) {
    return { seeded: [], skipped: true };
  }

  await ensureStaffSupabaseSession();

  const orgId = getOrgId();
  const seeded = [];
  let cloudConfirmed = false;
  let hadFetchFailure = false;
  let hadPushFailure = false;

  for (const { table, load } of COLLECTION_LOADERS) {
    const local = load();
    if (!localCollectionHasRecords(local)) continue;

    const remote = await fetchStaffSyncRows(table, orgId);
    if (remote === null) {
      hadFetchFailure = true;
    } else if (remote.length > 0) {
      cloudConfirmed = true;
      continue;
    }

    const rows = local.map((record) => ({
      id: String(record.id),
      data: record,
    }));
    const ok = await pushStaffSyncRows(table, rows, [], orgId);
    if (ok) seeded.push(table);
    else hadPushFailure = true;
  }

  for (const { table, load } of MAP_LOADERS) {
    const local = load();
    if (!local || typeof local !== 'object' || !Object.keys(local).length) continue;

    const remote = await fetchStaffSyncRows(table, orgId);
    if (remote === null) {
      hadFetchFailure = true;
    } else if (remote.length > 0) {
      cloudConfirmed = true;
      continue;
    }

    const rows = Object.entries(local).map(([id, data]) => ({ id, data }));
    const ok = await pushStaffSyncRows(table, rows, [], orgId);
    if (ok) seeded.push(table);
    else hadPushFailure = true;
  }

  for (const { table, recordId, load } of SINGLETON_LOADERS) {
    const local = load();
    if (!localCollectionHasRecords(local)) continue;

    const remote = await fetchStaffSyncRows(table, orgId);
    if (remote === null) {
      hadFetchFailure = true;
    } else if (remote.length > 0) {
      cloudConfirmed = true;
      continue;
    }

    const ok = await pushStaffSyncRows(table, [{ id: recordId, data: local }], [], orgId);
    if (ok) seeded.push(table);
    else hadPushFailure = true;
  }

  const hasLocal =
    COLLECTION_LOADERS.some(({ load }) => localCollectionHasRecords(load())) ||
    MAP_LOADERS.some(({ load }) => Object.keys(load() || {}).length > 0) ||
    SINGLETON_LOADERS.some(({ load }) => localCollectionHasRecords(load()));

  if (seeded.length || cloudConfirmed) {
    clearSyncIssue();
  } else if (hasLocal && (hadFetchFailure || hadPushFailure)) {
    reportSyncIssue({
      level: 'info',
      message:
        'Local workspace data is on this device. We could not confirm a cloud copy yet — stay signed in on desktop to finish uploading.',
    });
  } else if (!hasLocal) {
    clearSyncIssue();
  }

  return { seeded, skipped: false, cloudConfirmed };
}
