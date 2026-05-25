const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const USERINFO_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
export const GOOGLE_SCOPES = `${GMAIL_SEND_SCOPE} ${USERINFO_EMAIL_SCOPE}`;

export function getRedirectUri(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}/api/google/callback`;
}

export async function exchangeCodeForTokens(code, redirectUri) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth is not configured on the server.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Token exchange failed.');
  }
  return data;
}

export async function refreshAccessToken(refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth is not configured on the server.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Could not refresh Gmail access.');
  }
  return data.access_token;
}

export async function fetchGoogleEmail(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Could not read Google account email.');
  }
  return data.email || '';
}

export function encodeGmailRaw(message) {
  return Buffer.from(message, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function buildPlainTextEmail({ fromName, fromEmail, to, subject, body }) {
  const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  return [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
  ].join('\r\n');
}

export async function sendGmailMessage({ accessToken, rawMessage }) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodeGmailRaw(rawMessage) }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Gmail rejected the message.');
  }
  return data;
}

export function oauthResultHtml(payload, origin) {
  const safePayload = JSON.stringify(payload).replace(/</g, '\\u003c');
  const safeOrigin = JSON.stringify(origin);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Gmail connected</title></head>
<body style="font-family:sans-serif;background:#111;color:#f9f6f2;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <p id="status">Finishing Gmail connection…</p>
  <script>
    (function () {
      var payload = ${safePayload};
      var origin = ${safeOrigin};
      try {
        if (window.opener) {
          window.opener.postMessage({ type: 'medici-gmail-oauth', payload: payload }, origin);
          document.getElementById('status').textContent = 'Gmail connected. You can close this window.';
          window.close();
          return;
        }
        localStorage.setItem('medici-gmail-auth', JSON.stringify(payload));
        document.getElementById('status').textContent = 'Gmail connected. Returning to the app…';
        window.location.replace('/');
      } catch (error) {
        document.getElementById('status').textContent = 'Connection failed. Close this window and try again.';
      }
    })();
  </script>
</body>
</html>`;
}

export function oauthErrorHtml(message) {
  const safeMessage = String(message || 'Gmail connection failed.')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Gmail connection failed</title></head>
<body style="font-family:sans-serif;background:#111;color:#f9f6f2;padding:2rem;">
  <h1>Gmail connection failed</h1>
  <p>${safeMessage}</p>
  <p>You can close this window and try again.</p>
</body>
</html>`;
}
