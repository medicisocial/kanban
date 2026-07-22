import bcrypt from 'bcryptjs';

/** bcrypt cost — 12 is a solid default for interactive logins. */
const BCRYPT_ROUNDS = 12;

const BCRYPT_PREFIX = /^\$2[aby]\$/;

export function looksLikeBcryptHash(value) {
  return BCRYPT_PREFIX.test(String(value || '').trim());
}

export async function hashPassword(password) {
  const plain = String(password || '');
  if (!plain) {
    throw new Error('Cannot hash an empty password.');
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Verify a candidate password against a stored bcrypt hash.
 * Never accepts plaintext equality — compromised legacy secrets must be reset.
 */
export async function verifyPasswordHash(passwordHash, password) {
  const hash = String(passwordHash || '').trim();
  const plain = String(password || '');
  if (!hash || !plain || !looksLikeBcryptHash(hash)) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
