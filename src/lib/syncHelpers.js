import {
  mergeBrandCompanyFiles,
  mergeBrandSpecialMenus,
  mergeBrandLogoMap,
  mergeBrandSocialLoginsMap,
  mergeBrandStringMap,
  mergeClientsWorkspaceContactsMap,
  mergeClientsWorkspaceFileMap,
  mergeClientsWorkspaceNames,
  mergeBrandScalarMap,
  mergeClientsWorkspaceData,
  mergePortalPasswordVault,
  mergeClientNameTombstones,
  suppressedClientNameKeys,
  stripSuppressedClientNames,
} from '../utils/clientsWorkspaceMerge.js';
export const FETCH_TIMEOUT_MS = 12000;

function normalizeBrandUsers(entry) {
  if (Array.isArray(entry)) {
    return entry.filter((user) => user && typeof user === 'object');
  }
  if (entry && typeof entry === 'object') {
    // Handle { users: [...] } format stored in client_portal_credentials table
    if (Array.isArray(entry.users)) {
      return entry.users.filter((user) => user && typeof user === 'object');
    }
    // Handle single user object
    if (entry.username || entry.passwordHash) {
      return [entry];
    }
  }
  return [];
}

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

export function hasConfiguredPortalUsers(entry) {
  return normalizeBrandUsers(entry).some((user) => user.username && user.passwordHash);
}

/** Never let stale local cache replace configured portal users with an empty list. */
function resolvePortalCredentialPasswordHash(previous, incomingUser, allowPasswordChange) {
  const previousHash = previous?.passwordHash?.trim().toLowerCase() || '';
  const incomingHash = incomingUser?.passwordHash?.trim().toLowerCase() || '';
  if (!incomingHash) return previousHash;
  if (!previousHash) return incomingHash;
  if (incomingHash === previousHash) return incomingHash;
  if (allowPasswordChange) return incomingHash;
  return previousHash;
}

function attachPortalPasswordChangeMarkers(users, previousUsers, allowPasswordChange) {
  if (!allowPasswordChange || !users.length) return users;
  const prevById = new Map(previousUsers.map((user) => [user.id, user]));
  const prevByUsername = new Map(
    previousUsers.map((user) => [user.username.trim().toLowerCase(), user]),
  );

  return users.map((user) => {
    const previous =
      prevById.get(user.id) || prevByUsername.get(user.username.trim().toLowerCase());
    const prevHash = previous?.passwordHash?.trim().toLowerCase() || '';
    const nextHash = user.passwordHash?.trim().toLowerCase() || '';
    if (nextHash && prevHash && nextHash !== prevHash) {
      return { ...user, _passwordChangeAuthorized: true };
    }
    return user;
  });
}

/** Client-side mirror of server mergePortalCredentialData for direct Supabase upserts. */
export function mergePortalCredentialDataForPush(
  existingData,
  incomingData,
  { allowPasswordChange = false, authoritativeUserList = false } = {},
) {
  const existing = normalizeBrandUsers(existingData);
  const incoming = normalizeBrandUsers(incomingData);
  if (!incoming.length) return existing;
  if (!existing.length) return incoming;

  const existingById = new Map(existing.map((user) => [user.id, user]));
  const existingByUsername = new Map(
    existing.map((user) => [user.username.trim().toLowerCase(), user]),
  );
  const merged = [];
  const seen = new Set();

  for (const incomingUser of incoming) {
    const previous =
      existingById.get(incomingUser.id) ||
      existingByUsername.get(incomingUser.username.trim().toLowerCase());
    const passwordHash = resolvePortalCredentialPasswordHash(
      previous,
      incomingUser,
      allowPasswordChange,
    );
    const username = incomingUser.username || previous?.username || '';
    if (!passwordHash || !username) continue;
    const id = incomingUser.id || previous?.id;
    seen.add(id);
    merged.push({
      ...previous,
      ...incomingUser,
      id,
      username,
      passwordHash,
      displayName: incomingUser.displayName || previous?.displayName || '',
      avatar: Object.prototype.hasOwnProperty.call(incomingUser, 'avatar')
        ? incomingUser.avatar
        : previous?.avatar,
    });
  }

  // Staff portal-access saves send the full intended roster — do not re-attach
  // users the editor removed (stale-sync protection only applies to background pushes).
  if (!authoritativeUserList) {
    for (const user of existing) {
      if (seen.has(user.id)) continue;
      if (user.username && user.passwordHash) merged.push(user);
    }
  }

  return attachPortalPasswordChangeMarkers(merged, existing, allowPasswordChange);
}

function resolveClientPortalPasswordHash(localUser, remoteUser, allowPasswordChange) {
  const localHash = localUser?.passwordHash?.trim().toLowerCase() || '';
  const remoteHash = remoteUser?.passwordHash?.trim().toLowerCase() || '';
  if (!localHash) return remoteHash;
  if (!remoteHash) return localHash;
  if (localHash === remoteHash) return localHash;
  if (allowPasswordChange) return localHash;
  return remoteHash;
}

export function mergePortalCredentialValue({ remote, local, syncedStr, allowPasswordChange = false }) {
  const remoteUsers = normalizeBrandUsers(remote);
  const localUsers = normalizeBrandUsers(local);

  if (!localUsers.length && remoteUsers.length) return remoteUsers;

  if (!remoteUsers.length && localUsers.length) {
    if (syncedStr) {
      try {
        const syncedUsers = normalizeBrandUsers(JSON.parse(syncedStr));
        if (syncedUsers.length) return syncedUsers;
      } catch {
        /* ignore */
      }
    }
    return hasConfiguredPortalUsers(localUsers) ? localUsers : remoteUsers;
  }

  const merged = [];
  const seen = new Set();

  for (const localUser of localUsers) {
    const remoteUser =
      remoteUsers.find((user) => user.id === localUser.id) ||
      remoteUsers.find(
        (user) => user.username.toLowerCase() === localUser.username.toLowerCase(),
      );

    const passwordHash = resolveClientPortalPasswordHash(
      localUser,
      remoteUser,
      allowPasswordChange,
    );
    const username = localUser.username || remoteUser?.username || '';
    if (!passwordHash || !username) {
      if (remoteUser?.passwordHash) {
        merged.push(remoteUser);
        seen.add(remoteUser.id);
      }
      continue;
    }

    const id = localUser.id || remoteUser?.id;
    seen.add(id);
    merged.push({
      ...remoteUser,
      ...localUser,
      id,
      username,
      passwordHash,
    });
  }

  for (const remoteUser of remoteUsers) {
    if (seen.has(remoteUser.id)) continue;
    if (remoteUser.username && remoteUser.passwordHash) merged.push(remoteUser);
  }

  if (merged.length) return merged;
  return remoteUsers.length ? remoteUsers : localUsers;
}

/** Block empty credential payloads from being pushed to the cloud. */
export function filterProtectedSyncUpserts(table, changed) {
  if (table !== 'client_portal_credentials') return changed;
  return changed.filter(({ id, data }) => {
    if (hasConfiguredPortalUsers(data)) return true;
    console.warn(`[supabase:${table}] blocked empty credential upsert for ${id}`);
    return false;
  });
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

export function credentialPasswordChangesKey(orgId) {
  return `medici-credential-password-changes:${orgId}`;
}

/** Brands whose credentials were just saved via /api/client-portal-set-password (skip stale re-push). */
export function credentialServerSavedKey(orgId) {
  return `medici-credential-server-saved:${orgId}`;
}

export function markCredentialServerSaved(orgId, brands = []) {
  if (!orgId || !brands.length) return;
  const pending = loadCredentialServerSaved(orgId);
  for (const brand of brands) pending.add(String(brand));
  writeStringSetStorage(credentialServerSavedKey(orgId), pending);
}

export function loadCredentialServerSaved(orgId) {
  return new Set(readStringSetStorage(credentialServerSavedKey(orgId)));
}

export function clearCredentialServerSaved(orgId, brands = []) {
  if (!orgId) return;
  const pending = loadCredentialServerSaved(orgId);
  if (!brands.length) {
    localStorage.removeItem(credentialServerSavedKey(orgId));
    return;
  }
  for (const brand of brands) pending.delete(String(brand));
  writeStringSetStorage(credentialServerSavedKey(orgId), pending);
}

export function loadCredentialPasswordChanges(orgId) {
  return new Set(readStringSetStorage(credentialPasswordChangesKey(orgId)));
}

export function markCredentialPasswordChanges(orgId, brands = []) {
  if (!orgId || !brands.length) return;
  const pending = loadCredentialPasswordChanges(orgId);
  for (const brand of brands) pending.add(String(brand));
  writeStringSetStorage(credentialPasswordChangesKey(orgId), pending);
}

export function clearCredentialPasswordChanges(orgId, brands = []) {
  if (!orgId) return;
  const pending = loadCredentialPasswordChanges(orgId);
  if (!brands.length) {
    writeStringSetStorage(credentialPasswordChangesKey(orgId), new Set());
    return;
  }
  for (const brand of brands) pending.delete(String(brand));
  writeStringSetStorage(credentialPasswordChangesKey(orgId), pending);
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

/** Track a client brand awaiting its first portal credential sync (also covers new clients). */
export function registerPortalCredentialBrand(orgId, brand) {
  if (!orgId || !brand) return;
  markPendingCreates(orgId, 'client_portal_credentials', [String(brand)]);
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
  protectCredentialEntries = false,
  orgId = '',
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
      if (pendingRemoved.has(key)) continue;
      if (protectCredentialEntries && hasConfiguredPortalUsers(remoteValue)) {
        merged[key] = remoteValue;
        continue;
      }
      if (synced.has(key)) continue;
      merged[key] = remoteValue;
      continue;
    }

    const localStr = JSON.stringify(localValue);
    const remoteStr = JSON.stringify(remoteValue);
    if (localStr === remoteStr) {
      merged[key] = remoteValue;
      continue;
    }

    merged[key] = protectCredentialEntries
      ? mergePortalCredentialValue({
          remote: remoteValue,
          local: localValue,
          syncedStr: synced.get(key),
          allowPasswordChange: orgId ? loadCredentialPasswordChanges(orgId).has(key) : false,
        })
      : mergeRemoteRecordWithLocal({
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

const CLIENTS_SCALAR_MAP_KEYS = new Set([
  'colors',
  'accountManagers',
  'businessTypes',
  'contentTypeColors',
  'customColorPalette',
]);

function mergeClientsWorkspaceField(key, remote, local, synced) {
  if (key === 'names') {
    return mergeClientsWorkspaceNames(remote?.names, local?.names, synced?.names);
  }
  if (CLIENTS_SCALAR_MAP_KEYS.has(key)) {
    return mergeBrandScalarMap(remote?.[key], local?.[key]);
  }
  if (key === 'companyFiles') {
    return mergeClientsWorkspaceFileMap(
      remote?.companyFiles,
      local?.companyFiles,
      synced?.companyFiles,
      mergeBrandCompanyFiles,
    );
  }
  if (key === 'specialMenus') {
    return mergeClientsWorkspaceFileMap(
      remote?.specialMenus,
      local?.specialMenus,
      synced?.specialMenus,
      mergeBrandSpecialMenus,
    );
  }
  if (key === 'portalPasswordVault') {
    return mergePortalPasswordVault(
      mergePortalPasswordVault(remote?.portalPasswordVault, local?.portalPasswordVault),
      synced?.portalPasswordVault,
    );
  }
  if (key === 'contacts') {
    return mergeClientsWorkspaceContactsMap(remote?.contacts, local?.contacts, synced?.contacts);
  }
  if (key === 'logos') {
    return mergeBrandLogoMap(
      mergeBrandLogoMap(remote?.logos, local?.logos),
      synced?.logos,
    );
  }
  if (key === 'socialLogins') {
    return mergeBrandSocialLoginsMap(
      mergeBrandSocialLoginsMap(remote?.socialLogins, local?.socialLogins),
      synced?.socialLogins,
    );
  }
  if (key === 'photoGalleryLinks') {
    return mergeBrandStringMap(
      mergeBrandStringMap(remote?.photoGalleryLinks, local?.photoGalleryLinks),
      synced?.photoGalleryLinks,
    );
  }
  return undefined;
}

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

  // First pull this session — union-merge so a client saved locally while cloud
  // was stale (e.g. right after add-client) is not dropped on refresh.
  if (syncedStr == null) {
    return mergeClientsWorkspaceData(remote, local);
  }

  const merged = { ...remote };
  for (const key of CLIENTS_WORKSPACE_KEYS) {
    if (local[key] === undefined) continue;

    const localStr = JSON.stringify(local[key]);
    const syncedKeyStr =
      synced && synced[key] !== undefined ? JSON.stringify(synced[key]) : undefined;

    if (syncedKeyStr === undefined) {
      if (CLIENTS_SCALAR_MAP_KEYS.has(key)) {
        merged[key] = mergeBrandScalarMap(remote[key], local[key]);
        continue;
      }
      // No sync baseline for this field. Remote is authoritative (cloud wins)
      // so stale localStorage on a new device does not overwrite fresh cloud data.
      // Local wins only if local was modified after the remote record's timestamp.
      const remoteTs = recordRevision(remote);
      const localTs = recordRevision(local);
      merged[key] = localTs > remoteTs ? local[key] : (remote[key] !== undefined ? remote[key] : local[key]);
      continue;
    }

    if (localStr !== syncedKeyStr) {
      const fileField = mergeClientsWorkspaceField(key, remote, local, synced);
      merged[key] = fileField !== undefined ? fileField : local[key];
      continue;
    }

    const remoteStr = JSON.stringify(remote[key]);
    if (remoteStr !== syncedKeyStr) {
      const fileField = mergeClientsWorkspaceField(key, remote, local, synced);
      merged[key] =
        fileField !== undefined
          ? fileField
          : CLIENTS_SCALAR_MAP_KEYS.has(key)
            ? mergeBrandScalarMap(remote[key], local[key])
            : remote[key] !== undefined
              ? remote[key]
              : local[key];
    } else {
      merged[key] = local[key];
    }
  }

  // Honor cross-device delete tombstones: a removal recorded on any device
  // suppresses the name everywhere until a newer re-add overrides it.
  const tombstones = mergeClientNameTombstones(remote, local);
  merged.removedNames = tombstones.removedNames;
  merged.restoredNames = tombstones.restoredNames;
  return stripSuppressedClientNames(merged, suppressedClientNameKeys(tombstones));
}
