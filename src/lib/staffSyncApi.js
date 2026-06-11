import { supabase, SUPABASE_ENABLED } from './supabaseClient';
import { loadStaffSession } from '../utils/staffAuth';
import { getOrgId } from './orgSession';

function staffSessionHeaders() {
  const session = loadStaffSession();
  if (!session?.username || !session?.signature) return null;
  return {
    Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
    'Content-Type': 'application/json',
  };
}

async function supabaseSessionHeaders() {
  if (!SUPABASE_ENABLED || !supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return null;
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch {
    return null;
  }
}

async function buildAuthHeaders() {
  return staffSessionHeaders() || (await supabaseSessionHeaders());
}

/** Server-side Supabase writes when the browser cannot write directly with RLS. */
export async function pushStaffSync({ table, changed = [], removed = [], orgId = getOrgId() }) {
  if (!changed.length && !removed.length) return true;

  const headers = await buildAuthHeaders();
  if (!headers) return false;

  const response = await fetch('/api/staff-sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      table,
      orgId,
      upserts: changed.map((record) => ({ id: record.id, data: record })),
      deleteIds: removed,
    }),
  });

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

  const headers = await buildAuthHeaders();
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

/**
 * Load a workspace table through /api/staff-sync (service-role on the server).
 * Use when browser Supabase reads return empty — common on mobile with RLS.
 */
export async function fetchStaffSyncRows(table, orgId = getOrgId()) {
  if (!SUPABASE_ENABLED) return null;

  const headers = await buildAuthHeaders();
  if (!headers) return null;

  const params = new URLSearchParams({ table, orgId });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STAFF_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`/api/staff-sync?${params}`, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.rows) ? payload.rows : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
