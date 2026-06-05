import { getOrgId } from '../lib/orgSession';
import { loadStaffSession } from './staffAuth';
import { SUPABASE_ENABLED, supabase } from '../lib/supabaseClient';

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
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
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

export async function saveClientPortalPasswords({ brand, users }) {
  const headers = await buildAuthHeaders();
  if (!headers) {
    return { ok: false, error: 'Staff sign-in required to save portal passwords.' };
  }

  const response = await fetch('/api/client-portal-set-password', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brand,
      orgId: getOrgId(),
      users,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: payload.error || 'Could not save portal passwords.' };
  }

  return { ok: true, users: payload.users || [] };
}
