export const CLIENT_SESSION_KEY = 'medici-client-portal-session';

export function isClientHubPortal() {
  const params = new URLSearchParams(window.location.search);
  return params.get('portal') === '1' || params.get('portal') === 'true';
}

/** Remove Medici-internal assignment fields before client portal display or export. */
export function stripInternalCardFields(card) {
  if (!card || typeof card !== 'object') return card;
  const { assignedTo, contentCreator, accountManager, ...clientSafe } = card;
  return clientSafe;
}

export function stripInternalCardsForClientPortal(cards) {
  if (!Array.isArray(cards)) return [];
  return cards.map(stripInternalCardFields);
}

function authHeaders(session) {
  return {
    Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
    'Content-Type': 'application/json',
  };
}

export function loadClientSession() {
  try {
    const raw = localStorage.getItem(CLIENT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveClientSession(session) {
  localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(session));
}

export function clearClientSession() {
  localStorage.removeItem(CLIENT_SESSION_KEY);
}

export async function loginClientPortal(username, password) {
  const response = await fetch('/api/client-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Login failed.');
  }

  saveClientSession(payload.session);
  return payload;
}

export async function requestClientPasswordReset(username) {
  const response = await fetch('/api/client-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'request', username }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Could not send reset email.');
  }
  return payload;
}

export async function completeClientPasswordReset(token, password) {
  const response = await fetch('/api/client-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset', token, password }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Could not reset password.');
  }
  return payload;
}

export async function fetchClientPortalData(session) {
  const response = await fetch('/api/client-portal', {
    headers: authHeaders(session),
  });

  if (response.status === 401) {
    clearClientSession();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Could not load portal data.');
  }

  return response.json();
}

export async function submitClientPortalResponse(session, type, response) {
  const res = await fetch('/api/client-responses', {
    method: 'POST',
    headers: authHeaders(session),
    body: JSON.stringify({ type, response }),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || 'Could not save your response.');
  }
}

export async function submitClientPortalProfile(session, profile) {
  await submitClientPortalResponse(session, 'profile', profile);
}

export function slugifyClientName(clientName) {
  return clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const CLIENT_PIPELINE_COLUMNS = [
  { id: 'in-review', title: 'In Review' },
  { id: 'approved', title: 'Approved' },
  { id: 'scheduled', title: 'Scheduled' },
  { id: 'posted', title: 'Posted' },
];

function parseScheduledDateTime(dueDate, dueTime) {
  const scheduledAt = new Date(`${dueDate}T00:00:00`);
  if (dueTime) {
    const [hours, minutes] = dueTime.split(':').map(Number);
    scheduledAt.setHours(hours, minutes, 0, 0);
    return scheduledAt;
  }
  scheduledAt.setHours(23, 59, 59, 999);
  return scheduledAt;
}

/** Client portal only — scheduled reels past their post time (or marked posted). */
export function isClientPortalPosted(card, now = new Date()) {
  if (card.contentType === 'Story') return false;
  if (card.postedAt) return true;
  if (card.columnId !== 'scheduled' || !card.dueDate) return false;
  return now >= parseScheduledDateTime(card.dueDate, card.dueTime);
}

export function getClientPipelineDisplayColumn(card) {
  if (card.contentType === 'Story') return null;
  if (card.columnId === 'scheduled' && isClientPortalPosted(card)) return 'posted';
  if (CLIENT_PIPELINE_COLUMNS.some((column) => column.id === card.columnId)) return card.columnId;
  return null;
}

export function getClientPipelineCards(cards) {
  return cards.filter((card) => getClientPipelineDisplayColumn(card) !== null);
}

export function getClientShootCards(cards) {
  return cards
    .filter((card) => card.shootDate && card.contentType !== 'Story')
    .sort((a, b) => {
      const dateCompare = (a.shootDate || '').localeCompare(b.shootDate || '');
      if (dateCompare !== 0) return dateCompare;
      return (a.shootTime || '').localeCompare(b.shootTime || '');
    });
}
