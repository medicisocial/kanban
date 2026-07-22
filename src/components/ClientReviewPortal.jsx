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
import IdeaVaultTable from './IdeaVaultTable';
import ClientIdeaDetailModal from './ClientIdeaDetailModal';
import SharePortalShell from './clientPortal/SharePortalShell';
import { btnPrimaryClass, glassSegmentClass, surfacePanelClass } from './clientPortal/clientPortalUi';
import { clientMatchesBrand } from '../utils/clients';
import { getVaultIdeas } from '../utils/videoIdeas';

const VAULT_TABS = [
  { id: 'review', label: 'Review' },
  { id: 'bank', label: 'Approved' },
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
  const [detailSaving, setDetailSaving] = useState(false);

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
    () => brandIdeas.filter((idea) => idea.status !== 'approved'),
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

  const handleAddIdeaToBank = async (ideaData) => {
    const idea = {
      ...buildIdeaPayload(ideaData),
      status: 'approved',
      reviewedAt: Date.now(),
    };

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

      if (onAddIdeaToBank) {
        onAddIdeaToBank(ideaData);
        return;
      }

      throw new Error('Could not save to the bank.');
    } catch (err) {
      setActionError(err.message || 'Could not save to the bank. Please try again.');
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

  const detailIdea =
    (detailIdeaId &&
      (vaultIdeas.find((idea) => idea.id === detailIdeaId) ||
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
        return;
      }
      throw new Error('Could not save your notes.');
    } finally {
      setDetailSaving(false);
    }
  };

  const pendingCount = pendingIdeas.length;

  const tabClass = (tabId) =>
    `px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
      activeTab === tabId
        ? 'rounded-sm bg-[#810100] text-white'
        : 'text-white/45 hover:text-white'
    }`;

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Vault"
          description="Review new concepts from your team, submit your own, and browse approved ideas waiting for a shoot."
        >
          {pendingCount > 0 && activeTab === 'review' && (
            <span className="border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-amber-200/90">
              {pendingCount} awaiting approval
            </span>
          )}
          {vaultIdeas.length > 0 && (
            <span className="border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-violet-200/90">
              {vaultIdeas.length} approved
            </span>
          )}
        </ClientPortalSectionHeader>

        <div className={`${glassSegmentClass} mb-5 flex w-fit gap-0.5 p-0.5`}>
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

        {actionError && (
          <p className="mb-4 border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200/90">
            {actionError}
          </p>
        )}

        {activeTab === 'review' ? (
          <>
            <VideoIdeaQuickAdd
              clientOnly={client}
              onAdd={handleAddIdea}
              onAddToBank={handleAddIdeaToBank}
              submitLabel="Submit for review"
              hint="Submit for team review, or add straight to Approved."
            />

            <ClientIdeasTable
              ideas={reviewIdeas}
              client={client}
              clientColor={clientColor}
              clientLogo={clientLogo}
              onApprove={handleApprove}
              onDecline={handleDecline}
              onOpenIdea={(idea) => setDetailIdeaId(idea.id)}
              busyIds={busyIds}
            />
          </>
        ) : (
          <>
            <VideoIdeaQuickAdd
              clientOnly={client}
              variant="bank"
              onAddToBank={handleAddIdeaToBank}
            />
            <IdeaVaultTable
              ideas={vaultIdeas}
              readOnly
              hideClientColumn
              onOpenIdea={(idea) => setDetailIdeaId(idea.id)}
            />
          </>
        )}

        {detailIdea && (
          <ClientIdeaDetailModal
            idea={detailIdea}
            onClose={() => setDetailIdeaId(null)}
            onSave={handleUpdateIdeaDetails}
            onApprove={handleApprove}
            onDecline={handleDecline}
            canDecide={detailIdea.status === 'pending'}
            saving={detailSaving || busyIds.has(detailIdea.id)}
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
