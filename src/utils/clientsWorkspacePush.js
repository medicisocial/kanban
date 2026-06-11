/** Keys that stay in the legacy clients workspace blob (org-level, not per-brand). */
export const CLIENTS_BLOB_ONLY_KEYS = [
  'names',
  'removedNames',
  'restoredNames',
  'contentTypeColors',
  'customColorPalette',
];

export function slimClientsWorkspaceForCloudPush(workspace = {}) {
  const slim = {};
  for (const key of CLIENTS_BLOB_ONLY_KEYS) {
    if (workspace[key] !== undefined) {
      slim[key] = workspace[key];
    }
  }
  return slim;
}

export function mergeSlimClientsWorkspace(existing = {}, incoming = {}, synced = null) {
  const merged = { ...(existing || {}) };
  for (const key of CLIENTS_BLOB_ONLY_KEYS) {
    if (incoming[key] === undefined) continue;
    if (synced && synced[key] !== undefined && JSON.stringify(synced[key]) === JSON.stringify(incoming[key])) {
      merged[key] = existing[key];
      continue;
    }
    merged[key] = incoming[key];
  }
  return merged;
}
