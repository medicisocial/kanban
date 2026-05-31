const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePortalLogin(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidPortalEmail(value) {
  const normalized = normalizePortalLogin(value);
  return normalized.length > 0 && EMAIL_PATTERN.test(normalized);
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

export function buildPortalInviteMessage({ brand, email, portalUrl, temporaryPassword }) {
  const lines = [
    `Hi,`,
    ``,
    `Your ${brand} client portal is ready. Sign in to review ideas, approve content, and track your production schedule.`,
    ``,
    `Portal: ${portalUrl}`,
    `Email: ${email}`,
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
