/**
 * Server-side org settings tombstone union — newest timestamp wins.
 * Prevents a stale tab from wiping removed_names with {}.
 */

const CLIENT_NAME_TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function pruneTsMap(map, now) {
  const out = {};
  if (map && typeof map === 'object') {
    for (const [key, value] of Object.entries(map)) {
      const ts = Number(value) || 0;
      if (ts && now - ts <= CLIENT_NAME_TOMBSTONE_TTL_MS) out[key] = ts;
    }
  }
  return out;
}

function unionTsMap(a, b, now) {
  const out = pruneTsMap(a, now);
  const other = pruneTsMap(b, now);
  for (const [key, ts] of Object.entries(other)) {
    if (!out[key] || ts > out[key]) out[key] = ts;
  }
  return out;
}

export function mergeClientNameTombstones(stored = {}, incoming = {}, now = Date.now()) {
  return {
    removedNames: unionTsMap(stored?.removedNames, incoming?.removedNames, now),
    restoredNames: unionTsMap(stored?.restoredNames, incoming?.restoredNames, now),
  };
}

/** Merge incoming settings onto an existing org_workspace_settings row. */
export function mergeOrgWorkspaceSettingsWrite(existing = null, incoming = {}) {
  const stored = existing
    ? {
        removedNames: existing.removed_names || existing.removedNames || {},
        restoredNames: existing.restored_names || existing.restoredNames || {},
        contentTypeColors: existing.content_type_colors || existing.contentTypeColors,
        customColorPalette: existing.custom_color_palette || existing.customColorPalette,
      }
    : {};

  const tombstones = mergeClientNameTombstones(stored, incoming);
  return {
    removed_names: tombstones.removedNames,
    restored_names: tombstones.restoredNames,
    content_type_colors:
      incoming.contentTypeColors !== undefined
        ? incoming.contentTypeColors || {}
        : stored.contentTypeColors || {},
    custom_color_palette:
      incoming.customColorPalette !== undefined
        ? incoming.customColorPalette || []
        : Array.isArray(stored.customColorPalette)
          ? stored.customColorPalette
          : [],
  };
}
