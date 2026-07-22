import { SUPABASE_ENABLED } from './supabaseClient';
import { getOrgId } from './orgSession';
import { buildStaffApiAuthHeaders } from './staffApiAuth';
import { guardCardPushBatch } from './cardPushGuard';
import { broadcastCardPipelineRefresh } from './cardPipelineBroadcast';

/** Server-side Supabase writes when the browser cannot write directly with RLS. */
export async function pushStaffSync({
  table,
  changed = [],
  removed = [],
  orgId = getOrgId(),
  skipCardGuard = false,
}) {
  if (!changed.length && !removed.length) return true;

  const headers = await buildStaffApiAuthHeaders();
  if (!headers) return false;

  let safeChanged = changed;
  if (table === 'cards' && changed.length && !skipCardGuard) {
    safeChanged = await guardCardPushBatch(changed, orgId);
  }

  const response = await fetch('/api/staff-sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      table,
      orgId,
      upserts: safeChanged.map((record) => ({ id: record.id, data: record })),
      deleteIds: removed,
    }),
  });

  if (response.ok && table === 'cards' && safeChanged.length) {
    broadcastCardPipelineRefresh(safeChanged.map((record) => record.id));
  }

  return response.ok;
}

/** Persist one or more records immediately (e.g. after rescheduling on the calendar). */
export async function pushStaffSyncRecords(table, records) {
  if (!records?.length) return true;
  return pushStaffSync({ table, changed: records, removed: [] });
}

/** Persist rows with explicit { id, data } shape (singleton blobs, map entries). */
export async function pushStaffSyncRows(
  table,
  rows = [],
  removed = [],
  orgId = getOrgId(),
  options = {},
) {
  if (!rows.length && !removed.length) return true;

  const headers = await buildStaffApiAuthHeaders();
  if (!headers) return false;

  const response = await fetch('/api/staff-sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      table,
      orgId,
      upserts: rows,
      deleteIds: removed,
      authDeleteConfirmed: Boolean(options.authDeleteConfirmed),
      credentialPasswordChanges: options.credentialPasswordChanges || [],
    }),
  });

  return response.ok;
}

export async function pushStaffSyncSingleton(table, recordId, data) {
  if (!recordId) return true;
  return pushStaffSyncRows(table, [{ id: recordId, data }]);
}

const STAFF_FETCH_TIMEOUT_MS = 5000;
const AUTH_HEADER_TIMEOUT_MS = 2000;

async function staffSyncAuthHeaders() {
  return Promise.race([
    buildStaffApiAuthHeaders(),
    new Promise((resolve) => {
      setTimeout(() => resolve(null), AUTH_HEADER_TIMEOUT_MS);
    }),
  ]);
}

/**
 * Load a workspace table through /api/staff-sync (service-role on the server).
 * Use when browser Supabase reads return empty — common on mobile with RLS.
 *
 * Returns:
 * - array (possibly empty) when the API answered (including 403 → [])
 * - null only when auth/headers/network prevented a staff-sync response
 *
 * Callers must treat [] as authoritative scoped data and must NOT fall through
 * to org-wide REST/anon when a non-null array is returned.
 */
export async function fetchStaffSyncRows(table, orgId = getOrgId()) {
  if (!SUPABASE_ENABLED) return null;

  const headers = await staffSyncAuthHeaders();
  if (!headers) return null;

  const params = new URLSearchParams({ table, orgId });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STAFF_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`/api/staff-sync?${params}`, {
      headers,
      signal: controller.signal,
    });
    // 403 = server denied this table for this staff scope. Return [] so callers
    // do not fall open to unscoped REST/anon (security).
    if (response.status === 403) return [];
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.rows) ? payload.rows : [];
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
