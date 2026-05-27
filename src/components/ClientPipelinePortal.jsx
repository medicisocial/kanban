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
  glassInsetClass,
} from './clientPortal/clientPortalUi';

const COLUMN_TONES = {
  'in-review': 'review',
  approved: 'approved',
  scheduled: 'scheduled',
  posted: 'posted',
};

export default function ClientPipelinePortal({ cards, clientColor, embedded = false }) {
  const pipelineCards = getClientPipelineCards(stripInternalCardsForClientPortal(cards));
  const filteredCards = pipelineCards;

  const content = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {CLIENT_PIPELINE_COLUMNS.map((column) => {
        const columnCards = filteredCards.filter(
          (card) => getClientPipelineDisplayColumn(card) === column.id,
        );
        const tone = COLUMN_TONES[column.id] || 'default';

        return (
          <section key={column.id} className="overview-role-panel glass-surface flex flex-col">
            <div className="overview-role-panel-header-row">
              <div className="flex min-w-0 items-center gap-2">
                <span className={statusDotClass(tone)} />
                <h3 className="overview-role-title">{column.title}</h3>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-white/50">
                {columnCards.length}
              </span>
            </div>
            <div className="overview-role-panel-body overview-role-panel-body-list mx-4 mb-4 flex-1">
              <div className="p-2">
              {columnCards.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-white/35">No records</p>
              ) : (
                columnCards.map((card) => {
                  const typeStyle = getContentTypeStyle(card.contentType);
                  return (
                    <article
                      key={card.id}
                      className={`${glassInsetClass} mb-2 p-3 transition-colors last:mb-0 hover:border-white/12`}
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
