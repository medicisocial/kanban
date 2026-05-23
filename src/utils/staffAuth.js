export const STAFF_SESSION_KEY = 'medici-staff-session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getConfiguredUsername() {
  return (import.meta.env.VITE_STAFF_USERNAME || '').trim();
}

function getConfiguredPasswordHash() {
  return (import.meta.env.VITE_STAFF_PASSWORD_HASH || '').trim().toLowerCase();
}

export function isStaffAuthConfigured() {
  return Boolean(getConfiguredUsername() && getConfiguredPasswordHash());
}

export function isPublicClientPortal() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('client')) return true;
  if (params.get('calendar')) return true;
  if (params.get('content')) return true;
  if (params.get('shoot') && params.get('date')) return true;
  return false;
}

export async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function createSessionSignature(username, expires) {
  const secret = getConfiguredPasswordHash();
  return hashPassword(`${username}:${expires}:${secret}`);
}

export async function verifyStaffCredentials(username, password) {
  if (!isStaffAuthConfigured()) return false;

  const expectedUser = getConfiguredUsername();
  const normalizedUser = username.trim();
  if (normalizedUser.toLowerCase() !== expectedUser.toLowerCase()) {
    return false;
  }

  const passwordHash = await hashPassword(password);
  return timingSafeEqual(passwordHash, getConfiguredPasswordHash());
}

export async function createStaffSession(username) {
  const expires = Date.now() + SESSION_TTL_MS;
  const signature = await createSessionSignature(username.trim(), expires);
  return {
    username: username.trim(),
    expires,
    signature,
  };
}

export async function isStaffSessionValid(session) {
  if (!session?.username || !session?.expires || !session?.signature) return false;
  if (!isStaffAuthConfigured()) return false;
  if (Date.now() > session.expires) return false;

  const expectedUser = getConfiguredUsername();
  if (session.username.toLowerCase() !== expectedUser.toLowerCase()) return false;

  const expectedSignature = await createSessionSignature(session.username, session.expires);
  return timingSafeEqual(session.signature, expectedSignature);
}

export function loadStaffSession() {
  try {
    const raw = localStorage.getItem(STAFF_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStaffSession(session) {
  localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
}

export function clearStaffSession() {
  localStorage.removeItem(STAFF_SESSION_KEY);
}
