import { saveClientPortalPasswords } from './setPortalPasswordApi';

/**
 * Persist portal users through the service-role API (normalized portal_users table).
 */
export async function saveClientPortalCredentialsDirect({
  brand,
  users,
  allowPasswordChange = false,
  brandVault = {},
}) {
  const draftPayload = (Array.isArray(users) ? users : []).map((user) => ({
    id: user.id,
    username: user.username,
    password: allowPasswordChange && brandVault?.[user.id] ? brandVault[user.id] : '',
    displayName: user.displayName,
    avatar: user.avatar,
  }));

  return saveClientPortalPasswords({ brand, users: draftPayload });
}
