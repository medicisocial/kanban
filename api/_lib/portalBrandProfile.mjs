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

/** Lightweight profile read — avoids downloading the full clients workspace JSON. */
export async function fetchPortalBrandProfile(orgId, brand) {
  const url = getSupabaseUrl();
  const key = resolveAuthReadKey();
  if (!url || !key || !orgId || !brand) return null;

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
}
