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
    <div className="flex w-full justify-center overflow-x-auto pb-2">
      <div className="flex w-max gap-3 px-1">
      {CLIENT_PIPELINE_COLUMNS.map((column) => {
        const columnCards = filteredCards.filter(
          (card) => getClientPipelineDisplayColumn(card) === column.id,
        );
        const tone = COLUMN_TONES[column.id] || 'default';

        return (
          <section key={column.id} className="kanban-stage glass-surface flex flex-col">
            <div className="kanban-stage-header">
              <div className="flex min-w-0 items-center gap-2">
                <span className={statusDotClass(tone)} />
                <h3 className="kanban-stage-title">{column.title}</h3>
              </div>
              <span className="text-xs font-semibold tabular-nums text-white/40">
                {columnCards.length}
              </span>
            </div>
            <div className="kanban-stage-columns kanban-stage-columns-solo">
              <div className="kanban-column-cards">
                {columnCards.length === 0 ? (
                  <p className="py-8 text-center text-xs text-white/30">No records</p>
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
    </div>
  );

  if (embedded) {
    return (
      <section>
        <ClientPortalSectionHeader title="Board" compact />
        {content}
      </section>
    );
  }

  return (
    <section>
      <ClientPortalSectionHeader title="Content pipeline" compact />
      {content}
    </section>
  );
}
