import { createHash } from 'crypto';

const PROD_SUPER_ADMIN_USERNAME = 'admin@medicisocial.com';
// SHA-256 lowercase hex signature of "admin"
const PROD_SUPER_ADMIN_PASSWORD_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';

function getSuperAdminUsername() {
  return (process.env.SUPER_ADMIN_USERNAME || PROD_SUPER_ADMIN_USERNAME).trim();
}

function getSuperAdminPasswordHash() {
  return (process.env.SUPER_ADMIN_PASSWORD_HASH || PROD_SUPER_ADMIN_PASSWORD_HASH).trim().toLowerCase();
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

export function isSuperAdminSessionValid(session) {
  if (!session?.username || !session?.expires || !session?.signature) return false;
  if (Date.now() > session.expires) return false;

  const expectedUsername = getSuperAdminUsername();
  if (session.username.trim().toLowerCase() !== expectedUsername.toLowerCase()) return false;

  const secret = getSuperAdminPasswordHash();
  const signatureData = `${session.username}:${session.expires}:${secret}`;
  const expectedSignature = hashValue(signatureData);

  return timingSafeEqual(session.signature, expectedSignature);
}
