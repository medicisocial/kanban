import {
  mergeClientNameTombstones,
  suppressedClientNameKeys,
  stripSuppressedClientNames,
} from './clientsWorkspaceMerge.js';

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
  'videographers',
  'photographers',
  'businessTypes',
  'contacts',
  'socialLogins',
  'companyFiles',
  'specialMenus',
  'photoGalleryLinks',
  'websites',
  'portalPasswordVault',
  'ideas',
  'notes',
  '_passwordResetTokens',
  'deliverableTargets',
  'reelPointsTargets',
  'carouselStaticTargets',
  'carouselTargets',
  'staticTargets',
  'planIds',
  'shootDaysPerMonth',
  'shootHoursPerDay',
  'monthlyPackageAmounts',
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

/** Apply org_workspace_settings row in cloud mode — never touch names/profiles. */
export function mergeOrgSettingsIntoWorkspace(prev = {}, settings = {}) {
  if (!settings || typeof settings !== 'object') return prev;
  const now = Date.now();
  const tombstones = mergeClientNameTombstones(prev, settings, now);
  const next = { ...prev };
  next.removedNames = tombstones.removedNames;
  next.restoredNames = tombstones.restoredNames;
  if (settings.contentTypeColors !== undefined) next.contentTypeColors = settings.contentTypeColors;
  if (settings.customColorPalette !== undefined) next.customColorPalette = settings.customColorPalette;
  const suppressed = suppressedClientNameKeys(tombstones, now);
  return stripSuppressedClientNames(next, suppressed);
}

/** Apply only org-level clients blob fields in cloud mode — never touch names/profiles. */
export function mergeCloudClientsBlobRemote(prev = {}, remote = {}) {
  if (!remote || typeof remote !== 'object') return prev;
  const slim = slimClientsWorkspaceForCloudPush(remote);
  const next = { ...prev };
  if (slim.removedNames !== undefined) next.removedNames = slim.removedNames;
  if (slim.restoredNames !== undefined) next.restoredNames = slim.restoredNames;
  if (slim.contentTypeColors !== undefined) next.contentTypeColors = slim.contentTypeColors;
  if (slim.customColorPalette !== undefined) next.customColorPalette = slim.customColorPalette;
  return next;
}
