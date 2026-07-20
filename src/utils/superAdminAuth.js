export const SUPER_ADMIN_SESSION_KEY = 'medici-super-admin-session';

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifySuperAdminCredentials(username, password) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const adminUsername = (import.meta.env.VITE_SUPER_ADMIN_USERNAME || 'admin@medicisocial.com').trim().toLowerCase();

  if (normalizedUsername !== adminUsername) return null;

  const passwordHash = await hashPassword(String(password || '').trim());

  const defaultHash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; // hash of 'admin'
  const expectedHash = (import.meta.env.VITE_SUPER_ADMIN_PASSWORD_HASH || defaultHash).trim().toLowerCase();

  if (passwordHash !== expectedHash) return null;

  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const signatureData = `${normalizedUsername}:${expires}:${passwordHash}`;
  const signature = await hashPassword(signatureData);

  return {
    username: normalizedUsername,
    expires,
    signature,
  };
}

export function loadSuperAdminSession() {
  try {
    const raw = localStorage.getItem(SUPER_ADMIN_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSuperAdminSession(session) {
  localStorage.setItem(SUPER_ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearSuperAdminSession() {
  localStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
}

export function isSuperAdminSessionValid(session) {
  if (!session?.username || !session?.expires || !session?.signature) return false;
  if (Date.now() > session.expires) return false;
  return true;
}

export function impersonateOrg(org, ownerEmail, adminSession) {
  const mockStaffSession = {
    username: ownerEmail,
    type: 'saas',
    impersonated: true,
    adminSession: adminSession,
    org: org,
  };
  localStorage.setItem('medici-staff-session', JSON.stringify(mockStaffSession));
}

export function stopImpersonating() {
  localStorage.removeItem('medici-staff-session');
}
