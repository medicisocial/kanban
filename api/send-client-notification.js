import { getSessionFromRequest, isStaffSessionValid } from './_lib/staffAuth.mjs';
import {
  isEmailConfigured,
  normalizeShareType,
  sendClientNotificationEmails,
} from './_lib/platformEmail.mjs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function normalizeRecipients(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const recipients = [];

  for (const entry of raw) {
    const email = String(entry?.email || entry || '')
      .trim()
      .toLowerCase();
    if (!email || !EMAIL_PATTERN.test(email) || seen.has(email)) continue;
    seen.add(email);
    recipients.push({
      email,
      name: String(entry?.name || '').trim(),
    });
  }

  return recipients;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!isStaffSessionValid(session)) return unauthorized(res);

  if (!isEmailConfigured()) {
    return res.status(503).json({
      error:
        'Platform email is not configured. In Vercel, add RESEND_API_KEY (name exactly that, value = your re_… key from Resend), optionally EMAIL_FROM, then redeploy production.',
    });
  }

  const shareType = normalizeShareType(req.body?.shareType);
  const client = String(req.body?.client || '').trim();
  const shareUrl = String(req.body?.shareUrl || '').trim();
  const portalUrl = String(req.body?.portalUrl || '').trim();
  const itemCount = Number(req.body?.itemCount) || 0;
  const recipients = normalizeRecipients(req.body?.recipients);

  if (!shareType) {
    return res.status(400).json({ error: 'Invalid notification type.' });
  }
  if (!client) {
    return res.status(400).json({ error: 'Client is required.' });
  }
  if (!shareUrl || !/^https?:\/\//i.test(shareUrl)) {
    return res.status(400).json({ error: 'A valid share URL is required.' });
  }
  if (!portalUrl || !/^https?:\/\//i.test(portalUrl)) {
    return res.status(400).json({ error: 'A valid portal URL is required.' });
  }
  if (recipients.length === 0) {
    return res.status(400).json({ error: 'Select at least one recipient with a valid email.' });
  }

  try {
    const result = await sendClientNotificationEmails({
      shareType,
      client,
      recipients,
      shareUrl,
      portalUrl,
      itemCount,
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[send-client-notification] failed:', error?.message || error);
    return res.status(502).json({
      error: error.message || 'Could not send email. Please try again.',
    });
  }
}
