const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PORTAL_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizePortalLogin(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidPortalEmail(value) {
  const normalized = normalizePortalLogin(value);
  return normalized.length > 0 && EMAIL_PATTERN.test(normalized);
}

/** Client portal logins: work email or a simple username assigned by the agency. */
export function isValidPortalUsername(value) {
  const normalized = normalizePortalLogin(value);
  if (!normalized) return false;
  if (isValidPortalEmail(normalized)) return true;
  return PORTAL_USERNAME_PATTERN.test(normalized);
}

/** All console and portal logins use the signup email as the username. */
export function isValidLoginEmail(value) {
  return isValidPortalEmail(value);
}

export function looksLikeEmail(value) {
  return isValidPortalEmail(value);
}

export function suggestPortalEmailFromContacts(contacts = []) {
  for (const contact of contacts) {
    const email = contact?.email?.trim().toLowerCase();
    if (email && isValidPortalEmail(email)) return email;
  }
  return '';
}

export function suggestPortalUsernameFromBrand(brand = '') {
  const slug = normalizePortalLogin(brand).replace(/[^a-z0-9]/g, '');
  return slug.length >= 3 ? slug : '';
}

export function suggestPortalUsername(client, contacts = []) {
  return suggestPortalEmailFromContacts(contacts) || suggestPortalUsernameFromBrand(client);
}

export function buildPortalInviteMessage({ brand, email, username, portalUrl, temporaryPassword }) {
  const login = normalizePortalLogin(username || email || '');
  const loginLabel = looksLikeEmail(login) ? 'Email' : 'Username';
  const lines = [
    `Hi,`,
    ``,
    `Your ${brand} client portal is ready. Sign in to review ideas, approve content, and track your production schedule.`,
    ``,
    `Portal: ${portalUrl}`,
    `${loginLabel}: ${login}`,
  ];

  if (temporaryPassword) {
    lines.push(`Temporary password: ${temporaryPassword}`);
    lines.push(``, `Please change your password after your first sign-in.`);
  } else {
    lines.push(`Use the password your Medici Social account manager shared with you.`);
  }

  lines.push(``, `Questions? Reply to this email or contact your account manager.`, ``, `— Medici Social`);
  return lines.join('\n');
}
