import { sendViaGmailSmtp } from '../lib/google.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { to, subject, text, fromName, fromEmail } = req.body || {};
  if (!to || !subject || !text) {
    res.status(400).json({ error: 'Missing required email fields.' });
    return;
  }

  try {
    const result = await sendViaGmailSmtp({ to, subject, text, fromName, fromEmail });
    res.status(200).json({ ok: true, id: result.id });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to send email.' });
  }
}
