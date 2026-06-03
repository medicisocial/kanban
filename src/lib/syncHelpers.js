export const FETCH_TIMEOUT_MS = 12000;

/** Tables where accidental bulk deletes would break logins. */
export const AUTH_CRITICAL_SYNC_TABLES = new Set([
  'client_portal_credentials',
  'team_members',
]);

export function localCollectionHasRecords(local) {
  if (Array.isArray(local)) return local.length > 0;
  if (local && typeof local === 'object') return Object.keys(local).length > 0;
  return Boolean(local);
}

/** Only push deletes that were explicitly requested (tombstoned) for auth tables. */
export function filterProtectedSyncRemovals(table, removed, pendingRemoved) {
  if (!AUTH_CRITICAL_SYNC_TABLES.has(table)) return removed;
  return removed.filter((id) => pendingRemoved.has(String(id)));
}

/** Drop rows tombstoned locally so deleted records do not hydrate from cache. */
export function excludePendingRemovedFromCollection(items, getId, orgId, table) {
  if (!Array.isArray(items) || !items.length) return items || [];
  const pending = loadPendingRemoved(orgId, table);
  if (!pending.size) return items;
  return items.filter((item) => !pending.has(String(getId(item))));
}

/** Drop map keys tombstoned locally so deleted records do not hydrate from cache. */
export function excludePendingRemovedFromMap(map, orgId, table) {
  const source = map && typeof map === 'object' ? map : {};
  const pending = loadPendingRemoved(orgId, table);
  if (!pending.size) return source;
  const filtered = {};
  for (const [key, value] of Object.entries(source)) {
    if (!pending.has(String(key))) filtered[key] = value;
  }
  return filtered;
}

export function readSyncedLocalCollection(loadLocal, getId, orgId, table) {
  if (!loadLocal) return [];
  const raw = loadLocal();
  if (!orgId || !table || !getId || !Array.isArray(raw)) return Array.isArray(raw) ? raw : [];
  return excludePendingRemovedFromCollection(raw, getId, orgId, table);
}

export function readSyncedLocalMap(loadLocal, orgId, table) {
  if (!loadLocal) return {};
  const raw = loadLocal() || {};
  if (!orgId || !table) return raw;
  return excludePendingRemovedFromMap(raw, orgId, table);
}

export function pendingRemovedKey(orgId, table) {
  return `medici-pending-removed:${orgId}:${table}`;
}

export function pendingCreatesKey(orgId, table) {
  return `medici-pending-creates:${orgId}:${table}`;
}

function readStringSetStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeStringSetStorage(key, ids) {
  if (!ids.size) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify([...ids]));
}

export function loadPendingRemoved(orgId, table) {
  const key = pendingRemovedKey(orgId, table);
  return new Set(readStringSetStorage(key));
}

export function savePendingRemoved(orgId, table, ids) {
  writeStringSetStorage(pendingRemovedKey(orgId, table), ids);
}

/** Records created locally that have not finished uploading yet. */
export function loadPendingCreates(orgId, table) {
  return new Set(readStringSetStorage(pendingCreatesKey(orgId, table)));
}

export function savePendingCreates(orgId, table, ids) {
  writeStringSetStorage(pendingCreatesKey(orgId, table), ids);
}

export function markPendingCreates(orgId, table, ids) {
  if (!orgId || !table || !ids?.length) return new Set();
  const pending = loadPendingCreates(orgId, table);
  for (const id of ids) pending.add(String(id));
  savePendingCreates(orgId, table, pending);
  return pending;
}

export function unmarkPendingCreates(orgId, table, ids) {
  if (!orgId || !table || !ids?.length) return;
  const pending = loadPendingCreates(orgId, table);
  for (const id of ids) pending.delete(String(id));
  savePendingCreates(orgId, table, pending);
}

/** Tombstone deletes immediately so cloud pulls cannot resurrect them before push runs. */
export function markPendingRemoved(orgId, table, ids) {
  if (!orgId || !table || !ids?.length) return new Set();
  const pending = loadPendingRemoved(orgId, table);
  for (const id of ids) pending.add(String(id));
  savePendingRemoved(orgId, table, pending);
  return pending;
}

/** Pull unsynced local creates from cache when initial React state starts empty. */
export function augmentLocalWithPendingCreates(localItems, loadLocal, getId, pendingLocalCreates) {
  if (!loadLocal || !pendingLocalCreates?.size) return localItems;
  const localById = new Map(localItems.map((record) => [String(getId(record)), record]));
  const cache = loadLocal();
  if (!Array.isArray(cache)) return localItems;

  const augmented = [...localItems];
  for (const record of cache) {
    const id = String(getId(record));
    if (!pendingLocalCreates.has(id) || localById.has(id)) continue;
    augmented.push(record);
  }
  return augmented;
}

/** Pull unsynced local map entries from cache when initial React state starts empty. */
export function augmentLocalMapWithPendingCreates(localMap, loadLocal, pendingLocalCreates) {
  if (!loadLocal || !pendingLocalCreates?.size) return localMap || {};
  const cache = loadLocal() || {};
  const merged = { ...(localMap || {}) };
  for (const key of pendingLocalCreates) {
    if (merged[key] !== undefined || cache[key] === undefined) continue;
    merged[key] = cache[key];
  }
  return merged;
}

export async function fetchRowsWithTimeout(store) {
  return Promise.race([
    store.fetchAll(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Supabase fetch timed out')), FETCH_TIMEOUT_MS);
    }),
  ]);
}

export function recordsMatchSnapshot(items, snapshot, getId) {
  const next = new Map(items.map((record) => [String(getId(record)), JSON.stringify(record)]));
  if (snapshot.size !== next.size) return false;
  for (const [id, value] of next.entries()) {
    if (snapshot.get(id) !== value) return false;
  }
  return true;
}

export function mapMatchesSnapshot(map, snapshot) {
  const entries = Object.entries(map || {});
  const next = new Map(entries.map(([key, value]) => [key, JSON.stringify(value)]));
  if (snapshot.size !== next.size) return false;
  for (const [key, value] of next.entries()) {
    if (snapshot.get(key) !== value) return false;
  }
  return true;
}

export function singletonMatchesSnapshot(value, syncedStr) {
  return syncedStr === JSON.stringify(value);
}

function recordRevision(record) {
  if (!record || typeof record !== 'object') return 0;
  return record.updatedAt || record.createdAt || 0;
}

/** Three-way merge for a single record — unsynced local edits always win. */
export function mergeRemoteRecordWithLocal({ remote, local, syncedStr }) {
  if (local == null) return remote;
  if (remote == null) return local;

  const localStr = JSON.stringify(local);
  const remoteStr = JSON.stringify(remote);
  if (localStr === remoteStr) return remote;

  if (syncedStr === undefined) {
    // No sync baseline for this session (e.g. first load on a new device).
    // We cannot tell if local is a genuine unsynced edit or stale cache from a
    // previous login. Use timestamps to decide: prefer whichever was updated
    // more recently; cloud wins on a tie so a fresh device always shows current data.
    const remoteTs = recordRevision(remote);
    const localTs = recordRevision(local);
    return localTs > remoteTs ? local : remote;
  }

  // Local edits not yet reflected in our sync snapshot always win.
  if (localStr !== syncedStr) return local;

  // Local matches the last sync snapshot. Only accept remote if it is clearly newer.
  if (remoteStr !== syncedStr) {
    let syncedRecord = null;
    try {
      syncedRecord = JSON.parse(syncedStr);
    } catch {
      syncedRecord = null;
    }

    const remoteTs = recordRevision(remote);
    const localTs = recordRevision(local);
    const syncedTs = recordRevision(syncedRecord);
    if (remoteTs > syncedTs && remoteTs > localTs) return remote;
    return local;
  }

  return local;
}

/** Keep unsynced local edits when a realtime pull returns stale cloud data. */
export function mergeRemoteListWithLocalPending({
  remoteItems,
  getId,
  syncedSnapshot,
  localItems,
  pendingRemoved,
  pendingLocalCreates,
}) {
  const synced = syncedSnapshot || new Map();
  const pendingCreates = pendingLocalCreates || new Set();
  const localById = new Map(localItems.map((record) => [String(getId(record)), record]));
  const remoteIds = new Set();

  const merged = remoteItems
    .map((remote) => {
      const id = String(getId(remote));
      remoteIds.add(id);
      if (pendingRemoved.has(id)) return null;

      const local = localById.get(id);
      if (!local) {
        // Was synced locally before but removed — don't resurrect from stale cloud pulls.
        if (synced.has(id)) return null;
        return remote;
      }

      return mergeRemoteRecordWithLocal({
        remote,
        local,
        syncedStr: synced.get(id),
      });
    })
    .filter(Boolean);

  for (const local of localItems) {
    const id = String(getId(local));
    if (pendingRemoved.has(id) || remoteIds.has(id)) continue;
    // Was synced before but gone from cloud — drop stale localStorage copy.
    if (synced.has(id)) continue;
    // Only keep local-only rows that were explicitly created this session and not yet uploaded.
    if (!pendingCreates.has(id)) continue;
    merged.push(local);
  }

  return merged;
}

/** Keep unsynced local map edits when a realtime pull returns stale cloud data. */
export function mergeRemoteMapWithLocalPending({
  remoteMap,
  syncedSnapshot,
  localMap,
  pendingRemoved,
  pendingLocalCreates,
}) {
  const synced = syncedSnapshot || new Map();
  const pendingCreates = pendingLocalCreates || new Set();
  const local = localMap || {};
  const remote = remoteMap || {};
  const remoteKeys = new Set(Object.keys(remote));
  const merged = {};

  for (const [key, remoteValue] of Object.entries(remote)) {
    if (pendingRemoved.has(key)) continue;

    const localValue = local[key];
    if (localValue === undefined) {
      if (pendingRemoved.has(key) || synced.has(key)) continue;
      merged[key] = remoteValue;
      continue;
    }

    const localStr = JSON.stringify(localValue);
    const remoteStr = JSON.stringify(remoteValue);
    if (localStr === remoteStr) {
      merged[key] = remoteValue;
      continue;
    }

    merged[key] = mergeRemoteRecordWithLocal({
      remote: remoteValue,
      local: localValue,
      syncedStr: synced.get(key),
    });
  }

  for (const [key, localValue] of Object.entries(local)) {
    if (pendingRemoved.has(key) || remoteKeys.has(key)) continue;
    if (synced.has(key)) continue;
    if (!pendingCreates.has(key)) continue;
    merged[key] = localValue;
  }

  return merged;
}

export function mergeRemoteSingletonWithLocal({ remote, syncedStr, local }) {
  return mergeRemoteRecordWithLocal({ remote, local, syncedStr });
}

const CLIENTS_WORKSPACE_KEYS = [
  'names',
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
  'contentTypeColors',
  'customColorPalette',
];

/** Field-level three-way merge for the clients workspace blob (contacts, logos, etc.). */
export function mergeClientsWorkspaceState({ remote, local, syncedStr }) {
  if (local == null) return remote;
  if (remote == null) return local;

  let synced = null;
  if (syncedStr != null) {
    try {
      synced = JSON.parse(syncedStr);
    } catch {
      synced = null;
    }
  }

  const merged = { ...remote };
  for (const key of CLIENTS_WORKSPACE_KEYS) {
    if (local[key] === undefined) continue;

    const localStr = JSON.stringify(local[key]);
    const syncedKeyStr =
      synced && synced[key] !== undefined ? JSON.stringify(synced[key]) : undefined;

    if (syncedKeyStr === undefined) {
      // No sync baseline for this field. Remote is authoritative (cloud wins)
      // so stale localStorage on a new device does not overwrite fresh cloud data.
      // Local wins only if local was modified after the remote record's timestamp.
      const remoteTs = recordRevision(remote);
      const localTs = recordRevision(local);
      merged[key] = localTs > remoteTs ? local[key] : (remote[key] !== undefined ? remote[key] : local[key]);
      continue;
    }

    if (localStr !== syncedKeyStr) {
      merged[key] = local[key];
      continue;
    }

    const remoteStr = JSON.stringify(remote[key]);
    if (remoteStr !== syncedKeyStr) {
      merged[key] = remote[key] !== undefined ? remote[key] : local[key];
    } else {
      merged[key] = local[key];
    }
  }

  return merged;
}
