import { getOrgId, LEGACY_ORG_ID } from './orgSession.js';
import { isCloudSourceOfTruth } from './cloudSourceOfTruth.js';

const CLIENTS_NAMES_CACHE_KEY = 'medici-social-clients';

/** Namespace localStorage by org so SaaS workspaces don't share Medici browser cache. */
export function orgScopedKey(baseKey, orgId) {
  const id = orgId || getOrgId();
  if (!id || id === LEGACY_ORG_ID) return baseKey;
  return `${baseKey}@${id}`;
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

/** The workspace collection keys that are org-scoped in localStorage. */
export const WORKSPACE_CACHE_KEYS = [
  'medici-social-kanban',
  'medici-social-video-ideas',
  'medici-social-events',
  'medici-social-meetings',
  'medici-social-admin-tasks',
  'medici-social-shoot-plans',
  'medici-social-team',
  'medici-social-clients',
  'medici-client-portal-auth',
];

/**
 * Remove the org-scoped localStorage cache for the given org.
 * Call on logout (so the next user starts clean) and on SaaS login
 * (so stale data from a previous session doesn't contaminate the merge).
 */
export function clearOrgScopedCache(orgId) {
  if (!orgId || orgId === LEGACY_ORG_ID) return;
  for (const key of WORKSPACE_CACHE_KEYS) {
    localStorage.removeItem(orgScopedKey(key, orgId));
  }
}

function readNamesBootstrapCache() {
  try {
    const raw = localStorage.getItem(CLIENTS_NAMES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.names) && parsed.names.length) {
      return { names: parsed.names };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Clear workspace cache on login/logout. Also clears legacy base keys for the
 * primary org when cloud sync is enabled so stale localStorage cannot merge in.
 * In cloud mode, preserve the client names bootstrap (refreshed from client_records).
 */
export function clearSyncedWorkspaceCache(orgId) {
  clearOrgScopedCache(orgId);
  if (!orgId || orgId === LEGACY_ORG_ID) {
    const namesBootstrap = isCloudSourceOfTruth() ? readNamesBootstrapCache() : null;
    for (const key of WORKSPACE_CACHE_KEYS) {
      localStorage.removeItem(key);
    }
    if (namesBootstrap) {
      localStorage.setItem(CLIENTS_NAMES_CACHE_KEY, JSON.stringify(namesBootstrap));
    }
  }
}
