import {
  ADMIN_TASKS_STORAGE_KEY,
  AM_TODO_ORDER_KEY,
  CLIENT_PORTAL_AUTH_STORAGE_KEY,
  CLIENT_PORTAL_PASSWORD_VAULT_KEY,
  CLIENT_RESPONSES_STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  EDITOR_TODO_ORDER_KEY,
  EDITOR_TODO_STORAGE_KEY,
  EVENTS_STORAGE_KEY,
  MEETINGS_STORAGE_KEY,
  SHOOT_PLANS_STORAGE_KEY,
  STORAGE_KEY,
  TEAM_STORAGE_KEY,
  VIDEO_IDEAS_STORAGE_KEY,
} from '../constants';
import { orgScopedKey } from '../lib/orgStorage';
import { isCloudSourceOfTruth } from '../lib/cloudSourceOfTruth';

export const BACKUP_VERSION = 1;

export const BACKUP_STORAGE_KEYS = [
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
];

const BACKUP_QUEUE_KEYS = [
  CLIENT_RESPONSES_STORAGE_KEY,
  'medici-social-content-review-responses',
  'medici-social-shoot-responses',
];

export const ALL_SYNC_STORAGE_KEYS = [
  ...BACKUP_STORAGE_KEYS,
  ...BACKUP_QUEUE_KEYS,
  CLIENT_PORTAL_AUTH_STORAGE_KEY,
  CLIENT_PORTAL_PASSWORD_VAULT_KEY,
];

export const WORKSPACE_SYNC_META_KEY = 'medici-workspace-sync-meta';

function readWorkspaceData() {
  const data = {};
  for (const key of ALL_SYNC_STORAGE_KEYS) {
    const raw = localStorage.getItem(orgScopedKey(key));
    if (raw !== null) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
  }
  return data;
}

export function getWorkspaceDataSnapshot() {
  return JSON.stringify(readWorkspaceData());
}

export function getLocalSyncMeta() {
  try {
    const raw = localStorage.getItem(WORKSPACE_SYNC_META_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { exportedAt: null, snapshot: null };
}

export function setLocalSyncMeta(exportedAt, snapshot = getWorkspaceDataSnapshot()) {
  localStorage.setItem(
    WORKSPACE_SYNC_META_KEY,
    JSON.stringify({ exportedAt, snapshot }),
  );
}

export function isLocalWorkspaceDirty() {
  const meta = getLocalSyncMeta();
  if (!meta.snapshot) {
    return hasWorkspaceData({ data: readWorkspaceData() });
  }
  return getWorkspaceDataSnapshot() !== meta.snapshot;
}

export function buildBackupPayload() {
  const data = readWorkspaceData();
  const meta = getLocalSyncMeta();
  return {
    version: BACKUP_VERSION,
    exportedAt: meta.exportedAt || new Date(0).toISOString(),
    app: 'medici-social-kanban',
    data,
  };
}

export function buildBackupPayloadForPush() {
  const data = readWorkspaceData();
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'medici-social-kanban',
    data,
  };
}

export function applyBackupPayload(payload) {
  if (!payload?.data || typeof payload.data !== 'object') return false;

  for (const key of Object.keys(payload.data)) {
    localStorage.setItem(orgScopedKey(key), JSON.stringify(payload.data[key]));
  }

  if (payload.exportedAt) {
    setLocalSyncMeta(payload.exportedAt, JSON.stringify(payload.data));
  }

  return true;
}

export function hasWorkspaceData(payload = buildBackupPayload()) {
  const cards = payload?.data?.[STORAGE_KEY];
  if (Array.isArray(cards) && cards.length > 0) return true;

  const ideas = payload?.data?.[VIDEO_IDEAS_STORAGE_KEY];
  if (Array.isArray(ideas) && ideas.length > 0) return true;

  const adminTasks = payload?.data?.[ADMIN_TASKS_STORAGE_KEY];
  if (Array.isArray(adminTasks) && adminTasks.length > 0) return true;

  const shootPlans = payload?.data?.[SHOOT_PLANS_STORAGE_KEY];
  if (shootPlans && typeof shootPlans === 'object' && Object.keys(shootPlans).length > 0) {
    return true;
  }

  return false;
}

export function getPayloadTimestamp(payload) {
  const exportedAt = payload?.exportedAt;
  if (!exportedAt) return 0;
  const time = new Date(exportedAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function exportBackupFile() {
  const payload = buildBackupPayloadForPush();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `medici-social-backup-${stamp}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function importBackupFile(file) {
  if (isCloudSourceOfTruth()) {
    return Promise.reject(
      new Error('Backup import is disabled in cloud mode. Workspace data is synced from Supabase.'),
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        if (!payload?.data || typeof payload.data !== 'object') {
          reject(new Error('Invalid backup file.'));
          return;
        }
        const keys = Object.keys(payload.data);
        if (!keys.length) {
          reject(new Error('Backup file is empty.'));
          return;
        }
        for (const key of keys) {
          localStorage.setItem(orgScopedKey(key), JSON.stringify(payload.data[key]));
        }
        if (payload.exportedAt) {
          setLocalSyncMeta(payload.exportedAt, JSON.stringify(payload.data));
        }
        resolve(keys.length);
      } catch {
        reject(new Error('Could not read backup file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read backup file.'));
    reader.readAsText(file);
  });
}
