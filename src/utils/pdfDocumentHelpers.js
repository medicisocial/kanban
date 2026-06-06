/** Cap retina scaling so first-page render stays fast on 3x displays. */
export const PREVIEW_MAX_DEVICE_PIXEL_RATIO = 2;

export function capDevicePixelRatio(dpr, max = PREVIEW_MAX_DEVICE_PIXEL_RATIO) {
  return Math.min(Math.max(Number(dpr) || 1, 1), max);
}

export function previewDevicePixelRatio() {
  if (typeof window === 'undefined') return 1;
  return capDevicePixelRatio(window.devicePixelRatio || 1);
}

export function classifyPdfSource(source) {
  const url = String(source || '').trim();
  if (!url) return 'invalid';
  if (url.startsWith('data:')) return 'data';
  if (url.startsWith('blob:')) return 'blob';
  if (/^https?:\/\//i.test(url)) return 'remote';
  return 'invalid';
}
