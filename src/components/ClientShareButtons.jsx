import { useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { emailClientShareLink } from '../utils/clientEmail';

export default function ClientShareButtons({
  client,
  shareType,
  getShareUrl,
  onCopyLink,
  copyDisabled = false,
  copyLabel = 'Copy link',
  copiedLabel = 'Link copied!',
}) {
  const { getClientEmail } = useClientsContext();
  const [copied, setCopied] = useState(false);
  const [emailState, setEmailState] = useState('idle');
  const [emailError, setEmailError] = useState('');

  const savedEmail = (getClientEmail(client) || '').trim();

  const handleCopy = async () => {
    await onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleEmail = async () => {
    setEmailError('');
    setEmailState('sending');
    const result = await emailClientShareLink({
      client,
      url: getShareUrl(),
      type: shareType,
      getClientEmail,
    });
    if (!result.ok) {
      setEmailError(result.error);
      setEmailState('idle');
      return;
    }
    setEmailState(result.method === 'api' ? 'sent' : 'mailto');
    setTimeout(() => setEmailState('idle'), 2500);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={copyDisabled}
          className="rounded-lg bg-[#810100] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#a00000] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copied ? copiedLabel : copyLabel}
        </button>
        <button
          type="button"
          onClick={handleEmail}
          disabled={copyDisabled || emailState === 'sending'}
          title={savedEmail ? `Send to ${savedEmail}` : 'Add a client email under Manage Clients'}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#f9f6f2] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {emailState === 'sending'
            ? 'Sending…'
            : emailState === 'sent'
              ? 'Email sent!'
              : emailState === 'mailto'
                ? 'Opening email…'
                : 'Email link'}
        </button>
      </div>
      {!savedEmail && !copyDisabled && (
        <span className="text-[10px] text-gray-500">No email on file</span>
      )}
      {emailError && <span className="max-w-[220px] text-right text-[10px] text-red-300">{emailError}</span>}
    </div>
  );
}
