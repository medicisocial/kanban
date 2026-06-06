export const STAFF_SESSION_KEY = 'medici-staff-session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PROD_STAFF_USERNAME = 'info@medicisocial.com';
const PROD_STAFF_PASSWORD_HASH = '288a74dd35327615ef98b375a2445d9ebd4c570a5e5d413181986ebf127f45e1';

function getConfiguredUsername() {
  const fromEnv = (import.meta.env.VITE_STAFF_USERNAME || '').trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD) return PROD_STAFF_USERNAME;
  return '';
}

function getConfiguredPasswordHash() {
  const fromEnv = (import.meta.env.VITE_STAFF_PASSWORD_HASH || '').trim().toLowerCase();
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD) return PROD_STAFF_PASSWORD_HASH;
  return '';
}

export function isStaffAuthConfigured() {
  return Boolean(getConfiguredUsername() && getConfiguredPasswordHash());
}

export function isStaffAuthRequired() {
  if (isPublicShareLink()) return false;
  if (isStaffAuthConfigured()) return true;
  return import.meta.env.PROD;
}

function isAppGateRoute() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get('login') === '1' ||
    params.get('signup') === '1' ||
    params.get('pricing') === '1'
  );
}

export function isPublicShareLink() {
  if (isAppGateRoute()) return false;

  const params = new URLSearchParams(window.location.search);
  const client = params.get('client');
  // `client=1` is the client-login flag (?login=1&client=1), not a brand share link.
  if (client && client !== '1') return true;
  if (params.get('calendar')) return true;
  if (params.get('content')) return true;
  if (params.get('shoot') && params.get('date')) return true;
  return false;
}

export function isPublicClientPortal() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('portal') === '1' || params.get('portal') === 'true') return true;
  return isPublicShareLink();
}

export function isClientHubPortal() {
  const params = new URLSearchParams(window.location.search);
  return params.get('portal') === '1' || params.get('portal') === 'true';
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

function getEffectivePasswordHash(username) {
  if (isOpsStaffEmail(username) && import.meta.env.PROD) {
    return PROD_STAFF_PASSWORD_HASH;
  }
  return getConfiguredPasswordHash();
}

export function isOpsStaffEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  const configured = getConfiguredUsername();
  if (configured && normalized === configured.toLowerCase()) return true;
  return import.meta.env.PROD && normalized === PROD_STAFF_USERNAME.toLowerCase();
}

async function createSessionSignature(username, expires) {
  const secret = getEffectivePasswordHash(username);
  return hashPassword(`${username}:${expires}:${secret}`);
}

export async function verifyStaffCredentials(username, password) {
  if (!isOpsStaffEmail(username)) return false;
  if (!isStaffAuthConfigured() && !import.meta.env.PROD) return false;

  const passwordHash = await hashPassword(String(password || '').trim());
  return timingSafeEqual(passwordHash, getEffectivePasswordHash(username));
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

  const expectedSignature = await createSessionSignature(session.username, session.expires);
  return timingSafeEqual(session.signature, expectedSignature);
}

export function getConfiguredStaffUsername() {
  return getConfiguredUsername();
}

/** Shared Medici Social ops login — company-wide view, not personal queue. */
export function isSharedOperationsLogin(session) {
  if (!session) return false;
  if (session.type === 'saas' && isOpsStaffEmail(session.email)) return true;
  if (session.username && isOpsStaffEmail(session.username)) return true;
  return false;
}

export function usesPersonalWorkspaceView(session) {
  if (!session?.username && !session?.email) return false;
  return !isSharedOperationsLogin(session);
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
