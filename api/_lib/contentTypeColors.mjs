const CUSTOMIZABLE_CONTENT_TYPES = [
  'Reel',
  'Story',
  'Carousel',
  'Static Post',
  'One-off Project',
];

export function normalizeContentTypeColors(source = {}) {
  const normalized = {};
  for (const type of CUSTOMIZABLE_CONTENT_TYPES) {
    const value = source[type];
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())) {
      normalized[type] = value.trim().toLowerCase();
    }
  }
  return normalized;
}
