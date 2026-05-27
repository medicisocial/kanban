import { createHash } from 'crypto';

const PROD_STAFF_USERNAME = 'medicisocial';
const PROD_STAFF_PASSWORD_HASH = '288a74dd35327615ef98b375a2445d9ebd4c570a5e5d413181986ebf127f45e1';

function getConfiguredUsername() {
  return (process.env.STAFF_USERNAME || PROD_STAFF_USERNAME).trim();
}

function getConfiguredPasswordHash() {
  return (process.env.STAFF_PASSWORD_HASH || PROD_STAFF_PASSWORD_HASH).trim().toLowerCase();
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
  const secret = getConfiguredPasswordHash();
  return hashPassword(`${username}:${expires}:${secret}`);
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

  const expectedSignature = createSessionSignature(session.username, session.expires);
  return timingSafeEqual(session.signature, expectedSignature);
}
