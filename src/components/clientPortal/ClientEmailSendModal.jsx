import { useEffect, useMemo, useState } from 'react';
import { useClientsContext } from '../../context/ClientsContext';
import {
  buildClientEmailRecipients,
  formatRecipientLabel,
} from '../../utils/clientEmailRecipients';
import { getAgencyDisplayName, getPortalSignInUrl, sendClientNotification } from '../../utils/sendClientNotification';
import { isValidPortalEmail, normalizePortalLogin } from '../../utils/portalLogin';
import { btnPrimaryClass, btnSecondaryClass, inputClass, glassInsetClass } from './clientPortalUi';

const SHARE_LABELS = {
  ideas: 'Video ideas',
  calendar: 'Content calendar',
  review: 'Content review',
  portal_invite: 'Portal invite',
};

export default function ClientEmailSendModal({
  open,
  onClose,
  client,
  shareType,
  shareUrl,
  itemCount = 0,
}) {
  const { getClientContacts, getClientUsers } = useClientsContext();
  const [selected, setSelected] = useState(() => new Set());
  const [extraEmail, setExtraEmail] = useState('');
  const [extras, setExtras] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const recipients = useMemo(
    () => buildClientEmailRecipients(getClientContacts(client), getClientUsers(client)),
    [client, getClientContacts, getClientUsers],
  );

  const allRecipients = useMemo(() => {
    const merged = [...recipients];
    for (const extra of extras) {
      if (!merged.some((entry) => entry.email === extra.email)) {
        merged.push(extra);
      }
    }
    return merged;
  }, [recipients, extras]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(recipients.map((entry) => entry.email)));
    setExtraEmail('');
    setExtras([]);
    setError('');
    setMessage('');
  }, [open, client, recipients]);

  if (!open) return null;

  const toggleRecipient = (email) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const addExtraEmail = () => {
    const email = normalizePortalLogin(extraEmail);
    if (!isValidPortalEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setExtras((prev) => {
      if (prev.some((entry) => entry.email === email)) return prev;
      return [
        ...prev,
        { id: `extra-${email}`, email, name: '', role: 'Added manually', source: 'manual' },
      ];
    });
    setSelected((prev) => new Set(prev).add(email));
    setExtraEmail('');
  };

  const handleSend = async () => {
    const chosen = allRecipients.filter((entry) => selected.has(entry.email));
    if (chosen.length === 0) {
      setError('Select at least one recipient.');
      return;
    }

    setSending(true);
    setError('');
    setMessage('');

    try {
      const result = await sendClientNotification({
        shareType,
        client,
        shareUrl,
        portalUrl: getPortalSignInUrl(),
        itemCount,
        recipients: chosen,
      });
      setMessage(
        `Sent to ${result.sent} recipient${result.sent === 1 ? '' : 's'} from ${getAgencyDisplayName()}.`,
      );
      setTimeout(() => onClose?.(), 1800);
    } catch (err) {
      setError(err.message || 'Could not send email.');
    } finally {
      setSending(false);
    }
  };

  const shareLabel = SHARE_LABELS[shareType] || 'Update';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col border border-white/[0.08] bg-[#0a0a0a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/[0.08] px-5 py-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/40">Send email</p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            {shareLabel} — {client}
          </h2>
          <p className="mt-1 text-sm text-white/45">
            Sent from {getAgencyDisplayName()} via platform email. Recipients can open your share link without signing in.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className={glassInsetClass}>
            <div className="border-b border-white/[0.08] px-4 py-3">
              <p className="text-sm font-medium text-white">Recipients</p>
              <p className="mt-0.5 text-xs text-white/40">
                From Contacts and Portal access. Add one-off emails below.
              </p>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {allRecipients.length === 0 ? (
                <p className="px-4 py-6 text-sm text-white/45">
                  No saved emails yet. Add contacts under Clients → Contacts, or enter an email below.
                </p>
              ) : (
                allRecipients.map((recipient) => (
                  <label
                    key={recipient.id}
                    className="flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-white/[0.02]"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(recipient.email)}
                      onChange={() => toggleRecipient(recipient.email)}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-black text-[#810100]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-white">{formatRecipientLabel(recipient)}</span>
                      <span className="mt-0.5 block text-[10px] uppercase tracking-[0.18em] text-white/35">
                        {recipient.role}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              type="email"
              value={extraEmail}
              onChange={(e) => setExtraEmail(e.target.value)}
              placeholder="Add email address"
              className={`${inputClass} flex-1`}
            />
            <button type="button" onClick={addExtraEmail} className={`${btnSecondaryClass} shrink-0`}>
              Add
            </button>
          </div>

          {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
          {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.08] px-5 py-4">
          <button type="button" onClick={onClose} disabled={sending} className={btnSecondaryClass}>
            Cancel
          </button>
          <button type="button" onClick={handleSend} disabled={sending} className={`${btnPrimaryClass} disabled:opacity-50`}>
            {sending ? 'Sending…' : `Send to ${selected.size || 0}`}
          </button>
        </div>
      </div>
    </div>
  );
}
