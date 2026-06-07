import { bakeLogoCrop, normalizeClientLogo, serializeClientLogo } from './clientLogo';
import { clientNamesConflict } from './clients';
import { normalizePortalLogin } from './portalLogin';

export function createClientPortalUserId() {
  return crypto.randomUUID();
}

function normalizeUserAvatar(avatar) {
  const normalized = normalizeClientLogo(avatar);
  return normalized ? serializeClientLogo(normalized) : null;
}

export function normalizeClientUser(user, fallbackId) {
  if (!user || typeof user !== 'object') return null;
  const username = normalizePortalLogin(user.username || '');
  const passwordHash = user.passwordHash?.trim().toLowerCase() || '';
  const displayName = user.displayName?.trim() || '';
  if (!username && !passwordHash) return null;
  return {
    id: user.id || fallbackId || createClientPortalUserId(),
    username,
    passwordHash,
    displayName,
    avatar: normalizeUserAvatar(user.avatar),
  };
}

export function normalizeBrandUsers(entry) {
  if (Array.isArray(entry)) {
    return entry.map((user) => normalizeClientUser(user)).filter(Boolean);
  }
  if (entry && typeof entry === 'object') {
    // Handle { users: [...] } format stored in client_portal_credentials table
    if (Array.isArray(entry.users)) {
      return entry.users.map((user) => normalizeClientUser(user)).filter(Boolean);
    }
    // Handle single user object
    if (entry.username || entry.passwordHash) {
      return [normalizeClientUser(entry)].filter(Boolean);
    }
  }
  return [];
}

/** Resolve the map key used in credentials (may differ in casing from display name). */
export function resolveCredentialBrandKey(credentials, client) {
  if (!credentials || typeof credentials !== 'object' || !client) return client;

  const matchingKeys = Object.keys(credentials).filter((brand) => clientNamesConflict(brand, client));
  if (!matchingKeys.length) return client;

  if (matchingKeys.includes(client) && normalizeBrandUsers(credentials[client]).length) {
    return client;
  }

  const withUsers = matchingKeys.filter((key) => normalizeBrandUsers(credentials[key]).length > 0);
  if (withUsers.length === 1) return withUsers[0];
  if (withUsers.length > 1) {
    if (withUsers.includes(client)) return client;
    return withUsers[0];
  }

  if (matchingKeys.includes(client)) return client;
  return matchingKeys[0];
}

/** Usernames registered on brands other than `client` (case-insensitive brand match). */
export function collectTakenPortalUsernamesForOtherBrands(credentials, client) {
  const taken = new Set();
  for (const [brandKey, entry] of Object.entries(credentials || {})) {
    if (clientNamesConflict(brandKey, client)) continue;
    for (const user of normalizeBrandUsers(entry)) {
      const login = normalizePortalLogin(user.username);
      if (login) taken.add(login);
    }
  }
  return taken;
}

export function getClientUsersFromStore(credentials, client) {
  if (!credentials || typeof credentials !== 'object') return [];
  const brandKey = resolveCredentialBrandKey(credentials, client);
  return normalizeBrandUsers(credentials[brandKey]);
}

export function countConfiguredClientLogins(credentials) {
  if (!credentials || typeof credentials !== 'object') return 0;
  return Object.values(credentials).reduce(
    (total, entry) => total + normalizeBrandUsers(entry).filter((user) => user.passwordHash).length,
    0,
  );
}

export async function resolveUserAvatarDraft(draftAvatar, existingAvatar) {
  if (draftAvatar === undefined) {
    return existingAvatar ?? null;
  }
  if (draftAvatar === null) {
    return null;
  }
  if (!draftAvatar?.src) {
    return existingAvatar ?? null;
  }
  const normalized = normalizeClientLogo(draftAvatar);
  if (!normalized) return existingAvatar ?? null;
  const baked = await bakeLogoCrop(normalized);
  return baked || normalizeUserAvatar(normalized);
}

export function mergeBrandUserDrafts(existingUsers, draftUsers, hashPassword) {
  return Promise.all(
    draftUsers.map(async (draft) => {
      const existing =
        existingUsers.find((user) => user.id === draft.id) ||
        existingUsers.find(
          (user) => user.username.toLowerCase() === draft.username.trim().toLowerCase(),
        );

      let passwordHash = existing?.passwordHash || '';
      if (draft.password) {
        passwordHash = await hashPassword(String(draft.password).trim());
      }

      const avatar = await resolveUserAvatarDraft(draft.avatar, existing?.avatar);

      return {
        id: draft.id || existing?.id || createClientPortalUserId(),
        username: normalizePortalLogin(draft.username),
        passwordHash,
        displayName: draft.displayName?.trim() || existing?.displayName || '',
        avatar,
      };
    }),
  );
}
