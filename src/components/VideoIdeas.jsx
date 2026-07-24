import { useState, useMemo, useEffect } from 'react';
import VideoIdeaModal from './VideoIdeaModal';
import ClientSharePanel from './ClientSharePanel';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import AdminIdeasTable from './clientPortal/AdminIdeasTable';
import IdeaVaultTable from './IdeaVaultTable';
import ToCreateIdeasTable from './ToCreateIdeasTable';
import ScheduleVaultIdeaModal from './ScheduleVaultIdeaModal';
import AddEditorTaskModal from './AddEditorTaskModal';
import {
  getToCreateCards,
  getVaultIdeas,
  isRejectedIdeaStatus,
  isReviewQueueIdeaStatus,
} from '../utils/videoIdeas';
import { matchesClientFilter } from '../utils/clients';
import {
  btnPrimaryClass,
  btnSecondaryClass,
  glassSegmentClass,
  STATUS_PIPELINE_PILL_CLASS,
  statusPipelinePillProps,
  surfacePanelClass,
} from './clientPortal/clientPortalUi';

const IDEA_TABS = [
  { id: 'review', label: 'Review' },
  { id: 'ready', label: 'Ready' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'to-create', label: 'To Create' },
];

export default function VideoIdeas({
  ideas,
  cards,
  plans = {},
  clientFilter,
  onAddCard,
  onAddOneOffTask,
  onApprove,
  onDecline,
  onDeleteIdea,
  onDeleteIdeas,
  onDeleteVaultIdea,
  onMoveApprovedToReview,
  onUpdateIdea,
  onOpenCard,
  onOpenShoot,
  onReturnToApproved,
  onScheduleVaultIdea,
  onCreateOneOffFromIdea,
}) {
  const [activeTab, setActiveTab] = useState('review');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [ideaModal, setIdeaModal] = useState(null);
  const [scheduleIdea, setScheduleIdea] = useState(null);
  const [showAddOneOff, setShowAddOneOff] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const vaultIdeas = useMemo(
    () => getVaultIdeas(ideas, cards, { client: clientFilter }),
    [ideas, cards, clientFilter],
  );
  const toCreateCards = useMemo(
    () => getToCreateCards(cards, { client: clientFilter }),
    [cards, clientFilter],
  );

  const filteredByClient = useMemo(() => {
    if (!clientFilter || clientFilter === 'all') return ideas;
    return ideas.filter((idea) => matchesClientFilter(idea.client, clientFilter));
  }, [ideas, clientFilter]);

  const reviewIdeas = useMemo(
    () => filteredByClient.filter((idea) => isReviewQueueIdeaStatus(idea.status)),
    [filteredByClient],
  );

  const rejectedIdeas = useMemo(
    () => filteredByClient.filter((idea) => isRejectedIdeaStatus(idea.status)),
    [filteredByClient],
  );

  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, activeTab]);

  const pendingCount = reviewIdeas.filter((idea) => idea.status === 'pending').length;

  const filteredIdeas = useMemo(() => {
    let list = reviewIdeas;
    if (statusFilter !== 'all') {
      list = list.filter((idea) => idea.status === statusFilter);
    }
    return list;
  }, [reviewIdeas, statusFilter]);

  const allVisibleSelected =
    activeTab === 'rejected'
      ? rejectedIdeas.length > 0 && rejectedIdeas.every((idea) => selectedIds.has(idea.id))
      : filteredIdeas.length > 0 && filteredIdeas.every((idea) => selectedIds.has(idea.id));

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    const pool = activeTab === 'rejected' ? rejectedIdeas : filteredIdeas;
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pool.map((idea) => idea.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    const label =
      selectedIds.size === 1
        ? '1 rejected idea'
        : `${selectedIds.size} rejected ideas`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    onDeleteIdeas([...selectedIds]);
    setSelectedIds(new Set());
  };

  const handleDeleteReviewIdea = (ideaId) => {
    const idea = ideas.find((entry) => entry.id === ideaId);
    const label = idea?.title ? `"${idea.title}"` : 'this idea';
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return false;
    onDeleteIdea(ideaId);
    return true;
  };

  const handleDeleteRejectedIdea = (ideaId) => {
    const idea = ideas.find((entry) => entry.id === ideaId);
    const label = idea?.title ? `"${idea.title}"` : 'this idea';
    if (!window.confirm(`Delete ${label} from Rejected? This cannot be undone.`)) {
      return false;
    }
    onDeleteIdea(ideaId);
    return true;
  };

  const handleDeleteVaultIdea = (idea) => {
    const label = idea?.title ? `"${idea.title}"` : 'this idea';
    if (
      !window.confirm(
        `Delete ${label} from Ready? This cannot be undone.`,
      )
    ) {
      return false;
    }
    onDeleteVaultIdea?.(idea.id);
    return true;
  };

  const handleDeleteIdeaFromModal = (idea) => {
    if (!idea?.id) return;
    let deleted = false;
    if (idea.status === 'approved') {
      deleted = handleDeleteVaultIdea(idea);
    } else if (isRejectedIdeaStatus(idea.status)) {
      deleted = handleDeleteRejectedIdea(idea.id);
    } else {
      deleted = handleDeleteReviewIdea(idea.id);
    }
    if (deleted) setIdeaModal(null);
  };

  const handleReturnToReady = (card) => {
    if (onReturnToApproved?.(card)) {
      setActiveTab('ready');
    }
  };

  const handleAddCard = () => {
    onAddCard?.();
    setActiveTab('to-create');
  };

  const handleAddOneOff = (data) => {
    onAddOneOffTask?.(data);
    setShowAddOneOff(false);
    setActiveTab('to-create');
  };

  const tabClass = (tabId) =>
    activeTab === tabId
      ? `${btnPrimaryClass} !px-4 !py-1.5 !text-xs !tracking-wider`
      : `${btnSecondaryClass} !px-4 !py-1.5 !text-xs !tracking-wider !border-transparent !text-white/45 hover:!text-white`;

  const addActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {onAddCard && (
        <button
          type="button"
          onClick={handleAddCard}
          className={`${btnPrimaryClass} py-1.5 text-[10px]`}
        >
          + Add card
        </button>
      )}
      {onAddOneOffTask && (
        <button
          type="button"
          onClick={() => setShowAddOneOff(true)}
          className={`${btnSecondaryClass} py-1.5 text-[10px]`}
        >
          + Add one-off project
        </button>
      )}
    </div>
  );

  return (
    <section>
      <ClientPortalSectionHeader
        title="Vault"
        description="Review ideas, keep ready concepts, and track what is scheduled for creation."
      >
        {pendingCount > 0 && activeTab === 'review' && (
          <span
            {...statusPipelinePillProps(
              'pending',
              `${STATUS_PIPELINE_PILL_CLASS} px-2.5 py-1.5 tracking-wider`,
            )}
          >
            {pendingCount} awaiting client review
          </span>
        )}
        {vaultIdeas.length > 0 && (
          <span
            {...statusPipelinePillProps(
              'approved',
              `${STATUS_PIPELINE_PILL_CLASS} px-2.5 py-1.5 tracking-wider`,
            )}
          >
            {vaultIdeas.length} ready
          </span>
        )}
        {rejectedIdeas.length > 0 && (
          <span
            {...statusPipelinePillProps(
              'rejected',
              `${STATUS_PIPELINE_PILL_CLASS} px-2.5 py-1.5 tracking-wider`,
            )}
          >
            {rejectedIdeas.length} rejected
          </span>
        )}
        {toCreateCards.length > 0 && (
          <span
            {...statusPipelinePillProps(
              'create',
              `${STATUS_PIPELINE_PILL_CLASS} px-2.5 py-1.5 tracking-wider`,
            )}
          >
            {toCreateCards.length} to create
          </span>
        )}
      </ClientPortalSectionHeader>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className={`${glassSegmentClass} flex w-fit gap-0.5 p-0.5`}>
          {IDEA_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={tabClass(tab.id)}
            >
              {tab.label}
              {tab.id === 'ready' && vaultIdeas.length > 0 ? ` (${vaultIdeas.length})` : ''}
              {tab.id === 'rejected' && rejectedIdeas.length > 0 ? ` (${rejectedIdeas.length})` : ''}
              {tab.id === 'to-create' && toCreateCards.length > 0 ? ` (${toCreateCards.length})` : ''}
            </button>
          ))}
        </div>
        {addActions}
      </div>

      {activeTab === 'review' ? (
        <>
          <ClientSharePanel ideas={ideas} clientFilter={clientFilter} />

          <AdminIdeasTable
            ideas={reviewIdeas}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onEdit={setIdeaModal}
            onDelete={handleDeleteReviewIdea}
            onApprove={onApprove}
          />
        </>
      ) : activeTab === 'ready' ? (
        <IdeaVaultTable
          ideas={vaultIdeas}
          onEdit={setIdeaModal}
          onSchedule={setScheduleIdea}
          onMoveToReview={onMoveApprovedToReview}
        />
      ) : activeTab === 'rejected' ? (
        <>
          {rejectedIdeas.length > 0 && selectedIds.size > 0 && (
            <div className={`${surfacePanelClass} mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
              <p className="text-sm text-white/55">{selectedIds.size} selected</p>
              <button
                type="button"
                onClick={handleBulkDelete}
                className={`${btnSecondaryClass} border-rose-500/30 bg-rose-500/10 text-rose-200/90 hover:bg-rose-500/15`}
              >
                Delete selected
              </button>
            </div>
          )}
          <AdminIdeasTable
            ideas={rejectedIdeas}
            statusFilter="all"
            onStatusFilterChange={() => {}}
            hideStatusFilter
            showRejectionNote
            selectable
            selectedIds={selectedIds}
            onToggleSelect={toggleSelected}
            onSelectAll={handleSelectAll}
            allSelected={allVisibleSelected}
            onEdit={setIdeaModal}
            onDelete={handleDeleteRejectedIdea}
          />
        </>
      ) : (
        <ToCreateIdeasTable
          cards={cards}
          clientFilter={clientFilter}
          onOpenCard={onOpenCard}
          onOpenShoot={onOpenShoot}
          onReturnToApproved={handleReturnToReady}
        />
      )}

      {ideaModal && (
        <VideoIdeaModal
          idea={ideaModal}
          defaultClient={clientFilter !== 'all' ? clientFilter : undefined}
          onClose={() => setIdeaModal(null)}
          onSave={(data) => onUpdateIdea(ideaModal.id, data)}
          onDelete={handleDeleteIdeaFromModal}
          onMakeOneOff={(idea, data) => {
            onCreateOneOffFromIdea?.(idea, data);
            setIdeaModal(null);
          }}
        />
      )}

      {scheduleIdea && (
        <ScheduleVaultIdeaModal
          idea={scheduleIdea}
          cards={cards}
          plans={plans}
          onClose={() => setScheduleIdea(null)}
          onSave={(schedule) => {
            onScheduleVaultIdea?.(scheduleIdea.id, {
              client: scheduleIdea.client,
              ...schedule,
            });
            setActiveTab('to-create');
            setScheduleIdea(null);
          }}
        />
      )}

      {showAddOneOff && onAddOneOffTask && (
        <AddEditorTaskModal
          onClose={() => setShowAddOneOff(false)}
          onAdd={handleAddOneOff}
          initialColumnId="shoot"
        />
      )}
    </section>
  );
}
