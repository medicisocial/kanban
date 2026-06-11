import { getOrgId } from '../lib/orgSession';
import { loadStaffSession } from './staffAuth';
import { SUPABASE_ENABLED, supabase } from '../lib/supabaseClient';
import { fetchWithTimeout } from './withTimeout';

const SAVE_PASSWORD_TIMEOUT_MS = 60000;
const SESSION_LOOKUP_TIMEOUT_MS = 3000;

async function getSupabaseAccessToken() {
  if (!SUPABASE_ENABLED || !supabase) return null;
  try {
    return await Promise.race([
      supabase.auth.getSession().then(({ data }) => data?.session?.access_token || null),
      new Promise((resolve) => {
        setTimeout(() => resolve(null), SESSION_LOOKUP_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  }
}

async function buildAuthHeaders() {
  const session = loadStaffSession();
  if (session?.username && session?.signature) {
    return {
      Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
      'Content-Type': 'application/json',
    };
  }

  const token = await getSupabaseAccessToken();
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  return null;
}

export async function clearBrandPortalUsers(brand) {
  const headers = await buildAuthHeaders();
  if (!headers) {
    return { ok: false, error: 'Staff sign-in required.' };
  }

  try {
    const response = await fetchWithTimeout(
      '/api/client-portal-set-password',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ brand, orgId: getOrgId(), clear: true }),
      },
      SAVE_PASSWORD_TIMEOUT_MS,
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: payload.error || 'Could not clear portal users.' };
    }
    return { ok: true, users: [] };
  } catch (error) {
    return { ok: false, error: error?.message || 'Could not clear portal users.' };
  }
}

export async function saveClientPortalPasswords({ brand, users }) {
  const headers = await buildAuthHeaders();
  if (!headers) {
    return { ok: false, error: 'Staff sign-in required to save portal passwords.' };
  }

  try {
    const response = await fetchWithTimeout(
      '/api/client-portal-set-password',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          brand,
          orgId: getOrgId(),
          users,
        }),
      },
      SAVE_PASSWORD_TIMEOUT_MS,
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: payload.error || 'Could not save portal passwords.' };
    }

    return { ok: true, users: payload.users || [], vaultWarning: payload.vaultWarning || null };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Could not save portal passwords.',
    };
  }
}
