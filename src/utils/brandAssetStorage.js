import { supabase, SUPABASE_ENABLED } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import {
  ensureStaffSupabaseSession,
  hasStaffSupabaseSession,
} from '../lib/staffSupabaseAuth';

const BUCKET = 'brand-assets';

/** True when this browser can upload directly to storage (staff Supabase session). */
export async function canUseBrandAssetStorage() {
  if (!SUPABASE_ENABLED || !supabase) return false;
  if (await hasStaffSupabaseSession()) return true;
  try {
    const ensured = await ensureStaffSupabaseSession();
    if (!ensured?.ok) return false;
  } catch {
    return false;
  }
  return hasStaffSupabaseSession();
}

function sanitizeSegment(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}

function fileExtension(fileName, mimeType) {
  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  if (match) return `.${match[1]}`;
  if (mimeType === 'application/pdf') return '.pdf';
  return '';
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Upload one file to the brand-assets bucket; returns its public URL + storage path. */
export async function uploadBrandAssetFile(file, { brand, folder }) {
  if (!SUPABASE_ENABLED || !supabase) {
    throw new Error('Cloud storage is not available.');
  }
  const orgId = sanitizeSegment(getOrgId(), 'org');
  const brandSegment = sanitizeSegment(brand, 'brand');
  const folderSegment = sanitizeSegment(folder, 'general');
  const ext = fileExtension(file?.name, file?.type);
  const path = `${orgId}/${brandSegment}/${folderSegment}/${randomId()}${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file?.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) {
    throw new Error(error.message || 'Could not upload file to storage.');
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) {
    throw new Error('Upload succeeded but no file URL was returned.');
  }
  return { url, path };
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
