export const CLIENT_SOCIAL_PLATFORMS = ['instagram', 'tiktok', 'facebook'];

function clampPercent(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 50;
  return Math.min(100, Math.max(0, num));
}

function normalizeContactAvatar(avatar) {
  if (!avatar) return null;
  if (typeof avatar === 'string') {
    return { src: avatar, zoom: 1, x: 50, y: 50 };
  }
  if (typeof avatar === 'object' && avatar.src) {
    return {
      src: avatar.src,
      zoom: Math.min(3, Math.max(1, Number(avatar.zoom) || 1)),
      x: clampPercent(avatar.x ?? 50),
      y: clampPercent(avatar.y ?? 50),
    };
  }
  return null;
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
    id: contact.id || fallbackId || `contact-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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
