import { GMAIL_AUTH_STORAGE_KEY } from '../constants';
import { buildShareEmailContent } from './clientEmail';

export function loadGmailAuth() {
  try {
    const raw = localStorage.getItem(GMAIL_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGmailAuth(auth) {
  localStorage.setItem(GMAIL_AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearGmailAuth() {
  localStorage.removeItem(GMAIL_AUTH_STORAGE_KEY);
}

export function isGmailConnected() {
  return Boolean(loadGmailAuth()?.refreshToken);
}

export function connectGmail() {
  const width = 520;
  const height = 640;
  const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
  const popup = window.open(
    '/api/google/auth',
    'medici-gmail-oauth',
    `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`,
  );
  if (!popup) {
    return { ok: false, error: 'Pop-up blocked. Allow pop-ups for this site and try again.' };
  }
  return { ok: true };
}

export async function sendShareEmailViaGmail({ to, type, client, url, refreshToken }) {
  const { subject, text } = buildShareEmailContent(type, client, url);
  const response = await fetch('/api/gmail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refreshToken: refreshToken || undefined,
      to,
      subject,
      text,
      fromName: 'Medici Social',
      fromEmail: 'info@medicisocial.com',
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.error || 'Gmail could not send the email.', status: response.status };
  }
  return { ok: true, ...data };
}

export const GMAIL_OAUTH_MESSAGE_TYPE = 'medici-gmail-oauth';
