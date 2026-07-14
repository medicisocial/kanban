import { clientBrandNameKey, formatClientDisplayName, resolveClientMapValue, clientNamesConflict } from './clients.js';

const AGENCY_BRAND_NAME = 'Medici Social';
const AGENCY_BRAND_COLOR = '#810100';
const LEGACY_AGENCY_ORG_ID = 'medici';

/**
 * Medici Social is both the agency and a content brand. Cloud mode builds the
 * client list from client_records only — if that row is missing, the brand
 * disappears from filters/deliverables even though it exists in `brands`.
 */
export function ensureAgencyBrandInWorkspace(workspace = {}, orgId = '') {
  if (orgId !== LEGACY_AGENCY_ORG_ID) return workspace;
  const names = Array.isArray(workspace.names) ? workspace.names : [];
  if (names.some((name) => clientNamesConflict(name, AGENCY_BRAND_NAME))) {
    return workspace;
  }
  const next = { ...workspace, names: [...names, AGENCY_BRAND_NAME] };
  const colors = { ...(next.colors || {}) };
  if (!Object.keys(colors).some((key) => clientNamesConflict(key, AGENCY_BRAND_NAME))) {
    colors[AGENCY_BRAND_NAME] = AGENCY_BRAND_COLOR;
    next.colors = colors;
  }
  return next;
}

function isEmptyBrandField(field, value) {
  if (value === null || value === undefined) return true;
  if (field === 'contacts' || field === 'companyFiles' || field === 'specialMenus') {
    return Array.isArray(value) && value.length === 0;
  }
  if (field === 'socialLogins' || field === 'logo') {
    return typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
  }
  if (
    field === 'clientColor' ||
    field === 'photoGalleryLink' ||
    field === 'businessType' ||
    field === 'accountManager'
  ) {
    return String(value || '').trim() === '';
  }
  if (
    field === 'deliverableTarget' ||
    field === 'reelPointsTarget' ||
    field === 'carouselStaticTarget' ||
    field === 'shootDaysPerMonth' ||
    field === 'shootHoursPerDay'
  ) {
    return !(Number(value) > 0);
  }
  if (field === 'planId') {
    const id = String(value || '').trim().toLowerCase();
    return !id || id === 'custom';
  }
  return false;
}

function applyRemoteBrandField(next, field, mapKey, client, remoteValue) {
  const localValue = resolveClientMapValue(client, next[mapKey] || {});
  if (isEmptyBrandField(field, remoteValue) && !isEmptyBrandField(field, localValue)) {
    if (localValue !== undefined) {
      next[mapKey] = { ...(next[mapKey] || {}), [client]: localValue };
    }
    return;
  }
  if (!isEmptyBrandField(field, remoteValue)) {
    next[mapKey] = { ...(next[mapKey] || {}), [client]: remoteValue };
  }
}

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
    clientColor: resolveClientMapValue(client, workspace.colors) || '',
    clientLogo: resolveClientMapValue(client, workspace.logos) || {},
    contacts: resolveClientMapValue(client, workspace.contacts) || [],
    socialLogins: resolveClientMapValue(client, workspace.socialLogins) || {},
    companyFiles: resolveClientMapValue(client, workspace.companyFiles) || [],
    specialMenus: resolveClientMapValue(client, workspace.specialMenus) || [],
    photoGalleryLink: resolveClientMapValue(client, workspace.photoGalleryLinks) || '',
    businessType: resolveClientMapValue(client, workspace.businessTypes) || '',
    accountManager: resolveClientMapValue(client, workspace.accountManagers) || '',
    deliverableTarget: Number(resolveClientMapValue(client, workspace.deliverableTargets)) || 0,
    reelPointsTarget: Number(resolveClientMapValue(client, workspace.reelPointsTargets)) || 0,
    carouselStaticTarget: Number(resolveClientMapValue(client, workspace.carouselStaticTargets)) || 0,
    planId: String(resolveClientMapValue(client, workspace.planIds) || '').trim().toLowerCase() || 'custom',
    shootDaysPerMonth: Number(resolveClientMapValue(client, workspace.shootDaysPerMonth)) || 0,
    shootHoursPerDay: Number(resolveClientMapValue(client, workspace.shootHoursPerDay)) || 0,
  };
}

export function mergeClientRecordRowsIntoWorkspace(workspace = {}, rows = []) {
  const next = { ...workspace };
  const now = Date.now();
  next.restoredNames = { ...(next.restoredNames || {}) };
  next.names = unionClientNamesFromRecords(workspace.names, rows);
  for (const row of rows) {
    const client = clientNameFromRecordRow(row);
    if (!client) continue;
    const key = clientBrandNameKey(client);
    if (key) next.restoredNames[key] = now;
    applyRemoteBrandField(next, 'clientColor', 'colors', client, row.client_color || '');
    applyRemoteBrandField(next, 'logo', 'logos', client, row.logo);
    applyRemoteBrandField(next, 'contacts', 'contacts', client, row.contacts);
    applyRemoteBrandField(next, 'socialLogins', 'socialLogins', client, row.social_logins);
    applyRemoteBrandField(next, 'companyFiles', 'companyFiles', client, row.company_files);
    applyRemoteBrandField(next, 'specialMenus', 'specialMenus', client, row.special_menus);
    applyRemoteBrandField(next, 'photoGalleryLink', 'photoGalleryLinks', client, row.photo_gallery_link || '');
    applyRemoteBrandField(next, 'businessType', 'businessTypes', client, row.business_type || '');
    applyRemoteBrandField(next, 'accountManager', 'accountManagers', client, row.account_manager || '');
    applyRemoteBrandField(next, 'deliverableTarget', 'deliverableTargets', client, Number(row.deliverable_target) || 0);
    applyRemoteBrandField(next, 'reelPointsTarget', 'reelPointsTargets', client, Number(row.reel_points_target) || 0);
    applyRemoteBrandField(next, 'carouselStaticTarget', 'carouselStaticTargets', client, Number(row.carousel_static_target) || 0);
    applyRemoteBrandField(
      next,
      'planId',
      'planIds',
      client,
      String(row.plan_id || '').trim().toLowerCase() || 'custom',
    );
    applyRemoteBrandField(
      next,
      'shootDaysPerMonth',
      'shootDaysPerMonth',
      client,
      Math.max(0, Math.round(Number(row.shoot_days_per_month) || 0)),
    );
    {
      const n = Number(row.shoot_hours_per_day);
      applyRemoteBrandField(
        next,
        'shootHoursPerDay',
        'shootHoursPerDay',
        client,
        Number.isFinite(n) && n >= 0 ? Math.round(n * 2) / 2 : 0,
      );
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
    const changed = {};
    for (const [key, value] of Object.entries(nextPatch || {})) {
      if (JSON.stringify(prevPatch?.[key]) !== JSON.stringify(value)) {
        changed[key] = value;
      }
    }
    if (!Object.keys(changed).length) continue;
    if (!changed.displayName && nextPatch?.displayName) {
      changed.displayName = nextPatch.displayName;
    }
    patches.push({
      brandKey: clientBrandNameKey(client),
      patch: changed,
    });
  }
  return patches;
}
