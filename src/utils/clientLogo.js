export const DEFAULT_LOGO_CROP = { zoom: 1, x: 50, y: 50 };

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

function clampPercent(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 50;
  return Math.min(100, Math.max(0, num));
}
