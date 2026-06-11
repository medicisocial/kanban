import { isCloudSourceOfTruth } from './cloudSourceOfTruth.js';
import { markPendingRemoved, readSyncedLocalCollection, readSyncedLocalMap } from './syncHelpers';
import { getOrgId } from './orgSession';

/** Tombstone deletes before local state changes so sync cannot resurrect removed rows. */
export function tombstoneSyncedDeletes(table, ids) {
  if (!table || !ids?.length) return;
  markPendingRemoved(getOrgId(), table, ids.map(String));
}

/** Boot state: empty when cloud is source of truth; localStorage only for offline mode. */
export function initialSyncCollectionState(loadLocal, { table, getId } = {}) {
  if (isCloudSourceOfTruth()) return [];
  if (!loadLocal) return [];
  if (!table || !getId) return loadLocal();
  return readSyncedLocalCollection(loadLocal, getId, getOrgId(), table);
}

/** Boot state: empty when cloud is source of truth; localStorage only for offline mode. */
export function initialSyncMapState(loadLocal, { table } = {}) {
  if (isCloudSourceOfTruth()) return {};
  if (!loadLocal) return {};
  if (!table) return loadLocal();
  return readSyncedLocalMap(loadLocal, getOrgId(), table);
}

/** Cloud mode: never mirror synced tables into localStorage. */
export function shouldPersistSyncedState(syncLoaded) {
  if (isCloudSourceOfTruth()) return false;
  return syncLoaded;
}
