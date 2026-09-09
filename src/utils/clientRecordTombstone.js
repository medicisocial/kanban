import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { buildStaffApiAuthHeaders } from '../lib/staffApiAuth';
import { clientBrandNameKey } from './clients.js';

const TOMBSTONE_TIMEOUT_MS = 12000;

async function postTombstoneAction(orgId, brandKey, action) {
  if (!SUPABASE_ENABLED || !orgId || !brandKey) {
    return { ok: true };
  }

  const headers = await buildStaffApiAuthHeaders({ preferSupabaseJwt: false });
  if (!headers) {
    return { ok: false, error: 'Sign in to update client records.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TOMBSTONE_TIMEOUT_MS);
  try {
    const response = await fetch('/api/client-record-tombstone', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action,
        brandKey,
        orgId,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error: payload.error || `Could not ${action} client record (${response.status}).`,
      };
    }
    return { ok: true, ...payload };
  } catch (err) {
    return {
      ok: false,
      error:
        err?.name === 'AbortError'
          ? 'Client record tombstone timed out.'
          : err?.message || 'Could not reach client record tombstone API.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Soft-delete a client_records row so sync cannot rehydrate the brand. */
export async function tombstoneClientRecord(name, orgId = getOrgId()) {
  const brandKey = clientBrandNameKey(name);
  return postTombstoneAction(orgId, brandKey, 'tombstone');
}

/** Clear deleted_at when re-adding a previously removed brand. */
export async function restoreClientRecord(name, orgId = getOrgId()) {
  const brandKey = clientBrandNameKey(name);
  return postTombstoneAction(orgId, brandKey, 'restore');
}
