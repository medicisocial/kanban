import {
  BAKED_MAX_DATA_URL_LENGTH,
  IMAGE_BAKE_OUTPUT_SIZE,
  computeBakeOutputSize,
  encodeCanvas,
  loadImage,
} from './clientImage';
import {
  canUploadBrandAssetToStorage,
  uploadBrandAssetToStorage,
} from './brandAssetStorage';

export const DEFAULT_LOGO_CROP = { zoom: 1, x: 50, y: 50 };
export const LOGO_OUTPUT_SIZE = IMAGE_BAKE_OUTPUT_SIZE;

export function normalizeClientLogo(logo) {
  if (!logo) return null;
  if (typeof logo === 'string') {
    return { src: logo, ...DEFAULT_LOGO_CROP };
  }
  if (typeof logo === 'object' && logo.src) {
    const normalized = {
      src: logo.src,
      zoom: Math.min(3, Math.max(1, Number(logo.zoom) || 1)),
      x: clampPercent(logo.x ?? 50),
      y: clampPercent(logo.y ?? 50),
    };
    if (logo.storagePath) normalized.storagePath = String(logo.storagePath);
    if (Number.isFinite(Number(logo.updatedAt))) normalized.updatedAt = Number(logo.updatedAt);
    return normalized;
  }
  return null;
}

export function getLogoSrc(logo) {
  return normalizeClientLogo(logo)?.src || null;
}

export function serializeClientLogo(logo) {
  const normalized = normalizeClientLogo(logo);
  if (!normalized) return null;
  const serialized = {
    src: normalized.src,
    zoom: Math.round(normalized.zoom * 100) / 100,
    x: Math.round(normalized.x),
    y: Math.round(normalized.y),
  };
  if (normalized.storagePath) serialized.storagePath = normalized.storagePath;
  if (Number.isFinite(normalized.updatedAt)) serialized.updatedAt = normalized.updatedAt;
  return serialized;
}

export function logoCropStyle(crop) {
  const normalized = normalizeClientLogo(crop);
  if (!normalized) return {};
  return {
    objectFit: 'cover',
    objectPosition: `${normalized.x}% ${normalized.y}%`,
    transform: `scale(${normalized.zoom})`,
    transformOrigin: `${normalized.x}% ${normalized.y}%`,
  };
}

/** Render crop + zoom into a sharp square image (avoids grainy CSS upscaling). */
export async function bakeLogoCrop(logo, outputSize) {
  const normalized = normalizeClientLogo(logo);
  if (!normalized?.src) return null;

  const img = await loadImage(normalized.src);
  const { zoom, x, y } = normalized;
  const resolvedSize = outputSize ?? computeBakeOutputSize(img, zoom);

  const canvas = document.createElement('canvas');
  canvas.width = resolvedSize;
  canvas.height = resolvedSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not render photo.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const coverScale = Math.max(resolvedSize / img.width, resolvedSize / img.height) * zoom;
  const drawW = img.width * coverScale;
  const drawH = img.height * coverScale;
  const drawX = (resolvedSize - drawW) * (x / 100);
  const drawY = (resolvedSize - drawH) * (y / 100);

  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  return serializeClientLogo({
    src: encodeCanvas(canvas, {
      preferPng: true,
      maxLength: BAKED_MAX_DATA_URL_LENGTH,
    }),
    zoom: 1,
    x: 50,
    y: 50,
  });
}

export function needsLogoBake(logo) {
  const normalized = normalizeClientLogo(logo);
  if (!normalized?.src) return false;
  return (
    normalized.zoom !== 1 ||
    normalized.x !== 50 ||
    normalized.y !== 50
  );
}

function clampPercent(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 50;
  return Math.min(100, Math.max(0, num));
}

const DATA_URL_RE = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/;

function dataUrlToFile(dataUrl, baseName) {
  const match = DATA_URL_RE.exec(String(dataUrl || ''));
  if (!match) return null;
  const contentType = match[1] || 'image/png';
  const isBase64 = Boolean(match[2]);
  const raw = match[3];
  let bytes;
  if (isBase64) {
    const binary = atob(raw);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(raw));
  }
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('svg')
        ? 'svg'
        : 'jpg';
  return new File([bytes], `${baseName}.${ext}`, { type: contentType });
}

/**
 * Persist a logo image to the brand-assets bucket so the synced workspace blob
 * only ever carries a small URL — never a multi-hundred-KB base64 data URL.
 * Falls back to the inline data URL when storage is unavailable so logo edits
 * still work offline / when the service role isn't configured.
 */
export async function persistClientLogoToStorage(brand, logo) {
  const normalized = normalizeClientLogo(logo);
  if (!normalized?.src) return null;

  const stampNow = (extra = {}) => ({
    src: normalized.src,
    zoom: Math.round(normalized.zoom * 100) / 100,
    x: Math.round(normalized.x),
    y: Math.round(normalized.y),
    updatedAt: Date.now(),
    ...extra,
  });

  if (/^https?:\/\//i.test(normalized.src)) {
    return stampNow(normalized.storagePath ? { storagePath: normalized.storagePath } : {});
  }

  if (!normalized.src.startsWith('data:') || !brand || !canUploadBrandAssetToStorage()) {
    return stampNow();
  }

  try {
    const file = dataUrlToFile(normalized.src, 'logo');
    if (!file) return stampNow();
    const { url, path } = await uploadBrandAssetToStorage(file, { brand, folder: 'logos' });
    if (!url) return stampNow();
    return {
      src: url,
      storagePath: path,
      zoom: Math.round(normalized.zoom * 100) / 100,
      x: Math.round(normalized.x),
      y: Math.round(normalized.y),
      updatedAt: Date.now(),
    };
  } catch {
    return stampNow();
  }
}
