import { useMemo } from 'react';
import { useClientsContext } from '../../context/ClientsContext';
import { IDEA_STATUSES, getContentTypeStyle } from '../../constants';
import { contentTypePipelinePillProps } from '../../utils/contentTypeColors';
import ClientAvatar from '../ClientAvatar';
import TeamTaskCard from '../TeamTaskCard';
import ReferenceVideoLink, { ReferenceMusicLink } from './ReferenceVideoLink';
import {
  selectClass,
  surfacePanelClass,
  taskActionBtnClass,
  vaultRowActionsClass,
} from './clientPortalUi';

function StatusBadge({ status }) {
  return (
    <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/45">
      {IDEA_STATUSES[status] || status}
    </span>
  );
}

export default function AdminIdeasTable({
  ideas,
  statusFilter,
  onStatusFilterChange,
  hideStatusFilter = false,
  showRejectionNote = false,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  allSelected,
  onEdit,
  onDelete,
  onApprove,
}) {
  const { getClientColor } = useClientsContext();

  const statusCounts = useMemo(
    () => ({
      all: ideas.length,
      pending: ideas.filter((idea) => idea.status === 'pending').length,
    }),
    [ideas],
  );

  const filtered = useMemo(() => {
    let rows = [...ideas];

    if (statusFilter !== 'all') {
      rows = rows.filter((idea) => idea.status === statusFilter);
    }

    return rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [ideas, statusFilter]);

  const emptyMessage =
    ideas.length > 0 && statusFilter !== 'all'
      ? `No ${statusFilter} ideas. Try "All statuses" to see every record for this filter.`
      : 'No ideas match your filters.';

  return (
    <div>
      <div className={`${surfacePanelClass} mb-3 overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-xs text-white/45">
            {filtered.length} record{filtered.length === 1 ? '' : 's'}
          </p>
          {!hideStatusFilter && (
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className={`${selectClass} min-w-[140px]`}
              >
                <option value="pending">Pending review ({statusCounts.pending})</option>
                <option value="all">All statuses ({statusCounts.all})</option>
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/35">
                ▾
              </span>
            </div>
          )}
        </div>

        {selectable && filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-4 py-2.5">
            <label className="flex items-center gap-2 text-xs text-white/55">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="border-white/20 bg-[#111111]"
              />
              Select all visible
            </label>
            <p className="text-xs text-white/40">{selectedIds.size} selected</p>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className={`${surfacePanelClass} px-4 py-16 text-center`}>
          <p className="text-sm text-white/40">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((idea, index) => {
            const clientColor = getClientColor(idea.client);
            const isPending = idea.status === 'pending';
            const rejectionNote = String(idea.clientComment || '').trim();

            return (
              <TeamTaskCard
                key={idea.id}
                accentColor={clientColor}
                animationDelay={`${0.08 + index * 0.05}s`}
                onOpen={() => onEdit?.(idea)}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {selectable && (
                      <label className="mt-1 flex shrink-0 items-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(idea.id)}
                          onChange={() => onToggleSelect(idea.id)}
                          className="border-white/20 bg-[#111111]"
                        />
                        <span className="sr-only">Select</span>
                      </label>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="tesla-task-card-meta mb-2">
                        {idea.contentType && (
                          <span {...contentTypePipelinePillProps(getContentTypeStyle(idea.contentType))}>
                            {idea.contentType}
                          </span>
                        )}
                        <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-white/45">
                          <ClientAvatar client={idea.client} size="xs" color={clientColor} />
                          <span className="truncate">{idea.client}</span>
                        </div>
                      </div>
                      <h3 className="truncate text-sm font-semibold text-white">
                        {idea.title || 'Untitled idea'}
                      </h3>
                      <div className="mt-1">
                        <StatusBadge status={idea.status} />
                      </div>
                      {showRejectionNote && rejectionNote ? (
                        <p className="mt-1 line-clamp-3 text-xs text-rose-200/80">
                          <span className="font-medium text-rose-200/90">Rejection note: </span>
                          {rejectionNote}
                        </p>
                      ) : null}
                      {!showRejectionNote && idea.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-sky-200/70">
                          <span className="font-medium text-sky-200/90">Client notes: </span>
                          {idea.description}
                        </p>
                      ) : null}
                      {(idea.referenceVideo || idea.referenceMusic) && (
                        <div className="mt-2 flex flex-wrap gap-3">
                          {idea.referenceVideo && (
                            <ReferenceVideoLink url={idea.referenceVideo} compact />
                          )}
                          {idea.referenceMusic?.trim() && (
                            <ReferenceMusicLink url={idea.referenceMusic} compact />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={vaultRowActionsClass}>
                    {isPending && onApprove && (
                      <button
                        type="button"
                        onClick={() => onApprove(idea.id, idea.clientComment || '')}
                        className={taskActionBtnClass}
                      >
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(idea.id)}
                      className={taskActionBtnClass}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </TeamTaskCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
