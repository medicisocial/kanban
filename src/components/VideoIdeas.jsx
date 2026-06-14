import { useState, useMemo, useEffect } from 'react';
import VideoIdeaModal from './VideoIdeaModal';
import VideoIdeaQuickAdd from './VideoIdeaQuickAdd';
import ClientSharePanel from './ClientSharePanel';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import AdminIdeasTable from './clientPortal/AdminIdeasTable';
import IdeaVaultTable from './IdeaVaultTable';
import ScheduleVaultIdeaModal from './ScheduleVaultIdeaModal';
import { getVaultIdeas, isIdeaInVault, isIdeaScheduled } from '../utils/videoIdeas';
import { btnPrimaryClass, btnSecondaryClass, glassSegmentClass, surfacePanelClass } from './clientPortal/clientPortalUi';

const IDEA_TABS = [
  { id: 'review', label: 'Review' },
  { id: 'vault', label: 'Bank' },
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
  onUpdateIdea,
  onGoToBoard,
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

  const filteredByClient = useMemo(() => {
    if (!clientFilter || clientFilter === 'all') return ideas;
    return ideas.filter((idea) => idea.client === clientFilter);
  }, [ideas, clientFilter]);

  const reviewIdeas = useMemo(
    () => filteredByClient.filter((idea) => !isIdeaInVault(idea, cards)),
    [filteredByClient, cards],
  );

  const isBulkDeleteView = statusFilter === 'approved' || statusFilter === 'declined';
  const bulkDeleteLabel = statusFilter === 'declined' ? 'passed idea' : 'approved idea';

  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, activeTab]);

  const pendingCount = reviewIdeas.filter((idea) => idea.status === 'pending').length;

  const filteredIdeas = useMemo(() => {
    let list = reviewIdeas;
    if (statusFilter === 'approved') {
      list = list.filter((idea) => idea.status === 'approved' && isIdeaScheduled(idea, cards));
    } else if (statusFilter !== 'all') {
      list = list.filter((idea) => idea.status === statusFilter);
    }
    return list;
  }, [reviewIdeas, statusFilter, cards]);

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
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    onDeleteIdea(ideaId);
  };

  const handleDeleteVaultIdea = (idea) => {
    const label = idea?.title ? `"${idea.title}"` : 'this idea';
    if (
      !window.confirm(
        `Delete ${label} from the bank? This cannot be undone.`,
      )
    ) {
      return;
    }
    onDeleteVaultIdea?.(idea.id);
  };

  const tabClass = (tabId) =>
    activeTab === tabId
      ? `${btnPrimaryClass} !px-4 !py-1.5 !text-xs !tracking-wider`
      : `${btnSecondaryClass} !px-4 !py-1.5 !text-xs !tracking-wider !border-transparent !text-white/45 hover:!text-white`;

  return (
    <section>
      <ClientPortalSectionHeader
        title="Vault"
        description="Collect client approvals, then schedule approved concepts from the bank when you plan a shoot."
      >
        {pendingCount > 0 && activeTab === 'review' && (
          <span className="border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-amber-200/90">
            {pendingCount} awaiting client review
          </span>
        )}
        {vaultIdeas.length > 0 && (
          <span className="border border-white/25 bg-white/[0.08] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-white">
            {vaultIdeas.length} in bank
          </span>
        )}
      </ClientPortalSectionHeader>

      <div className={`${glassSegmentClass} mb-5 flex w-fit gap-0.5 p-0.5`}>
        {IDEA_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={tabClass(tab.id)}
          >
            {tab.label}
            {tab.id === 'vault' && vaultIdeas.length > 0 ? ` (${vaultIdeas.length})` : ''}
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
            onGoToBoard={onGoToBoard}
            onApprove={onApprove}
          />
        </>
      ) : (
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
            onDelete={handleDeleteVaultIdea}
            onUpdateReference={(ideaId, referenceVideo) => onUpdateIdea(ideaId, { referenceVideo })}
            onUpdateContentType={(ideaId, contentType) => onUpdateIdea(ideaId, { contentType })}
          />
        </>
      )}

      {ideaModal && (
        <VideoIdeaModal
          idea={ideaModal}
          defaultClient={clientFilter !== 'all' ? clientFilter : undefined}
          onClose={() => setIdeaModal(null)}
          onSave={(data) => onUpdateIdea(ideaModal.id, data)}
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
            setScheduleIdea(null);
          }}
        />
      )}
    </section>
  );
}
