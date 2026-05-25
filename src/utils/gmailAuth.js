import { GMAIL_AUTH_STORAGE_KEY } from '../constants';
import { buildShareEmailContent } from './clientEmail';

const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GMAIL_SCOPES =
  'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';

let gsiLoadPromise = null;

function loadGsiScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')));
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google sign-in.'));
    document.head.appendChild(script);
  });

  return gsiLoadPromise;
}

async function fetchOAuthConfig() {
  const response = await fetch('/api/google/config');
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.clientId) {
    throw new Error('Google OAuth is not configured on the server.');
  }
  return data;
}

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

export async function connectGmail() {
  try {
    await loadGsiScript();
    const { clientId } = await fetchOAuthConfig();

    return await new Promise((resolve) => {
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: GMAIL_SCOPES,
        ux_mode: 'popup',
        callback: async (response) => {
          if (response.error) {
            resolve({ ok: false, error: response.error_description || response.error });
            return;
          }

          try {
            const tokenResponse = await fetch('/api/google/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: response.code,
                redirectUri: window.location.origin,
              }),
            });
            const data = await tokenResponse.json().catch(() => ({}));
            if (!tokenResponse.ok) {
              resolve({ ok: false, error: data.error || 'Gmail connection failed.' });
              return;
            }

            const auth = {
              refreshToken: data.refreshToken,
              accountEmail: data.accountEmail,
              connectedAt: data.connectedAt,
            };
            saveGmailAuth(auth);
            resolve({ ok: true, auth });
          } catch {
            resolve({ ok: false, error: 'Gmail connection failed.' });
          }
        },
      });

      client.requestCode();
    });
  } catch (error) {
    return { ok: false, error: error.message || 'Gmail connection failed.' };
  }
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
