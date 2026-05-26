import { useState, useEffect } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import {
  parseContentShareHash,
  mergePortalCards,
  buildContentImportUrl,
  queueContentReviewResponse,
} from '../utils/contentReviewShare';
import ContentReviewCard from './ContentReviewCard';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import ClientTasksTable from './clientPortal/ClientTasksTable';
import { surfacePanelClass } from './clientPortal/clientPortalUi';

export default function ClientContentReviewPortal({
  client,
  cards,
  onApprove,
  onDeny,
  useCloudSync = false,
  onCloudQueueResponse,
  embedded = false,
  searchQuery = '',
}) {
  const { getClientColor, getClientAccountManager, getClientLogo } = useClientsContext();
  const [localCards, setLocalCards] = useState([]);
  const [done, setDone] = useState(false);
  const [sessionResponses, setSessionResponses] = useState([]);
  const [respondedIds, setRespondedIds] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (useCloudSync) {
      const pending = cards.filter(
        (card) =>
          card.client === client &&
          card.columnId === 'in-review' &&
          !respondedIds.includes(card.id),
      );
      setLocalCards(pending);
      setDone(pending.length === 0);
      return;
    }

    const snapshot = parseContentShareHash();
    const merged = mergePortalCards(cards, client, snapshot).filter(
      (card) => !respondedIds.includes(card.id),
    );
    setLocalCards(merged);
    setDone(merged.length === 0);
  }, [cards, client, respondedIds, useCloudSync]);

  const clientColor = getClientColor(client);
  const accountManager = getClientAccountManager(client);
  const clientLogo = getClientLogo(client);
  const canSyncLocally = !useCloudSync && cards.some(
    (c) => c.client === client && c.columnId === 'in-review',
  );

  const recordResponse = (response) => {
    setSessionResponses((prev) => [
      ...prev.filter((r) => r.cardId !== response.cardId),
      response,
    ]);
    if (useCloudSync && onCloudQueueResponse) {
      onCloudQueueResponse(response);
      return;
    }
    if (!canSyncLocally) {
      queueContentReviewResponse(response);
    }
  };

  const markResponded = (cardId) => {
    setRespondedIds((prev) => (prev.includes(cardId) ? prev : [...prev, cardId]));
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

    markResponded(cardId);
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

    markResponded(cardId);
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

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Tasks"
          description="Content awaiting your approval before scheduling. Approve when ready, or submit revision notes for your production team."
        />

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
            accountManager={accountManager}
            clientLogo={clientLogo}
            searchQuery={searchQuery}
            onApprove={handleApprove}
            onDeny={handleDeny}
          />
        )}
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-white/5 bg-black/95 px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-[800px] items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#810100] to-[#a00000] shadow-lg shadow-[#810100]/20">
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
            {sessionResponses.length > 0 && !useCloudSync && !canSyncLocally && (
              <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-left">
                <p className="text-sm text-gray-300">Send your feedback to Medici Social</p>
                <p className="mt-1 text-xs text-gray-500">
                  Copy this link and send it to your account manager so your approvals and revision notes update the board.
                </p>
                <button
                  type="button"
                  onClick={copyImportLink}
                  className="mt-3 rounded-lg bg-[#810100] px-4 py-2 text-sm font-medium text-white hover:bg-[#a00000]"
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
