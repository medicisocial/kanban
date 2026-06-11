/** Keys that stay in the legacy clients workspace blob (org-level, not per-brand). */
export const CLIENTS_BLOB_ONLY_KEYS = [
  'removedNames',
  'restoredNames',
  'contentTypeColors',
  'customColorPalette',
];

/** Per-brand fields migrated to client_records — ignored on cloud merge/push when Supabase is enabled. */
export const CLIENTS_BLOB_DEPRECATED_BRAND_KEYS = [
  'colors',
  'logos',
  'accountManagers',
  'businessTypes',
  'contacts',
  'socialLogins',
  'companyFiles',
  'specialMenus',
  'photoGalleryLinks',
  'portalPasswordVault',
  'ideas',
  'notes',
  '_passwordResetTokens',
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
  delete merged.names;
  return merged;
}

export function stripClientsBlobBrandFields(workspace = {}) {
  return slimClientsWorkspaceForCloudPush(workspace);
}
