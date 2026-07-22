/**
 * Realtime postgres_changes payloads are org-wide. Restricted (personal) staff
 * sessions must not apply them inline — that would bypass the staff-sync
 * allowlist. Instead refetch through staff-sync (or drop when an allowlist is
 * available client-side).
 */
import { mustUseStaffSyncOnly } from './staffSyncReadPolicy.js';
import { clientInAllowlist } from '../utils/staffClientAllowlist.js';

/**
 * @returns {'apply' | 'refetch' | 'drop'}
 */
export function decideRealtimePayloadAction({
  restricted = mustUseStaffSyncOnly(),
  rowClient = '',
  allowedClients = null,
} = {}) {
  if (!restricted) return 'apply';
  // Prefer staff-sync refetch when we don't have a client allowlist in memory
  // (personal AMs often lack finances data). Refetch is server-filtered.
  if (!Array.isArray(allowedClients)) return 'refetch';
  if (!rowClient) return 'refetch';
  if (!clientInAllowlist(rowClient, allowedClients)) return 'drop';
  return 'apply';
}

export function shouldApplyRealtimePayloadInline(restricted = mustUseStaffSyncOnly()) {
  return decideRealtimePayloadAction({ restricted, allowedClients: null }) === 'apply';
}
