import { loadStaffSession } from './staffAuth';

function authHeaders(session) {
  return {
    Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
    'Content-Type': 'application/json',
  };
}

export async function sendClientNotification(payload) {
  const session = loadStaffSession();
  if (!session) {
    throw new Error('Staff session expired. Sign in again and retry.');
  }

  const response = await fetch('/api/send-client-notification', {
    method: 'POST',
    headers: authHeaders(session),
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Could not send email.');
  }

  return data;
}

export function getPortalSignInUrl() {
  if (typeof window === 'undefined') return 'https://portal.medicisocial.com';
  return `${window.location.origin}${window.location.pathname}`;
}

export function getAgencyDisplayName() {
  return (import.meta.env.VITE_AGENCY_NAME || 'Medici Social').trim();
}
