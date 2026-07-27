import { createHmac, timingSafeEqual } from 'crypto';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const SPOTLIGHT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SPOTLIGHT_MARINA_EMAIL = 'marina@fulshearregional.com';
export const SPOTLIGHT_MEDICI_EMAIL = 'info@medicisocial.com';
export const SPOTLIGHT_GUIDE_FILENAME = 'Fulshear-Business-Spotlight-Guide.pdf';
export const SPOTLIGHT_GUIDE_PUBLIC_PATH = '/fulshear-business-spotlight-guide.pdf';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_CHAMBER_BRANDS = ['Fulshear Regional'];

export const SPOTLIGHT_QUESTION_FIELDS = [
  { key: 'businessName', label: 'Business name', section: 'Business information', required: true },
  { key: 'instagramHandle', label: 'Instagram handle', section: 'Business information' },
  { key: 'facebookPage', label: 'Facebook page', section: 'Business information' },
  { key: 'website', label: 'Website', section: 'Business information' },
  {
    key: 'logoAttached',
    label: 'High-resolution logo',
    section: 'Business information',
    hint: 'PNG, JPG, SVG, AI, or EPS preferred',
  },
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
  const secret = (process.env.SPOTLIGHT_TOKEN_SECRET || '').trim();
  if (!secret) {
    throw new Error('SPOTLIGHT_TOKEN_SECRET is required.');
  }
  return secret.toLowerCase();
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

export const SPOTLIGHT_LOGO_MAX_BYTES = 3 * 1024 * 1024;
export const SPOTLIGHT_LOGO_ACCEPT =
  '.png,.jpg,.jpeg,.svg,.webp,.ai,.eps,image/png,image/jpeg,image/svg+xml,image/webp,application/postscript';

const SPOTLIGHT_LOGO_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'svg',
  'webp',
  'ai',
  'eps',
]);

function extensionOf(filename) {
  const match = String(filename || '')
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function guessLogoContentType(filename, contentType = '') {
  const typed = String(contentType || '').trim().toLowerCase();
  if (typed && typed !== 'application/octet-stream') return typed;
  switch (extensionOf(filename)) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    case 'ai':
    case 'eps':
      return 'application/postscript';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Normalize an optional logo file uploaded with the questionnaire.
 * Expects { filename, contentType?, content } where content is base64 (optionally data-URL).
 */
export function normalizeSpotlightLogoAttachment(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'object') {
    throw new Error('Logo upload is invalid.');
  }

  const filename = String(raw.filename || raw.name || '')
    .trim()
    .replace(/[/\\]/g, '-')
    .slice(0, 120);
  if (!filename) {
    throw new Error('Logo filename is required.');
  }

  const ext = extensionOf(filename);
  if (!SPOTLIGHT_LOGO_EXTENSIONS.has(ext)) {
    throw new Error('Logo must be PNG, JPG, SVG, WEBP, AI, or EPS.');
  }

  let content = String(raw.content || raw.contentBase64 || '').trim();
  const dataUrlMatch = content.match(/^data:[^;]+;base64,(.+)$/i);
  if (dataUrlMatch) content = dataUrlMatch[1].replace(/\s+/g, '');
  else content = content.replace(/\s+/g, '');
  if (!content) {
    throw new Error('Logo file is empty.');
  }

  let bytes;
  try {
    bytes = Buffer.from(content, 'base64');
  } catch {
    throw new Error('Logo file could not be read.');
  }
  if (!bytes.length) {
    throw new Error('Logo file is empty.');
  }
  if (bytes.length > SPOTLIGHT_LOGO_MAX_BYTES) {
    throw new Error('Logo must be 3 MB or smaller.');
  }

  // Re-encode to normalize padding / strip data-URL noise.
  const normalized = bytes.toString('base64');
  return {
    filename,
    contentType: guessLogoContentType(filename, raw.contentType || raw.type),
    content: normalized,
    byteLength: bytes.length,
  };
}

export function logoAttachedAnswerFor(logo) {
  if (!logo?.filename) return '';
  return `Yes — attached (${logo.filename})`;
}

export function normalizeSpotlightAnswers(raw = {}) {
  const answers = {};
  for (const field of SPOTLIGHT_QUESTION_FIELDS) {
    answers[field.key] = String(raw[field.key] ?? '').trim();
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

export function buildSpotlightGuideUrl(origin) {
  return `${buildOrigin(origin)}${SPOTLIGHT_GUIDE_PUBLIC_PATH}`;
}

/** Load the chamber guide PDF for invite email attachment (base64). */
export function loadSpotlightGuideAttachment() {
  const guidePath = join(
    dirname(fileURLToPath(import.meta.url)),
    'assets',
    'fulshear-business-spotlight-guide.pdf',
  );
  const bytes = readFileSync(guidePath);
  return {
    filename: SPOTLIGHT_GUIDE_FILENAME,
    content: bytes.toString('base64'),
    contentType: 'application/pdf',
  };
}

export function buildSpotlightInviteEmail({
  brand,
  businessName,
  note,
  formUrl,
  guideUrl = '',
}) {
  const agency = 'Medici Social';
  const biz = String(businessName || '').trim();
  const subject = 'Fulshear Regional Chamber FOR Commerce - Business Spotlight';
  const noteBlock = note
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#ccc;"><em>${escapeHtml(note)}</em></p>`
    : '';
  const guideIntro =
    'Congratulations on joining the Fulshear Regional Chamber FOR Commerce! Your Business Spotlight - Branding Video is produced in partnership with Medici Social. Start with the attached Business Spotlight Guide — it explains the process, filming, and what to expect.';
  const questionnaireIntro =
    'When you are ready, complete the questionnaire below so we can write your script and prepare for filming.';
  const safeGuideUrl = String(guideUrl || '').trim();
  const guideLinkBlock = safeGuideUrl
    ? `<p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#777;">Guide:</p>
      <p style="margin:0 0 20px;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${escapeHtml(safeGuideUrl)}" style="color:#c88;">${escapeHtml(safeGuideUrl)}</a></p>`
    : `<p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#999;">The Business Spotlight Guide is attached to this email as a PDF.</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,Segoe UI,sans-serif;color:#f5f5f5;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#888;">Fulshear Regional Chamber FOR Commerce</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:600;color:#fff;">Business Spotlight</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#ccc;">
        ${escapeHtml(guideIntro)}
      </p>
      ${noteBlock}
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#c88;">1. Review the guide</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#bbb;">Open the attached PDF: <strong style="color:#fff;">${escapeHtml(SPOTLIGHT_GUIDE_FILENAME)}</strong></p>
      ${guideLinkBlock}
      <hr style="border:none;border-top:1px solid #222;margin:8px 0 24px;" />
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#c88;">2. Complete the questionnaire</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#ccc;">
        ${escapeHtml(questionnaireIntro)}
      </p>
      <a href="${escapeHtml(formUrl)}" style="display:inline-block;margin:8px 0 20px;padding:12px 24px;background:#810100;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:2px;">Open questionnaire</a>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#999;">No sign-in required. Your answers are emailed to the Chamber and Medici Social when you submit.</p>
      <p style="margin:16px 0 8px;font-size:12px;line-height:1.6;color:#777;">Questionnaire link:</p>
      <p style="margin:0 0 24px;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${escapeHtml(formUrl)}" style="color:#c88;">${escapeHtml(formUrl)}</a></p>
      <hr style="border:none;border-top:1px solid #222;margin:24px 0;" />
      <p style="margin:0;font-size:11px;line-height:1.6;color:#666;">Sent via ${escapeHtml(agency)}. Please use the button above to complete the form — do not reply to this email.</p>
    </div>
  </body>
</html>`;

  const text = [
    'Fulshear Regional Chamber FOR Commerce - Business Spotlight',
    '',
    guideIntro,
    note ? `Note: ${note}` : '',
    biz ? `Business: ${biz}` : '',
    '',
    '1. Review the guide',
    `Attached: ${SPOTLIGHT_GUIDE_FILENAME}`,
    safeGuideUrl ? `Guide: ${safeGuideUrl}` : '',
    '',
    '2. Complete the questionnaire',
    questionnaireIntro,
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
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#ccc;">
        Full answers are attached as a PDF${answers.logoAttached && /attached/i.test(answers.logoAttached) ? ', with the business logo file when provided' : ''}.
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
    'Full answers are attached as a PDF.',
    '',
    ...SPOTLIGHT_QUESTION_FIELDS.map((field) => `${field.label}: ${answers[field.key] || '—'}`),
  ];

  return { subject, html, text: textLines.join('\n') };
}

function sanitizePdfFilenamePart(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function buildSpotlightSubmissionPdfFilename(businessName) {
  const slug = sanitizePdfFilenamePart(businessName) || 'business';
  return `business-spotlight-${slug}.pdf`;
}

/** Build a PDF attachment (base64) of the submitted questionnaire answers. */
export async function buildSpotlightSubmissionPdf({ invite, answers }) {
  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const businessName = answers.businessName || invite.businessName || 'Business';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(163, 21, 29);
  doc.text('FULSHEAR REGIONAL CHAMBER FOR COMMERCE', margin, 16);

  doc.setTextColor(26, 26, 26);
  doc.setFontSize(16);
  doc.text('Business Spotlight Questionnaire', margin, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Business: ${businessName}`, margin, 34);
  doc.text(`Submitted by: ${invite.to || '—'}`, margin, 40);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 46);

  const body = SPOTLIGHT_QUESTION_FIELDS.map((field) => [
    field.label,
    answers[field.key] || '—',
  ]);

  autoTable(doc, {
    startY: 52,
    head: [['Question', 'Answer']],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      overflow: 'linebreak',
      valign: 'top',
      textColor: [26, 26, 26],
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [163, 21, 29],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [250, 247, 244] },
    columnStyles: {
      0: { cellWidth: pageW * 0.38, fontStyle: 'bold', textColor: [80, 80, 80] },
      1: { cellWidth: pageW * 0.48 },
    },
    margin: { left: margin, right: margin, bottom: 16 },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Medici Social · Business Spotlight', margin, pageH - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });
  }

  const arrayBuffer = doc.output('arraybuffer');
  const content = Buffer.from(arrayBuffer).toString('base64');
  return {
    filename: buildSpotlightSubmissionPdfFilename(businessName),
    content,
    contentType: 'application/pdf',
  };
}
