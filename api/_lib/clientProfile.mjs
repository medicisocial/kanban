export function normalizeClientContact(contact, fallbackId) {
  if (!contact || typeof contact !== 'object') return null;
  const role = contact.role?.trim() || '';
  const name = contact.name?.trim() || '';
  const phone = contact.phone?.trim() || '';
  const email = contact.email?.trim() || '';
  if (!role && !name && !phone && !email) return null;
  return {
    id: contact.id || fallbackId || `contact-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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
