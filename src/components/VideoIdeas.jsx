import { useState, useMemo, useEffect } from 'react';
import VideoIdeaModal from './VideoIdeaModal';
import ClientSharePanel from './ClientSharePanel';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import AdminIdeasTable from './clientPortal/AdminIdeasTable';
import { btnPrimaryClass, btnSecondaryClass, surfacePanelClass } from './clientPortal/clientPortalUi';

export default function VideoIdeas({
  ideas,
  clientFilter,
  search,
  onAddIdea,
  onApprove,
  onDecline,
  onDeleteIdea,
  onDeleteIdeas,
  onUpdateIdea,
  onGoToBoard,
}) {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [ideaModal, setIdeaModal] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const isBulkDeleteView = statusFilter === 'approved' || statusFilter === 'declined';
  const bulkDeleteLabel = statusFilter === 'declined' ? 'passed idea' : 'approved idea';

  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter]);

  const filteredByClient = useMemo(() => {
    if (!clientFilter || clientFilter === 'all') return ideas;
    return ideas.filter((idea) => idea.client === clientFilter);
  }, [ideas, clientFilter]);

  const pendingCount = filteredByClient.filter((i) => i.status === 'pending').length;
  const selectedCount = selectedIds.size;

  const filteredIdeas = useMemo(() => {
    let list = filteredByClient;
    if (statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        [i.title, i.client, i.description, i.clientComment, i.referenceVideo]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    return list;
  }, [filteredByClient, statusFilter, search]);

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
    if (selectedCount === 0) return;
    const label =
      selectedCount === 1 ? `1 ${bulkDeleteLabel}` : `${selectedCount} ${bulkDeleteLabel}s`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    onDeleteIdeas([...selectedIds]);
    setSelectedIds(new Set());
  };

  return (
    <section>
      <ClientPortalSectionHeader
        title="Video Ideas"
        description="Share video concepts with clients for approval. Approved ideas automatically move to the production board."
        actionLabel="+ Add idea"
        onAction={() => setIdeaModal('add')}
        action={btnPrimaryClass}
      >
        {pendingCount > 0 && (
          <span className="border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-amber-200/90">
            {pendingCount} awaiting client review
          </span>
        )}
      </ClientPortalSectionHeader>

      <ClientSharePanel ideas={ideas} clientFilter={clientFilter} />

      {isBulkDeleteView && filteredIdeas.length > 0 && selectedCount > 0 && (
        <div className={`${surfacePanelClass} mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
          <p className="text-sm text-white/55">{selectedCount} selected</p>
          <button
            type="button"
            onClick={handleBulkDelete}
            className={`${btnSecondaryClass} border-rose-500/30 bg-rose-500/10 text-rose-200/90 hover:bg-rose-500/15`}
          >
            Delete selected
          </button>
        </div>
      )}

      {filteredByClient.length === 0 ? (
        <div className={`${surfacePanelClass} px-6 py-16 text-center`}>
          <p className="text-sm text-white/45">No video ideas for this client filter.</p>
          <button
            type="button"
            onClick={() => setIdeaModal('add')}
            className={`${btnPrimaryClass} mt-4`}
          >
            Add your first idea
          </button>
        </div>
      ) : (
        <AdminIdeasTable
          ideas={filteredByClient}
          searchQuery={search}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          selectable={isBulkDeleteView}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelected}
          onSelectAll={handleSelectAll}
          allSelected={allVisibleSelected}
          onEdit={setIdeaModal}
          onDelete={onDeleteIdea}
          onGoToBoard={onGoToBoard}
        />
      )}

      {ideaModal && (
        <VideoIdeaModal
          idea={ideaModal === 'add' ? null : ideaModal}
          defaultClient={clientFilter !== 'all' ? clientFilter : undefined}
          onClose={() => setIdeaModal(null)}
          onSave={(data) => {
            if (ideaModal === 'add') {
              onAddIdea(data);
            } else {
              onUpdateIdea(ideaModal.id, data);
            }
          }}
        />
      )}
    </section>
  );
}
