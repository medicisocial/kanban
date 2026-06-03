import { SUPABASE_ENABLED } from './supabaseClient';

/** Empty initial state when cloud sync is active — never hydrate lists from cache. */
export function initialSyncCollectionState(loadLocal) {
  if (SUPABASE_ENABLED) return [];
  return loadLocal();
}

/** Empty initial state when cloud sync is active — never hydrate maps from cache. */
export function initialSyncMapState(loadLocal) {
  if (SUPABASE_ENABLED) return {};
  return loadLocal();
}
