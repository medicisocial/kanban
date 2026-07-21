import { readFileSync } from 'fs';
import { createServer } from 'vite';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

process.env.SPOTLIGHT_TOKEN_SECRET = 'test-spotlight-secret';
process.env.RESEND_API_KEY = '';

const {
  signSpotlightToken,
  verifySpotlightToken,
  canSendSpotlightInvite,
  getSpotlightNotifyRecipients,
  normalizeSpotlightAnswers,
  validateSpotlightAnswers,
  buildSpotlightInviteEmail,
  buildSpotlightSubmissionEmail,
  buildSpotlightFormUrl,
  SPOTLIGHT_MEDICI_EMAIL,
  SPOTLIGHT_MARINA_EMAIL,
  SPOTLIGHT_QUESTION_FIELDS,
} = await import('../api/_lib/spotlightQuestionnaire.mjs');

assert(canSendSpotlightInvite('Fulshear Regional'), 'Fulshear Regional can send spotlight invites');
assert(
  !canSendSpotlightInvite('Plume'),
  'non-chamber brand cannot send spotlight invites by default',
);

process.env.SPOTLIGHT_CHAMBER_BRANDS = 'Acme Chamber';
assert(canSendSpotlightInvite('Acme Chamber'), 'env allowlist brands can send invites');
delete process.env.SPOTLIGHT_CHAMBER_BRANDS;

const recipients = getSpotlightNotifyRecipients();
assert(recipients.includes(SPOTLIGHT_MEDICI_EMAIL), 'notify includes Medici');
assert(recipients.includes(SPOTLIGHT_MARINA_EMAIL), 'notify includes Marina');
assert(recipients.length === 2, 'default notify list has both addresses');

const token = signSpotlightToken({
  brand: 'Fulshear Regional',
  to: 'owner@example.com',
  businessName: 'Example Co',
  note: 'Welcome!',
  invitedBy: 'Marina',
});
assert(token.includes('.'), 'token has payload and signature');

const verified = verifySpotlightToken(token);
assert(verified.brand === 'Fulshear Regional', 'verified brand');
assert(verified.to === 'owner@example.com', 'verified recipient');
assert(verified.businessName === 'Example Co', 'verified business name');

let expiredCaught = false;
try {
  const expired = signSpotlightToken({
    brand: 'Fulshear Regional',
    to: 'owner@example.com',
    ttlMs: -1000,
  });
  verifySpotlightToken(expired);
} catch (error) {
  expiredCaught = /expired/i.test(error.message);
}
assert(expiredCaught, 'expired tokens are rejected');

let tamperCaught = false;
try {
  const [payload] = token.split('.');
  verifySpotlightToken(`${payload}.tampered-signature`);
} catch {
  tamperCaught = true;
}
assert(tamperCaught, 'tampered tokens are rejected');

const answers = normalizeSpotlightAnswers({
  businessName: 'Example Co',
  socialContactName: 'Alex Owner',
  socialContactEmail: 'alex@example.com',
  businessHistory: 'Family business since 2010',
  specialHook: 'Handmade goods',
  coreOffer: 'Custom gifts',
  logoAttached: 'yes',
  website: 'https://example.com',
});
assert(answers.logoAttached === 'Yes', 'logoAttached normalizes yes');
validateSpotlightAnswers(answers);

let missingCaught = false;
try {
  validateSpotlightAnswers(normalizeSpotlightAnswers({ businessName: 'Only name' }));
} catch (error) {
  missingCaught = /complete/i.test(error.message);
}
assert(missingCaught, 'required fields are enforced');

const inviteEmail = buildSpotlightInviteEmail({
  brand: 'Fulshear Regional',
  businessName: 'Example Co',
  note: 'Looking forward to filming',
  formUrl: buildSpotlightFormUrl(token, 'https://example.test'),
  invitedBy: 'Marina',
});
assert(/Business Spotlight/i.test(inviteEmail.subject), 'invite subject mentions spotlight');
assert(inviteEmail.html.includes('https://example.test/?spotlight='), 'invite includes form URL');
assert(inviteEmail.html.includes('Looking forward to filming'), 'invite includes note');
assert(
  /do not reply/i.test(inviteEmail.html) && /do not reply/i.test(inviteEmail.text),
  'invite tells recipients not to reply',
);

const submission = buildSpotlightSubmissionEmail({ invite: verified, answers });
assert(submission.subject.includes('Example Co'), 'submission subject includes business');
assert(submission.html.includes('Handmade goods'), 'submission includes answers');
assert(submission.text.includes(SPOTLIGHT_QUESTION_FIELDS[0].label), 'text includes field labels');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const clientUtils = await vite.ssrLoadModule('/src/utils/spotlightQuestionnaire.js');
assert(
  clientUtils.isChamberSpotlightBrand('Chamber of Commerce'),
  'client helper detects chamber type',
);
assert(
  !clientUtils.isChamberSpotlightBrand('Hospitality'),
  'client helper rejects non-chamber type',
);
assert(
  clientUtils.SPOTLIGHT_QUESTION_FIELDS.length === SPOTLIGHT_QUESTION_FIELDS.length,
  'client and server field schemas stay in sync',
);

const layoutSource = readFileSync(
  new URL('../src/components/clientPortal/ClientPortalLayout.jsx', import.meta.url),
  'utf8',
);
assert(layoutSource.includes("id: 'spotlight'"), 'portal nav includes Business Spotlight');
assert(layoutSource.includes('showSpotlight'), 'spotlight nav is gated');

const hubSource = readFileSync(new URL('../src/components/ClientHubPortal.jsx', import.meta.url), 'utf8');
assert(hubSource.includes('BusinessSpotlightInvite'), 'hub mounts spotlight invite');
assert(hubSource.includes('isChamberSpotlightBrand'), 'hub gates spotlight on chamber type');

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
assert(appSource.includes('isSpotlightQuestionnaireLink'), 'App routes public spotlight form');
assert(
  appSource.includes('BusinessSpotlightQuestionnairePortal'),
  'App mounts public questionnaire portal',
);

const inviteApi = readFileSync(
  new URL('../api/spotlight-questionnaire-invite.js', import.meta.url),
  'utf8',
);
assert(inviteApi.includes('isClientSessionValid'), 'invite API requires client session');
assert(inviteApi.includes('canSendSpotlightInvite'), 'invite API checks chamber brand');
assert(inviteApi.includes("replyTo: ''"), 'invite email has no Reply-To (form only, no reply)');
assert(
  !inviteApi.includes('SPOTLIGHT_MARINA_EMAIL'),
  'invite API does not set Marina as Reply-To',
);

const submitApi = readFileSync(
  new URL('../api/spotlight-questionnaire-submit.js', import.meta.url),
  'utf8',
);
assert(submitApi.includes('getSpotlightNotifyRecipients'), 'submit API emails notify list');
assert(submitApi.includes('verifySpotlightToken'), 'submit API verifies token');

const platformEmail = readFileSync(new URL('../api/_lib/platformEmail.mjs', import.meta.url), 'utf8');
assert(platformEmail.includes('Array.isArray(to)'), 'sendPlatformEmail supports multiple recipients');

await vite.close();
console.log('test-spotlight-questionnaire: ok');
