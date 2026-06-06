/**
 * Merge clients workspace blobs so a stale staff-sync push cannot clobber
 * files a client just uploaded through the portal (companyFiles, specialMenus)
 * or profile fields (contacts, logos, social logins).
 */

const SOCIAL_PLATFORMS = ['instagram', 'tiktok', 'facebook'];

function emptySocialLogins() {
  return {
    instagram: { username: '', password: '' },
    tiktok: { username: '', password: '' },
    facebook: { username: '', password: '' },
  };
}

function normalizeSocialLogins(logins) {
  const base = emptySocialLogins();
  if (!logins || typeof logins !== 'object') return base;
  for (const platform of SOCIAL_PLATFORMS) {
    const entry = logins[platform] || {};
    base[platform] = {
      username: entry.username?.trim() || '',
      password: typeof entry.password === 'string' ? entry.password : '',
    };
  }
  return base;
}

function mergeSocialLogins(existing, incoming) {
  const prev = normalizeSocialLogins(existing);
  const next = normalizeSocialLogins(incoming);
  for (const platform of SOCIAL_PLATFORMS) {
    const draftPassword = incoming?.[platform]?.password;
    if (draftPassword === undefined || draftPassword === null) {
      next[platform].password = prev[platform].password;
      continue;
    }
    if (draftPassword === '' && prev[platform].password) {
      next[platform].password = prev[platform].password;
    }
  }
  return next;
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
  const normalized = normalizeSocialLogins(logins);
  return SOCIAL_PLATFORMS.some(
    (platform) => normalized[platform].username || normalized[platform].password,
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
    base[brand] = logo;
  }

  return base;
}

export function mergeBrandSocialLogins(stored, incoming) {
  if (!socialLoginsHasContent(incoming) && socialLoginsHasContent(stored)) {
    return normalizeSocialLogins(stored);
  }
  return mergeSocialLogins(stored, incoming);
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
 * Per-brand three-way merge for staff realtime sync.
 * Respects admin deletes while keeping client uploads that landed after the last sync baseline.
 */
export function mergeClientsWorkspaceBrandFiles(
  remote = [],
  local = [],
  synced = [],
  mergeList = mergeBrandCompanyFiles,
) {
  const localList = Array.isArray(local) ? local : [];
  const remoteList = Array.isArray(remote) ? remote : [];
  const syncedList = Array.isArray(synced) ? synced : [];
  const localChanged = JSON.stringify(localList) !== JSON.stringify(syncedList);

  if (!localChanged) {
    return mergeList(syncedList, remoteList);
  }

  const byId = new Map();
  for (const entry of localList) {
    if (entry?.id) byId.set(String(entry.id), entry);
  }

  const syncedById = new Map(
    syncedList.filter((entry) => entry?.id).map((entry) => [String(entry.id), entry]),
  );

  for (const entry of remoteList) {
    if (!entry?.id) continue;
    const id = String(entry.id);
    if (byId.has(id)) continue;
    if (!syncedById.has(id)) {
      byId.set(id, entry);
      continue;
    }
    const syncedEntry = syncedById.get(id);
    if (recordUpdatedAt(entry) > recordUpdatedAt(syncedEntry)) {
      byId.set(id, entry);
    }
  }

  return [...byId.values()].sort((a, b) => recordUpdatedAt(b) - recordUpdatedAt(a));
}

export function mergeClientsWorkspaceFileMap(
  remoteMap = {},
  localMap = {},
  syncedMap = {},
  mergeList = mergeBrandCompanyFiles,
) {
  const brands = new Set([
    ...Object.keys(remoteMap || {}),
    ...Object.keys(localMap || {}),
    ...Object.keys(syncedMap || {}),
  ]);
  const merged = {};

  for (const brand of brands) {
    merged[brand] = mergeClientsWorkspaceBrandFiles(
      remoteMap?.[brand],
      localMap?.[brand],
      syncedMap?.[brand],
      mergeList,
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

  return {
    ...stored,
    ...incoming,
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
}
