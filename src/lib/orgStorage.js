import { getOrgId, LEGACY_ORG_ID } from './orgSession';

/** Namespace localStorage by org so SaaS workspaces don't share Medici browser cache. */
export function orgScopedKey(baseKey) {
  const orgId = getOrgId();
  if (!orgId || orgId === LEGACY_ORG_ID) return baseKey;
  return `${baseKey}@${orgId}`;
}

export function readOrgScopedJson(baseKey, fallback = null) {
  try {
    const scopedKey = orgScopedKey(baseKey);
    const scopedRaw = localStorage.getItem(scopedKey);
    if (scopedRaw !== null) return JSON.parse(scopedRaw);

    if (scopedKey !== baseKey) return fallback;

    const legacyRaw = localStorage.getItem(baseKey);
    if (legacyRaw !== null) return JSON.parse(legacyRaw);
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeOrgScopedJson(baseKey, value) {
  localStorage.setItem(orgScopedKey(baseKey), JSON.stringify(value));
}
