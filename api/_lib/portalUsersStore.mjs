import { getWriteConfig } from './supabase.mjs';

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

/** Replace all portal users for one brand (normalized portal_users table). */
export async function replaceBrandPortalUsers(
  orgId,
  brand,
  users,
  { allowPasswordChange = false, allowEmpty = false } = {},
  orgIdOverride,
) {
  const { url, key, orgId: resolvedOrgId } = getWriteConfig(orgIdOverride || orgId);
  if (!url || !key) throw new Error('Supabase is not configured.');

  const payload = Array.isArray(users) ? users : [];
  const response = await fetchWithTimeout(
    `${url}/rest/v1/rpc/replace_brand_portal_users`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        p_org_id: resolvedOrgId,
        p_brand_key: normalizeBrandKey(brand),
        p_users: payload,
        p_allow_password_change: Boolean(allowPasswordChange),
        p_allow_empty: Boolean(allowEmpty),
      }),
    },
    SERVER_WRITE_TIMEOUT_MS,
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`replace_brand_portal_users failed: ${response.status} ${detail}`.trim());
  }

  const result = await response.json();
  return Array.isArray(result) ? result : [];
}

/** Cross-org portal login rows from normalized portal_users. */
export async function fetchPortalUsersForLogin() {
  const { url, key } = getWriteConfig();
  if (!url || !key) return null;

  const response = await fetchWithTimeout(`${url}/rest/v1/rpc/fetch_portal_users_for_login`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows : null;
}

/** Portal users for one org grouped by brand_key → user array. */
export async function fetchPortalUsersByOrg(orgIdOverride) {
  const { url, key, orgId } = getWriteConfig(orgIdOverride);
  if (!url || !key) return {};

  const endpoint =
    `${url}/rest/v1/portal_users?select=id,username,password_hash,display_name,avatar,updated_at,brands!inner(brand_key,display_name,org_id)&brands.org_id=eq.${encodeURIComponent(orgId)}`;
  const response = await fetchWithTimeout(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) return {};

  const rows = await response.json();
  const map = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const brandKey = row.brands?.brand_key || row.brands?.display_name;
    if (!brandKey) continue;
    const users = map[brandKey] || [];
    users.push({
      id: String(row.id),
      username: row.username,
      passwordHash: row.password_hash,
      displayName: row.display_name || '',
      avatar: row.avatar || null,
    });
    map[brandKey] = users;
  }
  return map;
}

export function portalUserRowsToCredentialMap(rows = []) {
  const map = {};
  for (const row of rows) {
    const brandKey = row.brand_key || row.brandKey;
    if (!brandKey) continue;
    const users = map[brandKey] || [];
    users.push({
      id: String(row.user_id || row.id),
      username: row.username,
      passwordHash: row.password_hash || row.passwordHash,
      displayName: row.display_name || row.displayName || '',
      avatar: row.avatar || null,
    });
    map[brandKey] = users;
  }
  return map;
}

/** Legacy { id, org_id, data }[] shape for client-auth lookup. */
export function portalUserRowsToCredentialRows(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    const brandKey = row.brand_key || row.brandKey;
    if (!brandKey) continue;
    if (!grouped.has(brandKey)) {
      grouped.set(brandKey, { id: brandKey, org_id: row.org_id, data: [] });
    }
    grouped.get(brandKey).data.push({
      id: String(row.user_id || row.id),
      username: row.username,
      passwordHash: row.password_hash || row.passwordHash,
      displayName: row.display_name || row.displayName || '',
      avatar: row.avatar || null,
    });
  }
  return [...grouped.values()];
}
