import {
  ADMIN_TASKS_STORAGE_KEY,
  CLIENT_RESPONSES_STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  EDITOR_TODO_ORDER_KEY,
  EDITOR_TODO_STORAGE_KEY,
  SHOOT_PLANS_STORAGE_KEY,
  STORAGE_KEY,
  VIDEO_IDEAS_STORAGE_KEY,
} from '../constants';

export const BACKUP_VERSION = 1;

export const BACKUP_STORAGE_KEYS = [
  STORAGE_KEY,
  VIDEO_IDEAS_STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  SHOOT_PLANS_STORAGE_KEY,
  EDITOR_TODO_STORAGE_KEY,
  EDITOR_TODO_ORDER_KEY,
  ADMIN_TASKS_STORAGE_KEY,
];

const BACKUP_QUEUE_KEYS = [
  CLIENT_RESPONSES_STORAGE_KEY,
  'medici-social-content-review-responses',
  'medici-social-shoot-responses',
];

export function buildBackupPayload() {
  const data = {};
  for (const key of BACKUP_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
  }
  for (const key of BACKUP_QUEUE_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'medici-social-kanban',
    data,
  };
}

export function exportBackupFile() {
  const payload = buildBackupPayload();
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
          localStorage.setItem(key, JSON.stringify(payload.data[key]));
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
