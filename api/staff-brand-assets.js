import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { assertAuthorizedOrgId } from './_lib/orgContext.mjs';
import { fetchRecord, isSupabaseConfigured, upsertRecord } from './_lib/supabase.mjs';
import { patchBrandProfileRecord } from './_lib/brandRecordStore.mjs';
import { normalizeClientCompanyFiles } from './_lib/clientCompanyFiles.mjs';
import { normalizeClientSpecialMenus } from './_lib/clientSpecialMenus.mjs';

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function unavailable(res) {
  return res.status(503).json({ error: 'Cloud sync is not configured.' });
}

function isLikelyJwt(token) {
  return typeof token === 'string' && token.split('.').length === 3;
}

async function verifySupabaseAccessToken(token) {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey || !token) return false;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  return response.ok;
}

async function isAuthorized(req) {
  const staffSession = getSessionFromRequest(req);
  if (isStaffSessionValid(staffSession)) return true;

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  if (!isLikelyJwt(token)) return false;

  try {
    return await verifySupabaseAccessToken(token);
  } catch {
    return false;
  }
}

/**
 * Staff-only: save one brand's company files and/or special menus on the server
 * so menu PDFs are not lost to a stale workspace sync push.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await isAuthorized(req))) return unauthorized(res);
  if (!isSupabaseConfigured()) return unavailable(res);

  const { brand, companyFiles, specialMenus, orgId } = req.body || {};
  if (!brand) {
    return res.status(400).json({ error: 'Missing brand.' });
  }
  if (companyFiles === undefined && specialMenus === undefined) {
    return res.status(400).json({ error: 'Missing companyFiles or specialMenus.' });
  }

  const orgCheck = await assertAuthorizedOrgId(req, orgId);
  if (!orgCheck.ok) {
    return res.status(403).json({ error: orgCheck.error || 'Forbidden org scope.' });
  }
  const resolvedOrgId = orgCheck.orgId;

  try {
    const brandKey = String(brand).trim().toLowerCase();
    const workspace = (await fetchRecord('clients', 'workspace', resolvedOrgId)) || {};
    const businessType = workspace.businessTypes?.[brand] || '';
    const patch = { displayName: brand };

    if (companyFiles !== undefined) {
      if (!Array.isArray(companyFiles)) {
        return res.status(400).json({ error: 'companyFiles must be an array.' });
      }
      patch.companyFiles = normalizeClientCompanyFiles(companyFiles, businessType);
    }

    if (specialMenus !== undefined) {
      if (!Array.isArray(specialMenus)) {
        return res.status(400).json({ error: 'specialMenus must be an array.' });
      }
      patch.specialMenus = normalizeClientSpecialMenus(specialMenus);
    }

    await patchBrandProfileRecord(resolvedOrgId, brandKey, patch);

    return res.status(200).json({
      ok: true,
      companyFiles: patch.companyFiles,
      specialMenus: patch.specialMenus,
    });
  } catch (error) {
    console.error('[staff-brand-assets] failed:', error?.message || error);
    return res.status(500).json({ error: 'Could not save brand assets.' });
  }
}
