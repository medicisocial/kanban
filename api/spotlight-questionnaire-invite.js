import {
  getClientSessionFromRequest,
  isClientSessionValid,
} from './_lib/clientPortalAuth.mjs';
import { isEmailConfigured, sendPlatformEmail } from './_lib/platformEmail.mjs';
import {
  buildSpotlightFormUrl,
  buildSpotlightInviteEmail,
  canSendSpotlightInvite,
  isValidEmail,
  signSpotlightToken,
} from './_lib/spotlightQuestionnaire.mjs';

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function resolveOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim();
  if (host) return `${proto}://${host}`;
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getClientSessionFromRequest(req);
  if (!isClientSessionValid(session)) return unauthorized(res);

  const brand = String(session.brand || '').trim();
  if (!canSendSpotlightInvite(brand)) {
    return res.status(403).json({
      error: 'Business Spotlight invites are only available for Chamber of Commerce brands.',
    });
  }

  if (!isEmailConfigured()) {
    return res.status(503).json({
      error:
        'Platform email is not configured. In Vercel, add RESEND_API_KEY (and optionally EMAIL_FROM), then redeploy.',
    });
  }

  const to = String(req.body?.to || '').trim().toLowerCase();
  const businessName = String(req.body?.businessName || '').trim();
  const note = String(req.body?.note || '').trim();
  const invitedBy = String(
    req.body?.invitedBy || session.displayName || session.username || '',
  ).trim();

  if (!isValidEmail(to)) {
    return res.status(400).json({ error: 'Enter a valid recipient email.' });
  }

  try {
    const token = signSpotlightToken({
      brand,
      to,
      businessName,
      note,
      invitedBy,
    });
    const formUrl = buildSpotlightFormUrl(token, resolveOrigin(req));
    const email = buildSpotlightInviteEmail({
      brand,
      businessName,
      note,
      formUrl,
    });

    await sendPlatformEmail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      // No Reply-To — recipients should fill the form, not email back.
      replyTo: '',
    });

    return res.status(200).json({
      ok: true,
      to,
      formUrl,
      brand,
    });
  } catch (error) {
    console.error('[spotlight-questionnaire-invite] failed:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Could not send the questionnaire invite.',
    });
  }
}
