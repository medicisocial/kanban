import { useState, useEffect } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import {
  parseContentShareHash,
  mergePortalCards,
  buildContentImportUrl,
  queueContentReviewResponse,
} from '../utils/contentReviewShare';
import ContentReviewCard from './ContentReviewCard';

export default function ClientContentReviewPortal({
  client,
  cards,
  onApprove,
  onDeny,
}) {
  const { getClientColor } = useClientsContext();
  const [localCards, setLocalCards] = useState([]);
  const [done, setDone] = useState(false);
  const [sessionResponses, setSessionResponses] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const snapshot = parseContentShareHash();
    const merged = mergePortalCards(cards, client, snapshot);
    setLocalCards(merged);
    setDone(merged.length === 0);
  }, [cards, client]);

  const clientColor = getClientColor(client);
  const canSyncLocally = cards.some(
    (c) => c.client === client && c.columnId === 'in-review',
  );

  const recordResponse = (response) => {
    setSessionResponses((prev) => [
      ...prev.filter((r) => r.cardId !== response.cardId),
      response,
    ]);
    if (!canSyncLocally) {
      queueContentReviewResponse(response);
    }
  };

  const handleApprove = (cardId, comment) => {
    const card = localCards.find((c) => c.id === cardId);
    if (!card) return;

    const response = {
      cardId,
      action: 'approved',
      comment,
      client,
      card,
      timestamp: Date.now(),
    };

    recordResponse(response);
    if (canSyncLocally) onApprove(cardId, comment, card);

    setLocalCards((prev) => {
      const next = prev.filter((c) => c.id !== cardId);
      if (next.length === 0) setDone(true);
      return next;
    });
  };

  const handleDeny = (cardId, comment) => {
    const card = localCards.find((c) => c.id === cardId);
    if (!card) return;

    const trimmed = (comment || '').trim();
    if (!trimmed) return;

    const response = {
      cardId,
      action: 'denied',
      comment: trimmed,
      client,
      card,
      timestamp: Date.now(),
    };

    recordResponse(response);
    if (canSyncLocally) onDeny(cardId, comment, card);

    setLocalCards((prev) => {
      const next = prev.filter((c) => c.id !== cardId);
      if (next.length === 0) setDone(true);
      return next;
    });
  };

  const copyImportLink = async () => {
    const url = buildContentImportUrl(sessionResponses);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this link and send it to Medici Social:', url);
    }
  };

  const pendingCount = localCards.length;

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <header className="border-b border-white/5 bg-[#0f1117]/95 px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-[800px] items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Medici Social</p>
            <h1 className="text-lg font-semibold text-white">Content Review</h1>
            <p className="text-sm" style={{ color: clientColor }}>{client}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[800px] px-4 py-8 sm:px-6">
        {!done ? (
          <>
            <p className="mb-2 text-sm text-gray-300">
              Review the content below. Approve when it&apos;s ready to schedule, or mark not approved with notes explaining what to change.
            </p>
            <p className="mb-6 text-xs text-gray-500">
              {pendingCount} item{pendingCount === 1 ? '' : 's'} waiting for your review
            </p>

            <div className="space-y-4">
              {localCards.map((card) => (
                <ContentReviewCard
                  key={card.id}
                  card={card}
                  onApprove={handleApprove}
                  onDeny={handleDeny}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-12 text-center">
            <p className="text-2xl">🎉</p>
            <h2 className="mt-3 text-lg font-semibold text-white">All caught up!</h2>
            <p className="mt-2 text-sm text-gray-400">
              Thank you for reviewing your content.
            </p>
            {sessionResponses.length > 0 && !canSyncLocally && (
              <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-left">
                <p className="text-sm text-gray-300">Send your feedback to Medici Social</p>
                <p className="mt-1 text-xs text-gray-500">
                  Copy this link and send it to your account manager so your approvals and revision notes update the board.
                </p>
                <button
                  type="button"
                  onClick={copyImportLink}
                  className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                >
                  {copied ? 'Link copied!' : 'Copy feedback link'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
