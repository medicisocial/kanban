import { getRedis, loadWorkspace, saveWorkspace } from './redis.mjs';
import { getClientPortalAuthMap, hashValue, mergeClientPortalAuth, normalizeBrandUsers } from './clientPortalAuth.mjs';
import {
  fetchCollectionMap,
  isSupabaseConfigured,
  patchClientsPortalPasswordVault,
  upsertRecord,
  deleteRecord,
} from './supabase.mjs';
import { hasConfiguredPortalUsers, mergePortalCredentialData } from './authCriticalSync.mjs';

const CLIENT_PORTAL_AUTH_KEY = 'medici-client-portal-auth';
const CLIENTS_WORKSPACE_ID = 'workspace';

async function updatePortalPasswordVaultInClientsWorkspace({ orgId, brand, userId, password }) {
  if (!brand || !userId) return;
  const trimmedPassword = String(password).trim();

  if (isSupabaseConfigured()) {
    const brandVault = { [userId]: trimmedPassword };
    await patchClientsPortalPasswordVault(brand, brandVault, orgId);
    return;
  }

  const redis = getRedis();
  if (!redis) return;

  const workspace = (await loadWorkspace(redis)) || {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'medici-social-kanban',
    data: {},
  };
  workspace.data = workspace.data || {};
  const clientsKey = 'medici-social-clients';
  const existing = workspace.data[clientsKey] || {};
  const vault = { ...(existing.portalPasswordVault || {}) };
  const brandVault = { ...(vault[brand] || {}) };
  brandVault[userId] = trimmedPassword;
  vault[brand] = brandVault;
  workspace.data[clientsKey] = { ...existing, portalPasswordVault: vault };
  workspace.exportedAt = new Date().toISOString();
  await saveWorkspace(redis, workspace);
}

export async function loadClientAuthMap(orgId) {
  if (isSupabaseConfigured()) {
    try {
      const map = await fetchCollectionMap('client_portal_credentials', orgId);
      if (map) return map;
    } catch (error) {
      console.error('[clientCredentialsStore] Supabase fetch failed:', error?.message || error);
    }
  }

  const redis = getRedis();
  if (!redis) return null;
  const workspace = await loadWorkspace(redis);
  return getClientPortalAuthMap(workspace);
}

export async function saveClientAuthMap(authMap, orgId) {
  if (isSupabaseConfigured()) {
    let existingMap = {};
    try {
      existingMap = (await fetchCollectionMap('client_portal_credentials', orgId)) || {};
    } catch (error) {
      console.error('[clientCredentialsStore] existing credential fetch failed:', error?.message || error);
    }

    for (const [brand, entry] of Object.entries(authMap)) {
      if (brand.startsWith('__')) continue;
      const users = mergePortalCredentialData(existingMap[brand], entry);
      if (!hasConfiguredPortalUsers(users)) {
        if (hasConfiguredPortalUsers(existingMap[brand])) {
          console.warn(`[clientCredentialsStore] skipped empty save for ${brand}`);
          continue;
        }
        await deleteRecord('client_portal_credentials', brand, orgId);
        continue;
      }
      await upsertRecord('client_portal_credentials', brand, users, orgId);
    }
    return;
  }

  const redis = getRedis();
  if (!redis) throw new Error('Cloud sync is not configured.');

  const workspace = (await loadWorkspace(redis)) || {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'medici-social-kanban',
    data: {},
  };
  workspace.data = workspace.data || {};
  workspace.data[CLIENT_PORTAL_AUTH_KEY] = mergeClientPortalAuth(
    workspace.data[CLIENT_PORTAL_AUTH_KEY] || {},
    authMap,
  );
  workspace.exportedAt = new Date().toISOString();
  await saveWorkspace(redis, workspace);
}

export async function updateClientUserPassword({ brand, userId, username, newPassword, orgId }) {
  const authMap = await loadClientAuthMap(orgId);
  if (!authMap) throw new Error('Client portal credentials are not available.');

  const users = normalizeBrandUsers(authMap[brand]);
  if (!users.length) throw new Error('Client account not found.');

  const trimmedPassword = String(newPassword).trim();
  const passwordHash = hashValue(trimmedPassword);
  let updated = false;
  let resolvedUserId = userId;

  const nextUsers = users.map((user) => {
    const matches =
      user.id === userId ||
      user.username.trim().toLowerCase() === String(username || '').trim().toLowerCase();
    if (!matches) return user;
    updated = true;
    resolvedUserId = user.id;
    return { ...user, passwordHash };
  });

  if (!updated) throw new Error('Client account not found.');

  authMap[brand] = nextUsers;
  await saveClientAuthMap({ [brand]: nextUsers }, orgId);
  await updatePortalPasswordVaultInClientsWorkspace({
    orgId,
    brand,
    userId: resolvedUserId,
    password: trimmedPassword,
  });
  return true;
}
