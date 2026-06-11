import { isCloudSourceOfTruth } from '../lib/cloudSourceOfTruth';
import { orgScopedKey } from '../lib/orgStorage';

/** Portal response queues are offline/share-link only; cloud writes go direct to Supabase. */
export function shouldUsePortalResponseQueue() {
  return !isCloudSourceOfTruth();
}

export function queueStorageKey(baseKey) {
  return orgScopedKey(baseKey);
}
