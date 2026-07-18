import { useState, useMemo, useEffect } from 'react';
import VideoIdeaModal from './VideoIdeaModal';
import VideoIdeaQuickAdd from './VideoIdeaQuickAdd';
import ClientSharePanel from './ClientSharePanel';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import AdminIdeasTable from './clientPortal/AdminIdeasTable';
import IdeaVaultTable from './IdeaVaultTable';
import ToCreateIdeasTable from './ToCreateIdeasTable';
import ScheduleVaultIdeaModal from './ScheduleVaultIdeaModal';
import { getToCreateIdeas, getVaultIdeas } from '../utils/videoIdeas';
import { matchesClientFilter } from '../utils/clients';
import {
  btnSecondaryClass,
  segmentTabClass,
  segmentTabShellClass,
  surfacePanelClass,
} from './clientPortal/clientPortalUi';

const IDEA_TABS = [
  { id: 'review', label: 'Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'to-create', label: 'To Create' },
];

export default function VideoIdeas({
  ideas,
  cards,
  plans = {},
  clientFilter,
  onAddIdea,
  onAddIdeaToBank,
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
}) {
  const [activeTab, setActiveTab] = useState('review');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [ideaModal, setIdeaModal] = useState(null);
  const [scheduleIdea, setScheduleIdea] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const vaultIdeas = useMemo(
    () => getVaultIdeas(ideas, cards, { client: clientFilter }),
    [ideas, cards, clientFilter],
  );
  const toCreateIdeas = useMemo(
    () => getToCreateIdeas(ideas, cards, { client: clientFilter }),
    [ideas, cards, clientFilter],
  );

  const filteredByClient = useMemo(() => {
    if (!clientFilter || clientFilter === 'all') return ideas;
    return ideas.filter((idea) => matchesClientFilter(idea.client, clientFilter));
  }, [ideas, clientFilter]);

  const reviewIdeas = useMemo(
    () => filteredByClient.filter((idea) => idea.status !== 'approved'),
    [filteredByClient],
  );

  const isBulkDeleteView = statusFilter === 'declined';
  const bulkDeleteLabel = 'passed idea';

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
    filteredIdeas.length > 0 && filteredIdeas.every((idea) => selectedIds.has(idea.id));

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIdeas.map((idea) => idea.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    const label =
      selectedIds.size === 1 ? `1 ${bulkDeleteLabel}` : `${selectedIds.size} ${bulkDeleteLabel}s`;
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

  const handleDeleteVaultIdea = (idea) => {
    const label = idea?.title ? `"${idea.title}"` : 'this idea';
    if (
      !window.confirm(
        `Delete ${label} from Approved? This cannot be undone.`,
      )
    ) {
      return false;
    }
    onDeleteVaultIdea?.(idea.id);
    return true;
  };

  const handleDeleteIdeaFromModal = (idea) => {
    if (!idea?.id) return;
    const deleted =
      idea.status === 'approved' ? handleDeleteVaultIdea(idea) : handleDeleteReviewIdea(idea.id);
    if (deleted) setIdeaModal(null);
  };

  return (
    <section>
      <ClientPortalSectionHeader
        title="Vault"
        description="Review ideas, keep approved concepts ready, and track what is scheduled for creation."
      >
        {pendingCount > 0 && activeTab === 'review' && (
          <span className="border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-amber-200/90">
            {pendingCount} awaiting client review
          </span>
        )}
        {vaultIdeas.length > 0 && (
          <span className="border border-white/25 bg-white/[0.08] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-white">
            {vaultIdeas.length} approved
          </span>
        )}
        {toCreateIdeas.length > 0 && (
          <span className="border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-amber-100">
            {toCreateIdeas.length} to create
          </span>
        )}
      </ClientPortalSectionHeader>

      <div className={`${segmentTabShellClass} mb-5`}>
        {IDEA_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={segmentTabClass(activeTab === tab.id)}
          >
            {tab.label}
            {tab.id === 'approved' && vaultIdeas.length > 0 ? ` (${vaultIdeas.length})` : ''}
            {tab.id === 'to-create' && toCreateIdeas.length > 0 ? ` (${toCreateIdeas.length})` : ''}
          </button>
        ))}
      </div>

      {activeTab === 'review' ? (
        <>
          <ClientSharePanel ideas={ideas} clientFilter={clientFilter} />

          <VideoIdeaQuickAdd
            clientFilter={clientFilter}
            onAdd={onAddIdea}
            onAddToBank={onAddIdeaToBank}
            onAdded={() => {
              setActiveTab('review');
              setStatusFilter('pending');
            }}
          />

          {isBulkDeleteView && filteredIdeas.length > 0 && selectedIds.size > 0 && (
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
            ideas={reviewIdeas}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            selectable={isBulkDeleteView}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelected}
            onSelectAll={handleSelectAll}
            allSelected={allVisibleSelected}
            onEdit={setIdeaModal}
            onDelete={handleDeleteReviewIdea}
            onApprove={onApprove}
          />
        </>
      ) : activeTab === 'approved' ? (
        <>
          <VideoIdeaQuickAdd
            clientFilter={clientFilter}
            variant="bank"
            onAddToBank={onAddIdeaToBank}
          />
          <IdeaVaultTable
            ideas={vaultIdeas}
            onEdit={setIdeaModal}
            onSchedule={setScheduleIdea}
            onMoveToReview={onMoveApprovedToReview}
            onUpdateReference={(ideaId, referenceVideo) => onUpdateIdea(ideaId, { referenceVideo })}
            onUpdateContentType={(ideaId, contentType) => onUpdateIdea(ideaId, { contentType })}
          />
        </>
      ) : (
        <ToCreateIdeasTable
          ideas={toCreateIdeas}
          cards={cards}
          onOpenCard={onOpenCard}
          onOpenShoot={onOpenShoot}
          onReturnToApproved={onReturnToApproved}
        />
      )}

      {ideaModal && (
        <VideoIdeaModal
          idea={ideaModal}
          defaultClient={clientFilter !== 'all' ? clientFilter : undefined}
          onClose={() => setIdeaModal(null)}
          onSave={(data) => onUpdateIdea(ideaModal.id, data)}
          onDelete={handleDeleteIdeaFromModal}
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
    </section>
  );
}
