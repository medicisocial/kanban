import { encodeCanvas, loadImage } from './clientImage';

export const DEFAULT_LOGO_CROP = { zoom: 1, x: 50, y: 50 };
export const LOGO_OUTPUT_SIZE = 512;

export function normalizeClientLogo(logo) {
  if (!logo) return null;
  if (typeof logo === 'string') {
    return { src: logo, ...DEFAULT_LOGO_CROP };
  }
  if (typeof logo === 'object' && logo.src) {
    return {
      src: logo.src,
      zoom: Math.min(3, Math.max(1, Number(logo.zoom) || 1)),
      x: clampPercent(logo.x ?? 50),
      y: clampPercent(logo.y ?? 50),
    };
  }
  return null;
}

export function getLogoSrc(logo) {
  return normalizeClientLogo(logo)?.src || null;
}

export function serializeClientLogo(logo) {
  const normalized = normalizeClientLogo(logo);
  if (!normalized) return null;
  return {
    src: normalized.src,
    zoom: Math.round(normalized.zoom * 100) / 100,
    x: Math.round(normalized.x),
    y: Math.round(normalized.y),
  };
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
export async function bakeLogoCrop(logo, outputSize = LOGO_OUTPUT_SIZE) {
  const normalized = normalizeClientLogo(logo);
  if (!normalized?.src) return null;

  const img = await loadImage(normalized.src);
  const { zoom, x, y } = normalized;

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not render photo.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const coverScale = Math.max(outputSize / img.width, outputSize / img.height) * zoom;
  const drawW = img.width * coverScale;
  const drawH = img.height * coverScale;
  const drawX = (outputSize - drawW) * (x / 100);
  const drawY = (outputSize - drawH) * (y / 100);

  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  return serializeClientLogo({
    src: encodeCanvas(canvas),
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
