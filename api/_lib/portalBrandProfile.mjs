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

  // First resolve the brand_id
  let brandId = null;
  try {
    const brandResponse = await fetchWithTimeout(
      `${url}/rest/v1/brands?org_id=eq.${encodeURIComponent(orgId)}&brand_key=eq.${encodeURIComponent(brand.toLowerCase().trim())}&select=id`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      },
    );
    if (brandResponse.ok) {
      const brandRows = await brandResponse.json();
      if (brandRows?.length > 0) {
        brandId = brandRows[0].id;
      }
    }
  } catch (error) {
    console.warn('[portal-brand-profile] brand lookup failed:', error?.message || error);
  }

  if (!brandId) return null;

  // Now query each content table by brand_id
  const queryByBrand = async (table) => {
    const response = await fetchWithTimeout(
      `${url}/rest/v1/${table}?select=id,data&brand_id=eq.${encodeURIComponent(brandId)}`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      },
    );
    if (!response.ok) return [];
    return response.json();
  };

  const [cards, ideas, events, meetings, plans] = await Promise.all([
    queryByBrand('cards'),
    queryByBrand('video_ideas'),
    queryByBrand('events'),
    queryByBrand('meetings'),
    queryByBrand('shoot_plans'),
  ]);

  return {
    cards: (cards || []).map(r => r.data).filter(Boolean),
    ideas: (ideas || []).map(r => r.data).filter(Boolean),
    events: (events || []).map(r => r.data).filter(Boolean),
    meetings: (meetings || []).map(r => r.data).filter(Boolean),
    plans: (plans || []).reduce((acc, r) => { acc[r.id] = r.data; return acc; }, {}),
  };
}