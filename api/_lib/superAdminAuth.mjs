import { createHash } from 'crypto';
import { getSuperAdminSessionSecret } from './sessionSecrets.mjs';

const DEFAULT_SUPER_ADMIN_USERNAME = 'admin@medicisocial.com';

function getSuperAdminUsername() {
  return (
    process.env.SUPER_ADMIN_USERNAME ||
    process.env.VITE_SUPER_ADMIN_USERNAME ||
    DEFAULT_SUPER_ADMIN_USERNAME
  ).trim();
}

/**
 * Password hash must be set via server env. There is intentionally no default
 * password (the previous default was the literal password "admin").
 */
function getSuperAdminPasswordHash() {
  return (
    process.env.SUPER_ADMIN_PASSWORD_HASH ||
    process.env.VITE_SUPER_ADMIN_PASSWORD_HASH ||
    ''
  )
    .trim()
    .toLowerCase();
}

function hashValue(val) {
  return createHash('sha256').update(val).digest('hex');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function isSuperAdminConfigured() {
  return Boolean(getSuperAdminPasswordHash());
}

export function verifySuperAdminPassword(username, password) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const expectedUsername = getSuperAdminUsername().toLowerCase();
  if (normalizedUsername !== expectedUsername) return false;

  const expectedHash = getSuperAdminPasswordHash();
  if (!expectedHash) return false;

  const passwordHash = hashValue(String(password || '').trim());
  return timingSafeEqual(passwordHash, expectedHash);
}

export function createSuperAdminSession(username) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const secret = getSuperAdminSessionSecret();
  const signature = hashValue(`${normalizedUsername}:${expires}:${secret}`);
  return {
    username: normalizedUsername,
    expires,
    signature,
  };
}

export function isSuperAdminSessionValid(session) {
  if (!session?.username || !session?.expires || !session?.signature) return false;
  if (Date.now() > session.expires) return false;

  const expectedUsername = getSuperAdminUsername();
  if (session.username.trim().toLowerCase() !== expectedUsername.toLowerCase()) return false;

  try {
    const secret = getSuperAdminSessionSecret();
    const signatureData = `${session.username}:${session.expires}:${secret}`;
    const expectedSignature = hashValue(signatureData);
    return timingSafeEqual(session.signature, expectedSignature);
  } catch {
    return false;
  }
}
