import { getContentTypeStyle } from '../constants';
import { contentTypePipelinePillProps } from '../utils/contentTypeColors';
import { buildEditorCompletedCards, getEditorCompletedStatusLabel } from '../utils/editorTodo';
import { PortalTaskSection } from './clientPortal/PortalOverviewPanels';

function CompletedContentCardRow({ card, onOpen, getClientColor }) {
  const typeStyle = card.contentType ? getContentTypeStyle(card.contentType) : null;
  const clientColor = getClientColor?.(card.client) || '#9ca3af';

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen?.(card)}
        className="flex w-full items-start gap-4 px-4 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <span className="min-w-0 flex-1">
          <span className="mb-2 flex flex-wrap items-center gap-2">
            {card.contentType && typeStyle && (
              <span {...contentTypePipelinePillProps(typeStyle)}>{card.contentType}</span>
            )}
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-white/45">
              {getEditorCompletedStatusLabel(card)}
            </span>
          </span>
          <span className="block text-sm font-medium text-white">
            {card.title?.trim() || 'Untitled'}
          </span>
          <span className="mt-0.5 block text-xs font-medium" style={{ color: clientColor }}>
            {card.client}
          </span>
        </span>
      </button>
    </li>
  );
}

export default function OverviewCompletedContentSection({
  title = 'Completed content',
  subtitle,
  entries = [],
  cards,
  clientFilter,
  expandedEditorName,
  onToggleEditor,
  onOpenCard,
  getClientColor,
}) {
  const expandedCards = expandedEditorName
    ? buildEditorCompletedCards(cards, {
        assignee: expandedEditorName,
        clientFilter,
      })
    : [];

  return (
    <>
      {entries.length > 0 && (
        <div className="mx-auto mb-8 max-w-[960px]">
          <PortalTaskSection title={title} subtitle={subtitle}>
            <ul className="divide-y divide-white/[0.06]">
              {entries.map((entry) => {
                const isExpanded = expandedEditorName === entry.name;
                const isInteractive = entry.count > 0;

                return (
                  <li key={entry.name}>
                    {isInteractive ? (
                      <button
                        type="button"
                        onClick={() => onToggleEditor?.(entry.name)}
                        className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/[0.03] ${
                          isExpanded ? 'bg-white/[0.02]' : ''
                        }`}
                      >
                        <span className="text-sm font-medium text-white">{entry.name}</span>
                        <span className="flex items-center gap-2 text-sm font-semibold tabular-nums text-white/78">
                          {entry.count}
                          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">
                            {isExpanded ? 'Hide' : 'View'}
                          </span>
                        </span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-sm font-medium text-white/55">{entry.name}</span>
                        <span className="text-sm font-semibold tabular-nums text-white/35">
                          {entry.count}
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </PortalTaskSection>
        </div>
      )}

      {expandedEditorName && (
        <div className="mx-auto mb-8 max-w-[960px]">
          <PortalTaskSection
            title={expandedEditorName}
            subtitle={subtitle}
            action={
              <button
                type="button"
                onClick={() => onToggleEditor?.(expandedEditorName)}
                className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/45 transition hover:text-white/70"
              >
                Close
              </button>
            }
          >
            {expandedCards.length > 0 ? (
              <ul className="divide-y divide-white/[0.06]">
                {expandedCards.map((card) => (
                  <CompletedContentCardRow
                    key={card.id}
                    card={card}
                    onOpen={onOpenCard}
                    getClientColor={getClientColor}
                  />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-white/45">No content scheduled this month.</p>
            )}
          </PortalTaskSection>
        </div>
      )}
    </>
  );
}
