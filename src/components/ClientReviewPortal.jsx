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
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [actionError, setActionError] = useState('');
  const [copied, setCopied] = useState(false);

  const clientColor = getClientColor(client);
  const clientLogo = getClientLogo(client);
  const canSyncLocally = !useCloudSync && ideas.some((i) => i.client === client);

  const brandIdeas = useMemo(
    () => ideas.filter((idea) => idea.client === client),
    [ideas, client],
  );

  const pendingIdeas = useMemo(
    () =>
      brandIdeas.filter(
        (idea) => idea.status === 'pending' && !respondedIds.includes(idea.id),
      ),
    [brandIdeas, respondedIds],
  );

  useEffect(() => {
    if (useCloudSync) {
      setLocalIdeas(pendingIdeas);
      setDone(pendingIdeas.length === 0);
      return;
    }

    const snapshot = parseShareHash();
    const merged = mergePortalIdeas(ideas, client, snapshot).filter(
      (idea) => !respondedIds.includes(idea.id),
    );
    setLocalIdeas(merged);
    setDone(merged.length === 0);
  }, [ideas, client, respondedIds, useCloudSync, pendingIdeas]);

  const recordResponse = (response) => {
    setSessionResponses((prev) => [...prev.filter((r) => r.ideaId !== response.ideaId), response]);
    if (!canSyncLocally) {
      queueClientResponse(response);
    }
  };

  const markResponded = (ideaId) => {
    setRespondedIds((prev) => (prev.includes(ideaId) ? prev : [...prev, ideaId]));
  };

  const submitIdeaResponse = async (response) => {
    if (useCloudSync && onCloudQueueResponse) {
      await onCloudQueueResponse(response);
      return;
    }

    recordResponse(response);
    if (canSyncLocally) {
      if (response.action === 'approved') {
        onApprove?.(response.ideaId, response.comment, response.idea);
      } else {
        onDecline?.(response.ideaId, response.comment, response.idea);
      }
    }
  };

  const handleApprove = async (ideaId, comment) => {
    const idea = pendingIdeas.find((i) => i.id === ideaId) || ideas.find((i) => i.id === ideaId);
    if (!idea || idea.status !== 'pending') return;

    const response = {
      ideaId,
      action: 'approved',
      comment,
      client,
      idea,
      timestamp: Date.now(),
    };

    setActionError('');
    setBusyIds((prev) => new Set(prev).add(ideaId));

    try {
      await submitIdeaResponse(response);
      markResponded(ideaId);
      setLocalIdeas((prev) => {
        const next = prev.filter((i) => i.id !== ideaId);
        if (next.length === 0) setDone(true);
        return next;
      });
    } catch (err) {
      setActionError(err.message || 'Could not save your approval. Please try again.');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(ideaId);
        return next;
      });
    }
  };

  const handleDecline = async (ideaId, comment) => {
    const idea = pendingIdeas.find((i) => i.id === ideaId) || ideas.find((i) => i.id === ideaId);
    if (!idea || idea.status !== 'pending') return;

    const response = {
      ideaId,
      action: 'declined',
      comment,
      client,
      idea,
      timestamp: Date.now(),
    };

    setActionError('');
    setBusyIds((prev) => new Set(prev).add(ideaId));

    try {
      await submitIdeaResponse(response);
      markResponded(ideaId);
      setLocalIdeas((prev) => {
        const next = prev.filter((i) => i.id !== ideaId);
        if (next.length === 0) setDone(true);
        return next;
      });
    } catch (err) {
      setActionError(err.message || 'Could not save your response. Please try again.');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(ideaId);
        return next;
      });
    }
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

  const pendingCount = pendingIdeas.length;

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Ideas"
          description="Approve concepts you want produced, or decline with feedback for your team."
        >
          {pendingCount > 0 && (
            <span className="border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-amber-200/90">
              {pendingCount} awaiting approval
            </span>
          )}
        </ClientPortalSectionHeader>

        {actionError && (
          <p className="mb-4 border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200/90">
            {actionError}
          </p>
        )}

        {pendingCount > 0 && (
          <div className="mb-8 space-y-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
              Awaiting your decision
            </p>
            {pendingIdeas.map((idea) => (
              <VideoIdeaCard
                key={idea.id}
                idea={idea}
                reviewMode
                onApprove={handleApprove}
                onDecline={handleDecline}
              />
            ))}
          </div>
        )}

        {brandIdeas.length === 0 ? (
          <div className={`${surfacePanelClass} px-6 py-16 text-center`}>
            <h3 className="text-base font-semibold text-white">No ideas yet</h3>
            <p className="mt-2 text-sm text-white/50">
              Your account team will submit concepts here for your review.
            </p>
          </div>
        ) : (
          <>
            {pendingCount > 0 && (
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
                All ideas
              </p>
            )}
            <ClientIdeasTable
              ideas={brandIdeas}
              client={client}
              clientColor={clientColor}
              clientLogo={clientLogo}
              onApprove={handleApprove}
              onDecline={handleDecline}
              busyIds={busyIds}
            />
          </>
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
