import {
  buildPlainTextEmail,
  refreshAccessToken,
  sendGmailMessage,
} from '../lib/google.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { refreshToken, to, subject, text, fromName, fromEmail } = req.body || {};
  if (!refreshToken || !to || !subject || !text) {
    res.status(400).json({ error: 'Missing required email fields.' });
    return;
  }

  try {
    const accessToken = await refreshAccessToken(refreshToken);
    const rawMessage = buildPlainTextEmail({
      fromName: fromName || 'Medici Social',
      fromEmail: fromEmail || 'info@medicisocial.com',
      to,
      subject,
      body: text,
    });
    const result = await sendGmailMessage({ accessToken, rawMessage });
    res.status(200).json({ ok: true, id: result.id });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to send email.' });
  }
}
