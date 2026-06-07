import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage.js';

const STORAGE_KEY = 'medici-deleted-company-files';

function readStore() {
  try {
    const parsed = readOrgScopedJson(STORAGE_KEY, null);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

function writeStore(store) {
  try {
    writeOrgScopedJson(STORAGE_KEY, store);
  } catch {
    /* ignore quota errors */
  }
}

export function getDeletedCompanyFileIds(brand) {
  const key = String(brand || '').trim();
  if (!key) return new Set();
  const store = readStore();
  const ids = Array.isArray(store[key]) ? store[key] : [];
  return new Set(ids.map((id) => String(id)));
}

export function addDeletedCompanyFileIds(brand, ids) {
  const key = String(brand || '').trim();
  if (!key || !ids?.length) return;
  const store = readStore();
  const next = new Set([...(Array.isArray(store[key]) ? store[key] : []), ...ids.map((id) => String(id))]);
  store[key] = [...next];
  writeStore(store);
}

/** Record ids removed by an explicit save (portal delete). */
export function recordDeletedCompanyFiles(brand, prevFiles, nextFiles) {
  const nextIds = new Set(
    (Array.isArray(nextFiles) ? nextFiles : [])
      .filter((file) => file?.id)
      .map((file) => String(file.id)),
  );
  const removed = [];
  for (const file of Array.isArray(prevFiles) ? prevFiles : []) {
    const id = String(file?.id || '');
    if (id && !nextIds.has(id)) removed.push(id);
  }
  if (removed.length) addDeletedCompanyFileIds(brand, removed);
}

export function filterIdsFromCompanyFiles(files, deletedIds) {
  const deleted =
    deletedIds instanceof Set ? deletedIds : new Set((deletedIds || []).map((id) => String(id)));
  if (!deleted.size) return Array.isArray(files) ? files : [];
  return (Array.isArray(files) ? files : []).filter((file) => !deleted.has(String(file?.id || '')));
}

export function filterDeletedCompanyFiles(brand, files) {
  return filterIdsFromCompanyFiles(files, getDeletedCompanyFileIds(brand));
}

export function companyFilesIncludeDeleted(brand, files) {
  const deleted = getDeletedCompanyFileIds(brand);
  if (!deleted.size) return false;
  return (Array.isArray(files) ? files : []).some((file) => deleted.has(String(file?.id || '')));
}
