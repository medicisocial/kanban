import { useMemo } from 'react';
import { getContentTypeStyle } from '../constants';
import {
  CLIENT_PIPELINE_COLUMNS,
  getClientPipelineCards,
  getClientPipelineDisplayColumn,
  stripInternalCardsForClientPortal,
} from '../utils/clientPortalAuth';
import { formatScheduledDateTime } from '../utils';
import ClientPortalSectionHeader from './clientPortal/ClientPortalSectionHeader';
import {
  statusBadgeClass,
  statusDotClass,
  surfacePanelClass,
} from './clientPortal/clientPortalUi';

const COLUMN_TONES = {
  'in-review': 'review',
  approved: 'approved',
  scheduled: 'scheduled',
  posted: 'posted',
};

export default function ClientPipelinePortal({ cards, clientColor, embedded = false, searchQuery = '' }) {
  const pipelineCards = getClientPipelineCards(stripInternalCardsForClientPortal(cards));

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return pipelineCards;
    return pipelineCards.filter(
      (card) =>
        card.title?.toLowerCase().includes(query) ||
        card.contentType?.toLowerCase().includes(query),
    );
  }, [pipelineCards, searchQuery]);

  const content = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {CLIENT_PIPELINE_COLUMNS.map((column) => {
        const columnCards = filteredCards.filter(
          (card) => getClientPipelineDisplayColumn(card) === column.id,
        );
        const tone = COLUMN_TONES[column.id] || 'default';

        return (
          <section key={column.id} className={`${surfacePanelClass} flex flex-col`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={statusDotClass(tone)} />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/80">
                  {column.title}
                </h3>
              </div>
              <span className="border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] tabular-nums text-white/50">
                {columnCards.length}
              </span>
            </div>
            <div className="flex-1 space-y-0 p-2">
              {columnCards.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-white/35">No records</p>
              ) : (
                columnCards.map((card) => {
                  const typeStyle = getContentTypeStyle(card.contentType);
                  return (
                    <article
                      key={card.id}
                      className="mb-2 border border-white/[0.06] bg-white/[0.02] p-3 transition-colors last:mb-0 hover:border-white/12 hover:bg-white/[0.04]"
                      style={{ borderLeftColor: typeStyle.border, borderLeftWidth: '2px' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className="text-[10px] font-medium uppercase tracking-wider"
                          style={{ color: clientColor }}
                        >
                          {card.contentType}
                        </p>
                        <span className={statusBadgeClass(tone)}>
                          <span className={statusDotClass(tone)} />
                          {column.title}
                        </span>
                      </div>
                      <h4 className="mt-1.5 text-sm font-medium text-white">{card.title}</h4>
                      {card.dueDate && (
                        <p className="mt-1 text-[11px] tabular-nums text-white/45">
                          {formatScheduledDateTime(card.dueDate, card.dueTime)}
                        </p>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader
          title="Board"
          description="Track every piece of content through production — from client review to scheduled and posted."
        />
        {content}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Content pipeline</h2>
        <p className="mt-1 text-sm text-gray-400">
          Where your content stands — in review, approved, scheduled, or posted.
        </p>
      </div>
      {content}
    </div>
  );
}
