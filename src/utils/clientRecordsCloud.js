import { SUPABASE_ENABLED, supabase } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { buildStaffApiAuthHeaders } from '../lib/staffApiAuth';
import { ensureStaffSupabaseSession, hasStaffSupabaseSession } from '../lib/staffSupabaseAuth';
import { slimClientsWorkspaceForCloudPush } from './clientsWorkspacePush';

export {
  brandProfilePatchFromWorkspaceBrand,
  diffBrandProfilePatches,
  mergeClientRecordRowsIntoWorkspace,
} from './clientRecordsAssembly.js';

async function patchBrandProfileRpc(orgId, brandKey, patch) {
  if (!supabase) return { ok: false, error: 'Supabase client unavailable.' };
  const { error } = await supabase.rpc('patch_brand_profile', {
    p_org_id: orgId,
    p_brand_key: brandKey,
    p_patch: patch,
  });
  if (error) {
    console.warn('[client-records] patch_brand_profile failed:', error.message || error);
    return { ok: false, error: error.message || 'patch_brand_profile failed.' };
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

export async function pushBrandProfilePatches(orgId, patches = []) {
  if (!SUPABASE_ENABLED || !patches.length) return { ok: true };

  let lastError = '';

  for (const { brandKey, patch } of patches) {
    // patch_brand_profile is service_role-only (migration 027); browser RPC usually fails.
    let result = await patchBrandProfileViaApi(orgId, brandKey, patch);
    if (!result.ok) {
      let canWrite = await hasStaffSupabaseSession();
      if (!canWrite) {
        await ensureStaffSupabaseSession();
        canWrite = await hasStaffSupabaseSession();
      }
      if (canWrite) {
        result = await patchBrandProfileRpc(orgId, brandKey, patch);
      }
    }
    if (!result.ok) {
      lastError = result.error || lastError;
    }
  }

  if (lastError) {
    return {
      ok: false,
      error: lastError,
    };
  }

  return { ok: true };
}

export { slimClientsWorkspaceForCloudPush };
