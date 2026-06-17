import { getOrgId } from '../lib/orgSession';
import { buildStaffApiAuthHeaders } from '../lib/staffApiAuth';
import { fetchWithTimeout } from './withTimeout';

const STAFF_BRAND_ASSETS_TIMEOUT_MS = 60000;

async function buildAuthHeaders() {
  return buildStaffApiAuthHeaders();
}

export async function saveStaffBrandAssets({ brand, companyFiles, specialMenus }) {
  const headers = await buildAuthHeaders();
  if (!headers) {
    return { ok: false, error: 'Staff sign-in required to save brand assets.' };
  }

  const response = await fetchWithTimeout(
    '/api/staff-brand-assets',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        brand,
        orgId: getOrgId(),
        ...(companyFiles !== undefined ? { companyFiles } : {}),
        ...(specialMenus !== undefined ? { specialMenus } : {}),
      }),
    },
    STAFF_BRAND_ASSETS_TIMEOUT_MS,
  );

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
