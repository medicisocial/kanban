export const CLIENT_SESSION_KEY = 'medici-client-portal-session';

export function isClientHubPortal() {
  const params = new URLSearchParams(window.location.search);
  return params.get('portal') === '1' || params.get('portal') === 'true';
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

export function defaultPortalUsername(clientName) {
  return clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24) || 'client';
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
];

export function getClientPipelineCards(cards) {
  const allowed = new Set(CLIENT_PIPELINE_COLUMNS.map((col) => col.id));
  return cards.filter((card) => allowed.has(card.columnId) && card.contentType !== 'Story');
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
