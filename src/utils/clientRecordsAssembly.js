import { clientBrandNameKey } from './clients.js';

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
  for (const client of clientNames) {
    if (!client) continue;
    const prevPatch = brandProfilePatchFromWorkspaceBrand(client, prev);
    const nextPatch = brandProfilePatchFromWorkspaceBrand(client, next);
    if (JSON.stringify(prevPatch) !== JSON.stringify(nextPatch)) {
      patches.push({
        brandKey: clientBrandNameKey(client),
        patch: nextPatch,
      });
    }
  }
  return patches;
}
