import { Fragment, useMemo, useState } from 'react';
import { clientMatchesBrand } from '../../utils/clients';
import { IDEA_STATUSES } from '../../constants';
import ClientAvatar from '../ClientAvatar';
import ReferenceVideoLink from './ReferenceVideoLink';
import {
  btnGhostClass,
  btnPrimaryClass,
  btnSecondaryClass,
  formatPortalDate,
  inputClass,
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

const SORT_KEYS = {
  title: 'title',
  status: 'status',
  contentType: 'contentType',
  createdAt: 'createdAt',
};

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

export default function ClientIdeasTable({
  ideas,
  client,
  clientColor,
  clientLogo,
  onApprove,
  onDecline,
  busyIds = new Set(),
}) {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [expandedId, setExpandedId] = useState(null);
  const [declineId, setDeclineId] = useState(null);
  const [comment, setComment] = useState('');

  const handleSort = (key) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  };

  const filtered = useMemo(() => {
    let rows = ideas.filter((idea) => clientMatchesBrand(idea.client, client));

    if (statusFilter !== 'all') {
      rows = rows.filter((idea) => idea.status === statusFilter);
    }

    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === 'createdAt') {
        return ((a.createdAt || 0) - (b.createdAt || 0)) * dir;
      }
      const av = (a[sort.key] || '').toString().toLowerCase();
      const bv = (b[sort.key] || '').toString().toLowerCase();
      return av.localeCompare(bv) * dir;
    });
  }, [ideas, client, statusFilter, sort]);

  const submitDecline = (ideaId) => {
    onDecline?.(ideaId, comment.trim());
    setDeclineId(null);
    setComment('');
    setExpandedId(null);
  };

  return (
    <div className={`${surfacePanelClass} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="text-xs text-white/45">
          {filtered.length} record{filtered.length === 1 ? '' : 's'}
        </p>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${selectClass} min-w-[140px]`}
          >
            <option value="pending">Pending review</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
            <option value="all">All statuses</option>
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/35">
            ▾
          </span>
        </div>
      </div>

      <div className="md:hidden">
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-white/40">No ideas match your filters.</p>
        ) : (
          filtered.map((idea) => {
            const isPending = idea.status === 'pending';
            const isBusy = busyIds.has(idea.id);
            const expanded = expandedId === idea.id;
            const declining = declineId === idea.id;

            return (
              <div key={idea.id} className={mobileCardClass}>
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
                {idea.referenceVideo && (
                  <div className="mt-2">
                    <ReferenceVideoLink url={idea.referenceVideo} compact />
                  </div>
                )}
                <div className={mobileMetaClass}>
                  <StatusBadge status={idea.status} />
                  {idea.contentType && <span className="uppercase tracking-wider">{idea.contentType}</span>}
                  <span>{formatPortalDate(idea.createdAt)}</span>
                </div>
                {isPending && (
                  <div className={mobileActionRowClass}>
                    <button
                      type="button"
                      onClick={() => onApprove?.(idea.id, '')}
                      disabled={isBusy}
                      className={`${btnPrimaryClass} min-h-10 flex-1 px-3 py-2 text-[11px] disabled:opacity-40`}
                    >
                      {isBusy ? 'Saving…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeclineId(idea.id);
                        setExpandedId(idea.id);
                      }}
                      disabled={isBusy}
                      className={`${btnSecondaryClass} min-h-10 flex-1 px-3 py-2 text-[11px] disabled:opacity-40`}
                    >
                      Decline
                    </button>
                  </div>
                )}
                {(expanded || declining) && (
                  <div className="mt-3 space-y-3 border border-white/10 bg-white/[0.02] p-3">
                    {idea.description && (
                      <p className="text-sm leading-relaxed text-white/70">{idea.description}</p>
                    )}
                    {idea.referenceVideo && (
                      <p className="mt-2">
                        <ReferenceVideoLink url={idea.referenceVideo} />
                      </p>
                    )}
                    {declining && (
                      <>
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          rows={3}
                          placeholder="What should we change?"
                          className={`${inputClass} resize-y text-xs`}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDeclineId(null);
                              setComment('');
                            }}
                            className={`${btnSecondaryClass} min-h-10 flex-1 text-[11px]`}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => submitDecline(idea.id)}
                            className={`${btnSecondaryClass} min-h-10 flex-1 text-[11px]`}
                          >
                            Submit decline
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[940px] border-collapse">
          <thead>
            <tr>
              <th className="w-[26%]"><SortHeader label="Title" sortKey={SORT_KEYS.title} sort={sort} onSort={handleSort} /></th>
              <th className="w-[12%]"><span className={tableHeaderClass}>Reference</span></th>
              <th className="w-[10%]"><SortHeader label="Status" sortKey={SORT_KEYS.status} sort={sort} onSort={handleSort} /></th>
              <th className="w-[8%]"><SortHeader label="Type" sortKey={SORT_KEYS.contentType} sort={sort} onSort={handleSort} /></th>
              <th className="w-[12%]"><span className={tableHeaderClass}>Client</span></th>
              <th className="w-[10%]"><SortHeader label="Created" sortKey={SORT_KEYS.createdAt} sort={sort} onSort={handleSort} /></th>
              <th className="w-[14%]"><span className={tableHeaderClass}>Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-sm text-white/40">
                  No ideas match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((idea) => {
                const isPending = idea.status === 'pending';
                const isBusy = busyIds.has(idea.id);
                const expanded = expandedId === idea.id;
                const declining = declineId === idea.id;

                return (
                  <Fragment key={idea.id}>
                    <tr className={tableRowClass}>
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
                          <ClientAvatar client={client} size="md" color={clientColor} logoUrl={clientLogo} />
                          <span className="truncate text-xs text-white/70">{client}</span>
                        </div>
                      </td>
                      <td className={`${tableCellClass} text-xs tabular-nums text-white/55`}>
                        {formatPortalDate(idea.createdAt)}
                      </td>
                      <td className={tableCellClass}>
                        {isPending ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onApprove?.(idea.id, '')}
                              disabled={isBusy}
                              className={`${btnPrimaryClass} px-2.5 py-1.5 text-[10px] disabled:opacity-40`}
                            >
                              {isBusy ? 'Saving…' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeclineId(idea.id);
                                setExpandedId(idea.id);
                              }}
                              disabled={isBusy}
                              className={`${btnSecondaryClass} px-2.5 py-1.5 text-[10px] disabled:opacity-40`}
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : idea.id)}
                            className={`${btnGhostClass} text-[10px] uppercase tracking-wider`}
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                    {(expanded || declining) && (
                      <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                            <div>
                              {idea.description && (
                                <p className="text-sm leading-relaxed text-white/70">{idea.description}</p>
                              )}
                              {idea.referenceVideo && (
                                <p className="mt-2">
                                  <ReferenceVideoLink url={idea.referenceVideo} />
                                </p>
                              )}
                            </div>
                            {declining && (
                              <div className="min-w-[260px] border border-white/10 bg-[#0d0d0d] p-3">
                                <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">
                                  Decline with feedback
                                </p>
                                <textarea
                                  value={comment}
                                  onChange={(e) => setComment(e.target.value)}
                                  rows={3}
                                  placeholder="What should we change?"
                                  className={`${inputClass} mt-2 resize-y text-xs`}
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeclineId(null);
                                      setComment('');
                                    }}
                                    className={`${btnGhostClass} text-[10px] uppercase tracking-wider`}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => submitDecline(idea.id)}
                                    className={`${btnSecondaryClass} px-3 py-1.5 text-[10px]`}
                                  >
                                    Submit decline
                                  </button>
                                </div>
                              </div>
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
