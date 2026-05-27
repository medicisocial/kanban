export function createClientPortalUserId() {
  return crypto.randomUUID();
}

export function normalizeClientUser(user, fallbackId) {
  if (!user || typeof user !== 'object') return null;
  const username = user.username?.trim() || '';
  const passwordHash = user.passwordHash?.trim().toLowerCase() || '';
  const displayName = user.displayName?.trim() || '';
  if (!username && !passwordHash) return null;
  return {
    id: user.id || fallbackId || createClientPortalUserId(),
    username,
    passwordHash,
    displayName,
  };
}

export function normalizeBrandUsers(entry) {
  if (Array.isArray(entry)) {
    return entry.map((user) => normalizeClientUser(user)).filter(Boolean);
  }
  if (entry && typeof entry === 'object' && (entry.username || entry.passwordHash)) {
    return [normalizeClientUser(entry)].filter(Boolean);
  }
  return [];
}

export function getClientUsersFromStore(credentials, client) {
  if (!credentials || typeof credentials !== 'object') return [];
  return normalizeBrandUsers(credentials[client]);
}

export function countConfiguredClientLogins(credentials) {
  if (!credentials || typeof credentials !== 'object') return 0;
  return Object.values(credentials).reduce(
    (total, entry) => total + normalizeBrandUsers(entry).filter((user) => user.passwordHash).length,
    0,
  );
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
        passwordHash = await hashPassword(draft.password);
      }

      return {
        id: draft.id || existing?.id || createClientPortalUserId(),
        username: draft.username.trim(),
        passwordHash,
        displayName: draft.displayName?.trim() || existing?.displayName || '',
      };
    }),
  );
}
