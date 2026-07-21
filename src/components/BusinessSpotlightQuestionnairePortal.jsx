import { useMemo, useState } from 'react';
import {
  SPOTLIGHT_PARTS,
  SPOTLIGHT_QUESTION_FIELDS,
  emptySpotlightAnswers,
  peekSpotlightTokenClient,
  readSpotlightTokenFromUrl,
  submitSpotlightQuestionnaire,
} from '../utils/spotlightQuestionnaire';

const fieldClass =
  'bsq-field w-full rounded border border-[#d8d3cc] bg-white px-3 py-2.5 text-sm text-[#1a1a1a] outline-none transition';
const labelClass = 'mb-1.5 block text-sm font-medium text-[#1a1a1a]';

function FieldInput({ field, value, onChange }) {
  if (field.type === 'yesno') {
    return (
      <div className="flex flex-wrap gap-3">
        {['Yes', 'No'].map((option) => (
          <label key={option} className="inline-flex items-center gap-2 text-sm text-[#1a1a1a]">
            <input
              type="radio"
              name={field.key}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        className={`${fieldClass} min-h-[6rem] resize-y`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        rows={4}
      />
    );
  }

  return (
    <input
      type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.type === 'url' ? 'url' : 'text'}
      className={fieldClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
    />
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

  const fieldsBySection = useMemo(() => {
    const map = new Map();
    for (const field of SPOTLIGHT_QUESTION_FIELDS) {
      if (!map.has(field.section)) map.set(field.section, []);
      map.get(field.section).push(field);
    }
    return map;
  }, []);

  const handleChange = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

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
      <div className="min-h-[100dvh] bg-[#ece7e0] px-4 py-16">
        <div className="mx-auto max-w-xl bg-white px-8 py-10 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-[#1a1a1a]">Questionnaire unavailable</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#555]">
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
      <div className="min-h-[100dvh] bg-[#ece7e0] px-4 py-16">
        <div className="mx-auto max-w-xl bg-white px-8 py-10 text-center shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#a3151d]">
            Fulshear Regional Chamber
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-[#1a1a1a]">Thank you</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#555]">
            Your Business Spotlight questionnaire was submitted. Answers were emailed to the Chamber and
            Medici Social. We’ll be in touch about scripting and filming.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#ece7e0] px-3 py-8 sm:px-6 sm:py-12">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-[900px] bg-white px-5 py-8 shadow-sm sm:px-12 sm:py-14"
      >
        <header className="flex flex-col gap-4 border-b border-[#d8d3cc] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#a3151d]">
              Video production partner
            </p>
            <h1 className="mt-2 font-serif text-3xl text-[#1a1a1a] sm:text-4xl">Business Spotlight</h1>
            <p className="mt-1 text-sm uppercase tracking-[0.18em] text-[#666]">Questionnaire</p>
          </div>
          <div className="text-left text-sm text-[#555] sm:max-w-xs sm:text-right">
            <p className="font-medium text-[#1a1a1a]">{invite.brand || 'Fulshear Regional'}</p>
            <p className="mt-1">Tell your story. Build your brand. Connect with the community.</p>
          </div>
        </header>

        <p className="mt-6 text-sm leading-relaxed text-[#444]">
          Congratulations on joining the Fulshear Regional Chamber FOR Commerce! Your Business Spotlight —
          Branding Video is produced in partnership with Medici Social. Please complete this questionnaire
          so we can write your script and prepare for filming.
        </p>
        <p className="mt-3 text-sm text-[#666]">
          On submit, answers are emailed to <strong>Marina@fulshearregional.com</strong> and{' '}
          <strong>info@medicisocial.com</strong>.
        </p>

        {invite.note ? (
          <p className="mt-4 border-l-2 border-[#a3151d] bg-[#faf7f4] px-4 py-3 text-sm italic text-[#444]">
            {invite.note}
          </p>
        ) : null}

        <div className="mt-10 space-y-10">
          {SPOTLIGHT_PARTS.map((part) => (
            <section key={part.id}>
              <h2 className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#a3151d]">
                {part.title}
              </h2>
              <div className="space-y-8">
                {part.sections.map((section) => {
                  const fields = fieldsBySection.get(section) || [];
                  const sectionHint = fields.find((f) => f.sectionHint)?.sectionHint;
                  return (
                    <div key={section}>
                      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#777]">
                        {section}
                      </h3>
                      {sectionHint ? (
                        <p className="mb-3 text-xs text-[#888]">{sectionHint}</p>
                      ) : (
                        <div className="mb-3" />
                      )}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {fields.map((field) => (
                          <label
                            key={field.key}
                            className={`block ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}
                          >
                            <span className={labelClass}>
                              {field.label}
                              {field.required ? (
                                <span className="text-[#a3151d]"> *</span>
                              ) : field.optionalHint ? (
                                <span className="font-normal text-[#999]"> (optional)</span>
                              ) : null}
                            </span>
                            <FieldInput
                              field={field}
                              value={answers[field.key] || ''}
                              onChange={(value) => handleChange(field.key, value)}
                            />
                            {field.hint ? (
                              <span className="mt-1 block text-xs text-[#888]">{field.hint}</span>
                            ) : null}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-[#777]">
          Note: Photos and additional footage will be requested separately once the script is finalized. Your
          video is yours to use as your own year-round branding content.
        </p>

        {error ? (
          <p className="mt-4 border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="bsq-submit mt-6 inline-flex items-center justify-center bg-[#a3151d] px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition disabled:opacity-50"
        >
          {busy ? 'Submitting…' : 'Submit questionnaire'}
        </button>

        <footer className="mt-10 border-t border-[#d8d3cc] pt-5 text-xs leading-relaxed text-[#777]">
          Marina Pallatt, Director of Business Development & Memberships | (832) 600-3221 |
          Marina@fulshearregional.com — Medici Social | info@medicisocial.com | @medicisocial
        </footer>
      </form>
    </div>
  );
}
