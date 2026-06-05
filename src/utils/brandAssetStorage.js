import { supabase, SUPABASE_ENABLED } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { loadStaffSession } from './staffAuth';
import { loadUsableClientSession } from './clientPortalAuth';

const BUCKET = 'brand-assets';

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

  const res = await fetch('/api/brand-asset-sign-upload', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      brand,
      folder,
      orgId: getOrgId(),
      fileName: file?.name || 'file',
      contentType: file?.type || 'application/octet-stream',
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.token || !payload?.path) {
    throw new Error(payload?.error || 'Could not upload file.');
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(payload.path, payload.token, file, {
      contentType: file?.type || 'application/octet-stream',
    });
  if (error) {
    throw new Error(error.message || 'Could not upload file to storage.');
  }

  return { url: payload.publicUrl, path: payload.path };
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
