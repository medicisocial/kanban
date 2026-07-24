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
import IdeaVaultTable from './IdeaVaultTable';
import ClientIdeaDetailModal from './ClientIdeaDetailModal';
import SharePortalShell from './clientPortal/SharePortalShell';
import {
  btnPrimaryClass,
  btnSecondaryClass,
  glassSegmentClass,
  surfacePanelClass,
} from './clientPortal/clientPortalUi';
import { clientMatchesBrand } from '../utils/clients';
import { getVaultIdeas, isReviewQueueIdeaStatus } from '../utils/videoIdeas';

const VAULT_TABS = [
  { id: 'review', label: 'Review' },
  { id: 'bank', label: 'Ready' },
];

export default function ClientReviewPortal({
  client,
  ideas,
  cards = [],
  onAddIdea,
  onAddIdeaToBank,
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
  const [activeTab, setActiveTab] = useState('review');
  const [detailIdeaId, setDetailIdeaId] = useState(null);
  const [draftIdea, setDraftIdea] = useState(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const clientColor = getClientColor(client);
  const clientLogo = getClientLogo(client);
  const canSyncLocally = !useCloudSync && ideas.some((i) => clientMatchesBrand(i.client, client));

  const brandIdeas = useMemo(
    () => ideas.filter((idea) => clientMatchesBrand(idea.client, client)),
    [ideas, client],
  );

  const vaultIdeas = useMemo(
    () => getVaultIdeas(ideas, cards, { client }),
    [ideas, cards, client],
  );

  const reviewIdeas = useMemo(
    () => brandIdeas.filter((idea) => isReviewQueueIdeaStatus(idea.status)),
    [brandIdeas],
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

    if (!client) return;
    const shared = parseShareHash();
    if (shared?.type === 'ideas' && shared.client === client) {
      setLocalIdeas(mergePortalIdeas(ideas, shared.ideas || [], client));
      setDone(false);
    } else {
      setLocalIdeas(pendingIdeas);
      setDone(pendingIdeas.length === 0);
    }
  }, [ideas, client, respondedIds, useCloudSync, pendingIdeas]);

  const recordResponse = (response) => {
    queueClientResponse(response);
    setSessionResponses((prev) => [...prev, response]);
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
      } else if (response.action === 'declined' || response.action === 'rejected') {
        onDecline?.(response.ideaId, response.comment, response.idea);
      }
    }
  };

  const buildIdeaPayload = (ideaData = {}) => ({
    id: crypto.randomUUID(),
    client,
    title: ideaData.title || 'New idea',
    referenceVideo: ideaData.referenceVideo || '',
    description: ideaData.description || '',
    contentType: ideaData.contentType || 'Reel',
    status: 'pending',
    clientComment: ideaData.clientComment || '',
    boardCardId: null,
    createdAt: Date.now(),
    reviewedAt: null,
  });

  const openCreatedIdea = (idea) => {
    setDraftIdea(idea);
    setDetailIdeaId(idea.id);
  };

  const handleCreateIdea = async ({ toBank = false } = {}) => {
    const idea = buildIdeaPayload({ title: 'New idea' });
    if (toBank) {
      idea.status = 'approved';
      idea.reviewedAt = Date.now();
    }

    setActionError('');
    setCreating(true);
    openCreatedIdea(idea);

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

      if (toBank) {
        if (!onAddIdeaToBank) throw new Error('Could not save to Ready.');
        onAddIdeaToBank({
          id: idea.id,
          title: idea.title,
          referenceVideo: idea.referenceVideo,
          description: idea.description,
          contentType: idea.contentType,
          clientComment: idea.clientComment,
          status: 'approved',
          reviewedAt: idea.reviewedAt,
        });
        return;
      }

      if (!onAddIdea) throw new Error('Could not save your idea.');
      onAddIdea({
        id: idea.id,
        title: idea.title,
        referenceVideo: idea.referenceVideo,
        description: idea.description,
        contentType: idea.contentType,
        clientComment: idea.clientComment,
        status: 'pending',
      });
    } catch (err) {
      setDetailIdeaId(null);
      setDraftIdea(null);
      setActionError(err.message || 'Could not create your idea. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleApprove = async (ideaId, comment) => {
    const idea =
      pendingIdeas.find((i) => i.id === ideaId) ||
      ideas.find((i) => i.id === ideaId) ||
      (draftIdea?.id === ideaId ? draftIdea : null);
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
      setDraftIdea(null);
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
    const trimmed = String(comment || '').trim();
    if (!trimmed) {
      setActionError('Please add a note explaining your feedback before rejecting.');
      return;
    }

    const idea =
      pendingIdeas.find((i) => i.id === ideaId) ||
      ideas.find((i) => i.id === ideaId) ||
      (draftIdea?.id === ideaId ? draftIdea : null);
    if (!idea || idea.status !== 'pending') return;

    const response = {
      ideaId,
      action: 'rejected',
      comment: trimmed,
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
      setDraftIdea(null);
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

  const detailIdea =
    (detailIdeaId &&
      ((draftIdea?.id === detailIdeaId ? draftIdea : null) ||
        vaultIdeas.find((idea) => idea.id === detailIdeaId) ||
        reviewIdeas.find((idea) => idea.id === detailIdeaId) ||
        brandIdeas.find((idea) => idea.id === detailIdeaId) ||
        localIdeas.find((idea) => idea.id === detailIdeaId))) ||
    null;

  const handleUpdateIdeaDetails = async (ideaId, updates) => {
    setDetailSaving(true);
    setActionError('');
    try {
      if (useCloudSync && onCloudQueueResponse) {
        await onCloudQueueResponse({
          action: 'update',
          ideaId,
          updates,
          client,
          timestamp: Date.now(),
        });
        setDraftIdea((prev) =>
          prev?.id === ideaId
            ? {
                ...prev,
                ...updates,
                title: updates.title ?? prev.title,
                contentType: updates.contentType ?? prev.contentType,
                referenceVideo: updates.referenceVideo ?? prev.referenceVideo,
                description:
                  updates.description !== undefined ? updates.description : prev.description,
              }
            : prev,
        );
        return;
      }
      throw new Error('Could not save your idea.');
    } finally {
      setDetailSaving(false);
    }
  };

  const pendingCount = pendingIdeas.length;

  const displayedReviewIdeas = useMemo(() => {
    if (!draftIdea || !isReviewQueueIdeaStatus(draftIdea.status)) return reviewIdeas;
    if (reviewIdeas.some((idea) => idea.id === draftIdea.id)) return reviewIdeas;
    return [draftIdea, ...reviewIdeas];
  }, [draftIdea, reviewIdeas]);

  const displayedVaultIdeas = useMemo(() => {
    if (!draftIdea || draftIdea.status !== 'approved') return vaultIdeas;
    if (vaultIdeas.some((idea) => idea.id === draftIdea.id)) return vaultIdeas;
    return [draftIdea, ...vaultIdeas];
  }, [draftIdea, vaultIdeas]);

  const tabClass = (tabId) =>
    `px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
      activeTab === tabId
        ? 'rounded-sm bg-[#810100] text-white'
        : 'text-white/45 hover:text-white'
    }`;

  const addActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => handleCreateIdea({ toBank: activeTab === 'bank' })}
        className={`${btnPrimaryClass} py-1.5 text-[10px]`}
        disabled={creating}
      >
        + New idea
      </button>
    </div>
  );

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Vault"
          description="Review new concepts from your team, submit your own, and browse Ready ideas waiting for a shoot."
        >
          {pendingCount > 0 && activeTab === 'review' && (
            <span className="border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-amber-200/90">
              {pendingCount} awaiting approval
            </span>
          )}
          {vaultIdeas.length > 0 && (
            <span className="border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-violet-200/90">
              {vaultIdeas.length} ready
            </span>
          )}
        </ClientPortalSectionHeader>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className={`${glassSegmentClass} flex w-fit gap-0.5 p-0.5`}>
            {VAULT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={tabClass(tab.id)}
              >
                {tab.label}
                {tab.id === 'bank' && vaultIdeas.length > 0 ? ` (${vaultIdeas.length})` : ''}
              </button>
            ))}
          </div>
          {addActions}
        </div>

        {actionError && (
          <p className="mb-4 border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200/90">
            {actionError}
          </p>
        )}

        {activeTab === 'review' ? (
          <ClientIdeasTable
            ideas={displayedReviewIdeas}
            client={client}
            clientColor={clientColor}
            clientLogo={clientLogo}
            onApprove={handleApprove}
            onDecline={handleDecline}
            onOpenIdea={(idea) => {
              setDraftIdea((prev) => (prev?.id === idea.id ? prev : null));
              setDetailIdeaId(idea.id);
            }}
            busyIds={busyIds}
          />
        ) : (
          <IdeaVaultTable
            ideas={displayedVaultIdeas}
            readOnly
            hideClientColumn
            emptyTitle="No ready ideas yet"
            emptyDescription="Click + New idea to add a concept straight to Ready. It opens so you can fill in the details."
            onOpenIdea={(idea) => {
              setDraftIdea((prev) => (prev?.id === idea.id ? prev : null));
              setDetailIdeaId(idea.id);
            }}
          />
        )}

        {detailIdea && (
          <ClientIdeaDetailModal
            idea={detailIdea}
            onClose={() => {
              setDetailIdeaId(null);
              setDraftIdea(null);
            }}
            onSave={handleUpdateIdeaDetails}
            onApprove={handleApprove}
            onDecline={handleDecline}
            canDecide={detailIdea.status === 'pending'}
            saving={detailSaving || creating || busyIds.has(detailIdea.id)}
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
                Copy this link and send it to your account manager so ready ideas can be added to
                the board.
              </p>
              <button
                type="button"
                onClick={copyImportLink}
                className={`${btnSecondaryClass} mt-3`}
              >
                {copied ? 'Copied' : 'Copy import link'}
              </button>
            </div>
          )}
        </div>
      )}
    </SharePortalShell>
  );
}
