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

const CLIENT_RECORDS_SELECT =
  'id,org_id,brand_key,display_name,client_color,logo,contacts,social_logins,company_files,special_menus,photo_gallery_link,business_type,account_manager,updated_at';

async function fetchClientRecordRowsDirect(orgId) {
  if (!supabase) return [];
  // Do not require a user JWT — anon RLS allows legacy medici reads; authenticated
  // sessions still send their JWT automatically via the Supabase client.
  const { data, error } = await supabase
    .from('client_records')
    .select(CLIENT_RECORDS_SELECT)
    .eq('org_id', orgId);
  if (error) {
    console.warn('[client_records] direct Supabase fetch failed:', error.message || error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

function brandRowsFromDisplayNames(orgId, names = []) {
  return names
    .map((displayName) => {
      const name = String(displayName || '').trim();
      if (!name) return null;
      return {
        org_id: orgId,
        brand_key: name.toLowerCase(),
        display_name: name,
      };
    })
    .filter(Boolean);
}

/** Last-resort name list when client_records rows are temporarily unreachable. */
async function fetchBrandNameRowsFallback(orgId) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('brands')
    .select('brand_key, display_name')
    .eq('org_id', orgId);
  if (!error && Array.isArray(data) && data.length) {
    return data
      .filter((row) => row?.display_name && !String(row.brand_key || '').startsWith('__'))
      .map((row) => ({
        org_id: orgId,
        brand_key: row.brand_key,
        display_name: row.display_name,
      }));
  }

  try {
    const { data: rpcNames, error: rpcError } = await supabase.rpc('get_org_brand_names', {
      p_org_id: orgId,
    });
    if (!rpcError && Array.isArray(rpcNames) && rpcNames.length) {
      return brandRowsFromDisplayNames(orgId, rpcNames);
    }
  } catch {
    /* ignore */
  }

  return [];
}

const CLIENT_RECORDS_FETCH_ATTEMPTS = 4;
const CLIENT_RECORDS_RETRY_MS = 350;

/** Load normalized client profile rows — Supabase + staff-sync in parallel. */
export async function fetchClientRecordRows(orgId = getOrgId()) {
  if (!SUPABASE_ENABLED) return [];

  for (let attempt = 0; attempt < CLIENT_RECORDS_FETCH_ATTEMPTS; attempt += 1) {
    const [directRows, apiRows] = await Promise.all([
      fetchClientRecordRowsDirect(orgId),
      fetchStaffSyncRows('client_records', orgId),
    ]);

    if (directRows.length) return directRows;
    if (Array.isArray(apiRows) && apiRows.length) return apiRows;

    if (attempt < CLIENT_RECORDS_FETCH_ATTEMPTS - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, CLIENT_RECORDS_RETRY_MS * (attempt + 1));
      });
    }
  }

  return fetchBrandNameRowsFallback(orgId);
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
    try {
      const response = await fetch('/api/brand-record', {
        method: 'POST',
        headers,
        body: JSON.stringify({ brand: brandKey, orgId, patch }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return { ok: true };
      lastError =
        payload.error ||
        payload.detail ||
        `Could not save brand profile (${response.status}).`;
    } catch (err) {
      lastError = err?.message || 'Could not reach the brand profile API.';
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
