import { createHash } from 'crypto';

const CLIENT_PORTAL_AUTH_KEY = 'medici-client-portal-auth';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSessionSecret() {
  return (process.env.STAFF_PASSWORD_HASH || process.env.CLIENT_PORTAL_SESSION_SECRET || 'medici-client-portal')
    .trim()
    .toLowerCase();
}

function hashValue(value) {
  return createHash('sha256').update(value).digest('hex');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function getClientPortalAuthMap(workspace) {
  return workspace?.data?.[CLIENT_PORTAL_AUTH_KEY] || {};
}

function normalizeCredentialEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const username = entry.username?.trim() || '';
  const passwordHash = entry.passwordHash?.trim().toLowerCase() || '';
  if (!username && !passwordHash) return null;
  return { username, passwordHash };
}

export function mergeClientPortalAuth(existing = {}, incoming = {}) {
  const merged = { ...existing };

  for (const [brand, rawEntry] of Object.entries(incoming)) {
    const entry = normalizeCredentialEntry(rawEntry);
    if (!entry) continue;

    const previous = normalizeCredentialEntry(merged[brand]);
    const passwordHash = entry.passwordHash || previous?.passwordHash || '';
    const username = entry.username || previous?.username || '';

    if (!passwordHash) {
      if (previous?.passwordHash) {
        merged[brand] = {
          username: username || previous.username,
          passwordHash: previous.passwordHash,
        };
      }
      continue;
    }

    merged[brand] = { username, passwordHash };
  }

  return merged;
}

export function findBrandByUsername(authMap, username) {
  const normalized = username.trim().toLowerCase();
  for (const [brand, entry] of Object.entries(authMap)) {
    if (entry?.username?.trim()?.toLowerCase() === normalized) {
      return brand;
    }
  }
  return null;
}

export function verifyClientPassword(entry, password) {
  if (!entry?.passwordHash) return false;
  const hash = hashValue(password);
  return timingSafeEqual(hash, entry.passwordHash.trim().toLowerCase());
}

export function createClientSession(brand, username) {
  const expires = Date.now() + SESSION_TTL_MS;
  const signature = hashValue(`client:${brand}:${username}:${expires}:${getSessionSecret()}`);
  return {
    type: 'client',
    brand,
    username: username.trim(),
    expires,
    signature,
  };
}

export function isClientSessionValid(session) {
  if (session?.type !== 'client') return false;
  if (!session.brand || !session.username || !session.expires || !session.signature) return false;
  if (Date.now() > session.expires) return false;

  const expected = hashValue(
    `client:${session.brand}:${session.username}:${session.expires}:${getSessionSecret()}`,
  );
  return timingSafeEqual(session.signature, expected);
}

export function getClientSessionFromRequest(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;

  try {
    const json = Buffer.from(auth.slice(7), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}
