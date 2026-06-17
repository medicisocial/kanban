import { readOrgScopedJson, writeOrgScopedJson } from '../lib/orgStorage.js';
import { isCloudSourceOfTruth } from '../lib/cloudSourceOfTruth.js';
import { getOrgId } from '../lib/orgSession.js';
import { pushBrandProfilePatches } from './clientRecordsCloud.js';
import { clientBrandNameKey } from './clients.js';

const STORAGE_KEY = 'medici-deleted-company-files';
const cloudCache = new Map();

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

function cacheKeyForBrand(brand) {
  return clientBrandNameKey(brand) || String(brand || '').trim().toLowerCase();
}

function getCloudCacheForBrand(brand) {
  const key = cacheKeyForBrand(brand);
  if (!key) return new Set();
  if (cloudCache.has(key)) return cloudCache.get(key);
  return new Set();
}

function setCloudCacheForBrand(brand, ids) {
  const key = cacheKeyForBrand(brand);
  if (!key) return;
  cloudCache.set(key, new Set((ids || []).map((id) => String(id))));
}

async function pushDeletedIdsToCloud(brand, ids) {
  if (!ids?.length) return;
  try {
    await pushBrandProfilePatches(getOrgId(), [
      {
        brandKey: cacheKeyForBrand(brand) || String(brand || '').trim(),
        patch: { appendDeletedCompanyFileIds: ids.map((id) => String(id)) },
      },
    ]);
  } catch (error) {
    console.warn('[brand-file-tombstones] cloud append failed:', error?.message || error);
  }
}

/** Hydrate in-memory tombstones from normalized client_records rows (staff sync). */
export function hydrateBrandFileTombstonesFromRows(rows = []) {
  if (!isCloudSourceOfTruth()) return;
  for (const row of rows) {
    const brand = row.display_name || row.brand_key;
    const ids = Array.isArray(row.deleted_company_file_ids)
      ? row.deleted_company_file_ids
      : [];
    setCloudCacheForBrand(brand, ids);
  }
}

/** Hydrate tombstones for one brand (portal profile load). */
export function hydrateBrandFileTombstoneForBrand(brand, ids) {
  if (!isCloudSourceOfTruth()) return;
  setCloudCacheForBrand(brand, ids);
}

/** One-time: push any local-only tombstones to Supabase after cloud hydrate. */
export function syncLocalTombstonesToCloudIfNeeded() {
  if (isCloudSourceOfTruth()) return;
  const store = readStore();
  for (const [brand, ids] of Object.entries(store)) {
    if (!Array.isArray(ids) || !ids.length) continue;
    const cached = getCloudCacheForBrand(brand);
    const toPush = ids.map(String).filter((id) => !cached.has(id));
    if (!toPush.length) continue;
    setCloudCacheForBrand(brand, [...cached, ...toPush]);
    void pushDeletedIdsToCloud(brand, toPush);
  }
}

export function getDeletedCompanyFileIds(brand) {
  const key = String(brand || '').trim();
  if (!key) return new Set();

  if (isCloudSourceOfTruth()) {
    return new Set(getCloudCacheForBrand(key));
  }

  const store = readStore();
  const ids = Array.isArray(store[key]) ? store[key] : [];
  return new Set(ids.map((id) => String(id)));
}

export function addDeletedCompanyFileIds(brand, ids) {
  const key = String(brand || '').trim();
  if (!key || !ids?.length) return;

  const normalized = ids.map((id) => String(id));

  if (isCloudSourceOfTruth()) {
    const cached = getCloudCacheForBrand(key);
    const next = new Set([...cached, ...normalized]);
    setCloudCacheForBrand(key, [...next]);
    void pushDeletedIdsToCloud(key, normalized);
    return;
  }

  const store = readStore();
  const next = new Set([...(Array.isArray(store[key]) ? store[key] : []), ...normalized]);
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
