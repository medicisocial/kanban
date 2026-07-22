import { createHash } from 'crypto';
import { getStaffSessionSecret } from './sessionSecrets.mjs';

const PROD_STAFF_USERNAME = 'info@medicisocial.com';

function getConfiguredUsername() {
  return (process.env.STAFF_USERNAME || process.env.VITE_STAFF_USERNAME || PROD_STAFF_USERNAME)
    .trim();
}

/** Password verifier material — server env only. Never used as a session MAC secret. */
function getConfiguredPasswordHash() {
  return (process.env.STAFF_PASSWORD_HASH || '').trim().toLowerCase();
}

export function isStaffPasswordConfigured() {
  return Boolean(getConfiguredPasswordHash());
}

function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function createSessionSignature(username, expires) {
  const secret = getStaffSessionSecret();
  return hashPassword(`${username}:${expires}:${secret}`);
}

export function getConfiguredStaffUsername() {
  return getConfiguredUsername();
}

export function isOpsStaffEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return normalized === getConfiguredUsername().toLowerCase();
}

export function verifyStaffPassword(username, password) {
  if (!isOpsStaffEmail(username)) return false;
  const expected = getConfiguredPasswordHash();
  if (!expected) return false;
  const passwordHash = hashPassword(String(password || '').trim());
  return timingSafeEqual(passwordHash, expected);
}

export function createStaffSession(username) {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const normalized = String(username || '').trim();
  const signature = createSessionSignature(normalized, expires);
  return {
    username: normalized,
    expires,
    signature,
  };
}

export function getSessionFromRequest(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;

  try {
    const json = Buffer.from(auth.slice(7), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isStaffSessionValid(session) {
  if (!session?.username || !session?.expires || !session?.signature) return false;
  if (Date.now() > session.expires) return false;

  try {
    const expectedSignature = createSessionSignature(session.username, session.expires);
    return timingSafeEqual(session.signature, expectedSignature);
  } catch {
    return false;
  }
}
