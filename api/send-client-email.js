export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Medici Social <onboarding@resend.dev>';
  const secret = process.env.EMAIL_API_SECRET;

  if (!apiKey) {
    res.status(503).json({ error: 'Email service is not configured on the server.' });
    return;
  }

  if (secret && req.headers['x-email-secret'] !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { to, subject, text, html } = req.body || {};
  if (!to || !subject) {
    res.status(400).json({ error: 'Missing to or subject.' });
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: text || undefined,
        html: html || undefined,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(response.status).json({
        error: data.message || 'Resend rejected the email.',
      });
      return;
    }

    res.status(200).json({ ok: true, id: data.id });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to send email.' });
  }
}
