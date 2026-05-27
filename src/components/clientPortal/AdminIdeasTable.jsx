import { Fragment, useMemo, useState } from 'react';
import { useClientsContext } from '../../context/ClientsContext';
import { IDEA_STATUSES } from '../../constants';
import ClientAvatar from '../ClientAvatar';
import {
  btnGhostClass,
  btnSecondaryClass,
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
  searchQuery = '',
  statusFilter,
  onStatusFilterChange,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  allSelected,
  onEdit,
  onDelete,
  onGoToBoard,
}) {
  const { getClientColor, getClientAccountManager } = useClientsContext();
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [expandedId, setExpandedId] = useState(null);

  const handleSort = (key) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  };

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let rows = [...ideas];

    if (statusFilter !== 'all') {
      rows = rows.filter((idea) => idea.status === statusFilter);
    }

    if (query) {
      rows = rows.filter(
        (idea) =>
          [idea.title, idea.client, idea.description, idea.clientComment, idea.referenceVideo]
            .join(' ')
            .toLowerCase()
            .includes(query),
      );
    }

    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      if (sort.key === 'createdAt') {
        return ((a.createdAt || 0) - (b.createdAt || 0)) * dir;
      }
      if (sort.key === 'accountManager') {
        const av = getClientAccountManager(a.client) || '';
        const bv = getClientAccountManager(b.client) || '';
        return av.localeCompare(bv) * dir;
      }
      const av = (a[sort.key] || '').toString().toLowerCase();
      const bv = (b[sort.key] || '').toString().toLowerCase();
      return av.localeCompare(bv) * dir;
    });
  }, [ideas, statusFilter, searchQuery, sort, getClientAccountManager]);

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
            <option value="pending">Pending review</option>
            <option value="approved">Approved</option>
            <option value="declined">Passed</option>
            <option value="all">All statuses</option>
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
          <p className="px-4 py-12 text-center text-sm text-white/40">No ideas match your filters.</p>
        ) : (
          filtered.map((idea) => {
            const expanded = expandedId === idea.id;

            return (
              <div key={idea.id} className={mobileCardClass}>
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
                  onClick={() => setExpandedId(expanded ? null : idea.id)}
                  className="w-full text-left font-medium text-white"
                >
                  {idea.title || 'Untitled idea'}
                </button>
                {idea.description && !expanded && (
                  <p className="mt-1 line-clamp-2 text-xs text-white/40">{idea.description}</p>
                )}
                <div className={mobileMetaClass}>
                  <StatusBadge status={idea.status} />
                  {idea.contentType && <span className="uppercase tracking-wider">{idea.contentType}</span>}
                  <span className="text-white/70">{idea.client}</span>
                  <span>{formatPortalDate(idea.createdAt)}</span>
                </div>
                <div className={mobileActionRowClass}>
                  <button type="button" onClick={() => onEdit(idea)} className={`${btnGhostClass} min-h-10 flex-1 text-[11px]`}>
                    Edit
                  </button>
                  {idea.boardCardId && (
                    <button type="button" onClick={() => onGoToBoard(idea.boardCardId)} className={`${btnGhostClass} min-h-10 flex-1 text-[11px]`}>
                      Board
                    </button>
                  )}
                  <button type="button" onClick={() => onDelete(idea.id)} className={`${btnGhostClass} min-h-10 flex-1 text-[11px] text-rose-300/80`}>
                    Delete
                  </button>
                </div>
                {expanded && (
                  <div className="mt-3 border border-white/10 bg-white/[0.02] p-3 text-sm text-white/70">
                    {idea.description && <p>{idea.description}</p>}
                    {idea.referenceVideo && (
                      <p className="mt-2 text-xs text-white/45">
                        Reference:{' '}
                        <a href={idea.referenceVideo} target="_blank" rel="noreferrer" className="text-[#c88] underline-offset-2 hover:underline">
                          {idea.referenceVideo}
                        </a>
                      </p>
                    )}
                    {idea.clientComment && (
                      <p className="mt-2 text-xs text-white/50">Client note: {idea.clientComment}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr>
              {selectable && (
                <th className="w-[40px]">
                  <span className={tableHeaderClass} />
                </th>
              )}
              <th className="w-[28%]"><SortHeader label="Title" sortKey="title" sort={sort} onSort={handleSort} /></th>
              <th className="w-[11%]"><SortHeader label="Status" sortKey="status" sort={sort} onSort={handleSort} /></th>
              <th className="w-[9%]"><SortHeader label="Type" sortKey="contentType" sort={sort} onSort={handleSort} /></th>
              <th className="w-[13%]"><SortHeader label="Client" sortKey="client" sort={sort} onSort={handleSort} /></th>
              <th className="w-[11%]"><SortHeader label="Assigned AM" sortKey="accountManager" sort={sort} onSort={handleSort} /></th>
              <th className="w-[10%]"><SortHeader label="Created" sortKey="createdAt" sort={sort} onSort={handleSort} /></th>
              <th className="w-[14%]"><span className={tableHeaderClass}>Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={selectable ? 8 : 7} className="px-4 py-16 text-center text-sm text-white/40">
                  No ideas match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((idea) => {
                const clientColor = getClientColor(idea.client);
                const accountManager = getClientAccountManager(idea.client);
                const expanded = expandedId === idea.id;

                return (
                  <Fragment key={idea.id}>
                    <tr className={tableRowClass}>
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
                          onClick={() => setExpandedId(expanded ? null : idea.id)}
                          className="max-w-full text-left font-medium text-white transition-colors hover:text-[#c88]"
                        >
                          {idea.title || 'Untitled idea'}
                        </button>
                        {idea.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-white/40">{idea.description}</p>
                        )}
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
                      <td className={`${tableCellClass} text-xs text-white/65`}>
                        {accountManager || '—'}
                      </td>
                      <td className={`${tableCellClass} text-xs tabular-nums text-white/55`}>
                        {formatPortalDate(idea.createdAt)}
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(idea)}
                            className={`${btnGhostClass} text-[10px] uppercase tracking-wider`}
                          >
                            Edit
                          </button>
                          {idea.boardCardId && (
                            <button
                              type="button"
                              onClick={() => onGoToBoard(idea.boardCardId)}
                              className={`${btnGhostClass} text-[10px] uppercase tracking-wider`}
                            >
                              Board
                            </button>
                          )}
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
                    {expanded && (
                      <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                        <td colSpan={selectable ? 8 : 7} className="px-4 py-4">
                          <div className="text-sm text-white/70">
                            {idea.description && <p>{idea.description}</p>}
                            {idea.referenceVideo && (
                              <p className="mt-2 text-xs text-white/45">
                                Reference:{' '}
                                <a
                                  href={idea.referenceVideo}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#c88] underline-offset-2 hover:underline"
                                >
                                  {idea.referenceVideo}
                                </a>
                              </p>
                            )}
                            {idea.clientComment && (
                              <p className="mt-2 text-xs text-white/50">Client note: {idea.clientComment}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
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
