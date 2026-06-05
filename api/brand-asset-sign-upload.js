import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import { assertAuthorizedOrgId } from './_lib/orgContext.mjs';
import { getClientSessionFromRequest, isClientSessionValid } from './_lib/clientPortalAuth.mjs';
import { isSupabaseConfigured } from './_lib/supabase.mjs';

const BUCKET = 'brand-assets';
const ALLOWED_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'zip']);

function storageConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, serviceKey };
}

function sanitizeSegment(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}

function fileExtension(fileName, contentType) {
  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  if (match && ALLOWED_EXT.has(match[1])) return `.${match[1] === 'jpeg' ? 'jpg' : match[1]}`;
  if (contentType === 'application/pdf') return '.pdf';
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/jpeg') return '.jpg';
  if (contentType === 'image/webp') return '.webp';
  if (contentType === 'image/svg+xml') return '.svg';
  if (contentType === 'application/zip') return '.zip';
  return '';
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Authorize a signed-upload request from either a staff (agency) session or a
 * client-portal session. Client-portal callers may only upload for their own brand.
 */
async function authorize(req, requestedBrand, requestedOrgId) {
  // Staff: legacy signed session or a Supabase JWT mapped to an org membership.
  const orgCheck = await assertAuthorizedOrgId(req, requestedOrgId);
  if (orgCheck.ok) {
    return { ok: true, orgId: orgCheck.orgId, brand: requestedBrand };
  }

  // A valid staff session that fails the org scope check is a hard no.
  if (isStaffSessionValid(getSessionFromRequest(req))) {
    return { ok: false };
  }

  // Client portal: only the brand the session is scoped to.
  const clientSession = getClientSessionFromRequest(req);
  if (isClientSessionValid(clientSession)) {
    const sessionBrand = String(clientSession.brand || '').trim();
    if (sessionBrand && sessionBrand === String(requestedBrand || '').trim()) {
      return { ok: true, orgId: clientSession.orgId || 'medici', brand: sessionBrand };
    }
  }

  return { ok: false };
}

/**
 * Issue a short-lived signed upload URL for the brand-assets bucket. The browser
 * (staff or client portal) uploads the file directly to Supabase Storage, so PDFs
 * never travel through the serverless body limit. The service role does the signing,
 * so client-portal users (who have no Supabase auth session) can upload too.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Cloud sync is not configured.' });
  }

  const { brand, folder, fileName, contentType, orgId } = req.body || {};
  if (!brand) {
    return res.status(400).json({ error: 'Missing brand.' });
  }

  const auth = await authorize(req, brand, orgId);
  if (!auth.ok) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { url, serviceKey } = storageConfig();
  if (!url || !serviceKey) {
    return res.status(503).json({ error: 'Storage is not configured.' });
  }

  const ext = fileExtension(fileName, contentType);
  const path = `${sanitizeSegment(auth.orgId, 'org')}/${sanitizeSegment(auth.brand, 'brand')}/${sanitizeSegment(folder, 'general')}/${randomId()}${ext}`;

  try {
    const signRes = await fetch(`${url}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!signRes.ok) {
      const detail = await signRes.text().catch(() => '');
      console.error('[brand-asset-sign-upload] sign failed:', signRes.status, detail);
      return res.status(502).json({ error: 'Could not start upload.' });
    }

    const signJson = await signRes.json().catch(() => ({}));
    const signedUrl = signJson?.url || '';
    const tokenMatch = signedUrl.match(/[?&]token=([^&]+)/);
    const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
    if (!token) {
      console.error('[brand-asset-sign-upload] no token in sign response:', signedUrl);
      return res.status(502).json({ error: 'Could not start upload.' });
    }

    const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`;
    return res.status(200).json({ ok: true, path, token, publicUrl });
  } catch (error) {
    console.error('[brand-asset-sign-upload] failed:', error?.message || error);
    return res.status(500).json({ error: 'Could not start upload.' });
  }
}
