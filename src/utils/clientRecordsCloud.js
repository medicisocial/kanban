import { SUPABASE_ENABLED, supabase } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { buildStaffApiAuthHeaders } from '../lib/staffApiAuth';
import { ensureStaffSupabaseSession, hasStaffSupabaseSession } from '../lib/staffSupabaseAuth';
import { slimClientsWorkspaceForCloudPush } from './clientsWorkspacePush';
import { fetchStaffSyncRows } from '../lib/staffSyncApi';

export {
  brandProfilePatchFromWorkspaceBrand,
  diffBrandProfilePatches,
  mergeClientRecordRowsIntoWorkspace,
} from './clientRecordsAssembly.js';

const CLIENT_RECORDS_SELECT =
  'id,org_id,brand_key,display_name,client_color,logo,contacts,social_logins,company_files,special_menus,photo_gallery_link,business_type,account_manager,updated_at';

/** Load normalized client profile rows — Supabase client first, staff-sync API fallback. */
export async function fetchClientRecordRows(orgId = getOrgId()) {
  if (!SUPABASE_ENABLED) return [];

  if (supabase && (await hasStaffSupabaseSession())) {
    const { data, error } = await supabase
      .from('client_records')
      .select(CLIENT_RECORDS_SELECT)
      .eq('org_id', orgId);
    if (!error && Array.isArray(data)) return data;
    if (error) {
      console.warn('[client_records] direct Supabase fetch failed:', error.message || error);
    }
  }

  const rows = await fetchStaffSyncRows('client_records', orgId);
  return Array.isArray(rows) ? rows : [];
}

async function patchBrandProfileRpc(orgId, brandKey, patch) {
  if (!supabase) return { ok: false, error: 'Supabase client unavailable.' };
  const { error } = await supabase.rpc('patch_brand_profile', {
    p_org_id: orgId,
    p_brand_key: brandKey,
    p_patch: patch,
  });
  if (error) {
    console.warn('[client-records] patch_brand_profile failed:', error.message || error);
    return { ok: false, error: error.message || 'Could not save to Supabase.' };
  }
  return { ok: true };
}

async function patchBrandProfileViaApi(orgId, brandKey, patch) {
  const headers = await buildStaffApiAuthHeaders();
  if (!headers) {
    return { ok: false, error: 'Staff sign-in required to save client profiles.' };
  }
  try {
    const response = await fetch('/api/brand-record', {
      method: 'POST',
      headers,
      body: JSON.stringify({ brand: brandKey, orgId, patch }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error: payload.error || `Could not save brand profile (${response.status}).`,
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'Could not reach the brand profile API.' };
  }
}

async function patchBrandProfileToSupabase(orgId, brandKey, patch) {
  let canWrite = await hasStaffSupabaseSession();
  if (!canWrite) {
    await ensureStaffSupabaseSession();
    canWrite = await hasStaffSupabaseSession();
  }

  if (canWrite) {
    const rpcResult = await patchBrandProfileRpc(orgId, brandKey, patch);
    if (rpcResult.ok) return rpcResult;
    // RPC denied (e.g. migration 028 not applied yet) — fall back to server API.
    const apiResult = await patchBrandProfileViaApi(orgId, brandKey, patch);
    if (apiResult.ok) return apiResult;
    return {
      ok: false,
      error: rpcResult.error || apiResult.error || 'Could not save client profile.',
    };
  }

  return patchBrandProfileViaApi(orgId, brandKey, patch);
}

/** Persist profile field patches to Supabase client_records (direct RPC when signed in). */
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
