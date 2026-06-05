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

export async function saveStaffBrandAssets({ brand, companyFiles, specialMenus }) {
  const headers = await buildAuthHeaders();
  if (!headers) {
    return { ok: false, error: 'Staff sign-in required to save brand assets.' };
  }

  const response = await fetch('/api/staff-brand-assets', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brand,
      orgId: getOrgId(),
      ...(companyFiles !== undefined ? { companyFiles } : {}),
      ...(specialMenus !== undefined ? { specialMenus } : {}),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: payload.error || 'Could not save brand assets.' };
  }

  return {
    ok: true,
    companyFiles: payload.companyFiles,
    specialMenus: payload.specialMenus,
  };
}
