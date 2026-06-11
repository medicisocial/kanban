import { SUPABASE_ENABLED } from './supabaseClient';
import { loadStaffSession } from '../utils/staffAuth';
import { clearSyncIssue } from './workspaceSyncHealth';

/**
 * After sign-in, local workspace data is not auto-uploaded — Supabase is the source of truth.
 * Kept for API compatibility; always skips when cloud sync is enabled.
 */
export async function bootstrapLocalWorkspaceToCloud() {
  if (!SUPABASE_ENABLED || !loadStaffSession()?.username) {
    return { seeded: [], skipped: true };
  }

  clearSyncIssue();
  return { seeded: [], skipped: true, cloudSourceOfTruth: true };
}
