import { normalizeBrandUsers, hashValue } from './clientPortalAuth.mjs';
import { fetchCollectionMap, fetchRecord, upsertRecord } from './supabase.mjs';

export const AUTH_CRITICAL_SYNC_TABLES = new Set([
  'client_portal_credentials',
  'team_members',
]);

export function hasConfiguredPortalUsers(entry) {
  return normalizeBrandUsers(entry).some((user) => user.username && user.passwordHash);
}

/** Never replace configured portal users with an empty payload. */
export function mergePortalCredentialData(existingData, incomingData) {
  const existing = normalizeBrandUsers(existingData);
  const incoming = normalizeBrandUsers(incomingData);

  if (!incoming.length) return existing;
  if (!existing.length) return incoming;

  const existingById = new Map(existing.map((user) => [user.id, user]));
  const existingByUsername = new Map(
    existing.map((user) => [user.username.trim().toLowerCase(), user]),
  );

  const merged = [];
  const seen = new Set();

  for (const incomingUser of incoming) {
    const previous =
      existingById.get(incomingUser.id) ||
      existingByUsername.get(incomingUser.username.trim().toLowerCase());

    const passwordHash = incomingUser.passwordHash || previous?.passwordHash || '';
    const username = incomingUser.username || previous?.username || '';
    if (!passwordHash || !username) continue;

    const id = incomingUser.id || previous?.id;
    seen.add(id);
    merged.push({
      ...previous,
      ...incomingUser,
      id,
      username,
      passwordHash,
      displayName: incomingUser.displayName || previous?.displayName || '',
      avatar: Object.prototype.hasOwnProperty.call(incomingUser, 'avatar')
        ? incomingUser.avatar
        : previous?.avatar,
    });
  }

  for (const user of existing) {
    if (seen.has(user.id)) continue;
    if (user.username && user.passwordHash) merged.push(user);
  }

  return merged;
}

export function filterAuthCriticalDeletes(table, deleteIds, authDeleteConfirmed = false) {
  if (!AUTH_CRITICAL_SYNC_TABLES.has(table)) return deleteIds || [];
  if (authDeleteConfirmed) return deleteIds || [];
  if (!deleteIds?.length) return [];
  console.warn(
    `[auth-critical] blocked ${deleteIds.length} delete(s) on ${table} — pass authDeleteConfirmed to allow`,
  );
  return [];
}

export async function sanitizeAuthCriticalUpserts(table, upserts, orgId) {
  if (!Array.isArray(upserts) || !upserts.length) return [];

  if (table === 'client_portal_credentials') {
    let existingMap = null;
    try {
      existingMap = (await fetchCollectionMap('client_portal_credentials', orgId)) || {};
    } catch (error) {
      console.error('[auth-critical] credential fetch failed:', error?.message || error);
    }

    const sanitized = [];
    for (const row of upserts) {
      if (!row?.id) continue;
      const merged = mergePortalCredentialData(existingMap?.[row.id], row.data);
      if (!hasConfiguredPortalUsers(merged)) {
        console.warn(`[auth-critical] blocked empty portal credential upsert for ${row.id}`);
        continue;
      }
      sanitized.push({ id: row.id, data: merged });
    }
    return sanitized;
  }

  if (table === 'team_members') {
    return upserts.filter((row) => {
      const member = row?.data;
      const email = member?.email?.trim() || member?.username?.trim();
      const passwordHash = member?.passwordHash?.trim();
      if (!email || !passwordHash) {
        console.warn(`[auth-critical] blocked incomplete team member upsert for ${row?.id}`);
        return false;
      }
      return true;
    });
  }

  return upserts;
}

export async function repairPortalCredentialFromVault({ brand, orgId, user, password }) {
  if (!brand || !orgId || !user?.id || !password) return null;

  const clients = await fetchRecord('clients', 'workspace', orgId);
  const vaultPassword = clients?.portalPasswordVault?.[brand]?.[user.id];
  if (!vaultPassword || vaultPassword !== String(password).trim()) return null;

  const rows = await fetchCollectionMap('client_portal_credentials', orgId);
  const users = normalizeBrandUsers(rows?.[brand]);
  if (!users.length) return null;

  const passwordHash = hashValue(String(password).trim());
  const nextUsers = users.map((entry) =>
    entry.id === user.id ? { ...entry, passwordHash } : entry,
  );

  await upsertRecord('client_portal_credentials', brand, nextUsers, orgId);
  return { ...user, passwordHash };
}
