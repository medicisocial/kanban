import { normalizeBrandUsers, hashValue } from './clientPortalAuth.mjs';
import { mergeClientsWorkspaceData } from './clientsWorkspaceMerge.mjs';
import { fetchCollectionMap, fetchRecord, upsertRecord } from './supabase.mjs';

export const AUTH_CRITICAL_SYNC_TABLES = new Set([
  'client_portal_credentials',
  'team_members',
]);

export function hasConfiguredPortalUsers(entry) {
  return normalizeBrandUsers(entry).some((user) => user.username && user.passwordHash);
}

function stripPortalPasswordChangeMarker(user) {
  if (!user || typeof user !== 'object') return user;
  const { _passwordChangeAuthorized: _ignored, ...rest } = user;
  return rest;
}

function resolvePortalPasswordHash(previous, incomingUser, allowPasswordChange) {
  const previousHash = previous?.passwordHash?.trim().toLowerCase() || '';
  const incomingHash = incomingUser.passwordHash?.trim().toLowerCase() || '';
  if (!incomingHash) return previousHash;
  if (!previousHash) return incomingHash;
  if (incomingHash === previousHash) return incomingHash;
  if (allowPasswordChange) return incomingHash;
  console.warn(
    `[auth-critical] blocked unexpected portal password hash change for ${incomingUser.username || previous?.username || 'user'}`,
  );
  return previousHash;
}

/** Never replace configured portal users with an empty payload. */
export function mergePortalCredentialData(
  existingData,
  incomingData,
  { allowPasswordChange = false } = {},
) {
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

    const passwordHash = resolvePortalPasswordHash(previous, incomingUser, allowPasswordChange);
    const username = incomingUser.username || previous?.username || '';
    if (!passwordHash || !username) continue;

    const id = incomingUser.id || previous?.id;
    seen.add(id);
    merged.push(
      stripPortalPasswordChangeMarker({
        ...previous,
        ...incomingUser,
        id,
        username,
        passwordHash,
        displayName: incomingUser.displayName || previous?.displayName || '',
        avatar: Object.prototype.hasOwnProperty.call(incomingUser, 'avatar')
          ? incomingUser.avatar
          : previous?.avatar,
      }),
    );
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

export async function sanitizeAuthCriticalUpserts(
  table,
  upserts,
  orgId,
  { credentialPasswordChanges = null } = {},
) {
  if (!Array.isArray(upserts) || !upserts.length) return [];

  if (table === 'client_portal_credentials') {
    let existingMap = null;
    try {
      existingMap = (await fetchCollectionMap('client_portal_credentials', orgId)) || {};
    } catch (error) {
      console.error('[auth-critical] credential fetch failed:', error?.message || error);
    }

    const passwordChangeBrands =
      credentialPasswordChanges instanceof Set
        ? credentialPasswordChanges
        : new Set(
            Array.isArray(credentialPasswordChanges) ? credentialPasswordChanges.map(String) : [],
          );

    const sanitized = [];
    for (const row of upserts) {
      if (!row?.id) continue;
      const merged = mergePortalCredentialData(existingMap?.[row.id], row.data, {
        allowPasswordChange: passwordChangeBrands.has(String(row.id)),
      });
      if (!hasConfiguredPortalUsers(merged)) {
        console.warn(`[auth-critical] blocked empty portal credential upsert for ${row.id}`);
        continue;
      }
      sanitized.push({ id: row.id, data: merged });
    }
    return sanitized;
  }

  if (table === 'team_members') {
    let existingMap = null;
    try {
      existingMap = (await fetchCollectionMap('team_members', orgId)) || {};
    } catch (error) {
      console.error('[auth-critical] team member fetch failed:', error?.message || error);
    }

    const sanitized = [];
    for (const row of upserts) {
      if (!row?.id) continue;
      const incoming = row?.data && typeof row.data === 'object' ? row.data : {};
      const name = incoming.name?.trim();
      if (!name) {
        console.warn(`[auth-critical] blocked team member without name: ${row.id}`);
        continue;
      }

      const existing =
        existingMap?.[row.id] && typeof existingMap[row.id] === 'object'
          ? existingMap[row.id]
          : {};
      const merged = { ...existing, ...incoming, name };

      if (!merged.password && existing.password) {
        merged.password = existing.password;
      }
      if (!merged.roles?.length && existing.roles?.length) {
        merged.roles = existing.roles;
      }

      const email = (merged.email || merged.username || '').trim().toLowerCase();
      if (email) {
        merged.email = email;
        merged.username = email;
      } else if (existing.email || existing.username) {
        merged.email = (existing.email || existing.username || '').trim().toLowerCase();
        merged.username = merged.email || existing.username;
      }

      sanitized.push({ id: row.id, data: merged });
    }
    return sanitized;
  }

  if (table === 'clients') {
    let existingMap = null;
    try {
      existingMap = (await fetchCollectionMap('clients', orgId)) || {};
    } catch (error) {
      console.error('[auth-critical] clients workspace fetch failed:', error?.message || error);
    }

    const sanitized = [];
    for (const row of upserts) {
      if (!row?.id) continue;
      const existing =
        existingMap?.[row.id] && typeof existingMap[row.id] === 'object' ? existingMap[row.id] : {};
      sanitized.push({
        id: row.id,
        data: mergeClientsWorkspaceData(existing, row.data),
      });
    }
    return sanitized;
  }

  return upserts;
}

/**
 * Restore a portal password hash from the staff vault ONLY when the stored hash is
 * blank/missing. A login attempt must never override an existing valid hash —
 * otherwise a stale vault value (e.g. password == username) silently rewrites the
 * real password on every matching guess. This was the recurring failure where one
 * brand's login kept "becoming invalid" while others were fine.
 */
export async function repairPortalCredentialFromVault({ brand, orgId, user, password }) {
  if (!brand || !orgId || !user?.id || !password) return null;

  // Never touch a credential that already has a usable hash.
  if (user.passwordHash && user.passwordHash.trim()) return null;

  const clients = await fetchRecord('clients', 'workspace', orgId);
  const vaultPassword = clients?.portalPasswordVault?.[brand]?.[user.id];
  if (!vaultPassword || vaultPassword !== String(password).trim()) return null;

  const rows = await fetchCollectionMap('client_portal_credentials', orgId);
  const users = normalizeBrandUsers(rows?.[brand]);
  if (!users.length) return null;

  // Only fill the specific user when their stored hash is still blank.
  const target = users.find((entry) => entry.id === user.id);
  if (!target || (target.passwordHash && target.passwordHash.trim())) return null;

  const passwordHash = hashValue(String(password).trim());
  const nextUsers = users.map((entry) =>
    entry.id === user.id ? { ...entry, passwordHash } : entry,
  );

  await upsertRecord('client_portal_credentials', brand, nextUsers, orgId);
  return { ...user, passwordHash };
}
