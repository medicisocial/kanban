import { sendViaGmailOAuth } from '../lib/google.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { refreshToken, to, subject, text, fromName, fromEmail } = req.body || {};
  const token = refreshToken || process.env.GOOGLE_REFRESH_TOKEN;

  if (!to || !subject || !text) {
    res.status(400).json({ error: 'Missing required email fields.' });
    return;
  }

  if (!token) {
    res.status(503).json({ error: 'Gmail is not connected. Click Connect Gmail in the app.' });
    return;
  }

  try {
    const result = await sendViaGmailOAuth({
      refreshToken: token,
      to,
      subject,
      text,
      fromName,
      fromEmail,
    });
    res.status(200).json({ ok: true, id: result.id });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to send email.' });
  }
}
