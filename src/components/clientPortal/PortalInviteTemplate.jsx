import { useState } from 'react';
import { buildPortalInviteMessage } from '../../utils/portalLogin';
import { btnSecondaryClass, glassInsetClass } from './clientPortalUi';

export default function PortalInviteTemplate({ brand, email, username, password }) {
  const [copied, setCopied] = useState(false);
  const login = (username || email || '').trim();

  if (!login) return null;

  const portalUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://portal.medicisocial.com';

  const message = buildPortalInviteMessage({
    brand,
    username: login,
    portalUrl,
    temporaryPassword: password?.trim() || '',
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`${glassInsetClass} space-y-3 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Client welcome message</p>
          <p className="mt-0.5 text-xs text-white/45">
            Copy and send to {login} — ready for email or Slack.
          </p>
        </div>
        <button type="button" onClick={handleCopy} className={`${btnSecondaryClass} py-1.5 text-[10px]`}>
          {copied ? 'Copied' : 'Copy message'}
        </button>
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-sm border border-white/[0.06] bg-black/40 p-3 text-xs leading-relaxed text-white/60">
        {message}
      </pre>
    </div>
  );
}
