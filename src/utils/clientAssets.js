export const CLIENT_ASSETS_STORAGE_KEY = 'medici-social-client-assets';

export const OPUS_FONT_FAMILIES = [
  'Inter',
  'Arial',
  'Helvetica',
  'Montserrat',
  'Poppins',
  'Bebas Neue',
  'Oswald',
  'Roboto',
  'Playfair Display',
  'Georgia',
  'Custom',
];

export const OPUS_STYLE_KEYS = [
  { key: 'headline', label: 'Headline' },
  { key: 'subtitle', label: 'Subtitle' },
  { key: 'caption', label: 'Caption' },
  { key: 'cta', label: 'Call to action' },
];

export const ASSET_CATEGORIES = ['Logo', 'Icon', 'Template', 'Photo', 'Video', 'Other'];

export function createDefaultOpusTextStyle(overrides = {}) {
  return {
    fontFamily: 'Inter',
    fontSize: 42,
    fontWeight: 700,
    color: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 2,
    letterSpacing: 0,
    lineHeight: 1.15,
    textAlign: 'center',
    backgroundColor: '#000000',
    backgroundOpacity: 0.45,
    backgroundPadding: 10,
    borderRadius: 6,
    textTransform: 'none',
    ...overrides,
  };
}

export function createDefaultClientAssets(clientColor = '#810100') {
  return {
    branding: {
      logoUrl: '',
      logoDarkUrl: '',
      primaryColor: clientColor,
      secondaryColor: '#f9f6f2',
      accentColor: clientColor,
      guidelinesUrl: '',
      fonts: [],
      assets: [],
      notes: '',
    },
    opusAi: {
      headline: createDefaultOpusTextStyle({ fontSize: 52, fontWeight: 800 }),
      subtitle: createDefaultOpusTextStyle({ fontSize: 36, fontWeight: 600 }),
      caption: createDefaultOpusTextStyle({
        fontSize: 28,
        fontWeight: 500,
        textAlign: 'left',
        backgroundOpacity: 0.35,
      }),
      cta: createDefaultOpusTextStyle({
        fontSize: 32,
        fontWeight: 700,
        backgroundOpacity: 0.75,
        accentColor: clientColor,
      }),
    },
  };
}

export function normalizeOpusTextStyle(raw, defaults) {
  if (!raw || typeof raw !== 'object') {
    return { ...defaults };
  }

  const color =
    parseHexColor(raw.color) ||
    parseHexColor(raw.textColor) ||
    defaults.color;
  const strokeColor = parseHexColor(raw.strokeColor) || defaults.strokeColor;
  const backgroundColor = parseHexColor(raw.backgroundColor) || defaults.backgroundColor;

  const { textColor: _textColor, ...rest } = raw;

  return {
    ...defaults,
    ...rest,
    color,
    strokeColor,
    backgroundColor,
  };
}

export function sanitizeOpusAiForStorage(opusAi) {
  if (!opusAi || typeof opusAi !== 'object') return opusAi;

  const sanitized = {};
  for (const key of OPUS_STYLE_KEYS.map(({ key: styleKey }) => styleKey)) {
    const style = opusAi[key];
    if (!style || typeof style !== 'object') continue;

    const { textColor, ...rest } = style;
    sanitized[key] = {
      ...rest,
      color: parseHexColor(rest.color) || parseHexColor(textColor) || '#ffffff',
      strokeColor: parseHexColor(rest.strokeColor) || '#000000',
      backgroundColor: parseHexColor(rest.backgroundColor) || '#000000',
    };
  }

  return sanitized;
}

export function normalizeClientAssets(raw, clientColor = '#810100') {
  if (!raw || typeof raw !== 'object') {
    return createDefaultClientAssets(clientColor);
  }

  const defaults = createDefaultClientAssets(clientColor);

  return {
    branding: {
      ...defaults.branding,
      ...raw.branding,
      primaryColor: parseHexColor(raw.branding?.primaryColor) ?? defaults.branding.primaryColor,
      secondaryColor: parseHexColor(raw.branding?.secondaryColor) ?? defaults.branding.secondaryColor,
      accentColor: parseHexColor(raw.branding?.accentColor) ?? defaults.branding.accentColor,
      fonts: Array.isArray(raw.branding?.fonts) ? raw.branding.fonts : defaults.branding.fonts,
      assets: Array.isArray(raw.branding?.assets) ? raw.branding.assets : [],
    },
    opusAi: {
      headline: normalizeOpusTextStyle(raw.opusAi?.headline, defaults.opusAi.headline),
      subtitle: normalizeOpusTextStyle(raw.opusAi?.subtitle, defaults.opusAi.subtitle),
      caption: normalizeOpusTextStyle(raw.opusAi?.caption, defaults.opusAi.caption),
      cta: normalizeOpusTextStyle(raw.opusAi?.cta, defaults.opusAi.cta),
    },
  };
}

export function loadRawClientAssetsStore() {
  try {
    const stored = localStorage.getItem(CLIENT_ASSETS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    /* fall through */
  }
  return {};
}

export function loadClientAssetsStore() {
  return migrateClientAssetsStore(loadRawClientAssetsStore());
}

function normalizeStoreKey(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Match a client name to its key in the assets store (exact, then case-insensitive). */
export function resolveClientStoreKey(store, clientName, knownClients = []) {
  if (!clientName) return clientName;
  if (store?.[clientName]) return clientName;

  const target = normalizeStoreKey(clientName);

  for (const key of Object.keys(store || {})) {
    if (normalizeStoreKey(key) === target) {
      return key;
    }
  }

  for (const client of knownClients) {
    if (normalizeStoreKey(client) === target) {
      return client;
    }
  }

  return clientName;
}

/** Merge duplicate / legacy keys onto canonical client names from the clients list. */
export function reconcileClientAssetsStore(store, knownClients = []) {
  if (!store || typeof store !== 'object') return {};
  if (!knownClients.length) return { ...store };

  const next = { ...store };
  let changed = false;

  for (const client of knownClients) {
    const sourceKey = resolveClientStoreKey(next, client, knownClients);
    if (!next[sourceKey]) continue;

    if (sourceKey !== client) {
      next[client] = next[sourceKey];
      delete next[sourceKey];
      changed = true;
    }
  }

  if (changed) {
    localStorage.setItem(CLIENT_ASSETS_STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  return store;
}

export function readClientAssetsEntry(store, clientName, clientColor = '#810100', knownClients = []) {
  const key = resolveClientStoreKey(store, clientName, knownClients);
  return normalizeClientAssets(store[key], clientColor);
}

/** Persist one client profile — reads localStorage fresh, writes atomically. */
export function saveClientAssetsEntry(client, assets, knownClients = []) {
  const payload = JSON.parse(JSON.stringify(assets));
  if (!payload?.branding || !payload?.opusAi) {
    return null;
  }

  payload.opusAi = sanitizeOpusAiForStorage(payload.opusAi);

  const store = reconcileClientAssetsStore(loadClientAssetsStore(), knownClients);
  const canonicalClient = resolveClientStoreKey(store, client, knownClients);
  store[canonicalClient] = payload;
  const serialized = JSON.stringify(store);
  localStorage.setItem(CLIENT_ASSETS_STORAGE_KEY, serialized);

  const readBack = localStorage.getItem(CLIENT_ASSETS_STORAGE_KEY);
  if (readBack !== serialized) {
    return null;
  }

  return store;
}

/** Drop legacy root-level profile blobs; keep only client-keyed entries. */
export function migrateClientAssetsStore(parsed) {
  const migrated = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (!value || typeof value !== 'object') continue;
    if (value.branding && value.opusAi) {
      migrated[key] = value;
    }
  }

  return migrated;
}

export function previewHexColor(value, fallback = '#888888') {
  const parsed = parseHexColor(value);
  if (parsed) return parsed;

  if (!value || typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  const hex = withHash.slice(1);

  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length === 0) return fallback;

  if (hex.length <= 6) {
    return `#${hex.padEnd(6, '0').toLowerCase()}`;
  }

  return fallback;
}

export function parseHexColor(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  const hex = withHash.slice(1);

  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `#${hex.toLowerCase()}`;
  }

  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
  }

  return null;
}

export function toColorPickerHex(value, fallback = '#000000') {
  return parseHexColor(value) || fallback;
}

export function hexWithAlpha(hex, alpha) {
  if (!hex || alpha <= 0) return 'transparent';
  const parsed = parseHexColor(hex);
  if (!parsed) return 'transparent';
  const normalized = parsed.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

export function getOpusPreviewStyle(style, scale = 0.55) {
  const textColor = parseHexColor(style.color) || style.color || '#ffffff';
  const strokeColor = parseHexColor(style.strokeColor) || style.strokeColor || '#000000';
  const bg =
    style.backgroundOpacity > 0
      ? hexWithAlpha(style.backgroundColor, style.backgroundOpacity)
      : 'transparent';

  return {
    fontFamily: style.fontFamily,
    fontSize: `${Math.round(style.fontSize * scale)}px`,
    fontWeight: style.fontWeight,
    color: textColor,
    WebkitTextStroke:
      style.strokeWidth > 0 ? `${style.strokeWidth * scale}px ${strokeColor}` : undefined,
    letterSpacing: `${style.letterSpacing}px`,
    lineHeight: style.lineHeight,
    textAlign: style.textAlign,
    textTransform: style.textTransform,
    backgroundColor: bg,
    padding: `${style.backgroundPadding * scale}px`,
    borderRadius: `${style.borderRadius * scale}px`,
    display: 'inline-block',
    maxWidth: '100%',
  };
}
