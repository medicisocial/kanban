import { useState, useEffect } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import {
  parseContentShareHash,
  mergePortalCards,
  buildContentImportUrl,
  queueContentReviewResponse,
  shouldApplyContentReviewViaShareApi,
  submitContentReviewShareResponse,
} from '../utils/contentReviewShare';
import { stripInternalCardsForClientPortal } from '../utils/clientPortalAuth';
import { clientMatchesBrand } from '../utils/clients';
import ContentReviewCard from './ContentReviewCard';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import ClientTasksTable from './clientPortal/ClientTasksTable';
import SharePortalShell from './clientPortal/SharePortalShell';
import { btnPrimaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

export default function ClientContentReviewPortal({
  client,
  cards,
  onApprove,
  onDeny,
  useCloudSync = false,
  onCloudQueueResponse,
  embedded = false,
}) {
  const { getClientColor, getClientLogo } = useClientsContext();
  const [localCards, setLocalCards] = useState([]);
  const [done, setDone] = useState(false);
  const [sessionResponses, setSessionResponses] = useState([]);
  const [respondedIds, setRespondedIds] = useState([]);
  const [copied, setCopied] = useState(false);

  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (useCloudSync) {
      const pending = stripInternalCardsForClientPortal(cards).filter(
        (card) =>
          clientMatchesBrand(card.client, client) &&
          card.columnId === 'in-review' &&
          !respondedIds.includes(card.id),
      );
      setLocalCards(pending);
      setDone(pending.length === 0);
      return;
    }

    const snapshot = parseContentShareHash();
    const merged = mergePortalCards(
      stripInternalCardsForClientPortal(cards),
      client,
      snapshot,
    ).filter(
      (card) => !respondedIds.includes(card.id),
    );
    setLocalCards(merged);
    setDone(merged.length === 0);
  }, [cards, client, respondedIds, useCloudSync]);

  const clientColor = getClientColor(client);
  const clientLogo = getClientLogo(client);
  const useShareCloudApply = shouldApplyContentReviewViaShareApi();
  const canSyncLocally = !useCloudSync && !useShareCloudApply && cards.some(
    (c) => clientMatchesBrand(c.client, client) && c.columnId === 'in-review',
  );

  const recordResponse = async (response) => {
    setSessionResponses((prev) => [
      ...prev.filter((r) => r.cardId !== response.cardId),
      response,
    ]);
    if (useShareCloudApply) {
      await submitContentReviewShareResponse({
        brand: client,
        cardId: response.cardId,
        action: response.action,
        comment: response.comment,
        timestamp: response.timestamp,
      });
      return;
    }
    if (useCloudSync && onCloudQueueResponse) {
      await onCloudQueueResponse(response);
      return;
    }
    if (!canSyncLocally) {
      queueContentReviewResponse(response);
    }
  };

  const markResponded = (cardId) => {
    setRespondedIds((prev) => (prev.includes(cardId) ? prev : [...prev, cardId]));
  };

  const handleApprove = async (cardId, comment) => {
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

    setActionError('');
    markResponded(cardId);
    try {
      await recordResponse(response);
      if (canSyncLocally) onApprove(cardId, comment, card);

      setLocalCards((prev) => {
        const next = prev.filter((c) => c.id !== cardId);
        if (next.length === 0) setDone(true);
        return next;
      });
    } catch (err) {
      setRespondedIds((prev) => prev.filter((id) => id !== cardId));
      setActionError(err.message || 'Could not save your approval. Please try again.');
    }
  };

  const handleDeny = async (cardId, comment) => {
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

    setActionError('');
    markResponded(cardId);
    try {
      await recordResponse(response);
      if (canSyncLocally) onDeny(cardId, comment, card);

      setLocalCards((prev) => {
        const next = prev.filter((c) => c.id !== cardId);
        if (next.length === 0) setDone(true);
        return next;
      });
    } catch (err) {
      setRespondedIds((prev) => prev.filter((id) => id !== cardId));
      setActionError(err.message || 'Could not save your response. Please try again.');
    }
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

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Content review"
          description="Content awaiting your approval before scheduling. Approve when ready, or submit revision notes for your production team."
        />

        {actionError && (
          <p className="mb-4 border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200/90">
            {actionError}
          </p>
        )}

        {done ? (
          <div className={`${surfacePanelClass} px-6 py-16 text-center`}>
            <h3 className="text-base font-semibold text-white">No open tasks</h3>
            <p className="mt-2 text-sm text-white/50">
              All content has been reviewed. New deliverables will appear here when ready.
            </p>
          </div>
        ) : (
          <ClientTasksTable
            cards={localCards}
            client={client}
            clientColor={clientColor}
            clientLogo={clientLogo}
            onApprove={handleApprove}
            onDeny={handleDeny}
          />
        )}
      </section>
    );
  }

  return (
    <SharePortalShell title="Content review" client={client} clientColor={clientColor}>
      {actionError && (
        <p className="mb-4 border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200/90">
          {actionError}
        </p>
      )}

      {!done ? (
        <>
          <p className="mb-6 text-sm text-white/45">
            {pendingCount} item{pendingCount === 1 ? '' : 's'} waiting for your review
          </p>

          <div className="space-y-3">
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
        <div className={`${surfacePanelClass} px-6 py-12 text-center`}>
          <h2 className="text-lg font-semibold text-white">All caught up</h2>
          <p className="mt-2 text-sm text-white/45">
            Thank you for reviewing your content.
          </p>
          {sessionResponses.length > 0 && !useCloudSync && !canSyncLocally && !useShareCloudApply && (
            <div className="mt-6 text-left">
              <p className="text-sm text-white/55">Send your feedback to Medici Social</p>
              <p className="mt-1 text-xs text-white/35">
                Copy this link and send it to your account manager so your approvals and revision notes update the board.
              </p>
              <button
                type="button"
                onClick={copyImportLink}
                className={`${btnPrimaryClass} mt-3 py-2 text-[11px]`}
              >
                {copied ? 'Link copied!' : 'Copy feedback link'}
              </button>
            </div>
          )}
        </div>
      )}
    </SharePortalShell>
  );
}
