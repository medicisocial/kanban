import { CLIENT_PORTAL_PASSWORD_VAULT_KEY, CLIENTS_STORAGE_KEY } from '../constants';
import { readOrgScopedJson } from '../lib/orgStorage';
import { isCloudSourceOfTruth } from '../lib/cloudSourceOfTruth';
import { clientNamesConflict } from './clients';
import {
  fetchPortalPasswordVaultFromApi,
  patchPortalPasswordVaultViaApi,
} from './portalPasswordVaultApi';

/** In-memory vault cache for cloud mode (no localStorage). */
const cloudVaultCache = {};

function readCloudVault() {
  if (isCloudSourceOfTruth()) return cloudVaultCache;
  try {
    const clients = readOrgScopedJson(CLIENTS_STORAGE_KEY, null);
    if (clients?.portalPasswordVault && typeof clients.portalPasswordVault === 'object') {
      return clients.portalPasswordVault;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function readLocalVault() {
  if (isCloudSourceOfTruth()) return cloudVaultCache;
  try {
    const raw = localStorage.getItem(CLIENT_PORTAL_PASSWORD_VAULT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    /* ignore */
  }
  return {};
}

/**
 * Merge the cloud-synced vault (clients workspace) with the local write-through
 * cache. Local entries win so a password saved on this device always re-displays
 * after refresh, even before the cloud workspace finishes syncing.
 */
export function collapsePortalPasswordVaultBrandKeys(vault = {}) {
  const merged = {};
  for (const [brand, users] of Object.entries(vault || {})) {
    if (!users || typeof users !== 'object') continue;
    let canonical = Object.keys(merged).find((key) => clientNamesConflict(key, brand));
    if (!canonical) {
      canonical = brand.trim().toLowerCase();
      merged[canonical] = {};
    }
    merged[canonical] = { ...merged[canonical], ...users };
  }
  return merged;
}

export function loadPortalPasswordVault() {
  if (isCloudSourceOfTruth()) {
    return collapsePortalPasswordVaultBrandKeys(cloudVaultCache);
  }

  const cloud = readCloudVault();
  const local = readLocalVault();
  const merged = {};
  const brands = new Set([...Object.keys(cloud), ...Object.keys(local)]);
  for (const brand of brands) {
    merged[brand] = {
      ...(cloud[brand] && typeof cloud[brand] === 'object' ? cloud[brand] : {}),
      ...(local[brand] && typeof local[brand] === 'object' ? local[brand] : {}),
    };
  }
  return collapsePortalPasswordVaultBrandKeys(merged);
}

export function savePortalPasswordVault(vault) {
  const collapsed = collapsePortalPasswordVaultBrandKeys(vault);
  if (isCloudSourceOfTruth()) {
    for (const key of Object.keys(cloudVaultCache)) {
      delete cloudVaultCache[key];
    }
    Object.assign(cloudVaultCache, collapsed);
    return;
  }
  localStorage.setItem(CLIENT_PORTAL_PASSWORD_VAULT_KEY, JSON.stringify(collapsed));
}

/** Merge API-fetched vault entries into the vault cache for one brand. */
export function hydratePortalPasswordVaultForBrand(client, brandVault, { vaultBrandKey = client } = {}) {
  if (!client || !brandVault || typeof brandVault !== 'object') return;

  const vault = loadPortalPasswordVault();
  const brandKey = vaultBrandKey || client;
  vault[brandKey] = { ...(vault[brandKey] || {}), ...brandVault };

  for (const key of Object.keys(vault)) {
    if (key !== brandKey && clientNamesConflict(key, client)) {
      delete vault[key];
    }
  }

  savePortalPasswordVault(vault);
}

/** Fetch one brand's vault from the service API (cloud mode). */
export async function loadPortalPasswordVaultForBrand(client) {
  if (!isCloudSourceOfTruth() || !client) return { ok: true, vault: {} };
  const result = await fetchPortalPasswordVaultFromApi(client);
  if (result.ok && result.vault) {
    hydratePortalPasswordVaultForBrand(client, result.vault);
  }
  return result;
}

/** Resolve vault map key when display name differs from credential brand id (e.g. "Ara Med Spa" vs "ara med spa"). */
export function resolvePortalVaultBrandKey(vault, client) {
  if (!client) return client;
  const collapsed = collapsePortalPasswordVaultBrandKeys(vault);
  const match = Object.keys(collapsed).find((key) => clientNamesConflict(key, client));
  return match || client.trim().toLowerCase();
}

export function getPortalPasswordForUser(client, userId) {
  if (!client || !userId) return '';

  const vault = loadPortalPasswordVault();
  const brandKey = resolvePortalVaultBrandKey(vault, client);
  return vault[brandKey]?.[userId] ? String(vault[brandKey][userId]).trim() : '';
}

export async function updatePortalPasswordVault(client, draftUsers, savedUsers, { vaultBrandKey = client } = {}) {
  if (!client) return { ok: true };

  const vault = loadPortalPasswordVault();
  const brandKey = vaultBrandKey || client;
  const clientVault = { ...(vault[brandKey] || {}) };

  for (const draft of draftUsers) {
    const saved =
      savedUsers.find((user) => user.id === draft.id) ||
      savedUsers.find(
        (user) => user.username.toLowerCase() === draft.username.trim().toLowerCase(),
      );
    const userId = saved?.id || draft.id;
    if (!userId) continue;

    if (draft.password) {
      clientVault[userId] = String(draft.password).trim();
    }
  }

  const savedIds = new Set(savedUsers.map((user) => user.id));
  for (const userId of Object.keys(clientVault)) {
    if (!savedIds.has(userId)) {
      delete clientVault[userId];
    }
  }

  vault[brandKey] = clientVault;
  for (const key of Object.keys(vault)) {
    if (key !== brandKey && clientNamesConflict(key, client)) {
      delete vault[key];
    }
  }

  const collapsed = collapsePortalPasswordVaultBrandKeys(vault);
  savePortalPasswordVault(collapsed);

  if (isCloudSourceOfTruth()) {
    const brandVault = collapsed[brandKey] || collapsed[client.trim().toLowerCase()] || clientVault;
    return patchPortalPasswordVaultViaApi(brandKey, brandVault);
  }

  return { ok: true };
}
