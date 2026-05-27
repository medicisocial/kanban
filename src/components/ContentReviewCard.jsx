import { useState } from 'react';
import { getContentTypeStyle } from '../constants';
import { useClientsContext } from '../context/ClientsContext';
import { glassInsetClass, inputClass } from './clientPortal/clientPortalUi';

export default function ContentReviewCard({ card, onApprove, onDeny }) {
  const [comment, setComment] = useState('');
  const [denyError, setDenyError] = useState('');
  const { getClientColor } = useClientsContext();
  const typeStyle = getContentTypeStyle(card.contentType);
  const clientColor = getClientColor(card.client);

  const handleDeny = () => {
    const trimmed = comment.trim();
    if (!trimmed) {
      setDenyError('Please explain what needs to change before submitting.');
      return;
    }
    setDenyError('');
    onDeny(card.id, trimmed);
  };

  return (
    <article
      className={`${glassInsetClass} flex flex-col overflow-hidden`}
      style={{ borderTopColor: clientColor, borderTopWidth: '3px' }}
    >
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <span className="text-xs font-semibold" style={{ color: clientColor }}>
              {card.client}
            </span>
            <h3 className="mt-0.5 text-base font-semibold text-white">{card.title}</h3>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${typeStyle.label}`}
            style={{ backgroundColor: `${typeStyle.border}22` }}
          >
            {card.contentType}
          </span>
        </div>

        {card.dropboxLink ? (
          <a
            href={card.dropboxLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2.5 text-sm text-[#fca5a5] transition hover:bg-white/10 hover:text-[#fecaca]"
          >
            <span>📁</span>
            <span className="truncate">View content in Dropbox ↗</span>
          </a>
        ) : (
          <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Content link not attached yet — your team may still be uploading.
          </p>
        )}

        {card.notes && (
          <p className="mb-3 text-sm text-gray-400">{card.notes}</p>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-gray-400">
            Your feedback (optional for approve, required if not approved)
          </span>
          <textarea
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (denyError) setDenyError('');
            }}
            rows={3}
            placeholder="If this isn't approved, explain what needs to change..."
            className={`${inputClass} resize-y`}
          />
        </label>

        {denyError && (
          <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {denyError}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onApprove(card.id, comment.trim())}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            ✓ Approve
          </button>
          <button
            type="button"
            onClick={handleDeny}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
          >
            Not approved
          </button>
        </div>
      </div>
    </article>
  );
}
