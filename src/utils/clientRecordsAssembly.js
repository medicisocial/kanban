import { clientBrandNameKey, formatClientDisplayName } from './clients.js';

function pickPreferredClientName(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (clientBrandNameKey(a) !== clientBrandNameKey(b)) return a;
  if (a === a.toLowerCase() && b !== b.toLowerCase()) return b;
  if (b === b.toLowerCase() && a !== a.toLowerCase()) return a;
  return a;
}

function clientNameFromRecordRow(row) {
  const display = String(row.display_name || '').trim();
  const brandKey = String(row.brand_key || '').trim();
  return formatClientDisplayName(display || brandKey);
}

function unionClientNamesFromRecords(existingNames = [], rows = []) {
  const seen = new Set();
  const merged = [];
  for (const name of Array.isArray(existingNames) ? existingNames : []) {
    const key = clientBrandNameKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(formatClientDisplayName(name));
  }
  for (const row of rows) {
    const name = clientNameFromRecordRow(row);
    if (!name) continue;
    const key = clientBrandNameKey(name);
    const existingIndex = merged.findIndex((entry) => clientBrandNameKey(entry) === key);
    if (existingIndex === -1) {
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(name);
      continue;
    }
    merged[existingIndex] = pickPreferredClientName(merged[existingIndex], name);
  }
  return merged;
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
  next.names = unionClientNamesFromRecords(workspace.names, rows);
  for (const row of rows) {
    const client = clientNameFromRecordRow(row);
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
