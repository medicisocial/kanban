import { getRedis, loadWorkspace, saveWorkspace } from './redis.mjs';
import {
  getClientPortalAuthMap,
  hashValue,
  mergeClientPortalAuth,
  normalizeBrandUsers,
} from './clientPortalAuth.mjs';
import { fetchCollectionMap, isSupabaseConfigured, upsertRecord } from './supabase.mjs';

const CLIENT_PORTAL_AUTH_KEY = 'medici-client-portal-auth';

export async function loadClientAuthMap() {
  if (isSupabaseConfigured()) {
    try {
      const map = await fetchCollectionMap('client_portal_credentials');
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

export async function saveClientAuthMap(authMap) {
  if (isSupabaseConfigured()) {
    for (const [brand, entry] of Object.entries(authMap)) {
      if (brand.startsWith('__')) continue;
      const users = normalizeBrandUsers(entry);
      if (!users.length) continue;
      await upsertRecord('client_portal_credentials', brand, users);
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

export async function updateClientUserPassword({ brand, userId, username, newPassword }) {
  const authMap = await loadClientAuthMap();
  if (!authMap) throw new Error('Client portal credentials are not available.');

  const users = normalizeBrandUsers(authMap[brand]);
  if (!users.length) throw new Error('Client account not found.');

  const passwordHash = hashValue(newPassword);
  let updated = false;

  const nextUsers = users.map((user) => {
    const matches =
      user.id === userId ||
      user.username.trim().toLowerCase() === String(username || '').trim().toLowerCase();
    if (!matches) return user;
    updated = true;
    return { ...user, passwordHash };
  });

  if (!updated) throw new Error('Client account not found.');

  authMap[brand] = nextUsers;
  await saveClientAuthMap({ [brand]: nextUsers });
  return true;
}
