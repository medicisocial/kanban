import { useState } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import EmailRecipientModal from './EmailRecipientModal';

export default function ClientShareButtons({
  client,
  shareType,
  getShareUrl,
  onCopyLink,
  copyDisabled = false,
  copyLabel = 'Copy link',
  copiedLabel = 'Link copied!',
}) {
  const { getClientEmails } = useClientsContext();
  const [copied, setCopied] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const savedCount = getClientEmails(client).length;

  const handleCopy = async () => {
    await onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <>
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
            onClick={() => setShowEmailModal(true)}
            disabled={copyDisabled}
            title={
              savedCount > 0
                ? `${savedCount} saved contact${savedCount === 1 ? '' : 's'} — or enter manually`
                : 'Enter an email or add contacts under Manage clients'
            }
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#f9f6f2] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Email link
          </button>
        </div>
        {savedCount > 0 && !copyDisabled && (
          <span className="text-[10px] text-gray-500">
            {savedCount} saved contact{savedCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {showEmailModal && (
        <EmailRecipientModal
          client={client}
          shareType={shareType}
          getShareUrl={getShareUrl}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </>
  );
}
