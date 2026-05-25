import { useEffect, useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { useGmail } from '../hooks/useGmail';
import { MEDICI_SENDER_EMAIL, MEDICI_SENDER_NAME } from '../constants';
import { isValidEmail, openClientShareEmail } from '../utils/clientEmail';

const inputClass =
  'select-dark w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-[#f9f6f2] outline-none transition focus:border-[#810100]/50';

export default function EmailRecipientModal({ client, shareType, getShareUrl, onClose }) {
  const { getClientEmails } = useClientsContext();
  const { sendShareEmail } = useGmail();
  const savedEmails = getClientEmails(client);
  const [selectedEmail, setSelectedEmail] = useState(savedEmails[0] || '');
  const [customEmail, setCustomEmail] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const useCustom = customEmail.trim().length > 0;
  const recipient = useCustom ? customEmail.trim() : selectedEmail.trim();

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');

    if (!recipient) {
      setError('Choose a saved contact or enter an email address.');
      return;
    }
    if (!isValidEmail(recipient)) {
      setError('Enter a valid email address.');
      return;
    }

    const url = getShareUrl();
    setSending(true);
    const result = await sendShareEmail({ to: recipient, type: shareType, client, url });
    setSending(false);

    if (!result.ok) {
      if (result.error?.includes('not configured')) {
        openClientShareEmail({ to: recipient, type: shareType, client, url });
        onClose();
        return;
      }
      setError(result.error);
      return;
    }

    setSent(true);
    setTimeout(onClose, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSend}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="font-serif text-lg font-semibold text-white">Email {client}</h2>
          <p className="mt-1 text-sm text-gray-400">
            Sends from <span className="text-[#f9f6f2]">{MEDICI_SENDER_NAME}</span> (
            {MEDICI_SENDER_EMAIL}).
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          {savedEmails.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Saved contacts
              </legend>
              {savedEmails.map((email) => (
                <label
                  key={email}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                    !useCustom && selectedEmail === email
                      ? 'border-[#810100]/50 bg-[#810100]/10'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <input
                    type="radio"
                    name="recipient"
                    value={email}
                    checked={!useCustom && selectedEmail === email}
                    onChange={() => {
                      setCustomEmail('');
                      setSelectedEmail(email);
                    }}
                    className="accent-[#810100]"
                  />
                  <span className="text-sm text-[#f9f6f2]">{email}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="text-sm text-gray-500">
              No saved contacts yet. Add emails under Manage clients, or enter one below.
            </p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Or enter email
            </span>
            <input
              type="email"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              placeholder="client@company.com"
              className={inputClass}
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {sent && <p className="text-sm text-green-400">Email sent!</p>}
        </div>

        <div className="flex gap-2 border-t border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending || sent}
            className="flex-1 rounded-lg bg-[#810100] py-2.5 text-sm font-medium text-white hover:bg-[#a00000] disabled:opacity-60"
          >
            {sending ? 'Sending…' : sent ? 'Sent!' : 'Send email'}
          </button>
        </div>
      </form>
    </div>
  );
}
