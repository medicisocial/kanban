export const CLIENT_SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'facebook', label: 'Facebook' },
];

export function createClientContactId() {
  return crypto.randomUUID();
}

export function normalizeClientContact(contact, fallbackId) {
  if (!contact || typeof contact !== 'object') return null;
  const role = contact.role?.trim() || '';
  const name = contact.name?.trim() || '';
  const phone = contact.phone?.trim() || '';
  const email = contact.email?.trim() || '';
  if (!role && !name && !phone && !email) return null;
  return {
    id: contact.id || fallbackId || createClientContactId(),
    role,
    name,
    phone,
    email,
  };
}

export function normalizeClientContacts(contacts) {
  if (!Array.isArray(contacts)) return [];
  return contacts.map((contact) => normalizeClientContact(contact)).filter(Boolean);
}

export function emptyClientSocialLogins() {
  return {
    instagram: { username: '', password: '' },
    tiktok: { username: '', password: '' },
    facebook: { username: '', password: '' },
  };
}

export function normalizeClientSocialLogins(logins) {
  const base = emptyClientSocialLogins();
  if (!logins || typeof logins !== 'object') return base;
  for (const platform of Object.keys(base)) {
    const entry = logins[platform] || {};
    base[platform] = {
      username: entry.username?.trim() || '',
      password: typeof entry.password === 'string' ? entry.password : '',
    };
  }
  return base;
}

export function mergeClientSocialLogins(existing, incoming) {
  const prev = normalizeClientSocialLogins(existing);
  const next = normalizeClientSocialLogins(incoming);
  for (const platform of Object.keys(next)) {
    const draftPassword = incoming?.[platform]?.password;
    if (draftPassword === undefined || draftPassword === null) {
      next[platform].password = prev[platform].password;
      continue;
    }
    if (draftPassword === '' && prev[platform].password) {
      next[platform].password = prev[platform].password;
    }
  }
  return next;
}
