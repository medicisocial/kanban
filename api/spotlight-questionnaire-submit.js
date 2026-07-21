import { isEmailConfigured, sendPlatformEmail } from './_lib/platformEmail.mjs';
import {
  buildSpotlightSubmissionEmail,
  getSpotlightNotifyRecipients,
  normalizeSpotlightAnswers,
  validateSpotlightAnswers,
  verifySpotlightToken,
} from './_lib/spotlightQuestionnaire.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isEmailConfigured()) {
    return res.status(503).json({
      error:
        'Platform email is not configured. In Vercel, add RESEND_API_KEY (and optionally EMAIL_FROM), then redeploy.',
    });
  }

  const token = String(req.body?.token || '').trim();
  if (!token) {
    return res.status(400).json({ error: 'Missing questionnaire link.' });
  }

  let invite;
  try {
    invite = verifySpotlightToken(token);
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Invalid questionnaire link.' });
  }

  let answers;
  try {
    answers = normalizeSpotlightAnswers(req.body?.answers || req.body || {});
    validateSpotlightAnswers(answers);
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Incomplete questionnaire.' });
  }

  try {
    const email = buildSpotlightSubmissionEmail({ invite, answers });
    const recipients = getSpotlightNotifyRecipients();
    await sendPlatformEmail({
      to: recipients,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: invite.to,
    });

    return res.status(200).json({
      ok: true,
      notified: recipients,
      businessName: answers.businessName,
    });
  } catch (error) {
    console.error('[spotlight-questionnaire-submit] failed:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Could not submit the questionnaire.',
    });
  }
}
