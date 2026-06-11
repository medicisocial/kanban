import { getSupabaseUrl, resolveAuthReadKey } from './supabase.mjs';

const SERVER_FETCH_TIMEOUT_MS = 15000;

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

/** Case-insensitive brand key lookup in per-brand workspace maps. */
export function resolveBrandStorageKey(map, brand, names = []) {
  if (!brand) return '';
  const trimmed = String(brand).trim();
  if (!trimmed) return '';

  if (map && typeof map === 'object' && map[trimmed]) return trimmed;

  const normalized = trimmed.toLowerCase();
  if (Array.isArray(names)) {
    for (const name of names) {
      if (String(name).trim().toLowerCase() === normalized && map?.[name]) return name;
    }
  }

  if (map && typeof map === 'object') {
    for (const key of Object.keys(map)) {
      if (key.trim().toLowerCase() === normalized) return key;
    }
  }

  return trimmed;
}

export function brandKeysMatch(a, b) {
  if (!a || !b) return false;
  const normalize = (value) => String(value).trim().toLowerCase().replace(/\s+/g, ' ');
  return normalize(a) === normalize(b);
}

/** Filter content rows (cards, events, meetings, ideas) to one brand — case-insensitive. */
export function filterContentByBrand(items, brand) {
  if (!Array.isArray(items) || !brand) return [];
  return items.filter((item) => item?.client && brandKeysMatch(item.client, brand));
}

export function filterPlansByBrand(plans, brand) {
  if (!plans || typeof plans !== 'object' || !brand) return {};
  const filtered = {};
  for (const [key, plan] of Object.entries(plans)) {
    if (plan?.client && brandKeysMatch(plan.client, brand)) filtered[key] = plan;
  }
  return filtered;
}

/** Map portal credential key (e.g. "arco fit") to workspace display name ("Arco Fit"). */
export function resolvePortalBrandDisplayNameFromStore(sessionBrand, clientStore = {}) {
  if (!sessionBrand) return '';

  const names = Array.isArray(clientStore?.names) ? clientStore.names : [];
  for (const name of names) {
    if (brandKeysMatch(name, sessionBrand)) return String(name).trim();
  }

  const brandKey = resolveBrandStorageKey(
    clientStore?.colors || clientStore?.logos || clientStore?.photoGalleryLinks || {},
    sessionBrand,
    names,
  );

  if (brandKey && brandKeysMatch(brandKey, sessionBrand)) {
    const fromNames = names.find((name) => brandKeysMatch(name, brandKey));
    if (fromNames) return String(fromNames).trim();
  }

  return String(sessionBrand).trim();
}

/** Human-readable brand label for all client portal surfaces. */
export function resolvePortalBrandLabel({ profile, displayBrand, sessionBrand }) {
  return profile?.displayName || displayBrand || profile?.brandKey || sessionBrand || '';
}

export async function resolvePortalBrandDisplayName(orgId, sessionBrand) {
  if (!sessionBrand) return '';

  const normalized = String(sessionBrand).trim().toLowerCase().replace(/\s+/g, ' ');
  const url = getSupabaseUrl();
  const key = resolveAuthReadKey();

  if (url && key && orgId && normalized) {
    try {
      const brandResponse = await fetchWithTimeout(
        `${url}/rest/v1/brands?org_id=eq.${encodeURIComponent(orgId)}&brand_key=eq.${encodeURIComponent(normalized)}&select=display_name&limit=1`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
        },
      );
      if (brandResponse.ok) {
        const brandRows = await brandResponse.json();
        const fromBrands = brandRows?.[0]?.display_name;
        if (fromBrands && brandKeysMatch(fromBrands, sessionBrand)) {
          return String(fromBrands).trim();
        }
      }

      const response = await fetchWithTimeout(
        `${url}/rest/v1/client_brand_names?name_normalized=eq.${encodeURIComponent(normalized)}&org_id=eq.${encodeURIComponent(orgId)}&select=display_name&limit=1`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
        },
      );
      if (response.ok) {
        const rows = await response.json();
        const displayName = rows?.[0]?.display_name;
        if (displayName && brandKeysMatch(displayName, sessionBrand)) {
          return String(displayName).trim();
        }
      }
    } catch (error) {
      console.warn('[portal-brand-profile] display name lookup failed:', error?.message || error);
    }
  }

  return String(sessionBrand).trim();
}

export async function resolveBrandRecord(orgId, brand) {
  if (!brand) return null;

  const url = getSupabaseUrl();
  const key = resolveAuthReadKey();
  if (!url || !key || !orgId) return null;

  const normalized = String(brand).trim().toLowerCase().replace(/\s+/g, ' ');

  try {
    const exactResponse = await fetchWithTimeout(
      `${url}/rest/v1/brands?org_id=eq.${encodeURIComponent(orgId)}&brand_key=eq.${encodeURIComponent(normalized)}&select=id,brand_key,display_name&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      },
    );
    if (exactResponse.ok) {
      const rows = await exactResponse.json();
      if (rows?.[0]?.id) return rows[0];
    }

    const allResponse = await fetchWithTimeout(
      `${url}/rest/v1/brands?org_id=eq.${encodeURIComponent(orgId)}&select=id,brand_key,display_name`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      },
    );
    if (allResponse.ok) {
      const rows = await allResponse.json();
      for (const row of rows || []) {
        if (
          brandKeysMatch(row.brand_key, brand) ||
          brandKeysMatch(row.display_name, brand)
        ) {
          return row;
        }
      }
    }
  } catch (error) {
    console.warn('[portal-brand-profile] brand record lookup failed:', error?.message || error);
  }

  return null;
}

function rowMatchesBrand(row, brand, table) {
  const data = row?.data;
  if (!data || typeof data !== 'object') return false;
  if (table === 'shoot_plans') {
    return data.client ? brandKeysMatch(data.client, brand) : brandKeysMatch(row.id, brand);
  }
  return data.client ? brandKeysMatch(data.client, brand) : false;
}

/** @internal test helper */
export function matchesBrandContentRow(row, brand, table) {
  return rowMatchesBrand(row, brand, table);
}

async function queryOrgTableRows(orgId, table) {
  const url = getSupabaseUrl();
  const key = resolveAuthReadKey();
  if (!url || !key || !orgId) return [];

  const response = await fetchWithTimeout(
    `${url}/rest/v1/${table}?select=id,data&org_id=eq.${encodeURIComponent(orgId)}`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  );
  if (!response.ok) return [];
  return response.json();
}

async function queryRowsByBrandId(orgId, table, brandId) {
  const url = getSupabaseUrl();
  const key = resolveAuthReadKey();
  if (!url || !key || !orgId || !brandId) return [];

  const response = await fetchWithTimeout(
    `${url}/rest/v1/${table}?select=id,data&org_id=eq.${encodeURIComponent(orgId)}&brand_id=eq.${encodeURIComponent(brandId)}`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  );
  if (!response.ok) return [];
  return response.json();
}

async function loadBrandTableContent(orgId, brand, table, brandId) {
  if (brandId) {
    const linkedRows = await queryRowsByBrandId(orgId, table, brandId);
    if (linkedRows.length > 0) {
      return linkedRows;
    }
  }

  const orgRows = await queryOrgTableRows(orgId, table);
  return orgRows.filter((row) => rowMatchesBrand(row, brand, table));
}

export function resolveBrandProfileFromStore(clientStore, brand) {
  const names = Array.isArray(clientStore?.names) ? clientStore.names : [];
  const brandKey = resolveBrandStorageKey(
    clientStore?.photoGalleryLinks || clientStore?.colors || {},
    brand,
    names,
  );

  const photoGalleryLinks = clientStore?.photoGalleryLinks || {};
  const colors = clientStore?.colors || {};
  const logos = clientStore?.logos || {};
  const businessTypes = clientStore?.businessTypes || {};
  const contacts = clientStore?.contacts || {};
  const socialLogins = clientStore?.socialLogins || {};
  const companyFiles = clientStore?.companyFiles || {};
  const specialMenus = clientStore?.specialMenus || {};

  const photoGalleryLink = String(photoGalleryLinks[brandKey] || '').trim() || null;

  return {
    brandKey,
    clientColor: colors[brandKey] || null,
    clientLogo: logos[brandKey] || null,
    businessType: businessTypes[brandKey] || null,
    photoGalleryLink,
    contacts: contacts[brandKey] ?? [],
    socialLogins: socialLogins[brandKey] ?? {},
    companyFiles: companyFiles[brandKey] ?? [],
    specialMenus: specialMenus[brandKey] ?? [],
    contentTypeColors: clientStore?.contentTypeColors || {},
  };
}

/**
 * Lightweight brand profile read using the normalized get_brand_profile RPC.
 * Avoids downloading the full clients workspace JSON or the legacy blob.
 */
export async function fetchPortalBrandProfile(orgId, brand) {
  const url = getSupabaseUrl();
  const key = resolveAuthReadKey();
  if (!url || !key || !orgId || !brand) return null;

  // Try the new normalized get_brand_profile RPC first (from migration 018).
  try {
    const response = await fetchWithTimeout(
      `${url}/rest/v1/rpc/get_brand_profile`,
      {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ p_org_id: orgId, p_brand_key: brand }),
      },
    );

    if (response.ok) {
      const payload = await response.json();
      if (payload && typeof payload === 'object' && payload.brandId) {
        return payload;
      }
    }
  } catch (error) {
    console.warn('[portal-brand-profile] get_brand_profile RPC not available yet, falling back to legacy:', error?.message || error);
  }

  // Fall back to legacy get_portal_brand_profile RPC (pre-018 clients blob).
  try {
    const response = await fetchWithTimeout(
      `${url}/rest/v1/rpc/get_portal_brand_profile`,
      {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ p_org_id: orgId, p_brand: brand }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Portal profile fetch failed: ${response.status} ${detail}`.trim());
    }

    const payload = await response.json();
    if (!payload || typeof payload !== 'object') return null;
    return payload;
  } catch (error) {
    console.warn('[portal-brand-profile] legacy RPC also failed:', error?.message || error);
    return null;
  }
}

/**
 * Fetch portal users for a brand from the normalized portal_users table.
 */
export async function fetchBrandPortalUsers(orgId, brand) {
  const url = getSupabaseUrl();
  const key = resolveAuthReadKey();
  if (!url || !key || !orgId || !brand) return [];

  try {
    const response = await fetchWithTimeout(
      `${url}/rest/v1/rpc/get_brand_portal_users`,
      {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ p_org_id: orgId, p_brand_key: brand }),
      },
    );

    if (response.ok) {
      const payload = await response.json();
      if (Array.isArray(payload)) return payload;
      return [];
    }
  } catch (error) {
    console.warn('[portal-brand-profile] get_brand_portal_users failed:', error?.message || error);
  }

  return [];
}

/**
 * Fetch brand-scoped content (cards, events, meetings, ideas) directly
 * from Supabase by brand_id instead of filtering the full workspace.
 */
export async function fetchBrandContent(orgId, brand) {
  const url = getSupabaseUrl();
  const key = resolveAuthReadKey();
  if (!url || !key || !orgId || !brand) return null;

  const brandRecord = await resolveBrandRecord(orgId, brand);
  const brandId = brandRecord?.id || null;

  const [cards, ideas, events, meetings, plans] = await Promise.all([
    loadBrandTableContent(orgId, brand, 'cards', brandId),
    loadBrandTableContent(orgId, brand, 'video_ideas', brandId),
    loadBrandTableContent(orgId, brand, 'events', brandId),
    loadBrandTableContent(orgId, brand, 'meetings', brandId),
    loadBrandTableContent(orgId, brand, 'shoot_plans', brandId),
  ]);

  const hasContent =
    cards.length > 0 ||
    ideas.length > 0 ||
    events.length > 0 ||
    meetings.length > 0 ||
    plans.length > 0;

  if (!hasContent && !brandRecord) return null;

  return {
    cards: (cards || []).map((r) => r.data).filter(Boolean),
    ideas: (ideas || []).map((r) => r.data).filter(Boolean),
    events: (events || []).map((r) => r.data).filter(Boolean),
    meetings: (meetings || []).map((r) => r.data).filter(Boolean),
    plans: (plans || []).reduce((acc, r) => {
      acc[r.id] = r.data;
      return acc;
    }, {}),
  };
}