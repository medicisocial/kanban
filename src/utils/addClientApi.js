import { getOrgId } from '../lib/orgSession';
import { supabase, SUPABASE_ENABLED } from '../lib/supabaseClient';
import { loadStaffSession } from './staffAuth';
import { fetchWithTimeout } from './withTimeout';

const ADD_CLIENT_TIMEOUT_MS = 20000;

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

export async function addClientThroughApi({
  displayName,
  color,
  logo = null,
  businessType = '',
  orgId = getOrgId(),
}) {
  const headers = await buildAuthHeaders();
  if (!headers) {
    return { ok: false, error: 'Sign in to add a client.' };
  }

  const response = await fetchWithTimeout(
    '/api/add-client',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        displayName,
        color,
        logo,
        businessType,
        orgId,
      }),
    },
    ADD_CLIENT_TIMEOUT_MS,
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: payload.error || 'Could not add client. Try again in a moment.',
    };
  }

  return payload;
}
