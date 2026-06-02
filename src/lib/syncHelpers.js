export const FETCH_TIMEOUT_MS = 12000;

export function pendingRemovedKey(orgId, table) {
  return `medici-pending-removed:${orgId}:${table}`;
}

function readPendingRemovedStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function loadPendingRemoved(orgId, table) {
  const key = pendingRemovedKey(orgId, table);
  return new Set(readPendingRemovedStorage(key));
}

export function savePendingRemoved(orgId, table, ids) {
  const key = pendingRemovedKey(orgId, table);
  if (!ids.size) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify([...ids]));
}

/** Tombstone deletes immediately so cloud pulls cannot resurrect them before push runs. */
export function markPendingRemoved(orgId, table, ids) {
  if (!orgId || !table || !ids?.length) return new Set();
  const pending = loadPendingRemoved(orgId, table);
  for (const id of ids) pending.add(String(id));
  savePendingRemoved(orgId, table, pending);
  return pending;
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
}) {
  const synced = syncedSnapshot || new Map();
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
}) {
  const synced = syncedSnapshot || new Map();
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
