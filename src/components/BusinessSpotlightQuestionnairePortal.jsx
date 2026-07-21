import { useMemo, useState } from 'react';
import {
  emptySpotlightAnswers,
  peekSpotlightTokenClient,
  readSpotlightTokenFromUrl,
  submitSpotlightQuestionnaire,
} from '../utils/spotlightQuestionnaire';

const FIELD_STYLE = {
  width: '100%',
  boxSizing: 'border-box',
  border: 'none',
  borderBottom: '1px solid #b9b3a9',
  padding: '8px 2px',
  fontSize: 15,
  fontFamily: 'Arial, Helvetica, sans-serif',
  color: '#1a1a1a',
  background: 'transparent',
};

const AREA_STYLE = {
  ...FIELD_STYLE,
  resize: 'vertical',
  border: '1px solid #d8d3cc',
  borderRadius: 2,
  padding: '8px 10px',
};

const sectionTitle = (extra = {}) => ({
  fontWeight: 800,
  color: '#a3151d',
  fontSize: 14,
  letterSpacing: '0.03em',
  ...extra,
});

const labelStyle = (first = false) => ({
  display: 'block',
  fontWeight: 'bold',
  fontSize: 14,
  marginBottom: 4,
  ...(first ? {} : { marginTop: 16 }),
});

const optionalSpan = {
  fontWeight: 'normal',
  color: '#6b6b6b',
};

const partBanner = (marginTop) => ({
  background: '#a3151d',
  color: '#ffffff',
  textAlign: 'center',
  fontWeight: 800,
  fontSize: 18,
  letterSpacing: '0.04em',
  padding: 12,
  margin: `${marginTop}px 0 24px`,
});

function Field({
  label,
  value,
  onChange,
  placeholder,
  optional,
  hint,
  first = false,
  multiline = false,
  rows = 2,
  required = false,
  type = 'text',
}) {
  return (
    <>
      <label style={labelStyle(first)}>
        {label}
        {optional ? <span style={optionalSpan}> (optional)</span> : null}
        {hint ? <span style={optionalSpan}> {hint}</span> : null}
        {required ? <span style={{ color: '#a3151d' }}> *</span> : null}
      </label>
      {multiline ? (
        <textarea
          className="bsq-field"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          style={AREA_STYLE}
        />
      ) : (
        <input
          className="bsq-field"
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={FIELD_STYLE}
        />
      )}
    </>
  );
}

export default function BusinessSpotlightQuestionnairePortal() {
  const token = useMemo(() => readSpotlightTokenFromUrl(), []);
  const invite = useMemo(() => peekSpotlightTokenClient(token), [token]);
  const [answers, setAnswers] = useState(() =>
    emptySpotlightAnswers({ businessName: invite?.businessName || '' }),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (key) => (value) => setAnswers((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await submitSpotlightQuestionnaire({ token, answers });
      setDone(true);
    } catch (err) {
      setError(err?.message || 'Could not submit the questionnaire.');
    } finally {
      setBusy(false);
    }
  };

  if (!token || !invite || invite.expired) {
    return (
      <div style={{ minHeight: '100vh', background: '#ece7e0', padding: '64px 16px' }}>
        <div
          style={{
            maxWidth: 560,
            margin: '0 auto',
            background: '#fff',
            padding: '40px 32px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Questionnaire unavailable</h1>
          <p style={{ margin: 0, color: '#555', lineHeight: 1.6 }}>
            {invite?.expired
              ? 'This questionnaire link has expired. Please ask the Chamber for a new invite.'
              : 'This Business Spotlight link is missing or invalid.'}
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: '#ece7e0', padding: '64px 16px' }}>
        <div
          style={{
            maxWidth: 560,
            margin: '0 auto',
            background: '#fff',
            padding: '40px 32px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: 11, fontWeight: 'bold', letterSpacing: '0.06em', color: '#a3151d' }}>
            FULSHEAR REGIONAL CHAMBER
          </p>
          <h1 style={{ fontSize: 26, margin: '12px 0' }}>Thank you</h1>
          <p style={{ margin: 0, color: '#555', lineHeight: 1.6 }}>
            Your Business Spotlight questionnaire was submitted. Answers were emailed to the Chamber and
            Medici Social. We’ll be in touch about scripting and filming.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#ece7e0' }}>
      <style>{`
        .bsq-field::placeholder { color: #adaaa5; }
        .bsq-field:focus { outline: none; border-color: #a3151d !important; }
        .bsq-submit:hover { background: #861118 !important; }
        @media (max-width: 720px) {
          .bsq-card { padding: 28px 20px 40px !important; }
          .bsq-header { flex-direction: column !important; }
          .bsq-row { flex-direction: column !important; }
        }
      `}</style>
      <form className="bsq-card" onSubmit={handleSubmit} style={{
        maxWidth: 900,
        margin: '0 auto',
        background: '#ffffff',
        padding: '56px 64px 72px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#1a1a1a',
      }}
      >
        <div
          className="bsq-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 24,
            paddingBottom: 20,
            borderBottom: '1px solid #d8d3cc',
          }}
        >
          <img
            src="/fulshear-chamber-logo.png"
            alt="Fulshear Regional Chamber FOR Commerce"
            style={{ height: 83, width: 256, objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 'bold',
                letterSpacing: '0.06em',
                color: '#6b6b6b',
                marginBottom: 6,
                textAlign: 'center',
              }}
            >
              VIDEO PRODUCTION PARTNER
            </div>
            <img
              src="/medici-social-logo.png"
              alt="Medici Social"
              style={{ height: 39, width: 135, objectFit: 'contain' }}
            />
          </div>
        </div>

        <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '0.01em', margin: '32px 0 2px' }}>
          BUSINESS SPOTLIGHT
        </h1>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: '#a3151d', margin: '0 0 20px', letterSpacing: '0.02em' }}>
          - QUESTIONNAIRE -
        </h2>
        <p style={{ fontStyle: 'italic', fontSize: 17, margin: '0 0 20px' }}>
          Tell Your Story. Build Your Brand. Connect with the Community.
        </p>

        <div
          style={{
            background: '#f5f0ea',
            border: '1px solid #e2dcd2',
            padding: '20px 24px',
            fontSize: 15,
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: '0 0 12px' }}>
            Congratulations on joining the Fulshear Regional Chamber FOR Commerce! Your Business Spotlight -
            Branding Video is produced in partnership with Medici Social. Please complete this questionnaire
            so we can write your script and prepare for filming.
          </p>
          <p style={{ margin: 0, fontWeight: 'bold' }}>
            When you submit, answers are emailed to BOTH: Marina@fulshearregional.com and
            info@medicisocial.com
          </p>
        </div>

        {invite.note ? (
          <p
            style={{
              margin: '16px 0 0',
              padding: '12px 16px',
              borderLeft: '3px solid #a3151d',
              background: '#faf7f4',
              fontStyle: 'italic',
              fontSize: 14,
            }}
          >
            {invite.note}
          </p>
        ) : null}

        <div style={partBanner(32)}>PART 1 — INFORMATION FOR YOUR VIDEO</div>

        <div style={sectionTitle({ marginBottom: 12 })}>BUSINESS INFORMATION</div>
        <Field label="Business name" value={answers.businessName} onChange={set('businessName')} first required />
        <Field
          label="Instagram handle"
          value={answers.instagramHandle}
          onChange={set('instagramHandle')}
          placeholder="@yourbusiness"
        />
        <Field label="Facebook page" value={answers.facebookPage} onChange={set('facebookPage')} optional />
        <Field label="Website" value={answers.website} onChange={set('website')} optional />
        <Field
          label="High-resolution logo attached?"
          value={answers.logoAttached}
          onChange={set('logoAttached')}
          hint="(PNG, AI, EPS, or SVG preferred)"
          placeholder="Yes / No — how you'll send it"
        />

        <div style={sectionTitle({ margin: '28px 0 12px' })}>SOCIAL MEDIA CONTACT</div>
        <div className="bsq-row" style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1.4 }}>
            <Field
              label="Full name"
              value={answers.socialContactName}
              onChange={set('socialContactName')}
              first
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <Field
              label="Phone number"
              value={answers.socialContactPhone}
              onChange={set('socialContactPhone')}
              first
            />
          </div>
        </div>
        <Field
          label="Email address"
          value={answers.socialContactEmail}
          onChange={set('socialContactEmail')}
          type="email"
          required
        />

        <div style={sectionTitle({ margin: '28px 0 12px' })}>GIVEAWAY INFORMATION</div>
        <Field label="Giveaway prize" value={answers.giveawayPrize} onChange={set('giveawayPrize')} first />
        <div className="bsq-row" style={{ display: 'flex', gap: 24, marginTop: 16 }}>
          <div style={{ flex: 1 }}>
            <Field
              label="Approximate value"
              value={answers.giveawayValue}
              onChange={set('giveawayValue')}
              first
            />
          </div>
          <div style={{ flex: 1.4 }}>
            <Field
              label="Restrictions or expiration dates"
              value={answers.giveawayRestrictions}
              onChange={set('giveawayRestrictions')}
              first
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '28px 0 12px' }}>
          <div style={sectionTitle()}>GIVEAWAY CONTACT</div>
          <div style={{ fontSize: 12, color: '#6b6b6b' }}>(if different from social media contact)</div>
        </div>
        <div className="bsq-row" style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1.4 }}>
            <Field
              label="Full name"
              value={answers.giveawayContactName}
              onChange={set('giveawayContactName')}
              first
            />
          </div>
          <div style={{ flex: 1 }}>
            <Field
              label="Phone number"
              value={answers.giveawayContactPhone}
              onChange={set('giveawayContactPhone')}
              first
            />
          </div>
        </div>
        <Field
          label="Email address"
          value={answers.giveawayContactEmail}
          onChange={set('giveawayContactEmail')}
          type="email"
        />

        <div style={sectionTitle({ margin: '28px 0 12px' })}>FILMING INFORMATION</div>
        <Field
          label="Full name(s) of anyone appearing in the video"
          value={answers.filmingNames}
          onChange={set('filmingNames')}
          first
          multiline
          rows={2}
        />

        <div style={partBanner(40)}>PART 2 — TELL US YOUR STORY</div>

        <div style={sectionTitle({ marginBottom: 12 })}>BUSINESS HISTORY & OWNERSHIP</div>
        <Field
          label="Tell us about the history of the business and who owns/runs it"
          value={answers.businessHistory}
          onChange={set('businessHistory')}
          first
          multiline
          rows={3}
          required
        />
        <Field
          label="How long has the business (or owner) been doing this work?"
          value={answers.yearsInBusiness}
          onChange={set('yearsInBusiness')}
        />

        <div style={sectionTitle({ margin: '28px 0 12px' })}>THE &quot;SPECIAL&quot; HOOK</div>
        <Field
          label="What's the ONE thing that makes your business special or different?"
          value={answers.specialHook}
          onChange={set('specialHook')}
          first
          multiline
          rows={2}
          required
        />
        <Field
          label="Do you have a signature product, service, or specialty? Describe it"
          value={answers.signatureSpecialty}
          onChange={set('signatureSpecialty')}
          multiline
          rows={2}
        />
        <Field
          label="Is there a personal story behind the business (why you started it, a tradition, a passion)?"
          value={answers.personalStory}
          onChange={set('personalStory')}
          multiline
          rows={3}
        />

        <div style={sectionTitle({ margin: '28px 0 12px' })}>THE OFFER</div>
        <Field
          label="What's the core offer or value proposition for new customers?"
          value={answers.coreOffer}
          onChange={set('coreOffer')}
          first
          multiline
          rows={2}
          required
        />
        <Field
          label="Any specific pricing, packages, or details you want mentioned?"
          value={answers.pricingDetails}
          onChange={set('pricingDetails')}
          multiline
          rows={2}
        />

        <div style={sectionTitle({ margin: '28px 0 12px' })}>SCRIPT PREFERENCES</div>
        <Field
          label="Any specific quotes, phrases, or taglines you'd like included?"
          value={answers.scriptQuotes}
          onChange={set('scriptQuotes')}
          first
          multiline
          rows={2}
        />
        <Field
          label="Anything you do NOT want mentioned or shown in the video?"
          value={answers.scriptExclusions}
          onChange={set('scriptExclusions')}
          multiline
          rows={2}
        />

        <p
          style={{
            fontSize: 12,
            color: '#6b6b6b',
            fontStyle: 'italic',
            lineHeight: 1.6,
            margin: '28px 0 0',
            borderTop: '1px solid #d8d3cc',
            paddingTop: 20,
          }}
        >
          Note: Photos and additional footage will be requested separately once the script is finalized. Your
          video is yours to use as your own year-round branding content.
        </p>

        <div
          style={{
            marginTop: 32,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            background: '#f5f0ea',
            border: '1px solid #e2dcd2',
            padding: 24,
          }}
        >
          <div style={{ fontSize: 14, color: '#1a1a1a', textAlign: 'center' }}>
            Ready to submit? Your answers will be emailed to Marina@fulshearregional.com and
            info@medicisocial.com.
          </div>
          <button
            type="submit"
            className="bsq-submit"
            disabled={busy}
            style={{
              display: 'inline-block',
              background: '#a3151d',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: '0.03em',
              padding: '14px 32px',
              textDecoration: 'none',
              border: 'none',
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.7 : 1,
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
          >
            {busy ? 'SUBMITTING…' : 'SUBMIT QUESTIONNAIRE'}
          </button>
          {error ? (
            <div style={{ fontSize: 13, color: '#861118', textAlign: 'center' }}>{error}</div>
          ) : null}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#6b6b6b', margin: '28px 0 0' }}>
          Marina Pallatt, Director of Business Development & Memberships | (832) 600-3221 |
          Marina@fulshearregional.com — Medici Social | info@medicisocial.com | @medicisocial
        </p>
      </form>
    </div>
  );
}
