import { getSupabaseUrl, getWriteConfig } from './supabase.mjs';

const SERVER_FETCH_TIMEOUT_MS = 15000;
const SERVER_WRITE_TIMEOUT_MS = 55000;

async function fetchWithTimeout(url, options = {}, timeoutMs = SERVER_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Supabase request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeBrandKey(brand) {
  return String(brand || '').trim().toLowerCase();
}

export async function fetchOrgBrandNames(orgIdOverride) {
  const { url, key, orgId } = getWriteConfig(orgIdOverride);
  if (!url || !key) return [];

  const response = await fetchWithTimeout(
    `${url}/rest/v1/rpc/get_org_brand_names`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_org_id: orgId }),
    },
  );
  if (!response.ok) return [];
  const payload = await response.json();
  return Array.isArray(payload) ? payload.map(String) : [];
}

export async function fetchBrandProfileRecord(orgId, brand, orgIdOverride) {
  const { url, key, orgId: resolvedOrgId } = getWriteConfig(orgIdOverride || orgId);
  if (!url || !key) return null;

  const response = await fetchWithTimeout(
    `${url}/rest/v1/rpc/get_brand_profile`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_org_id: resolvedOrgId,
        p_brand_key: normalizeBrandKey(brand),
      }),
    },
  );
  if (!response.ok) return null;
  const payload = await response.json();
  return payload && typeof payload === 'object' ? payload : null;
}

export async function patchBrandProfileRecord(orgId, brand, patch, orgIdOverride) {
  const { url, key, orgId: resolvedOrgId } = getWriteConfig(orgIdOverride || orgId);
  if (!url || !key) throw new Error('Supabase is not configured.');

  const response = await fetchWithTimeout(
    `${url}/rest/v1/rpc/patch_brand_profile`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        p_org_id: resolvedOrgId,
        p_brand_key: normalizeBrandKey(brand),
        p_patch: patch && typeof patch === 'object' ? patch : {},
      }),
    },
    SERVER_WRITE_TIMEOUT_MS,
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`patch_brand_profile failed: ${response.status} ${detail}`.trim());
  }
}

export async function fetchClientRecordRows(orgIdOverride) {
  const { url, key, orgId } = getWriteConfig(orgIdOverride);
  if (!url || !key) return [];

  const endpoint =
    `${url}/rest/v1/client_records?select=id,org_id,brand_key,display_name,client_color,logo,contacts,social_logins,company_files,special_menus,photo_gallery_link,business_type,account_manager,deleted_company_file_ids,updated_at&org_id=eq.${encodeURIComponent(orgId)}`;
  const response = await fetchWithTimeout(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`client_records fetch failed: ${response.status} ${detail}`.trim());
  }
  return response.json();
}

export function brandProfilePatchFromWorkspaceBrand(client, workspace = {}) {
  if (!client) return null;
  return {
    displayName: client,
    clientColor: workspace.colors?.[client] || '',
    clientLogo: workspace.logos?.[client] || {},
    contacts: workspace.contacts?.[client] || [],
    socialLogins: workspace.socialLogins?.[client] || {},
    companyFiles: workspace.companyFiles?.[client] || [],
    specialMenus: workspace.specialMenus?.[client] || [],
    photoGalleryLink: workspace.photoGalleryLinks?.[client] || '',
    businessType: workspace.businessTypes?.[client] || '',
    accountManager: workspace.accountManagers?.[client] || '',
  };
}

export function mergeClientRecordRowsIntoWorkspace(workspace = {}, rows = []) {
  const next = { ...workspace };
  for (const row of rows) {
    const client = row.display_name || row.brand_key;
    if (!client) continue;
    if (row.client_color) {
      next.colors = { ...(next.colors || {}), [client]: row.client_color };
    }
    if (row.logo && typeof row.logo === 'object' && Object.keys(row.logo).length) {
      next.logos = { ...(next.logos || {}), [client]: row.logo };
    }
    if (Array.isArray(row.contacts)) {
      next.contacts = { ...(next.contacts || {}), [client]: row.contacts };
    }
    if (row.social_logins && typeof row.social_logins === 'object') {
      next.socialLogins = { ...(next.socialLogins || {}), [client]: row.social_logins };
    }
    if (Array.isArray(row.company_files)) {
      next.companyFiles = { ...(next.companyFiles || {}), [client]: row.company_files };
    }
    if (Array.isArray(row.special_menus)) {
      next.specialMenus = { ...(next.specialMenus || {}), [client]: row.special_menus };
    }
    if (row.photo_gallery_link) {
      next.photoGalleryLinks = {
        ...(next.photoGalleryLinks || {}),
        [client]: row.photo_gallery_link,
      };
    }
    if (row.business_type) {
      next.businessTypes = { ...(next.businessTypes || {}), [client]: row.business_type };
    }
    if (row.account_manager) {
      next.accountManagers = { ...(next.accountManagers || {}), [client]: row.account_manager };
    }
  }
  return next;
}

export function diffBrandProfilePatches(prev = {}, next = {}, clientNames = []) {
  const patches = [];
  const names = new Set(clientNames.filter(Boolean));
  for (const client of names) {
    const prevPatch = brandProfilePatchFromWorkspaceBrand(client, prev);
    const nextPatch = brandProfilePatchFromWorkspaceBrand(client, next);
    if (JSON.stringify(prevPatch) !== JSON.stringify(nextPatch)) {
      patches.push({ brandKey: normalizeBrandKey(client), patch: nextPatch });
    }
  }
  return patches;
}
