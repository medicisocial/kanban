import { Fragment, useMemo, useState } from 'react';
import { getContentTypeStyle } from '../../constants';
import ClientAvatar from '../ClientAvatar';
import { formatScheduledDateTime } from '../../utils';
import {
  btnGhostClass,
  btnPrimaryClass,
  btnSecondaryClass,
  inputClass,
  mobileActionRowClass,
  mobileCardClass,
  mobileMetaClass,
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

export default function ClientTasksTable({
  cards,
  client,
  clientColor,
  clientLogo,
  searchQuery = '',
  onApprove,
  onDeny,
}) {
  const [sort, setSort] = useState({ key: 'dueDate', dir: 'asc' });
  const [expandedId, setExpandedId] = useState(null);
  const [denyId, setDenyId] = useState(null);
  const [comment, setComment] = useState('');

  const handleSort = (key) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  };

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let rows = [...cards];

    if (query) {
      rows = rows.filter(
        (card) =>
          card.title?.toLowerCase().includes(query) ||
          card.contentType?.toLowerCase().includes(query),
      );
    }

    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      if (sort.key === 'dueDate') {
        const av = a.dueDate || '9999';
        const bv = b.dueDate || '9999';
        return av.localeCompare(bv) * dir;
      }
      const av = (a[sort.key] || '').toString().toLowerCase();
      const bv = (b[sort.key] || '').toString().toLowerCase();
      return av.localeCompare(bv) * dir;
    });
  }, [cards, searchQuery, sort]);

  const submitDeny = (cardId) => {
    const trimmed = comment.trim();
    if (!trimmed) return;
    onDeny?.(cardId, trimmed);
    setDenyId(null);
    setComment('');
    setExpandedId(null);
  };

  return (
    <div className={`${surfacePanelClass} overflow-hidden`}>
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-xs text-white/45">
          {filtered.length} task{filtered.length === 1 ? '' : 's'} awaiting review
        </p>
      </div>

      <div className="md:hidden">
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-white/40">No tasks waiting for your review.</p>
        ) : (
          filtered.map((card) => {
            const expanded = expandedId === card.id;
            const denying = denyId === card.id;
            const typeStyle = getContentTypeStyle(card.contentType);

            return (
              <div key={card.id} className={mobileCardClass}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : card.id)}
                  className="w-full text-left font-medium text-white"
                >
                  {card.title || 'Untitled'}
                </button>
                <div className={mobileMetaClass}>
                  <span className="uppercase tracking-wider" style={{ color: typeStyle.border }}>
                    {card.contentType}
                  </span>
                  <span className={statusBadgeClass('review')}>
                    <span className={statusDotClass('review')} />
                    In review
                  </span>
                  <span>{card.dueDate ? formatScheduledDateTime(card.dueDate, card.dueTime) : 'No due date'}</span>
                </div>
                <div className={mobileActionRowClass}>
                  <button
                    type="button"
                    onClick={() => onApprove?.(card.id, '')}
                    className={`${btnPrimaryClass} min-h-10 flex-1 px-3 py-2 text-[11px]`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDenyId(card.id);
                      setExpandedId(card.id);
                    }}
                    className={`${btnSecondaryClass} min-h-10 flex-1 px-3 py-2 text-[11px]`}
                  >
                    Revise
                  </button>
                </div>
                {(expanded || denying) && (
                  <div className="mt-3 space-y-3 border border-white/10 bg-white/[0.02] p-3">
                    {card.description ? (
                      <p className="text-sm text-white/65">{card.description}</p>
                    ) : (
                      <p className="text-sm text-white/40">No additional details.</p>
                    )}
                    {card.driveLink && (
                      <a href={card.driveLink} target="_blank" rel="noreferrer" className="text-xs text-[#c88] underline-offset-2 hover:underline">
                        View content
                      </a>
                    )}
                    {denying && (
                      <>
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          rows={3}
                          placeholder="Required — explain what to change"
                          className={`${inputClass} resize-y text-xs`}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDenyId(null);
                              setComment('');
                            }}
                            className={`${btnSecondaryClass} min-h-10 flex-1 text-[11px]`}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => submitDeny(card.id)}
                            disabled={!comment.trim()}
                            className={`${btnSecondaryClass} min-h-10 flex-1 text-[11px] disabled:opacity-40`}
                          >
                            Submit notes
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
        <table className="w-full min-w-[880px] border-collapse">
          <thead>
            <tr>
              <th className="w-[36%]"><SortHeader label="Title" sortKey="title" sort={sort} onSort={handleSort} /></th>
              <th className="w-[12%]"><SortHeader label="Type" sortKey="contentType" sort={sort} onSort={handleSort} /></th>
              <th className="w-[12%]"><span className={tableHeaderClass}>Status</span></th>
              <th className="w-[14%]"><span className={tableHeaderClass}>Client</span></th>
              <th className="w-[16%]"><SortHeader label="Due" sortKey="dueDate" sort={sort} onSort={handleSort} /></th>
              <th className="w-[12%]"><span className={tableHeaderClass}>Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-white/40">
                  No tasks waiting for your review.
                </td>
              </tr>
            ) : (
              filtered.map((card) => {
                const expanded = expandedId === card.id;
                const denying = denyId === card.id;
                const typeStyle = getContentTypeStyle(card.contentType);

                return (
                  <Fragment key={card.id}>
                    <tr className={tableRowClass}>
                      <td className={tableCellClass}>
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : card.id)}
                          className="text-left font-medium text-white transition-colors hover:text-[#c88]"
                        >
                          {card.title || 'Untitled'}
                        </button>
                      </td>
                      <td className={tableCellClass}>
                        <span
                          className="text-[10px] font-medium uppercase tracking-wider"
                          style={{ color: typeStyle.border }}
                        >
                          {card.contentType}
                        </span>
                      </td>
                      <td className={tableCellClass}>
                        <span className={statusBadgeClass('review')}>
                          <span className={statusDotClass('review')} />
                          In review
                        </span>
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex items-center gap-2">
                          <ClientAvatar client={client} size="md" color={clientColor} logoUrl={clientLogo} />
                          <span className="truncate text-xs text-white/70">{client}</span>
                        </div>
                      </td>
                      <td className={`${tableCellClass} text-xs tabular-nums text-white/55`}>
                        {card.dueDate ? formatScheduledDateTime(card.dueDate, card.dueTime) : '—'}
                      </td>
                      <td className={tableCellClass}>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onApprove?.(card.id, '')}
                            className={`${btnPrimaryClass} px-2.5 py-1.5 text-[10px]`}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDenyId(card.id);
                              setExpandedId(card.id);
                            }}
                            className={`${btnSecondaryClass} px-2.5 py-1.5 text-[10px]`}
                          >
                            Revise
                          </button>
                        </div>
                      </td>
                    </tr>
                    {(expanded || denying) && (
                      <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                            <div className="text-sm text-white/65">
                              {card.description ? (
                                <p>{card.description}</p>
                              ) : (
                                <p className="text-white/40">No additional details.</p>
                              )}
                              {card.driveLink && (
                                <p className="mt-2 text-xs">
                                  <a
                                    href={card.driveLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#c88] underline-offset-2 hover:underline"
                                  >
                                    View content
                                  </a>
                                </p>
                              )}
                            </div>
                            {denying && (
                              <div className="min-w-[260px] border border-white/10 bg-[#0d0d0d] p-3">
                                <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">
                                  Revision notes
                                </p>
                                <textarea
                                  value={comment}
                                  onChange={(e) => setComment(e.target.value)}
                                  rows={3}
                                  placeholder="Required — explain what to change"
                                  className={`${inputClass} mt-2 resize-y text-xs`}
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDenyId(null);
                                      setComment('');
                                    }}
                                    className={`${btnGhostClass} text-[10px] uppercase tracking-wider`}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => submitDeny(card.id)}
                                    disabled={!comment.trim()}
                                    className={`${btnSecondaryClass} px-3 py-1.5 text-[10px] disabled:opacity-40`}
                                  >
                                    Submit notes
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
