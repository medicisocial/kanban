import { fetchCollectionMap, isSupabaseConfigured, upsertRecord } from './supabase.mjs';
import { getClientPortalAuthMap, hashValue, mergeClientPortalAuth, normalizeBrandUsers } from './clientPortalAuth.mjs';

/**
 * Persist client portal credentials (brand → users array) to Supabase.
 * This replaces the legacy Redis/Upstash store.
 */
export async function persistClientCredentials(brand, users, orgId) {
  if (!isSupabaseConfigured()) return;

  try {
    const existingMap = (await fetchCollectionMap('client_portal_credentials', orgId)) || {};
    const existing = normalizeBrandUsers(existingMap?.[brand]);
    const merged = mergeClientPortalAuth(existing, users);
    await upsertRecord('client_portal_credentials', brand, merged, orgId);
  } catch (error) {
    console.error('[client-credentials-store] persist failed:', error?.message || error);
  }
}

/**
 * Save a full credentials map (brand → { users: [...] }) to the
 * client_portal_credentials table. Each brand's users are upserted individually.
 *
 * @param {object} credentialsMap - e.g. { "Brand Name": { users: [...] }, ... }
 * @param {string} orgId
 */
export async function saveClientAuthMap(credentialsMap, orgId) {
  if (!isSupabaseConfigured()) {
    throw new Error('Cloud sync is not configured.');
  }
  if (!credentialsMap || typeof credentialsMap !== 'object') {
    throw new Error('Invalid credentials payload.');
  }

  for (const [brand, entry] of Object.entries(credentialsMap)) {
    if (!brand || !entry) continue;
    const users = normalizeBrandUsers(entry);
    if (!users.length) continue;

    // Hash any plaintext passwords before storing
    const hashedUsers = users.map((user) => {
      const password = String(user.password || user.passwordHash || '').trim();
      if (!password) return user;
      // If it's already a SHA-256 hex hash (64 chars), store as-is
      if (/^[a-f0-9]{64}$/i.test(password)) {
        return { ...user, passwordHash: password.toLowerCase() };
      }
      return { ...user, passwordHash: hashValue(password) };
    });

    await persistClientCredentials(brand, hashedUsers, orgId);
  }
}

/**
 * Load the full client portal auth map from Supabase.
 */
export async function loadClientPortalAuthMap(orgId) {
  if (!isSupabaseConfigured()) return null;

  try {
    const map = await fetchCollectionMap('client_portal_credentials', orgId);
    return getClientPortalAuthMap({ data: { 'medici-client-portal-auth': map } });
  } catch (error) {
    console.error('[client-credentials-store] load failed:', error?.message || error);
    return null;
  }
}

/**
 * Hash a password for storage using SHA-256.
 */
export function hashPortalPassword(password) {
  return hashValue(String(password).trim());
}