import { getOrgId } from '../lib/orgSession';
import { supabase, SUPABASE_ENABLED } from '../lib/supabaseClient';
import { loadStaffSession } from './staffAuth';
import { clientBrandNameKey, isInternalClientName, normalizeClientName } from './clients';
import { fetchWithTimeout } from './withTimeout';

const CLIENT_BRAND_NAME_TIMEOUT_MS = 15000;

function parseRpcResult(data, fallbackError) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: fallbackError };
  }
  if (data.ok) {
    return { ok: true, name: data.name || null };
  }
  return { ok: false, error: data.error || fallbackError };
}

async function buildAuthHeaders() {
  const session = loadStaffSession();
  if (session?.username && session?.signature) {
    return {
      Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
      'Content-Type': 'application/json',
    };
  }

  if (SUPABASE_ENABLED && supabase) {
    try {
      const token = await Promise.race([
        supabase.auth.getSession().then(({ data }) => data?.session?.access_token || null),
        new Promise((resolve) => {
          setTimeout(() => resolve(null), 3000);
        }),
      ]);
      if (token) {
        return {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

async function reserveClientBrandNameViaApi(name, orgId, action = 'reserve') {
  const headers = await buildAuthHeaders();
  if (!headers) {
    return { ok: false, error: 'Sign in to add a client.' };
  }

  const response = await fetchWithTimeout(
    '/api/client-brand-name',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action,
        displayName: name,
        orgId: orgId || getOrgId(),
      }),
    },
    CLIENT_BRAND_NAME_TIMEOUT_MS,
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: payload.error || 'Could not verify client name availability. Try again in a moment.',
    };
  }

  return parseRpcResult(payload, 'Could not reserve client name.');
}

async function reserveClientBrandNameViaRpc(name, orgId) {
  if (!supabase) {
    return { ok: false, error: 'Cloud sync is not configured.' };
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, error: 'Cloud sync is not configured.' };
  }

  const token = await Promise.race([
    supabase.auth.getSession().then(({ data }) => data?.session?.access_token || null),
    new Promise((resolve) => {
      setTimeout(() => resolve(null), 3000);
    }),
  ]);

  if (!token) {
    return { ok: false, error: 'Sign in to add a client.' };
  }

  const response = await fetchWithTimeout(
    `${url}/rest/v1/rpc/reserve_client_brand_name`,
    {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_display_name: name,
        p_org_id: orgId,
      }),
    },
    CLIENT_BRAND_NAME_TIMEOUT_MS,
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error('[clientBrandNames] reserve RPC failed:', data?.message || response.status);
    return {
      ok: false,
      error: 'Could not verify client name availability. Try again in a moment.',
    };
  }

  return parseRpcResult(data, 'Could not reserve client name.');
}

/** Reserve a globally unique client brand name for this workspace (Supabase only). */
export async function reserveClientBrandName(name, orgId) {
  const trimmed = normalizeClientName(name);
  if (!trimmed) {
    return { ok: false, error: 'Please enter a client name.' };
  }
  if (isInternalClientName(trimmed)) {
    return { ok: false, error: 'That client name is reserved.' };
  }
  if (!SUPABASE_ENABLED || !orgId) {
    return { ok: true, name: trimmed };
  }

  const apiResult = await reserveClientBrandNameViaApi(trimmed, orgId, 'reserve');
  if (apiResult.ok) return apiResult;
  if (
    apiResult.error === 'Sign in to add a client.' ||
    apiResult.error === 'That client name is reserved.' ||
    apiResult.error === 'Please enter a client name.' ||
    /already exists/i.test(apiResult.error || '')
  ) {
    return apiResult;
  }

  return reserveClientBrandNameViaRpc(trimmed, orgId);
}

/** Undo a reservation when local client creation fails after the global lock succeeds. */
export async function releaseClientBrandName(name, orgId) {
  const trimmed = normalizeClientName(name);
  if (!trimmed || !SUPABASE_ENABLED || !orgId) {
    return { ok: true };
  }

  const apiResult = await reserveClientBrandNameViaApi(trimmed, orgId, 'release');
  if (apiResult.ok) return apiResult;

  if (!supabase) {
    return { ok: false, error: apiResult.error || 'Could not release client name.' };
  }

  const { data, error } = await supabase.rpc('release_client_brand_name', {
    p_display_name: trimmed,
    p_org_id: orgId,
  });

  if (error) {
    console.error('[clientBrandNames] release failed:', error.message || error);
    return { ok: false, error: error.message || 'Could not release client name.' };
  }

  return parseRpcResult(data, 'Could not release client name.');
}

export { clientBrandNameKey };
