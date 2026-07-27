import { useState } from 'react';
import ClientPortalSectionHeader from './ClientPortalSectionHeader';
import { btnPrimaryClass, inputClass, surfacePanelClass } from './clientPortalUi';
import { sendSpotlightQuestionnaireInvite } from '../../utils/spotlightQuestionnaire';

export default function BusinessSpotlightInvite({
  brand,
  session,
  userDisplayName = '',
}) {
  const [to, setTo] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const result = await sendSpotlightQuestionnaireInvite({
        to,
        businessName,
        note,
        invitedBy: userDisplayName,
        session,
      });
      setSuccess(`Questionnaire sent to ${result.to}.`);
      setTo('');
      setBusinessName('');
      setNote('');
    } catch (err) {
      setError(err?.message || 'Could not send the questionnaire.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <ClientPortalSectionHeader
        title="Business Spotlight"
        description="Email the Business Spotlight Guide (PDF) plus questionnaire link to a member business. When they submit, answers go to Marina and Medici Social."
      />

      <div className={`${surfacePanelClass} max-w-xl px-5 py-5`}>
        <p className="mb-4 text-sm text-white/55">
          Recipients get the guide PDF attached at the top of the email, then a no-login
          questionnaire link. Completed answers are emailed to{' '}
          <span className="text-white/80">marina@fulshearregional.com</span> and{' '}
          <span className="text-white/80">info@medicisocial.com</span>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/45">Recipient email</span>
            <input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputClass}
              placeholder="owner@business.com"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/45">
              Business name <span className="text-white/30">(optional)</span>
            </span>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className={inputClass}
              placeholder="Pre-fills the questionnaire"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/45">
              Personal note <span className="text-white/30">(optional)</span>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${inputClass} min-h-[5rem] resize-y`}
              placeholder={`A short note from ${brand}…`}
              rows={3}
            />
          </label>

          {error && (
            <p className="border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-200/90">
              {error}
            </p>
          )}
          {success && (
            <p className="border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-200/90">
              {success}
            </p>
          )}

          <button type="submit" disabled={busy || !to.trim()} className={btnPrimaryClass}>
            {busy ? 'Sending…' : 'Send questionnaire'}
          </button>
        </form>
      </div>
    </section>
  );
}
