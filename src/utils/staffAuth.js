export const STAFF_SESSION_KEY = 'medici-staff-session';
/** Tab-scoped flag set on explicit sign-out so Supabase session restore is skipped. */
export const STAFF_SIGNED_OUT_KEY = 'medici-staff-signed-out';

const PROD_STAFF_USERNAME = 'info@medicisocial.com';

/** SHA-256 hex digest — used for client portal user password storage only. */
export async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getConfiguredUsername() {
  const fromEnv = (import.meta.env.VITE_STAFF_USERNAME || '').trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD) return PROD_STAFF_USERNAME;
  return '';
}

/** Public username only — password hashes must never ship in the browser bundle. */
export function isStaffAuthConfigured() {
  return Boolean(getConfiguredUsername()) || import.meta.env.PROD;
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

export function isOpsStaffEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  const configured = getConfiguredUsername();
  if (configured && normalized === configured.toLowerCase()) return true;
  return import.meta.env.PROD && normalized === PROD_STAFF_USERNAME.toLowerCase();
}

/**
 * Server-side credential check + session mint. Never hashes passwords against a
 * client-bundled secret.
 */
export async function loginStaffWithPassword(username, password) {
  const res = await fetch('/api/staff-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: String(username || '').trim(),
      password: String(password || '').trim(),
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.session) {
    return { ok: false, error: payload?.error || 'Invalid email or password.' };
  }
  return { ok: true, session: payload.session };
}

export async function isStaffSessionValid(session) {
  if (!session?.username || !session?.expires || !session?.signature) return false;
  if (Date.now() > session.expires) return false;

  try {
    const res = await fetch('/api/staff-auth', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
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

export function markStaffSignedOut() {
  try {
    sessionStorage.setItem(STAFF_SIGNED_OUT_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearStaffSignedOut() {
  try {
    sessionStorage.removeItem(STAFF_SIGNED_OUT_KEY);
  } catch {
    /* ignore */
  }
}

export function isStaffSignedOut() {
  try {
    return sessionStorage.getItem(STAFF_SIGNED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

/** True when Supabase auth should not silently re-establish a staff session. */
export function shouldSuppressStaffAutoRestore() {
  return isStaffSignedOut();
}
