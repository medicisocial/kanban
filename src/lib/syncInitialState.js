import { SUPABASE_ENABLED } from './supabaseClient';

/** Hydrate from local cache on boot; cloud sync merges afterward when enabled. */
export function initialSyncCollectionState(loadLocal) {
  return loadLocal();
}

/** Hydrate from local cache on boot; cloud sync merges afterward when enabled. */
export function initialSyncMapState(loadLocal) {
  return loadLocal();
}

export function shouldPersistSyncedState(syncLoaded) {
  return !SUPABASE_ENABLED || syncLoaded;
}
