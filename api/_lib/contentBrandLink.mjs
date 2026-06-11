import { getSupabaseUrl, resolveAuthReadKey } from './supabase.mjs';
import { brandKeysMatch } from './portalBrandProfile.mjs';

const CONTENT_TABLES_WITH_CLIENT = new Set([
  'cards',
  'shoot_plans',
  'video_ideas',
  'admin_tasks',
  'events',
  'meetings',
]);

function normalizeBrandLookupKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function contentTableUsesBrandLink(table) {
  return CONTENT_TABLES_WITH_CLIENT.has(table);
}

export function buildBrandIdLookupMap(brandRows = []) {
  const map = new Map();
  for (const row of brandRows) {
    if (!row?.id) continue;
    if (row.brand_key) map.set(normalizeBrandLookupKey(row.brand_key), row.id);
    if (row.display_name) map.set(normalizeBrandLookupKey(row.display_name), row.id);
  }
  return map;
}

export function resolveBrandIdForClient(client, brandMap) {
  const normalized = normalizeBrandLookupKey(client);
  if (!normalized || !brandMap) return null;
  if (brandMap.has(normalized)) return brandMap.get(normalized);

  for (const [key, brandId] of brandMap.entries()) {
    if (brandKeysMatch(key, normalized)) return brandId;
  }
  return null;
}

export async function fetchBrandIdLookupMap(orgId) {
  const url = getSupabaseUrl();
  const key = resolveAuthReadKey();
  if (!url || !key || !orgId) return new Map();

  const response = await fetch(
    `${url}/rest/v1/brands?org_id=eq.${encodeURIComponent(orgId)}&select=id,brand_key,display_name`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    },
  );
  if (!response.ok) return new Map();
  const rows = await response.json();
  return buildBrandIdLookupMap(Array.isArray(rows) ? rows : []);
}

export function attachBrandIdToContentRow(table, row, brandMap) {
  if (!contentTableUsesBrandLink(table)) return row;
  const client = row?.data?.client;
  if (!client) return row;
  const brandId = resolveBrandIdForClient(client, brandMap);
  if (!brandId) return row;
  return { ...row, brand_id: brandId };
}

export async function enrichContentRowsForUpsert(table, rows, orgId) {
  if (!contentTableUsesBrandLink(table) || !rows?.length) return rows;
  const brandMap = await fetchBrandIdLookupMap(orgId);
  if (!brandMap.size) return rows;
  return rows.map((row) => attachBrandIdToContentRow(table, row, brandMap));
}
