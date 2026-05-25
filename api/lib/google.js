import nodemailer from 'nodemailer';

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

export async function sendViaGmailSmtp({ to, subject, text, fromName, fromEmail }) {
  const user = process.env.GMAIL_USER || 'info@medicisocial.com';
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) {
    throw new Error('Gmail is not configured on the server (missing GMAIL_APP_PASSWORD).');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  const result = await transporter.sendMail({
    from: `"${fromName || 'Medici Social'}" <${fromEmail || user}>`,
    to,
    subject,
    text,
  });

  return { id: result.messageId };
}

export function getRedirectUri(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}/api/google/callback`;
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
