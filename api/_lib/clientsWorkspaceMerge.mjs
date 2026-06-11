import { mergeClientSocialLogins } from './clientProfile.mjs';
import { normalizeClientBrandName } from './clientBrandNames.mjs';

/**
 * Merge clients workspace blobs so a stale staff-sync push cannot clobber
 * files a client just uploaded through the portal (companyFiles, specialMenus)
 * or profile fields (contacts, logos, social logins).
 */

const TEST_CLIENT_NAME_PATTERNS = [
  /^cursor audit sync\b/i,
  /^cursor api test\b/i,
  /^pipeline audit client\b/i,
  /^e2e[\s-]/i,
  /\be2e test\b/i,
  /-test-upsert$/i,
];

/** Names created by automated audits/E2E runs — never persisted or shown. */
export function isTestClientName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return false;
  return TEST_CLIENT_NAME_PATTERNS.some((pattern) => pattern.test(trimmed));
}

const CLIENT_NAME_TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function pruneTsMap(map, now) {
  const out = {};
  if (map && typeof map === 'object') {
    for (const [key, value] of Object.entries(map)) {
      const ts = Number(value) || 0;
      if (ts && now - ts <= CLIENT_NAME_TOMBSTONE_TTL_MS) out[key] = ts;
    }
  }
  return out;
}

function unionTsMap(a, b, now) {
  const out = pruneTsMap(a, now);
  const other = pruneTsMap(b, now);
  for (const [key, ts] of Object.entries(other)) {
    if (!out[key] || ts > out[key]) out[key] = ts;
  }
  return out;
}

/** Union two blobs' removal/restore tombstones, keeping the newest event per name. */
export function mergeClientNameTombstones(stored = {}, incoming = {}, now = Date.now()) {
  return {
    removedNames: unionTsMap(stored?.removedNames, incoming?.removedNames, now),
    restoredNames: unionTsMap(stored?.restoredNames, incoming?.restoredNames, now),
  };
}

/** Brand keys whose latest tombstone event is a removal (still within TTL). */
export function suppressedClientNameKeys(
  { removedNames = {}, restoredNames = {} } = {},
  now = Date.now(),
) {
  const removed = pruneTsMap(removedNames, now);
  const restored = pruneTsMap(restoredNames, now);
  const keys = new Set();
  for (const [key, ts] of Object.entries(removed)) {
    if ((restored[key] || 0) < ts) keys.add(key);
  }
  return keys;
}

/** Drop tombstoned + test-only client names (and their brand-map entries) from a blob. */
export function stripSuppressedClientNames(workspace = {}, suppressedKeys = new Set()) {
  const names = Array.isArray(workspace.names) ? workspace.names : [];
  const isDropped = (name) =>
    isTestClientName(name) || suppressedKeys.has(normalizeClientBrandName(name));
  const keepNames = names.filter((name) => !isDropped(name));

  const stripMap = (map) => {
    if (!map || typeof map !== 'object') return map;
    const next = {};
    let changed = false;
    for (const [key, value] of Object.entries(map)) {
      if (isDropped(key)) {
        changed = true;
        continue;
      }
      next[key] = value;
    }
    return changed ? next : map;
  };

  return {
    ...workspace,
    names: keepNames,
    colors: stripMap(workspace.colors),
    logos: stripMap(workspace.logos),
    accountManagers: stripMap(workspace.accountManagers),
    businessTypes: stripMap(workspace.businessTypes),
    contacts: stripMap(workspace.contacts),
    socialLogins: stripMap(workspace.socialLogins),
    companyFiles: stripMap(workspace.companyFiles),
    specialMenus: stripMap(workspace.specialMenus),
    photoGalleryLinks: stripMap(workspace.photoGalleryLinks),
    portalPasswordVault: stripMap(workspace.portalPasswordVault),
  };
}

/** Union client names on write so a stale push cannot drop a brand the server just added. */
export function mergeClientsWorkspaceNamesOnWrite(stored = [], incoming = []) {
  const storedList = Array.isArray(stored) ? stored : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];
  const seen = new Set();
  const merged = [];

  for (const name of incomingList) {
    const key = normalizeClientBrandName(name);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(name);
    }
  }
  for (const name of storedList) {
    const key = normalizeClientBrandName(name);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(name);
    }
  }
  return merged;
}

function mergeBrandScalarMap(stored = {}, incoming = {}) {
  return {
    ...(stored && typeof stored === 'object' ? stored : {}),
    ...(incoming && typeof incoming === 'object' ? incoming : {}),
  };
}

function recordUpdatedAt(record) {
  return Number(record?.updatedAt) || 0;
}

function maxUpdatedAt(records) {
  if (!Array.isArray(records) || !records.length) return 0;
  return records.reduce((max, record) => Math.max(max, recordUpdatedAt(record)), 0);
}

/** Union file lists by id; keep the entry with the newest updatedAt. */
export function mergeBrandCompanyFiles(stored = [], incoming = []) {
  const storedList = Array.isArray(stored) ? stored : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];
  const incomingMaxTs = maxUpdatedAt(incomingList);
  const byId = new Map();

  for (const file of incomingList) {
    if (!file?.id) continue;
    byId.set(String(file.id), file);
  }

  for (const file of storedList) {
    if (!file?.id) continue;
    const id = String(file.id);
    const existing = byId.get(id);
    if (!existing) {
      // Client upload staff has not seen yet — keep if newer than incoming snapshot.
      if (recordUpdatedAt(file) > incomingMaxTs) byId.set(id, file);
      continue;
    }
    byId.set(
      id,
      recordUpdatedAt(file) >= recordUpdatedAt(existing) ? file : existing,
    );
  }

  return [...byId.values()].sort((a, b) => recordUpdatedAt(b) - recordUpdatedAt(a));
}

/** Union special menus by id; keep the entry with the newest updatedAt. */
export function mergeBrandSpecialMenus(stored = [], incoming = []) {
  const storedList = Array.isArray(stored) ? stored : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];
  const incomingMaxTs = maxUpdatedAt(incomingList);
  const byId = new Map();

  for (const menu of incomingList) {
    if (!menu?.id) continue;
    byId.set(String(menu.id), menu);
  }

  for (const menu of storedList) {
    if (!menu?.id) continue;
    const id = String(menu.id);
    const existing = byId.get(id);
    if (!existing) {
      if (recordUpdatedAt(menu) > incomingMaxTs) byId.set(id, menu);
      continue;
    }
    byId.set(
      id,
      recordUpdatedAt(menu) >= recordUpdatedAt(existing) ? menu : existing,
    );
  }

  return [...byId.values()].sort((a, b) => recordUpdatedAt(b) - recordUpdatedAt(a));
}

/** Deep-merge per-brand portal password vault entries (never wipe stored passwords). */
export function mergePortalPasswordVault(stored = {}, incoming = {}) {
  const base = stored && typeof stored === 'object' ? stored : {};
  const inc = incoming && typeof incoming === 'object' ? incoming : {};
  const merged = { ...base };

  for (const [brand, users] of Object.entries(inc)) {
    merged[brand] = {
      ...(merged[brand] && typeof merged[brand] === 'object' ? merged[brand] : {}),
      ...(users && typeof users === 'object' ? users : {}),
    };
  }

  return merged;
}

function mergeBrandMap(storedMap = {}, incomingMap = {}, mergeList) {
  const stored = storedMap && typeof storedMap === 'object' ? storedMap : {};
  const incoming = incomingMap && typeof incomingMap === 'object' ? incomingMap : {};
  const brands = new Set([...Object.keys(stored), ...Object.keys(incoming)]);
  const merged = {};

  for (const brand of brands) {
    merged[brand] = mergeList(stored[brand], incoming[brand]);
  }

  return merged;
}

function logoHasContent(logo) {
  if (!logo) return false;
  if (typeof logo === 'string') return logo.trim().length > 0;
  return Boolean(logo?.src);
}

function socialLoginsHasContent(logins) {
  const normalized = mergeClientSocialLogins(logins, {});
  return ['instagram', 'tiktok', 'facebook'].some(
    (platform) => normalized[platform]?.username || normalized[platform]?.password,
  );
}

/** Union contacts by id; never let a stale empty list wipe stored contacts. */
export function mergeBrandContacts(stored = [], incoming = []) {
  const storedList = Array.isArray(stored) ? stored : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];
  if (!incomingList.length && storedList.length) return storedList;

  const byId = new Map();
  for (const contact of storedList) {
    if (contact?.id) byId.set(String(contact.id), contact);
  }
  for (const contact of incomingList) {
    if (contact?.id) byId.set(String(contact.id), contact);
  }
  return [...byId.values()];
}

export function mergeBrandContactsMap(storedMap = {}, incomingMap = {}) {
  return mergeBrandMap(storedMap, incomingMap, mergeBrandContacts);
}

/** Keep stored logos when a stale push omits them or sends an empty value. */
function logoIsStorageBacked(logo) {
  const src = typeof logo === 'string' ? logo : logo?.src;
  return /^https?:\/\//i.test(String(src || ''));
}

function logoUpdatedAt(logo) {
  const ts = Number(logo?.updatedAt);
  return Number.isFinite(ts) ? ts : 0;
}

/**
 * Choose between a stored and incoming logo. Newest (by updatedAt) wins; on a tie
 * or when neither is stamped, the storage-URL logo beats an inline base64 one so a
 * stale tab can never re-inflate the workspace row with a giant data URL.
 */
function pickPreferredLogo(stored, incoming) {
  if (!logoHasContent(incoming)) return stored;
  if (!logoHasContent(stored)) return incoming;

  const incomingTs = logoUpdatedAt(incoming);
  const storedTs = logoUpdatedAt(stored);
  if (incomingTs !== storedTs) return incomingTs > storedTs ? incoming : stored;

  const incomingStorage = logoIsStorageBacked(incoming);
  const storedStorage = logoIsStorageBacked(stored);
  if (incomingStorage !== storedStorage) return incomingStorage ? incoming : stored;

  return incoming;
}

export function mergeBrandLogoMap(stored = {}, incoming = {}) {
  const base = stored && typeof stored === 'object' ? { ...stored } : {};
  const inc = incoming && typeof incoming === 'object' ? incoming : {};

  for (const [brand, logo] of Object.entries(inc)) {
    if (!logoHasContent(logo)) {
      if (Object.prototype.hasOwnProperty.call(inc, brand) && !logoHasContent(base[brand])) {
        delete base[brand];
      }
      continue;
    }
    base[brand] = pickPreferredLogo(base[brand], logo);
  }

  return base;
}

export function mergeBrandSocialLogins(stored, incoming) {
  if (!socialLoginsHasContent(incoming) && socialLoginsHasContent(stored)) {
    return mergeClientSocialLogins(stored, stored);
  }
  return mergeClientSocialLogins(stored, incoming);
}

export function mergeBrandSocialLoginsMap(storedMap = {}, incomingMap = {}) {
  return mergeBrandMap(storedMap, incomingMap, mergeBrandSocialLogins);
}

/** Per-brand string map (e.g. photo gallery links) — same empty-wipe guard as logos. */
export function mergeBrandStringMap(stored = {}, incoming = {}) {
  const base = stored && typeof stored === 'object' ? { ...stored } : {};
  const inc = incoming && typeof incoming === 'object' ? incoming : {};

  for (const [brand, value] of Object.entries(inc)) {
    const incomingValue = String(value || '').trim();
    const storedValue = String(base[brand] || '').trim();
    if (!incomingValue && storedValue) continue;
    if (!incomingValue) delete base[brand];
    else base[brand] = incomingValue;
  }

  return base;
}

/**
 * Three-way merge for one brand's contact list during staff realtime sync.
 * Honors admin edits while keeping contacts that only exist on the server.
 */
export function mergeClientsWorkspaceBrandContacts(remote = [], local = [], synced = []) {
  const localList = Array.isArray(local) ? local : [];
  const remoteList = Array.isArray(remote) ? remote : [];
  const syncedList = Array.isArray(synced) ? synced : [];
  const localChanged = JSON.stringify(localList) !== JSON.stringify(syncedList);

  if (!localChanged) {
    return mergeBrandContacts(syncedList, remoteList);
  }

  const byId = new Map();
  for (const contact of localList) {
    if (contact?.id) byId.set(String(contact.id), contact);
  }

  const syncedIds = new Set(
    syncedList.filter((contact) => contact?.id).map((contact) => String(contact.id)),
  );

  for (const contact of remoteList) {
    if (!contact?.id) continue;
    const id = String(contact.id);
    if (byId.has(id)) continue;
    if (!syncedIds.has(id)) byId.set(id, contact);
  }

  return [...byId.values()];
}

export function mergeClientsWorkspaceContactsMap(
  remoteMap = {},
  localMap = {},
  syncedMap = {},
) {
  const brands = new Set([
    ...Object.keys(remoteMap || {}),
    ...Object.keys(localMap || {}),
    ...Object.keys(syncedMap || {}),
  ]);
  const merged = {};

  for (const brand of brands) {
    merged[brand] = mergeClientsWorkspaceBrandContacts(
      remoteMap?.[brand],
      localMap?.[brand],
      syncedMap?.[brand],
    );
  }

  return merged;
}

/**
 * Replace one brand's file/menu lists on an explicit API save (staff-brand-assets,
 * portal profile). Does not union-merge — admin deletes must stick.
 */
export function applyAuthoritativeBrandAssets(
  workspace = {},
  { companyFilesByBrand, specialMenusByBrand } = {},
) {
  const next = { ...workspace };
  if (companyFilesByBrand && typeof companyFilesByBrand === 'object') {
    next.companyFiles = { ...(workspace.companyFiles || {}), ...companyFilesByBrand };
  }
  if (specialMenusByBrand && typeof specialMenusByBrand === 'object') {
    next.specialMenus = { ...(workspace.specialMenus || {}), ...specialMenusByBrand };
  }
  return next;
}

/** Three-way-safe merge for the clients singleton workspace row. */
export function mergeClientsWorkspaceData(stored = {}, incoming = {}) {
  if (!incoming || typeof incoming !== 'object') return stored || {};
  if (!stored || typeof stored !== 'object') return { ...incoming };

  const now = Date.now();
  const tombstones = mergeClientNameTombstones(stored, incoming, now);
  const suppressed = suppressedClientNameKeys(tombstones, now);

  const merged = {
    ...stored,
    ...incoming,
    removedNames: tombstones.removedNames,
    restoredNames: tombstones.restoredNames,
    names: mergeClientsWorkspaceNamesOnWrite(stored.names, incoming.names),
    colors: mergeBrandScalarMap(stored.colors, incoming.colors),
    accountManagers: mergeBrandScalarMap(stored.accountManagers, incoming.accountManagers),
    businessTypes: mergeBrandScalarMap(stored.businessTypes, incoming.businessTypes),
    contacts: mergeBrandContactsMap(stored.contacts, incoming.contacts),
    logos: mergeBrandLogoMap(stored.logos, incoming.logos),
    socialLogins: mergeBrandSocialLoginsMap(stored.socialLogins, incoming.socialLogins),
    photoGalleryLinks: mergeBrandStringMap(stored.photoGalleryLinks, incoming.photoGalleryLinks),
    companyFiles: mergeBrandMap(
      stored.companyFiles,
      incoming.companyFiles,
      mergeBrandCompanyFiles,
    ),
    specialMenus: mergeBrandMap(
      stored.specialMenus,
      incoming.specialMenus,
      mergeBrandSpecialMenus,
    ),
    portalPasswordVault: mergePortalPasswordVault(
      stored.portalPasswordVault,
      incoming.portalPasswordVault,
    ),
  };

  return stripSuppressedClientNames(merged, suppressed);
}

/** Keys that stay in the legacy clients workspace blob (org-level, not per-brand). */
export const CLIENTS_BLOB_ONLY_KEYS = [
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
    if (
      synced &&
      synced[key] !== undefined &&
      JSON.stringify(synced[key]) === JSON.stringify(incoming[key])
    ) {
      merged[key] = existing[key];
      continue;
    }
    merged[key] = incoming[key];
  }
  delete merged.names;
  return merged;
}
