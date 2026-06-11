import { SUPABASE_ENABLED, supabase } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { loadStaffSession } from './staffAuth';
import { ensureStaffSupabaseSession, hasStaffSupabaseSession } from '../lib/staffSupabaseAuth';
import { slimClientsWorkspaceForCloudPush } from './clientsWorkspacePush';

export {
  brandProfilePatchFromWorkspaceBrand,
  diffBrandProfilePatches,
  mergeClientRecordRowsIntoWorkspace,
} from './clientRecordsAssembly.js';

async function patchBrandProfileRpc(orgId, brandKey, patch) {
  if (!supabase) return false;
  const { error } = await supabase.rpc('patch_brand_profile', {
    p_org_id: orgId,
    p_brand_key: brandKey,
    p_patch: patch,
  });
  if (error) {
    console.warn('[client-records] patch_brand_profile failed:', error.message || error);
    return false;
  }
  return true;
}

async function buildBrandRecordAuthHeaders() {
  const session = loadStaffSession();
  if (session?.username && session?.signature) {
    return {
      Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
      'Content-Type': 'application/json',
    };
  }
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function patchBrandProfileViaApi(orgId, brandKey, patch) {
  const headers = await buildBrandRecordAuthHeaders();
  if (!headers) return false;
  try {
    const response = await fetch('/api/brand-record', {
      method: 'POST',
      headers,
      body: JSON.stringify({ brand: brandKey, orgId, patch }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function pushBrandProfilePatches(orgId, patches = []) {
  if (!SUPABASE_ENABLED || !patches.length) return { ok: true };

  let canWrite = await hasStaffSupabaseSession();
  if (!canWrite) {
    await ensureStaffSupabaseSession();
    canWrite = await hasStaffSupabaseSession();
  }

  for (const { brandKey, patch } of patches) {
    if (canWrite) {
      const ok = await patchBrandProfileRpc(orgId, brandKey, patch);
      if (ok) continue;
    }
    await patchBrandProfileViaApi(orgId, brandKey, patch);
  }

  return { ok: true };
}

export { slimClientsWorkspaceForCloudPush };
