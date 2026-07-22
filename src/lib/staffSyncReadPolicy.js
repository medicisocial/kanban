/**
 * When a personal (non-ops) staff session is active, all workspace reads must
 * go through /api/staff-sync so server-side AM allowlists cannot be bypassed
 * by direct Supabase / anon REST.
 */
import {
  isSharedOperationsLogin,
  loadStaffSession,
  usesPersonalWorkspaceView,
} from '../utils/staffAuth.js';

export function mustUseStaffSyncOnly(session = loadStaffSession()) {
  if (!session) return false;
  if (isSharedOperationsLogin(session)) return false;
  return usesPersonalWorkspaceView(session);
}

/**
 * Personal sessions must never use direct Supabase upserts even if a leftover
 * ops JWT is present in the browser — those writes bypass staff-sync gates.
 */
export function mustRouteWritesThroughStaffSync(session = loadStaffSession()) {
  return mustUseStaffSyncOnly(session);
}
