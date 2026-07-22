import { useState } from 'react';
import { getContentTypeStyle } from '../constants';
import { contentTypePillProps } from '../utils/contentTypeColors';
import { buildPeerApprovalMessage, buildPeerDenialMessage } from '../utils/contentReviewShare';
import { getStructuredScript, hasStructuredScript } from '../utils/scriptFields';
import { useClientsContext } from '../context/ClientsContext';
import ScriptPanel from './ScriptPanel';
import { glassInsetClass, inputClass } from './clientPortal/clientPortalUi';

export default function ContentReviewCard({
  card,
  peerResponses = [],
  feedbackOnly = false,
  onApprove,
  onDeny,
}) {
  const [comment, setComment] = useState('');
  const [denyError, setDenyError] = useState('');
  const { getClientColor } = useClientsContext();
  const typeStyle = getContentTypeStyle(card.contentType);
  const clientColor = getClientColor(card.client);
  const script = getStructuredScript(card);
  const showScript = hasStructuredScript(card);

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
          <span {...contentTypePillProps(typeStyle, 'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase')}>
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

        {showScript && (
          <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
              Script
            </p>
            <ScriptPanel
              hook={script.hook}
              body={script.body}
              overlays={script.overlays}
              caption={script.caption}
              readOnly
            />
          </div>
        )}

        {peerResponses
          .filter((entry) => entry.action === 'approved')
          .map((entry) => (
            <p
              key={`approve-${entry.email}-${entry.timestamp}`}
              className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
            >
              {buildPeerApprovalMessage(entry, card.contentType)}
            </p>
          ))}

        {peerResponses
          .filter((entry) => entry.action === 'denied')
          .map((entry) => (
            <div
              key={`deny-${entry.email}-${entry.timestamp}`}
              className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
            >
              <p className="font-medium">{buildPeerDenialMessage(entry, card.contentType)}</p>
              {entry.comment ? (
                <p className="mt-1.5 whitespace-pre-wrap text-rose-100/85">{entry.comment}</p>
              ) : null}
            </div>
          ))}

        {feedbackOnly ? (
          <p className="text-sm text-white/50">
            Your team is revising this based on the feedback above.
          </p>
        ) : (
          <>
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
          </>
        )}
      </div>
    </article>
  );
}
