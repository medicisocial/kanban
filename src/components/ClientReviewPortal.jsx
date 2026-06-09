import { useState, useEffect, useMemo } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import {
  parseShareHash,
  mergePortalIdeas,
  buildImportUrl,
  queueClientResponse,
} from '../utils/clientShare';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import ClientIdeasTable from './clientPortal/ClientIdeasTable';
import VideoIdeaQuickAdd from './VideoIdeaQuickAdd';
import SharePortalShell from './clientPortal/SharePortalShell';
import { btnPrimaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';
import { clientMatchesBrand } from '../utils/clients';

export default function ClientReviewPortal({
  client,
  ideas,
  onAddIdea,
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
  const canSyncLocally = !useCloudSync && ideas.some((i) => clientMatchesBrand(i.client, client));

  const brandIdeas = useMemo(
    () => ideas.filter((idea) => clientMatchesBrand(idea.client, client)),
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
      } else if (response.action === 'declined') {
        onDecline?.(response.ideaId, response.comment, response.idea);
      }
    }
  };

  const buildIdeaPayload = (ideaData) => ({
    id: crypto.randomUUID(),
    client,
    title: ideaData.title,
    referenceVideo: ideaData.referenceVideo || '',
    description: ideaData.description || '',
    contentType: ideaData.contentType || 'Reel',
    status: 'pending',
    clientComment: ideaData.clientComment || '',
    boardCardId: null,
    createdAt: Date.now(),
    reviewedAt: null,
  });

  const handleAddIdea = async (ideaData) => {
    const idea = buildIdeaPayload(ideaData);

    setActionError('');
    try {
      if (useCloudSync && onCloudQueueResponse) {
        await onCloudQueueResponse({
          action: 'create',
          idea,
          client,
          timestamp: Date.now(),
        });
        return;
      }

      if (onAddIdea) {
        onAddIdea(ideaData);
        return;
      }

      throw new Error('Could not save your idea.');
    } catch (err) {
      setActionError(err.message || 'Could not save your idea. Please try again.');
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
          description="Submit your own concepts or approve ideas from your production team."
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

        <VideoIdeaQuickAdd
          clientOnly={client}
          onAdd={handleAddIdea}
          submitLabel="Submit idea"
          hint="Paste a reference link and press Enter — your team will see it in the list below."
        />

        <ClientIdeasTable
          ideas={brandIdeas}
          client={client}
          clientColor={clientColor}
          clientLogo={clientLogo}
          onApprove={handleApprove}
          onDecline={handleDecline}
          busyIds={busyIds}
        />
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

          {actionError && (
            <p className="mb-4 border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200/90">
              {actionError}
            </p>
          )}

          <ClientIdeasTable
            ideas={localIdeas}
            client={client}
            clientColor={clientColor}
            clientLogo={clientLogo}
            onApprove={handleApprove}
            onDecline={handleDecline}
            busyIds={busyIds}
          />
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
