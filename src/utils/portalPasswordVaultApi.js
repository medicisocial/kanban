import { getOrgId } from '../lib/orgSession';
import { loadStaffSession } from './staffAuth';
import { SUPABASE_ENABLED, supabase } from '../lib/supabaseClient';
import { fetchWithTimeout } from './withTimeout';

const VAULT_API_TIMEOUT_MS = 30000;
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

export async function fetchPortalPasswordVaultFromApi(brand) {
  if (!SUPABASE_ENABLED || !brand) return { ok: false, vault: {} };

  const headers = await buildAuthHeaders();
  if (!headers) {
    return { ok: false, error: 'Staff sign-in required.', vault: {} };
  }

  try {
    const params = new URLSearchParams({
      brand: String(brand).trim().toLowerCase(),
      orgId: getOrgId(),
    });
    const response = await fetchWithTimeout(
      `/api/client-portal-vault?${params}`,
      { headers },
      VAULT_API_TIMEOUT_MS,
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: payload.error || 'Could not load portal vault.', vault: {} };
    }
    return { ok: true, vault: payload.vault && typeof payload.vault === 'object' ? payload.vault : {} };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Could not load portal vault.',
      vault: {},
    };
  }
}

export async function patchPortalPasswordVaultViaApi(brand, brandVault) {
  if (!SUPABASE_ENABLED || !brand) return { ok: true };

  const vault = brandVault && typeof brandVault === 'object' ? brandVault : {};
  if (!Object.keys(vault).length) return { ok: true };

  const headers = await buildAuthHeaders();
  if (!headers) {
    return { ok: false, error: 'Staff sign-in required to save portal vault.' };
  }

  try {
    const response = await fetchWithTimeout(
      '/api/client-portal-vault',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          brand: String(brand).trim().toLowerCase(),
          orgId: getOrgId(),
          brandVault: vault,
        }),
      },
      VAULT_API_TIMEOUT_MS,
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: payload.error || 'Could not save portal vault.' };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || 'Could not save portal vault.' };
  }
}
