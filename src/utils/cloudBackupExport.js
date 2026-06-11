import { fetchStaffSyncRows } from '../lib/staffSyncApi';
import { getOrgId } from '../lib/orgSession';
import {
  STORAGE_KEY,
  VIDEO_IDEAS_STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  TEAM_STORAGE_KEY,
  SHOOT_PLANS_STORAGE_KEY,
  EDITOR_TODO_STORAGE_KEY,
  EDITOR_TODO_ORDER_KEY,
  AM_TODO_ORDER_KEY,
  ADMIN_TASKS_STORAGE_KEY,
  EVENTS_STORAGE_KEY,
  MEETINGS_STORAGE_KEY,
  CLIENT_PORTAL_AUTH_STORAGE_KEY,
} from '../constants';
import { BACKUP_VERSION } from './dataBackup';

const TABLE_TO_KEY = {
  cards: STORAGE_KEY,
  video_ideas: VIDEO_IDEAS_STORAGE_KEY,
  clients: CLIENTS_STORAGE_KEY,
  team_members: TEAM_STORAGE_KEY,
  shoot_plans: SHOOT_PLANS_STORAGE_KEY,
  admin_tasks: ADMIN_TASKS_STORAGE_KEY,
  events: EVENTS_STORAGE_KEY,
  meetings: MEETINGS_STORAGE_KEY,
};

function rowsToCollection(table, rows = []) {
  if (table === 'clients') {
    const row = rows.find((entry) => entry.id === 'workspace') || rows[0];
    return row?.data || {};
  }
  if (table === 'shoot_plans') {
    const map = {};
    for (const row of rows) {
      if (row?.id) map[row.id] = row.data;
    }
    return map;
  }
  return rows.map((row) => row.data).filter(Boolean);
}

function portalUsersToCredentialMap(rows = []) {
  const map = {};
  for (const row of rows) {
    const brandKey = row.brand_key || row.brands?.brand_key;
    if (!brandKey) continue;
    const users = map[brandKey] || [];
    users.push({
      id: String(row.id),
      username: row.username,
      passwordHash: row.password_hash,
      displayName: row.display_name || '',
      avatar: row.avatar || null,
    });
    map[brandKey] = users;
  }
  return map;
}

/** Assemble a backup snapshot from Supabase via staff-sync (cloud mode export). */
export async function buildCloudBackupPayload(orgId = getOrgId()) {
  const data = {};

  for (const table of Object.keys(TABLE_TO_KEY)) {
    const rows = await fetchStaffSyncRows(table, orgId);
    if (!Array.isArray(rows)) continue;
    data[TABLE_TO_KEY[table]] = rowsToCollection(table, rows);
  }

  const clientRecords = await fetchStaffSyncRows('client_records', orgId);
  if (Array.isArray(clientRecords) && clientRecords.length) {
    data.client_records = clientRecords;
  }

  const portalUsers = await fetchStaffSyncRows('portal_users', orgId);
  if (Array.isArray(portalUsers) && portalUsers.length) {
    data[CLIENT_PORTAL_AUTH_STORAGE_KEY] = portalUsersToCredentialMap(portalUsers);
  }

  const editorTodo = await fetchStaffSyncRows('admin_tasks', orgId);
  if (Array.isArray(editorTodo)) {
    data[EDITOR_TODO_STORAGE_KEY] = rowsToCollection('admin_tasks', editorTodo);
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'medici-social-kanban',
    source: 'supabase',
    data,
  };
}
