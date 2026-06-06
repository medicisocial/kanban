import { CLIENT_PORTAL_PASSWORD_VAULT_KEY, CLIENTS_STORAGE_KEY } from '../constants';
import { readOrgScopedJson } from '../lib/orgStorage';

function readCloudVault() {
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
export function loadPortalPasswordVault() {
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
  return merged;
}

export function savePortalPasswordVault(vault) {
  localStorage.setItem(CLIENT_PORTAL_PASSWORD_VAULT_KEY, JSON.stringify(vault));
}

export function getPortalPasswordForUser(client, userId) {
  if (!client || !userId) return '';
  return loadPortalPasswordVault()[client]?.[userId] || '';
}

export function updatePortalPasswordVault(client, draftUsers, savedUsers) {
  if (!client) return;

  const vault = loadPortalPasswordVault();
  const clientVault = { ...(vault[client] || {}) };

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

  vault[client] = clientVault;
  savePortalPasswordVault(vault);
}
