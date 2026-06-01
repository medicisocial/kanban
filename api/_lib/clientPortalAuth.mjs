import { createHash, randomUUID } from 'crypto';

const CLIENT_PORTAL_AUTH_KEY = 'medici-client-portal-auth';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function clampPercent(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 50;
  return Math.min(100, Math.max(0, num));
}

function normalizeUserAvatar(avatar) {
  if (!avatar) return null;
  if (typeof avatar === 'string') {
    return { src: avatar, zoom: 1, x: 50, y: 50 };
  }
  if (typeof avatar === 'object' && avatar.src) {
    return {
      src: avatar.src,
      zoom: Math.min(3, Math.max(1, Number(avatar.zoom) || 1)),
      x: clampPercent(avatar.x ?? 50),
      y: clampPercent(avatar.y ?? 50),
    };
  }
  return null;
}

function getSessionSecret() {
  return (process.env.STAFF_PASSWORD_HASH || process.env.CLIENT_PORTAL_SESSION_SECRET || 'medici-client-portal')
    .trim()
    .toLowerCase();
}

export function hashValue(value) {
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

function normalizeClientUser(user, fallbackId) {
  if (!user || typeof user !== 'object') return null;
  const username = user.username?.trim() || '';
  const passwordHash = user.passwordHash?.trim().toLowerCase() || '';
  const displayName = user.displayName?.trim() || '';
  if (!username && !passwordHash) return null;
  return {
    id: user.id || fallbackId || randomUUID(),
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
  if (entry && typeof entry === 'object' && (entry.username || entry.passwordHash)) {
    return [normalizeClientUser(entry)].filter(Boolean);
  }
  return [];
}

function mergeBrandUsers(existingUsers, incomingUsers) {
  const existingById = new Map(existingUsers.map((user) => [user.id, user]));
  const merged = [];

  for (const incoming of incomingUsers) {
    const previous =
      existingById.get(incoming.id) ||
      existingUsers.find((user) => user.username.toLowerCase() === incoming.username.toLowerCase());

    const passwordHash = incoming.passwordHash || previous?.passwordHash || '';
    const username = incoming.username || previous?.username || '';
    if (!passwordHash || !username) continue;

    merged.push({
      id: incoming.id || previous?.id || randomUUID(),
      username,
      passwordHash,
      displayName: incoming.displayName || previous?.displayName || '',
      avatar: Object.prototype.hasOwnProperty.call(incoming, 'avatar')
        ? normalizeUserAvatar(incoming.avatar)
        : normalizeUserAvatar(previous?.avatar),
    });
  }

  return merged;
}

export function mergeClientPortalAuth(existing = {}, incoming = {}) {
  const merged = { ...existing };

  for (const [brand, rawEntry] of Object.entries(incoming)) {
    const incomingUsers = normalizeBrandUsers(rawEntry);
    if (!incomingUsers.length) continue;

    const existingUsers = normalizeBrandUsers(merged[brand]);
    merged[brand] = mergeBrandUsers(existingUsers, incomingUsers);
  }

  return merged;
}

export function findClientLogin(authMap, username) {
  const normalized = username.trim().toLowerCase();
  const emailLocal = normalized.includes('@') ? normalized.split('@')[0] : null;

  for (const [brand, entry] of Object.entries(authMap)) {
    for (const user of normalizeBrandUsers(entry)) {
      const stored = user.username.toLowerCase();
      if (stored === normalized) {
        return { brand, user };
      }
      // Legacy portal usernames (e.g. plumehtx) still work when clients sign in with email.
      if (emailLocal && stored === emailLocal) {
        return { brand, user };
      }
    }
  }
  return null;
}

export function findBrandByUsername(authMap, username) {
  return findClientLogin(authMap, username)?.brand || null;
}

/**
 * Cross-tenant login lookup. `rows` is an array of { id: brand, org_id, data }
 * fetched without an org filter. Returns { brand, org_id, user } for the first
 * match so the client session can be scoped to the owning org.
 */
export function findClientLoginAcrossOrgs(rows, username) {
  const normalized = username.trim().toLowerCase();
  const emailLocal = normalized.includes('@') ? normalized.split('@')[0] : null;

  for (const row of rows || []) {
    const brand = row?.id;
    if (!brand || brand.startsWith('__')) continue;
    for (const user of normalizeBrandUsers(row.data)) {
      const stored = user.username.toLowerCase();
      if (stored === normalized || (emailLocal && stored === emailLocal)) {
        return { brand, org_id: row.org_id, user };
      }
    }
  }
  return null;
}

export function verifyClientPassword(entry, password) {
  if (!entry?.passwordHash) return false;
  const hash = hashValue(password);
  return timingSafeEqual(hash, entry.passwordHash.trim().toLowerCase());
}

/**
 * orgId is included in the signature only when present, so legacy sessions
 * created before multi-tenant support remain valid until they expire.
 */
function clientSessionSignature(brand, username, expires, orgId) {
  const orgSegment = orgId ? `:${orgId}` : '';
  return hashValue(`client:${brand}:${username}:${expires}${orgSegment}:${getSessionSecret()}`);
}

export function createClientSession(brand, username, orgId) {
  const expires = Date.now() + SESSION_TTL_MS;
  const trimmedUsername = username.trim();
  const session = {
    type: 'client',
    brand,
    username: trimmedUsername,
    expires,
    signature: clientSessionSignature(brand, trimmedUsername, expires, orgId),
  };
  if (orgId) session.orgId = orgId;
  return session;
}

export function isClientSessionValid(session) {
  if (session?.type !== 'client') return false;
  if (!session.brand || !session.username || !session.expires || !session.signature) return false;
  if (Date.now() > session.expires) return false;

  const expected = clientSessionSignature(
    session.brand,
    session.username,
    session.expires,
    session.orgId,
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
