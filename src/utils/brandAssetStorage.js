import { supabase, SUPABASE_ENABLED } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { loadStaffSession } from './staffAuth';
import { loadUsableClientSession } from './clientPortalAuth';
import { fetchWithTimeout, withTimeout } from './withTimeout';

const BUCKET = 'brand-assets';
const SIGN_UPLOAD_TIMEOUT_MS = 30000;
const STORAGE_UPLOAD_TIMEOUT_MS = 120000;

function clientPortalSession() {
  try {
    return loadUsableClientSession();
  } catch {
    return null;
  }
}

/**
 * Auth headers for the signed-upload endpoint. Works for both the staff (agency)
 * app and the client portal — whichever session this browser holds.
 */
async function buildUploadAuthHeaders() {
  const staff = loadStaffSession();
  if (staff?.username && staff?.signature) {
    return {
      Authorization: `Bearer ${btoa(JSON.stringify(staff))}`,
      'Content-Type': 'application/json',
    };
  }

  const client = clientPortalSession();
  if (client?.signature) {
    return {
      Authorization: `Bearer ${btoa(JSON.stringify(client))}`,
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

/**
 * Synchronous check for whether this browser can use storage uploads at all.
 * Both staff and client-portal sessions qualify — the server signs the upload with
 * the service role, so no Supabase auth session is required.
 */
export function canUploadBrandAssetToStorage() {
  if (!SUPABASE_ENABLED || !supabase) return false;
  const staff = loadStaffSession();
  if (staff?.username && staff?.signature) return true;
  return Boolean(clientPortalSession()?.signature);
}

/** True when the server cannot sign storage uploads (missing service role, etc.). */
export function isStorageSignUnavailableError(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('storage is not configured') ||
    text.includes('could not start upload') ||
    text.includes('cloud sync is not configured')
  );
}

/** Async probe — includes Supabase JWT staff sessions not covered by the sync check. */
export async function probeBrandAssetStorageReady() {
  if (!SUPABASE_ENABLED || !supabase) return false;
  if (canUploadBrandAssetToStorage()) return true;
  try {
    const { data } = await Promise.race([
      supabase.auth.getSession(),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 2000)),
    ]);
    return Boolean(data?.session?.access_token);
  } catch {
    return false;
  }
}

/**
 * Upload a file to the brand-assets bucket via a server-issued signed URL. The file
 * goes straight to Supabase Storage, bypassing the serverless body limit, and works
 * for client-portal users who have no Supabase auth session.
 */
export async function uploadBrandAssetToStorage(file, { brand, folder }) {
  if (!SUPABASE_ENABLED || !supabase) {
    throw new Error('Cloud storage is not available.');
  }

  const headers = await buildUploadAuthHeaders();
  if (!headers) {
    throw new Error('Please sign in again to upload files.');
  }

  const client = clientPortalSession();
  const staff = loadStaffSession();
  const orgId = client?.orgId || staff?.orgId || getOrgId();

  const res = await fetchWithTimeout(
    '/api/brand-asset-sign-upload',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        brand,
        folder,
        orgId,
        fileName: file?.name || 'file',
        contentType: file?.type || 'application/octet-stream',
      }),
    },
    SIGN_UPLOAD_TIMEOUT_MS,
  );

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.token || !payload?.path) {
    throw new Error(payload?.error || 'Could not upload file.');
  }

  await putFileToSignedUploadUrl({
    path: payload.path,
    token: payload.token,
    file,
    contentType: file?.type || 'application/octet-stream',
  });

  return { url: payload.publicUrl, path: payload.path };
}

/** PUT to the signed URL with an abortable fetch (supabase-js has no upload timeout). */
async function putFileToSignedUploadUrl({ path, token, file, contentType }) {
  const base = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!base) {
    throw new Error('Cloud storage URL is not configured.');
  }

  const url = `${base}/storage/v1/object/upload/sign/${BUCKET}/${path}?token=${encodeURIComponent(token)}`;
  const body = new FormData();
  body.append('cacheControl', '3600');
  body.append('', file);

  const res = await fetchWithTimeout(
    url,
    {
      method: 'PUT',
      headers: {
        ...(anonKey ? { apikey: anonKey } : {}),
        'x-upsert': 'false',
      },
      body,
    },
    STORAGE_UPLOAD_TIMEOUT_MS,
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || 'Could not upload file to storage.');
  }
}

/** Best-effort delete of a storage object by path. */
export async function deleteBrandAssetFile(path) {
  if (!path || !SUPABASE_ENABLED || !supabase) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    /* ignore — orphaned objects are harmless */
  }
}
