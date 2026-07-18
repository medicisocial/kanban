import { Fragment, useMemo, useState } from 'react';
import { useClientsContext } from '../../context/ClientsContext';
import { IDEA_STATUSES } from '../../constants';
import ClientAvatar from '../ClientAvatar';
import ReferenceVideoLink from './ReferenceVideoLink';
import {
  btnGhostClass,
  btnPrimaryClass,
  formatPortalDate,
  mobileActionRowClass,
  mobileCardClass,
  mobileMetaClass,
  selectClass,
  statusBadgeClass,
  statusDotClass,
  surfacePanelClass,
  tableCellClass,
  tableHeaderClass,
  tableRowClass,
} from './clientPortalUi';

function SortHeader({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  const arrow = active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕';
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`${tableHeaderClass} w-full cursor-pointer select-none text-left transition-colors hover:text-white/70`}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        <span className={`text-[9px] ${active ? 'text-white/60' : 'text-white/25'}`}>{arrow}</span>
      </span>
    </button>
  );
}

function StatusBadge({ status }) {
  const tone = status === 'approved' ? 'approved' : status === 'declined' ? 'declined' : 'pending';
  return (
    <span className={statusBadgeClass(tone)}>
      <span className={statusDotClass(tone)} />
      {IDEA_STATUSES[status] || status}
    </span>
  );
}

export default function AdminIdeasTable({
  ideas,
  statusFilter,
  onStatusFilterChange,
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
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });

  const openIdeaFromRow = (event, idea) => {
    if (event.target.closest('button, a, input, select, textarea, label')) return;
    onEdit?.(idea);
  };

  const handleRowKeyDown = (event, idea) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onEdit?.(idea);
  };

  const handleSort = (key) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  };

  const statusCounts = useMemo(
    () => ({
      all: ideas.length,
      pending: ideas.filter((idea) => idea.status === 'pending').length,
      declined: ideas.filter((idea) => idea.status === 'declined').length,
    }),
    [ideas],
  );

  const filtered = useMemo(() => {
    let rows = [...ideas];

    if (statusFilter !== 'all') {
      rows = rows.filter((idea) => idea.status === statusFilter);
    }

    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      if (sort.key === 'createdAt') {
        return ((a.createdAt || 0) - (b.createdAt || 0)) * dir;
      }
      const av = (a[sort.key] || '').toString().toLowerCase();
      const bv = (b[sort.key] || '').toString().toLowerCase();
      return av.localeCompare(bv) * dir;
    });
  }, [ideas, statusFilter, sort]);

  return (
    <div className={`${surfacePanelClass} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="text-xs text-white/45">
          {filtered.length} record{filtered.length === 1 ? '' : 's'}
        </p>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className={`${selectClass} min-w-[140px]`}
          >
            <option value="pending">Pending review ({statusCounts.pending})</option>
            <option value="declined">Passed ({statusCounts.declined})</option>
            <option value="all">All statuses ({statusCounts.all})</option>
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/35">
            ▾
          </span>
        </div>
      </div>

      {selectable && filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-2.5">
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

      <div className="md:hidden">
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-white/40">
            {ideas.length > 0 && statusFilter !== 'all'
              ? `No ${statusFilter} ideas. Try "All statuses" to see every record for this filter.`
              : 'No ideas match your filters.'}
          </p>
        ) : (
          filtered.map((idea) => {
            return (
              <div
                key={idea.id}
                className={`${mobileCardClass} cursor-pointer transition hover:bg-white/[0.04]`}
                onClick={(event) => openIdeaFromRow(event, idea)}
                onKeyDown={(event) => handleRowKeyDown(event, idea)}
                role="button"
                tabIndex={0}
              >
                {selectable && (
                  <label className="mb-2 flex items-center gap-2 text-xs text-white/55">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(idea.id)}
                      onChange={() => onToggleSelect(idea.id)}
                      className="border-white/20 bg-[#111111]"
                    />
                    Select
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => onEdit?.(idea)}
                  className="w-full text-left font-medium text-white"
                >
                  {idea.title || 'Untitled idea'}
                </button>
                {idea.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-white/40">{idea.description}</p>
                )}
                {idea.referenceVideo && (
                  <div className="mt-2">
                    <ReferenceVideoLink url={idea.referenceVideo} compact />
                  </div>
                )}
                <div className={mobileMetaClass}>
                  <StatusBadge status={idea.status} />
                  {idea.contentType && <span className="uppercase tracking-wider">{idea.contentType}</span>}
                  <span className="text-white/70">{idea.client}</span>
                  <span>{formatPortalDate(idea.createdAt)}</span>
                </div>
                <div className={mobileActionRowClass}>
                  {idea.status === 'pending' && onApprove && (
                    <button
                      type="button"
                      onClick={() => onApprove(idea.id, idea.clientComment || '')}
                      className={`${btnPrimaryClass} min-h-10 flex-1 px-3 py-2 text-[11px]`}
                    >
                      Approve
                    </button>
                  )}
                  <button type="button" onClick={() => onEdit(idea)} className={`${btnGhostClass} min-h-10 flex-1 text-[11px]`}>
                    Edit
                  </button>
                  <button type="button" onClick={() => onDelete(idea.id)} className={`${btnGhostClass} min-h-10 flex-1 text-[11px] text-rose-300/80`}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[940px] border-collapse">
          <thead>
            <tr>
              {selectable && (
                <th className="w-[40px]">
                  <span className={tableHeaderClass} />
                </th>
              )}
              <th className="w-[24%]"><SortHeader label="Title" sortKey="title" sort={sort} onSort={handleSort} /></th>
              <th className="w-[12%]"><span className={tableHeaderClass}>Reference</span></th>
              <th className="w-[10%]"><SortHeader label="Status" sortKey="status" sort={sort} onSort={handleSort} /></th>
              <th className="w-[8%]"><SortHeader label="Type" sortKey="contentType" sort={sort} onSort={handleSort} /></th>
              <th className="w-[12%]"><SortHeader label="Client" sortKey="client" sort={sort} onSort={handleSort} /></th>
              <th className="w-[9%]"><SortHeader label="Created" sortKey="createdAt" sort={sort} onSort={handleSort} /></th>
              <th className="w-[17%]"><span className={tableHeaderClass}>Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={selectable ? 8 : 7} className="px-4 py-16 text-center text-sm text-white/40">
                  {ideas.length > 0 && statusFilter !== 'all'
                    ? `No ${statusFilter} ideas. Try "All statuses" to see every record for this filter.`
                    : 'No ideas match your filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((idea) => {
                const clientColor = getClientColor(idea.client);
                const isPending = idea.status === 'pending';

                return (
                  <Fragment key={idea.id}>
                    <tr
                      className={`${tableRowClass} cursor-pointer`}
                      onClick={(event) => openIdeaFromRow(event, idea)}
                      onKeyDown={(event) => handleRowKeyDown(event, idea)}
                      role="button"
                      tabIndex={0}
                    >
                      {selectable && (
                        <td className={`${tableCellClass} w-[40px]`}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(idea.id)}
                            onChange={() => onToggleSelect(idea.id)}
                            className="border-white/20 bg-[#111111]"
                          />
                        </td>
                      )}
                      <td className={tableCellClass}>
                        <button
                          type="button"
                          onClick={() => onEdit?.(idea)}
                          className="max-w-full text-left font-medium text-white transition-colors hover:text-[#c88]"
                        >
                          {idea.title || 'Untitled idea'}
                        </button>
                        {idea.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-white/40">{idea.description}</p>
                        )}
                      </td>
                      <td className={tableCellClass}>
                        <ReferenceVideoLink url={idea.referenceVideo} />
                      </td>
                      <td className={tableCellClass}>
                        <StatusBadge status={idea.status} />
                      </td>
                      <td className={`${tableCellClass} text-xs uppercase tracking-wider text-white/55`}>
                        {idea.contentType || '—'}
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex items-center gap-2">
                          <ClientAvatar client={idea.client} size="md" color={clientColor} />
                          <span className="truncate text-xs text-white/70">{idea.client}</span>
                        </div>
                      </td>
                      <td className={`${tableCellClass} text-xs tabular-nums text-white/55`}>
                        {formatPortalDate(idea.createdAt)}
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex flex-wrap items-center gap-1">
                          {isPending && onApprove && (
                            <button
                              type="button"
                              onClick={() => onApprove(idea.id, idea.clientComment || '')}
                              className={`${btnPrimaryClass} px-2.5 py-1.5 text-[10px]`}
                            >
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEdit(idea)}
                            className={`${btnGhostClass} text-[10px] uppercase tracking-wider`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(idea.id)}
                            className={`${btnGhostClass} text-[10px] uppercase tracking-wider text-rose-300/80 hover:text-rose-200`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
