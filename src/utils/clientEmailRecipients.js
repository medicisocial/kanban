import { isValidPortalEmail, normalizePortalLogin } from './portalLogin';

export function buildClientEmailRecipients(contacts = [], portalUsers = []) {
  const byEmail = new Map();

  for (const contact of contacts) {
    const email = normalizePortalLogin(contact?.email);
    if (!isValidPortalEmail(email)) continue;
    byEmail.set(email, {
      id: `contact-${contact.id || email}`,
      email,
      name: contact.name?.trim() || '',
      role: contact.role?.trim() || 'Contact',
      source: 'contact',
    });
  }

  for (const user of portalUsers) {
    const email = normalizePortalLogin(user?.username);
    if (!isValidPortalEmail(email)) continue;
    const existing = byEmail.get(email);
    byEmail.set(email, {
      id: existing?.id || `portal-${user.id || email}`,
      email,
      name: existing?.name || user.displayName?.trim() || '',
      role: existing?.role || 'Portal access',
      source: existing ? 'both' : 'portal',
    });
  }

  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}

export function formatRecipientLabel(recipient) {
  if (recipient.name) {
    return `${recipient.name} (${recipient.email})`;
  }
  return recipient.email;
}
