export const SUPER_ADMIN_SESSION_KEY = 'medici-super-admin-session';

export async function verifySuperAdminCredentials(username, password) {
  const res = await fetch('/api/admin-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: String(username || '').trim(),
      password: String(password || '').trim(),
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.session) {
    return null;
  }
  return payload.session;
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

/**
 * Shape/expiry check only — never grants privileges by itself.
 * Call validateSuperAdminSession before showing admin UI or accepting impersonation.
 */
export function hasSuperAdminSessionShape(session) {
  if (!session?.username || !session?.expires || !session?.signature) return false;
  if (Date.now() > session.expires) return false;
  return true;
}

/** Server-verified session check (signature validated with a server-only secret). */
export async function isSuperAdminSessionValid(session) {
  if (!hasSuperAdminSessionShape(session)) return false;
  try {
    const res = await fetch('/api/admin-auth', {
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
