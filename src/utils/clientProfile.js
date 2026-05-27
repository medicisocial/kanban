import { bakeLogoCrop, normalizeClientLogo, serializeClientLogo } from './clientLogo';

export const CLIENT_SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'facebook', label: 'Facebook' },
];

function normalizeContactAvatar(avatar) {
  const normalized = normalizeClientLogo(avatar);
  return normalized ? serializeClientLogo(normalized) : null;
}

export async function resolveContactAvatarDraft(draftAvatar, existingAvatar) {
  if (draftAvatar === undefined) {
    return existingAvatar ?? null;
  }
  if (draftAvatar === null) {
    return null;
  }
  if (!draftAvatar?.src) {
    return existingAvatar ?? null;
  }
  const normalized = normalizeClientLogo(draftAvatar);
  if (!normalized) return existingAvatar ?? null;
  const baked = await bakeLogoCrop(normalized);
  return baked || normalizeContactAvatar(normalized);
}

export async function prepareClientContactsForSave(contacts) {
  const prepared = await Promise.all(
    (Array.isArray(contacts) ? contacts : []).map(async (contact) => {
      const { pendingAvatar, ...rest } = contact || {};
      const avatar = await resolveContactAvatarDraft(pendingAvatar, rest.avatar);
      return { ...rest, avatar };
    }),
  );
  return normalizeClientContacts(prepared);
}

export function contactsDraftHasChanges(draft, saved) {
  if (!Array.isArray(draft)) return false;
  if (draft.some((contact) => contact?.pendingAvatar !== undefined)) return true;
  return (
    JSON.stringify(normalizeClientContacts(draft)) !==
    JSON.stringify(normalizeClientContacts(saved))
  );
}

export function createClientContactId() {
  return crypto.randomUUID();
}

export function normalizeClientContact(contact, fallbackId) {
  if (!contact || typeof contact !== 'object') return null;
  const role = contact.role?.trim() || '';
  const name = contact.name?.trim() || '';
  const phone = contact.phone?.trim() || '';
  const email = contact.email?.trim() || '';
  const avatar = normalizeContactAvatar(contact.avatar);
  if (!role && !name && !phone && !email && !avatar) return null;
  return {
    id: contact.id || fallbackId || createClientContactId(),
    role,
    name,
    phone,
    email,
    avatar,
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
