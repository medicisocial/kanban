import { createHmac, timingSafeEqual } from 'crypto';

export const SPOTLIGHT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SPOTLIGHT_MARINA_EMAIL = 'marina@fulshearregional.com';
export const SPOTLIGHT_MEDICI_EMAIL = 'info@medicisocial.com';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_CHAMBER_BRANDS = ['Fulshear Regional'];

export const SPOTLIGHT_QUESTION_FIELDS = [
  { key: 'businessName', label: 'Business name', section: 'Business information', required: true },
  { key: 'instagramHandle', label: 'Instagram handle', section: 'Business information' },
  { key: 'facebookPage', label: 'Facebook page', section: 'Business information' },
  { key: 'website', label: 'Website', section: 'Business information' },
  { key: 'logoAttached', label: 'High-resolution logo attached?', section: 'Business information' },
  { key: 'socialContactName', label: 'Social media contact — full name', section: 'Social media contact', required: true },
  { key: 'socialContactPhone', label: 'Social media contact — phone', section: 'Social media contact' },
  { key: 'socialContactEmail', label: 'Social media contact — email', section: 'Social media contact', required: true },
  { key: 'giveawayPrize', label: 'Giveaway prize', section: 'Giveaway information' },
  { key: 'giveawayValue', label: 'Approximate value', section: 'Giveaway information' },
  { key: 'giveawayRestrictions', label: 'Restrictions or expiration dates', section: 'Giveaway information' },
  { key: 'giveawayContactName', label: 'Giveaway contact — full name', section: 'Giveaway contact' },
  { key: 'giveawayContactPhone', label: 'Giveaway contact — phone', section: 'Giveaway contact' },
  { key: 'giveawayContactEmail', label: 'Giveaway contact — email', section: 'Giveaway contact' },
  { key: 'filmingNames', label: 'Full name(s) of anyone appearing in the video', section: 'Filming information' },
  { key: 'businessHistory', label: 'History of the business and who owns/runs it', section: 'Business history & ownership', required: true },
  { key: 'yearsInBusiness', label: 'How long has the business (or owner) been doing this work?', section: 'Business history & ownership' },
  { key: 'specialHook', label: "What's the ONE thing that makes your business special or different?", section: 'The “special” hook', required: true },
  { key: 'signatureSpecialty', label: 'Signature product, service, or specialty', section: 'The “special” hook' },
  { key: 'personalStory', label: 'Personal story behind the business', section: 'The “special” hook' },
  { key: 'coreOffer', label: 'Core offer or value proposition for new customers', section: 'The offer', required: true },
  { key: 'pricingDetails', label: 'Pricing, packages, or details to mention', section: 'The offer' },
  { key: 'scriptQuotes', label: 'Quotes, phrases, or taglines to include', section: 'Script preferences' },
  { key: 'scriptExclusions', label: 'Anything you do NOT want mentioned or shown', section: 'Script preferences' },
];

function getTokenSecret() {
  return (
    process.env.SPOTLIGHT_TOKEN_SECRET ||
    process.env.CLIENT_PORTAL_SESSION_SECRET ||
    process.env.STAFF_PASSWORD_HASH ||
    'medici-spotlight-questionnaire'
  )
    .trim()
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function base64UrlEncode(value) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64').toString('utf8');
}

function signPayload(payloadJson) {
  return createHmac('sha256', getTokenSecret()).update(payloadJson).digest('base64url');
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || '').trim());
}

export function getSpotlightNotifyRecipients() {
  const fromEnv = String(process.env.SPOTLIGHT_NOTIFY_TO || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((email) => isValidEmail(email));
  if (fromEnv.length) return [...new Set(fromEnv)];
  return [SPOTLIGHT_MEDICI_EMAIL, SPOTLIGHT_MARINA_EMAIL];
}

export function canSendSpotlightInvite(brand) {
  const name = String(brand || '').trim();
  if (!name) return false;
  const extras = String(process.env.SPOTLIGHT_CHAMBER_BRANDS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const allowed = [...DEFAULT_CHAMBER_BRANDS, ...extras];
  return allowed.some((entry) => entry.toLowerCase() === name.toLowerCase());
}

export function signSpotlightToken({
  brand,
  to,
  businessName = '',
  note = '',
  invitedBy = '',
  ttlMs = SPOTLIGHT_TOKEN_TTL_MS,
} = {}) {
  const now = Date.now();
  const payload = {
    brand: String(brand || '').trim(),
    to: String(to || '').trim().toLowerCase(),
    businessName: String(businessName || '').trim(),
    note: String(note || '').trim(),
    invitedBy: String(invitedBy || '').trim(),
    iat: now,
    exp: now + Number(ttlMs || SPOTLIGHT_TOKEN_TTL_MS),
  };
  if (!payload.brand || !isValidEmail(payload.to)) {
    throw new Error('A chamber brand and valid recipient email are required.');
  }
  const payloadJson = JSON.stringify(payload);
  return `${base64UrlEncode(payloadJson)}.${signPayload(payloadJson)}`;
}

export function verifySpotlightToken(token) {
  const raw = String(token || '').trim();
  const [encodedPayload, signature] = raw.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Invalid questionnaire link.');
  }

  let payloadJson;
  try {
    payloadJson = base64UrlDecode(encodedPayload);
  } catch {
    throw new Error('Invalid questionnaire link.');
  }

  const expected = signPayload(payloadJson);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error('Invalid or tampered questionnaire link.');
  }

  let payload;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    throw new Error('Invalid questionnaire link.');
  }

  if (!payload?.brand || !isValidEmail(payload.to)) {
    throw new Error('Invalid questionnaire link.');
  }
  if (!Number.isFinite(payload.exp) || Date.now() > Number(payload.exp)) {
    throw new Error('This questionnaire link has expired. Ask for a new invite.');
  }

  return {
    brand: String(payload.brand).trim(),
    to: String(payload.to).trim().toLowerCase(),
    businessName: String(payload.businessName || '').trim(),
    note: String(payload.note || '').trim(),
    invitedBy: String(payload.invitedBy || '').trim(),
    iat: Number(payload.iat) || 0,
    exp: Number(payload.exp) || 0,
  };
}

/** Decode token payload without verifying (client preview only). */
export function peekSpotlightToken(token) {
  try {
    return verifySpotlightToken(token);
  } catch {
    const raw = String(token || '').trim();
    const [encodedPayload] = raw.split('.');
    if (!encodedPayload) return null;
    try {
      const payload = JSON.parse(base64UrlDecode(encodedPayload));
      return {
        brand: String(payload.brand || '').trim(),
        to: String(payload.to || '').trim().toLowerCase(),
        businessName: String(payload.businessName || '').trim(),
        note: String(payload.note || '').trim(),
        invitedBy: String(payload.invitedBy || '').trim(),
        exp: Number(payload.exp) || 0,
        expired: Number.isFinite(payload.exp) && Date.now() > Number(payload.exp),
      };
    } catch {
      return null;
    }
  }
}

export function normalizeSpotlightAnswers(raw = {}) {
  const answers = {};
  for (const field of SPOTLIGHT_QUESTION_FIELDS) {
    const value = raw[field.key];
    if (field.key === 'logoAttached') {
      answers[field.key] = String(value ?? '').trim();
      continue;
    }
    answers[field.key] = String(value ?? '').trim();
  }
  return answers;
}

export function validateSpotlightAnswers(answers) {
  const missing = SPOTLIGHT_QUESTION_FIELDS.filter(
    (field) => field.required && !String(answers[field.key] || '').trim(),
  ).map((field) => field.label);
  if (missing.length) {
    throw new Error(`Please complete: ${missing.join(', ')}.`);
  }
  if (answers.socialContactEmail && !isValidEmail(answers.socialContactEmail)) {
    throw new Error('Enter a valid social media contact email.');
  }
  if (answers.giveawayContactEmail && !isValidEmail(answers.giveawayContactEmail)) {
    throw new Error('Enter a valid giveaway contact email.');
  }
}

function buildOrigin(origin) {
  const raw = String(origin || '').trim().replace(/\/+$/, '');
  if (raw && /^https?:\/\//i.test(raw)) return raw;
  return 'https://medicisocial.com';
}

export function buildSpotlightFormUrl(token, origin) {
  return `${buildOrigin(origin)}/?spotlight=${encodeURIComponent(token)}`;
}

export function buildSpotlightInviteEmail({
  brand,
  businessName,
  note,
  formUrl,
}) {
  const agency = 'Medici Social';
  const chamber = String(brand || 'Fulshear Regional').trim();
  const biz = String(businessName || '').trim();
  const subject = biz
    ? `${chamber} — Business Spotlight questionnaire for ${biz}`
    : `${chamber} — Business Spotlight questionnaire`;
  const noteBlock = note
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#ccc;"><em>${escapeHtml(note)}</em></p>`
    : '';
  const intro =
    'Congratulations on joining the Fulshear Regional Chamber FOR Commerce! Your Business Spotlight - Branding Video is produced in partnership with Medici Social. Please complete this questionnaire so we can write your script and prepare for filming.';

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,Segoe UI,sans-serif;color:#f5f5f5;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#888;">${escapeHtml(chamber)}</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:600;color:#fff;">Business Spotlight questionnaire</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#ccc;">
        ${escapeHtml(intro)}
      </p>
      ${noteBlock}
      <a href="${escapeHtml(formUrl)}" style="display:inline-block;margin:8px 0 20px;padding:12px 24px;background:#810100;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:2px;">Open questionnaire</a>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#999;">No sign-in required. Your answers are emailed to the Chamber and Medici Social when you submit.</p>
      <p style="margin:16px 0 8px;font-size:12px;line-height:1.6;color:#777;">Link:</p>
      <p style="margin:0 0 24px;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${escapeHtml(formUrl)}" style="color:#c88;">${escapeHtml(formUrl)}</a></p>
      <hr style="border:none;border-top:1px solid #222;margin:24px 0;" />
      <p style="margin:0;font-size:11px;line-height:1.6;color:#666;">Sent via ${escapeHtml(agency)}. Please use the button above to complete the form — do not reply to this email.</p>
    </div>
  </body>
</html>`;

  const text = [
    'Business Spotlight questionnaire',
    '',
    intro,
    note ? `Note: ${note}` : '',
    '',
    `Open questionnaire: ${formUrl}`,
    '',
    'Please complete the form at the link above — do not reply to this email.',
    '',
    `— ${agency}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

export function buildSpotlightSubmissionEmail({ invite, answers }) {
  const businessName = answers.businessName || invite.businessName || 'Business';
  const subject = `Business Spotlight answers — ${businessName}`;
  const rows = SPOTLIGHT_QUESTION_FIELDS.map((field) => {
    const value = answers[field.key] || '—';
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #222;color:#999;vertical-align:top;width:38%;">${escapeHtml(field.label)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #222;color:#f5f5f5;white-space:pre-wrap;">${escapeHtml(value)}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,Segoe UI,sans-serif;color:#f5f5f5;">
    <div style="max-width:720px;margin:0 auto;padding:32px 24px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#888;">Fulshear Regional Chamber</p>
      <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:600;color:#fff;">Business Spotlight questionnaire submitted</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#aaa;">
        Invited: ${escapeHtml(invite.to)} · Brand: ${escapeHtml(invite.brand)}
      </p>
      <table style="width:100%;border-collapse:collapse;background:#111;border:1px solid #222;">${rows}</table>
      <p style="margin:24px 0 0;font-size:11px;line-height:1.6;color:#666;">Sent automatically via Medici Social Portal.</p>
    </div>
  </body>
</html>`;

  const textLines = [
    `Business Spotlight questionnaire submitted — ${businessName}`,
    `Invited: ${invite.to}`,
    `Brand: ${invite.brand}`,
    '',
    ...SPOTLIGHT_QUESTION_FIELDS.map((field) => `${field.label}: ${answers[field.key] || '—'}`),
  ];

  return { subject, html, text: textLines.join('\n') };
}
