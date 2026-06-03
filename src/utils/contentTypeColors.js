export const CUSTOMIZABLE_CONTENT_TYPES = [
  'Reel',
  'Story',
  'Carousel',
  'Static Post',
  'One-off Project',
];

export const DEFAULT_CONTENT_TYPE_COLORS = {
  Reel: '#f59e0b',
  Story: '#3b82f6',
  Carousel: '#f472b6',
  'Static Post': '#810100',
  'One-off Project': '#a78bfa',
};

const DEFAULT_LABEL_CLASSES = {
  Reel: 'text-amber-300',
  Story: 'text-blue-300',
  Carousel: 'text-pink-300',
  'Static Post': 'text-[#fca5a5]',
  'One-off Project': 'text-violet-300',
  Shoot: 'text-[#fca5a5]',
};

let colorOverrides = null;

export function setContentTypeColorOverrides(colors) {
  colorOverrides = colors && typeof colors === 'object' ? colors : null;
}

export function getContentTypeColorOverrides() {
  return colorOverrides;
}

function hexToRgba(hex, alpha = 0.14) {
  const normalized = String(hex || '').trim().replace('#', '');
  if (normalized.length !== 6) return `rgba(129, 1, 0, ${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildTypeStyle(border, useDefaultLabel, contentType) {
  return {
    border,
    bg: hexToRgba(border, 0.32),
    badgeBg: hexToRgba(border, 0.48),
    label: useDefaultLabel
      ? DEFAULT_LABEL_CLASSES[contentType] || DEFAULT_LABEL_CLASSES['Static Post']
      : '',
    textColor: border,
  };
}

export function contentTypeCardStyle(typeStyle) {
  return {
    backgroundColor: typeStyle.bg,
    boxShadow: `inset 3px 0 0 ${typeStyle.border}`,
  };
}

/** Pipeline-matched surface for client/event/meeting calendar cards. */
export function accentCardStyle(accentColor, { bgAlpha = 0.32 } = {}) {
  const border = String(accentColor || '#810100').trim();
  return {
    backgroundColor: hexToRgba(border, bgAlpha),
    boxShadow: `inset 3px 0 0 ${border}`,
  };
}

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

export function buildContentTypeStyle(contentType, overrides = colorOverrides) {
  const custom = overrides?.[contentType];
  const border = custom || DEFAULT_CONTENT_TYPE_COLORS[contentType] || DEFAULT_CONTENT_TYPE_COLORS['Static Post'];

  if (custom) {
    return buildTypeStyle(border, false, contentType);
  }

  return buildTypeStyle(border, true, contentType);
}

/** Shared inline styles for deliverable badges (cards, tasks, calendars). */
export function contentTypeBadgeProps(typeStyle) {
  return {
    className: `rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeStyle.label || ''}`.trim(),
    style: {
      backgroundColor: typeStyle.badgeBg || typeStyle.bg,
      color: typeStyle.textColor || typeStyle.border,
    },
  };
}

/** Pill badge with optional extra classes (team tasks, review cards, etc.). */
export function contentTypePillProps(typeStyle, className = 'rounded-full px-2 py-0.5 text-[10px] font-semibold') {
  const badge = contentTypeBadgeProps(typeStyle);
  return {
    className: `${className} ${typeStyle.label || ''}`.trim(),
    style: badge.style,
  };
}

/** Text-only label (modal headers, timeline rows). */
export function contentTypeLabelProps(typeStyle, className = '') {
  return {
    className: className.trim(),
    style: { color: typeStyle.textColor || typeStyle.border },
  };
}
