/**
 * Merge clients workspace blobs so a stale staff-sync push cannot clobber
 * files a client just uploaded through the portal (companyFiles, specialMenus).
 */

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

/** Three-way-safe merge for the clients singleton workspace row. */
export function mergeClientsWorkspaceData(stored = {}, incoming = {}) {
  if (!incoming || typeof incoming !== 'object') return stored || {};
  if (!stored || typeof stored !== 'object') return { ...incoming };

  return {
    ...stored,
    ...incoming,
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
