export const FETCH_TIMEOUT_MS = 12000;

export function pendingRemovedKey(orgId, table) {
  return `medici-pending-removed:${orgId}:${table}`;
}

export function loadPendingRemoved(orgId, table) {
  try {
    const raw = sessionStorage.getItem(pendingRemovedKey(orgId, table));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function savePendingRemoved(orgId, table, ids) {
  const key = pendingRemovedKey(orgId, table);
  if (!ids.size) {
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, JSON.stringify([...ids]));
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
      merged[key] = remoteValue;
      continue;
    }

    const localStr = JSON.stringify(localValue);
    const remoteStr = JSON.stringify(remoteValue);
    if (localStr === remoteStr) {
      merged[key] = remoteValue;
      continue;
    }

    const syncedStr = synced.get(key);
    if (syncedStr === undefined || (syncedStr !== localStr && localStr !== remoteStr)) {
      merged[key] = localValue;
    } else {
      merged[key] = remoteValue;
    }
  }

  for (const [key, localValue] of Object.entries(local)) {
    if (pendingRemoved.has(key) || remoteKeys.has(key)) continue;
    merged[key] = localValue;
  }

  return merged;
}

export function mergeRemoteSingletonWithLocal({ remote, syncedStr, local }) {
  if (remote == null) return local;
  if (local == null) return remote;

  const localStr = JSON.stringify(local);
  const remoteStr = JSON.stringify(remote);
  if (localStr === remoteStr) return remote;
  if (syncedStr === undefined || (syncedStr !== localStr && localStr !== remoteStr)) {
    return local;
  }
  return remote;
}
