import { getContentTypeStyle } from '../constants';
import { CLIENT_PIPELINE_COLUMNS, getClientPipelineCards } from '../utils/clientPortalAuth';
import { formatScheduledDateTime } from '../utils';

export default function ClientPipelinePortal({ cards, clientColor }) {
  const pipelineCards = getClientPipelineCards(cards);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Content pipeline</h2>
        <p className="mt-1 text-sm text-gray-400">
          Where your content stands — in review, approved, or scheduled to post.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CLIENT_PIPELINE_COLUMNS.map((column) => {
          const columnCards = pipelineCards.filter((card) => card.columnId === column.id);
          return (
            <section
              key={column.id}
              className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{column.title}</h3>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400">
                  {columnCards.length}
                </span>
              </div>
              <div className="space-y-3">
                {columnCards.length === 0 ? (
                  <p className="text-xs text-gray-500">Nothing here right now.</p>
                ) : (
                  columnCards.map((card) => {
                    const typeStyle = getContentTypeStyle(card.contentType);
                    return (
                      <article
                        key={card.id}
                        className="rounded-xl border border-white/8 bg-[#111111] p-3"
                        style={{ borderLeftColor: typeStyle.border, borderLeftWidth: '3px' }}
                      >
                        <p className="text-[10px] font-semibold uppercase" style={{ color: clientColor }}>
                          {card.contentType}
                        </p>
                        <h4 className="mt-1 text-sm font-medium text-white">{card.title}</h4>
                        {card.dueDate && (
                          <p className="mt-1 text-xs text-gray-400">
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
    </div>
  );
}
