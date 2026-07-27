/** Client-side helpers for Business Spotlight questionnaire (mirror of API field schema). */

export const SPOTLIGHT_QUESTION_FIELDS = [
  { key: 'businessName', label: 'Business name', section: 'Business information', required: true, type: 'text' },
  { key: 'instagramHandle', label: 'Instagram handle', section: 'Business information', type: 'text' },
  { key: 'facebookPage', label: 'Facebook page', section: 'Business information', type: 'text', optionalHint: true },
  { key: 'website', label: 'Website', section: 'Business information', type: 'url', optionalHint: true },
  {
    key: 'logoAttached',
    label: 'High-resolution logo',
    section: 'Business information',
    type: 'file',
    hint: 'PNG, JPG, SVG, AI, or EPS preferred',
  },
  { key: 'socialContactName', label: 'Full name', section: 'Social media contact', required: true, type: 'text' },
  { key: 'socialContactPhone', label: 'Phone number', section: 'Social media contact', type: 'tel' },
  { key: 'socialContactEmail', label: 'Email address', section: 'Social media contact', required: true, type: 'email' },
  { key: 'giveawayPrize', label: 'Giveaway prize', section: 'Giveaway information', type: 'text' },
  { key: 'giveawayValue', label: 'Approximate value', section: 'Giveaway information', type: 'text' },
  {
    key: 'giveawayRestrictions',
    label: 'Restrictions or expiration dates',
    section: 'Giveaway information',
    type: 'textarea',
  },
  { key: 'giveawayContactName', label: 'Full name', section: 'Giveaway contact', type: 'text', sectionHint: 'If different from social media contact' },
  { key: 'giveawayContactPhone', label: 'Phone number', section: 'Giveaway contact', type: 'tel' },
  { key: 'giveawayContactEmail', label: 'Email address', section: 'Giveaway contact', type: 'email' },
  {
    key: 'filmingNames',
    label: 'Full name(s) of anyone appearing in the video',
    section: 'Filming information',
    type: 'textarea',
  },
  {
    key: 'businessHistory',
    label: 'Tell us about the history of the business and who owns/runs it',
    section: 'Business history & ownership',
    required: true,
    type: 'textarea',
  },
  {
    key: 'yearsInBusiness',
    label: 'How long has the business (or owner) been doing this work?',
    section: 'Business history & ownership',
    type: 'text',
  },
  {
    key: 'specialHook',
    label: "What's the ONE thing that makes your business special or different?",
    section: 'The “special” hook',
    required: true,
    type: 'textarea',
  },
  {
    key: 'signatureSpecialty',
    label: 'Do you have a signature product, service, or specialty? Describe it',
    section: 'The “special” hook',
    type: 'textarea',
  },
  {
    key: 'personalStory',
    label: 'Is there a personal story behind the business (why you started it, a tradition, a passion)?',
    section: 'The “special” hook',
    type: 'textarea',
  },
  {
    key: 'coreOffer',
    label: "What's the core offer or value proposition for new customers?",
    section: 'The offer',
    required: true,
    type: 'textarea',
  },
  {
    key: 'pricingDetails',
    label: 'Any specific pricing, packages, or details you want mentioned?',
    section: 'The offer',
    type: 'textarea',
  },
  {
    key: 'scriptQuotes',
    label: "Any specific quotes, phrases, or taglines you'd like included?",
    section: 'Script preferences',
    type: 'textarea',
  },
  {
    key: 'scriptExclusions',
    label: 'Anything you do NOT want mentioned or shown in the video?',
    section: 'Script preferences',
    type: 'textarea',
  },
];

export const SPOTLIGHT_PARTS = [
  {
    id: 'part1',
    title: 'Part 1 — Information for your video',
    sections: [
      'Business information',
      'Social media contact',
      'Giveaway information',
      'Giveaway contact',
      'Filming information',
    ],
  },
  {
    id: 'part2',
    title: 'Part 2 — Tell us your story',
    sections: ['Business history & ownership', 'The “special” hook', 'The offer', 'Script preferences'],
  },
];

function base64UrlDecode(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function readSpotlightTokenFromUrl() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('spotlight') || '';
}

export function isSpotlightQuestionnaireLink() {
  return Boolean(readSpotlightTokenFromUrl());
}

export function peekSpotlightTokenClient(token) {
  const raw = String(token || '').trim();
  const [encodedPayload] = raw.split('.');
  if (!encodedPayload) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const exp = Number(payload.exp) || 0;
    return {
      brand: String(payload.brand || '').trim(),
      to: String(payload.to || '').trim().toLowerCase(),
      businessName: String(payload.businessName || '').trim(),
      note: String(payload.note || '').trim(),
      invitedBy: String(payload.invitedBy || '').trim(),
      exp,
      expired: exp > 0 && Date.now() > exp,
    };
  } catch {
    return null;
  }
}

export function emptySpotlightAnswers(prefill = {}) {
  const answers = {};
  for (const field of SPOTLIGHT_QUESTION_FIELDS) {
    answers[field.key] = prefill[field.key] || '';
  }
  if (prefill.businessName) answers.businessName = prefill.businessName;
  return answers;
}

export async function sendSpotlightQuestionnaireInvite({ to, businessName, note, invitedBy, session }) {
  const response = await fetch('/api/spotlight-questionnaire-invite', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, businessName, note, invitedBy }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Could not send the questionnaire invite.');
  }
  return payload;
}

export const SPOTLIGHT_LOGO_MAX_BYTES = 3 * 1024 * 1024;
export const SPOTLIGHT_LOGO_ACCEPT = '.png,.jpg,.jpeg,.svg,.webp,.ai,.eps';

function extensionOf(filename) {
  const match = String(filename || '')
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read the logo file.'));
    reader.readAsDataURL(file);
  });
}

/** Validate and encode a logo File for questionnaire submit. */
export async function prepareSpotlightLogoAttachment(file) {
  if (!file) return null;
  const filename = String(file.name || 'logo').trim().replace(/[/\\]/g, '-').slice(0, 120);
  const ext = extensionOf(filename);
  const allowed = new Set(['png', 'jpg', 'jpeg', 'svg', 'webp', 'ai', 'eps']);
  if (!allowed.has(ext)) {
    throw new Error('Logo must be PNG, JPG, SVG, WEBP, AI, or EPS.');
  }
  if (Number(file.size) > SPOTLIGHT_LOGO_MAX_BYTES) {
    throw new Error('Logo must be 3 MB or smaller.');
  }
  const content = await readFileAsBase64(file);
  return {
    filename,
    contentType: file.type || 'application/octet-stream',
    content,
  };
}

export async function submitSpotlightQuestionnaire({ token, answers, logo = null }) {
  const response = await fetch('/api/spotlight-questionnaire-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, answers, logo }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Could not submit the questionnaire.');
  }
  return payload;
}

export function isChamberSpotlightBrand(businessType) {
  return String(businessType || '').trim() === 'Chamber of Commerce';
}
