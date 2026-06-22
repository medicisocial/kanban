import { SUPABASE_ENABLED, supabase } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { buildStaffApiAuthHeaders } from '../lib/staffApiAuth';
import { ensureStaffSupabaseSession } from '../lib/staffSupabaseAuth';
import { slimClientsWorkspaceForCloudPush } from './clientsWorkspacePush';
import { fetchStaffSyncRows } from '../lib/staffSyncApi';

export {
  brandProfilePatchFromWorkspaceBrand,
  diffBrandProfilePatches,
  mergeClientRecordRowsIntoWorkspace,
} from './clientRecordsAssembly.js';

/** Slim select for fast filter/sidebar — skips heavy jsonb profile fields. */
export const CLIENT_RECORDS_LIST_SELECT =
  'org_id,brand_key,display_name,client_color,updated_at';

const CLIENT_RECORDS_FULL_SELECT =
  'id,org_id,brand_key,display_name,client_color,logo,contacts,social_logins,company_files,special_menus,photo_gallery_link,business_type,account_manager,deleted_company_file_ids,updated_at';

const DIRECT_READ_TIMEOUT_MS = 3000;
const DIRECT_PROFILE_SAVE_TIMEOUT_MS = 8000;
const API_PROFILE_SAVE_TIMEOUT_MS = 12000;

function withTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    }),
  ]);
}

async function fetchClientRecordRowsDirect(orgId, select) {
  if (!supabase) return [];
  const { data, error } = await supabase.from('client_records').select(select).eq('org_id', orgId);
  if (error) {
    console.warn('[client_records] Supabase read failed:', error.message || error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

async function readClientRecords(orgId, select) {
  const directRows = await Promise.race([
    fetchClientRecordRowsDirect(orgId, select),
    new Promise((resolve) => {
      setTimeout(() => resolve([]), DIRECT_READ_TIMEOUT_MS);
    }),
  ]);
  if (directRows.length) return directRows;

  const apiRows = await fetchStaffSyncRows('client_records', orgId);
  return Array.isArray(apiRows) ? apiRows : [];
}

/** Fast list load — direct Supabase first, staff-sync fallback only if empty. */
export async function fetchClientRecordListRows(orgId = getOrgId()) {
  if (!SUPABASE_ENABLED) return [];
  return readClientRecords(orgId, CLIENT_RECORDS_LIST_SELECT);
}

/** Full profile load — for client detail after list is visible. */
export async function fetchClientRecordFullRows(orgId = getOrgId()) {
  if (!SUPABASE_ENABLED) return [];
  return readClientRecords(orgId, CLIENT_RECORDS_FULL_SELECT);
}

/** @deprecated Use fetchClientRecordListRows — kept for tests and API parity. */
export async function fetchClientRecordRows(orgId = getOrgId()) {
  return fetchClientRecordFullRows(orgId);
}

async function patchBrandProfileRpc(orgId, brandKey, patch) {
  if (!supabase) return { ok: false, error: 'Supabase client unavailable.' };
  let error = null;
  try {
    const result = await withTimeout(
      supabase.rpc('patch_brand_profile', {
        p_org_id: orgId,
        p_brand_key: brandKey,
        p_patch: patch,
      }),
      DIRECT_PROFILE_SAVE_TIMEOUT_MS,
      'Direct Supabase profile save timed out.',
    );
    error = result?.error;
  } catch (err) {
    console.warn('[client-records] patch_brand_profile timed out:', err.message || err);
    return { ok: false, error: err.message || 'Direct Supabase profile save timed out.' };
  }
  if (error) {
    console.warn('[client-records] patch_brand_profile failed:', error.message || error);
    return { ok: false, error: error.message || 'Could not save to Supabase.' };
  }
  return { ok: true };
}

async function patchBrandProfileViaApi(orgId, brandKey, patch) {
  const legacyHeaders = await buildStaffApiAuthHeaders({ preferSupabaseJwt: false });
  const jwtHeaders = legacyHeaders
    ? await buildStaffApiAuthHeaders({ preferSupabaseJwt: true })
    : null;
  const headerSets = [legacyHeaders, jwtHeaders].filter(Boolean);
  const seen = new Set();
  const uniqueHeaders = headerSets.filter((headers) => {
    const token = headers.Authorization || '';
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });

  if (!uniqueHeaders.length) {
    return { ok: false, error: 'Staff sign-in required to save client profiles.' };
  }

  let lastError = '';

  for (const headers of uniqueHeaders) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_PROFILE_SAVE_TIMEOUT_MS);
    try {
      const response = await fetch('/api/brand-record', {
        method: 'POST',
        headers,
        body: JSON.stringify({ brand: brandKey, orgId, patch }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return { ok: true };
      lastError =
        payload.error ||
        payload.detail ||
        `Could not save brand profile (${response.status}).`;
    } catch (err) {
      lastError =
        err?.name === 'AbortError'
          ? 'Brand profile API timed out.'
          : err?.message || 'Could not reach the brand profile API.';
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { ok: false, error: lastError || 'Could not save client profile.' };
}

async function patchBrandProfileToSupabase(orgId, brandKey, patch) {
  await ensureStaffSupabaseSession();

  const rpcResult = await patchBrandProfileRpc(orgId, brandKey, patch);
  if (rpcResult.ok) return rpcResult;

  const apiResult = await patchBrandProfileViaApi(orgId, brandKey, patch);
  if (apiResult.ok) return apiResult;

  return {
    ok: false,
    error:
      rpcResult.error ||
      apiResult.error ||
      'Could not save client profile. Sign out and sign in again, then retry.',
  };
}

/** Persist profile field patches to Supabase client_records. */
export async function pushBrandProfilePatches(orgId, patches = []) {
  if (!SUPABASE_ENABLED || !patches.length) return { ok: true };

  let lastError = '';

  for (const { brandKey, patch } of patches) {
    const result = await patchBrandProfileToSupabase(orgId, brandKey, patch);
    if (!result.ok) {
      lastError = result.error || lastError;
    }
  }

  if (lastError) {
    return { ok: false, error: lastError };
  }

  return { ok: true };
}

export { slimClientsWorkspaceForCloudPush };
