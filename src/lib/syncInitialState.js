import { SUPABASE_ENABLED } from './supabaseClient';
import { markPendingRemoved, readSyncedLocalCollection, readSyncedLocalMap } from './syncHelpers';
import { getOrgId } from './orgSession';

/** Tombstone deletes before local state changes so sync cannot resurrect removed rows. */
export function tombstoneSyncedDeletes(table, ids) {
  if (!table || !ids?.length) return;
  markPendingRemoved(getOrgId(), table, ids.map(String));
}

/** Hydrate from local cache on boot; cloud sync merges afterward when enabled. */
export function initialSyncCollectionState(loadLocal, { table, getId } = {}) {
  if (!loadLocal) return [];
  if (!table || !getId) return loadLocal();
  return readSyncedLocalCollection(loadLocal, getId, getOrgId(), table);
}

/** Hydrate from local cache on boot; cloud sync merges afterward when enabled. */
export function initialSyncMapState(loadLocal, { table } = {}) {
  if (!loadLocal) return {};
  if (!table) return loadLocal();
  return readSyncedLocalMap(loadLocal, getOrgId(), table);
}

export function shouldPersistSyncedState(syncLoaded) {
  return !SUPABASE_ENABLED || syncLoaded;
}
