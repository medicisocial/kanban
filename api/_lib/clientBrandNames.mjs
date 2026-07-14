import { getSupabaseUrl } from './supabase.mjs';

const WRITE_TIMEOUT_MS = 12000;

function getWriteKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
}

function normalizeDisplayName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeClientBrandName(name) {
  return normalizeDisplayName(name).toLowerCase();
}

export function isInternalClientBrandName(name) {
  const display = normalizeDisplayName(name);
  return display === '__internal__' || display.startsWith('__');
}

async function restFetch(path, options = {}) {
  const url = getSupabaseUrl();
  const key = getWriteKey();
  if (!url || !key) {
    throw new Error('Cloud sync is not configured.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Database request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function reserveClientBrandNameOnServer(orgId, displayName) {
  const display = normalizeDisplayName(displayName);
  const normalized = normalizeClientBrandName(display);

  if (!normalized) {
    return { ok: false, error: 'Please enter a client name.' };
  }
  if (isInternalClientBrandName(display)) {
    return { ok: false, error: 'That client name is reserved.' };
  }
  if (!orgId) {
    return { ok: false, error: 'Workspace is not ready. Refresh and try again.' };
  }

  const response = await restFetch('client_brand_names', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      name_normalized: normalized,
      display_name: display,
      org_id: orgId,
    }),
  });

  if (response.ok) {
    return { ok: true, name: display };
  }

  const detail = await response.text().catch(() => '');
  if (response.status === 409 || /duplicate key|unique/i.test(detail)) {
    return {
      ok: false,
      error: 'A client with that name already exists on Medici Social. Choose a different name.',
    };
  }

  throw new Error(detail || `Could not reserve client name (${response.status}).`);
}

export async function fetchClientBrandNameRow(displayName) {
  const normalized = normalizeClientBrandName(displayName);
  if (!normalized) return null;

  const response = await restFetch(
    `client_brand_names?name_normalized=eq.${encodeURIComponent(normalized)}&select=name_normalized,display_name,org_id&limit=1`,
  );
  if (!response.ok) return null;
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

/** Upsert the normalized client_records row (migration 017 schema). Required before client_brand_names insert. */
export async function upsertClientRecordOnServer(orgId, displayName, { color, logo, businessType } = {}) {
  const display = normalizeDisplayName(displayName);
  const brandKey = normalizeClientBrandName(display);
  if (!orgId || !brandKey) {
    throw new Error('Missing org or client name.');
  }

  const response = await restFetch('client_records', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      org_id: orgId,
      brand_key: brandKey,
      display_name: display,
      client_color: typeof color === 'string' && color.trim() ? color.trim() : '#9ca3af',
      logo: logo && typeof logo === 'object' ? logo : {},
      business_type: typeof businessType === 'string' ? businessType : '',
      contacts: [],
      social_logins: {},
      company_files: [],
      special_menus: [],
      photo_gallery_link: '',
      account_manager: '',
      videographer: '',
      photographer: '',
      carousel_target: 0,
      static_target: 0,
      data: {},
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `Could not save client record (${response.status}).`);
  }
}

export async function releaseClientBrandNameOnServer(orgId, displayName) {
  const normalized = normalizeClientBrandName(displayName);
  if (!normalized || !orgId) {
    return { ok: true };
  }

  const response = await restFetch(
    `client_brand_names?name_normalized=eq.${encodeURIComponent(normalized)}&org_id=eq.${encodeURIComponent(orgId)}`,
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    },
  );

  if (response.ok || response.status === 404) {
    return { ok: true };
  }

  const detail = await response.text().catch(() => '');
  throw new Error(detail || `Could not release client name (${response.status}).`);
}
