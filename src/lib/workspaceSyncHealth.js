const listeners = new Set();

/** @typedef {{ id: string, level: 'info' | 'warn' | 'error', message: string, table?: string, at: number }} SyncIssue */

/** @type {SyncIssue | null} */
let latestIssue = null;

export function reportSyncIssue({ level = 'warn', message, table }) {
  if (!message) return;
  latestIssue = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    message,
    table,
    at: Date.now(),
  };
  for (const listener of listeners) {
    listener(latestIssue);
  }
}

export function clearSyncIssue() {
  latestIssue = null;
  for (const listener of listeners) {
    listener(null);
  }
}

export function getLatestSyncIssue() {
  return latestIssue;
}

export function subscribeSyncIssues(listener) {
  listeners.add(listener);
  listener(latestIssue);
  return () => listeners.delete(listener);
}
