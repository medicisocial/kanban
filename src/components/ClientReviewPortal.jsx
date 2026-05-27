import { useState, useEffect, useMemo } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import {
  parseShareHash,
  mergePortalIdeas,
  buildImportUrl,
  queueClientResponse,
} from '../utils/clientShare';
import VideoIdeaCard from './VideoIdeaCard';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import ClientIdeasTable from './clientPortal/ClientIdeasTable';
import SharePortalShell from './clientPortal/SharePortalShell';
import { btnPrimaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

export default function ClientReviewPortal({
  client,
  ideas,
  onApprove,
  onDecline,
  useCloudSync = false,
  onCloudQueueResponse,
  embedded = false,
}) {
  const { getClientColor, getClientLogo } = useClientsContext();
  const [localIdeas, setLocalIdeas] = useState([]);
  const [done, setDone] = useState(false);
  const [sessionResponses, setSessionResponses] = useState([]);
  const [respondedIds, setRespondedIds] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (useCloudSync) {
      const pending = ideas.filter(
        (idea) => idea.client === client && idea.status === 'pending' && !respondedIds.includes(idea.id),
      );
      setLocalIdeas(pending);
      setDone(pending.length === 0);
      return;
    }

    const snapshot = parseShareHash();
    const merged = mergePortalIdeas(ideas, client, snapshot).filter(
      (idea) => !respondedIds.includes(idea.id),
    );
    setLocalIdeas(merged);
    setDone(merged.length === 0);
  }, [ideas, client, respondedIds, useCloudSync]);

  const clientColor = getClientColor(client);
  const clientLogo = getClientLogo(client);
  const canSyncLocally = !useCloudSync && ideas.some((i) => i.client === client);

  const pendingIds = useMemo(
    () => localIdeas.map((idea) => idea.id),
    [localIdeas],
  );

  const recordResponse = (response) => {
    setSessionResponses((prev) => [...prev.filter((r) => r.ideaId !== response.ideaId), response]);
    if (useCloudSync && onCloudQueueResponse) {
      onCloudQueueResponse(response);
      return;
    }
    if (!canSyncLocally) {
      queueClientResponse(response);
    }
  };

  const markResponded = (ideaId) => {
    setRespondedIds((prev) => (prev.includes(ideaId) ? prev : [...prev, ideaId]));
  };

  const handleApprove = (ideaId, comment) => {
    const idea = localIdeas.find((i) => i.id === ideaId) || ideas.find((i) => i.id === ideaId);
    if (!idea) return;

    const response = {
      ideaId,
      action: 'approved',
      comment,
      client,
      idea,
      timestamp: Date.now(),
    };

    markResponded(ideaId);
    recordResponse(response);
    if (canSyncLocally) onApprove(ideaId, comment, idea);

    setLocalIdeas((prev) => {
      const next = prev.filter((i) => i.id !== ideaId);
      if (next.length === 0) setDone(true);
      return next;
    });
  };

  const handleDecline = (ideaId, comment) => {
    const idea = localIdeas.find((i) => i.id === ideaId) || ideas.find((i) => i.id === ideaId);
    if (!idea) return;

    const response = {
      ideaId,
      action: 'declined',
      comment,
      client,
      idea,
      timestamp: Date.now(),
    };

    markResponded(ideaId);
    recordResponse(response);
    if (canSyncLocally) onDecline(ideaId, comment, idea);

    setLocalIdeas((prev) => {
      const next = prev.filter((i) => i.id !== ideaId);
      if (next.length === 0) setDone(true);
      return next;
    });
  };

  const copyImportLink = async () => {
    const url = buildImportUrl(sessionResponses);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this link and send it to Medici Social:', url);
    }
  };

  const pendingCount = localIdeas.length;
  const brandIdeas = useMemo(
    () => ideas.filter((idea) => idea.client === client),
    [ideas, client],
  );

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Ideas"
          description="Review and approve video concepts submitted for your brand. Pending items require your decision before production begins."
        >
          {pendingCount > 0 && (
            <span className="border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-amber-200/90">
              {pendingCount} pending
            </span>
          )}
        </ClientPortalSectionHeader>

        {brandIdeas.length === 0 ? (
          <div className={`${surfacePanelClass} px-6 py-16 text-center`}>
            <h3 className="text-base font-semibold text-white">No ideas yet</h3>
            <p className="mt-2 text-sm text-white/50">
              Your account team will submit concepts here for your review.
            </p>
          </div>
        ) : (
          <ClientIdeasTable
            ideas={ideas}
            client={client}
            clientColor={clientColor}
            clientLogo={clientLogo}
            onApprove={handleApprove}
            onDecline={handleDecline}
            pendingIds={pendingIds}
          />
        )}
      </section>
    );
  }

  return (
    <SharePortalShell title="Video idea review" client={client} clientColor={clientColor}>
      {!done ? (
        <>
          <p className="mb-6 text-sm text-white/45">
            {pendingCount} idea{pendingCount === 1 ? '' : 's'} waiting for your feedback
          </p>

          <div className="space-y-3">
            {localIdeas.map((idea) => (
              <VideoIdeaCard
                key={idea.id}
                idea={idea}
                reviewMode
                onApprove={handleApprove}
                onDecline={handleDecline}
              />
            ))}
          </div>
        </>
      ) : (
        <div className={`${surfacePanelClass} px-6 py-12 text-center`}>
          <h2 className="text-lg font-semibold text-white">All caught up</h2>
          <p className="mt-2 text-sm text-white/45">
            Thank you for reviewing your video ideas.
          </p>
          {sessionResponses.length > 0 && !useCloudSync && !canSyncLocally && (
            <div className="mt-6 text-left">
              <p className="text-sm text-white/55">Send your approvals to Medici Social</p>
              <p className="mt-1 text-xs text-white/35">
                Copy this link and send it to your account manager so approved ideas can be added to the board.
              </p>
              <button
                type="button"
                onClick={copyImportLink}
                className={`${btnPrimaryClass} mt-3 py-2 text-[11px]`}
              >
                {copied ? 'Link copied!' : 'Copy approval link'}
              </button>
            </div>
          )}
        </div>
      )}
    </SharePortalShell>
  );
}
