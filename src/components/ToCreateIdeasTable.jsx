import { useClientsContext } from '../context/ClientsContext';
import { getContentTypeStyle } from '../constants';
import { formatDate, formatTime } from '../utils';
import { findIdeaBoardCard, sortIdeasByShootSchedule } from '../utils/videoIdeas';
import { contentTypeLabelProps } from '../utils/contentTypeColors';
import ClientAvatar from './ClientAvatar';
import {
  btnGhostClass,
  btnPrimaryClass,
  surfacePanelClass,
} from './clientPortal/clientPortalUi';

export default function ToCreateIdeasTable({
  ideas,
  cards,
  onEdit,
  onOpenCard,
  onReturnToApproved,
}) {
  const { getClientColor } = useClientsContext();

  if (!ideas.length) {
    return (
      <div className={`${surfacePanelClass} px-4 py-16 text-center`}>
        <p className="text-sm text-white/45">No approved ideas are scheduled for a shoot.</p>
        <p className="mt-2 text-xs text-white/35">
          Schedule an idea from Approved to create its To Create card.
        </p>
      </div>
    );
  }

  const scheduledIdeas = sortIdeasByShootSchedule(ideas, cards)
    .map((idea) => ({ idea, card: findIdeaBoardCard(idea, cards) }))
    .filter(({ card }) => card);

  return (
    <div className={`${surfacePanelClass} divide-y divide-white/[0.06] overflow-hidden`}>
      {scheduledIdeas.map(({ idea, card }) => {
        const typeStyle = getContentTypeStyle(card.contentType);
        const clientColor = getClientColor(card.client);
        return (
          <article
            key={idea.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="w-[6.75rem] shrink-0">
                <p className="text-xs font-medium tabular-nums text-white/80">
                  {formatDate(card.shootDate)}
                </p>
                <p className="mt-0.5 text-[10px] tabular-nums text-white/35">
                  {card.shootTime ? formatTime(card.shootTime) : 'Time not set'}
                  {card.shootEndTime ? ` – ${formatTime(card.shootEndTime)}` : ''}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p {...contentTypeLabelProps(typeStyle, 'text-[10px] font-semibold uppercase')}>
                    {card.contentType}
                  </p>
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-200">
                    To Create
                  </span>
                </div>
                <h3 className="mt-1 truncate text-sm font-semibold text-white">
                  {card.title || idea.title || 'Untitled idea'}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/45">
                  <ClientAvatar client={card.client} size="xs" color={clientColor} />
                  <span className="truncate">{card.client}</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end">
              <button
                type="button"
                onClick={() => onOpenCard?.(card)}
                className={`${btnPrimaryClass} px-2.5 py-1.5 text-[10px]`}
              >
                Open card
              </button>
              <button
                type="button"
                onClick={() => onEdit?.(idea)}
                className={`${btnGhostClass} px-2.5 py-1.5 text-[10px]`}
              >
                Edit idea
              </button>
              <button
                type="button"
                onClick={() => onReturnToApproved?.(card)}
                className={`${btnGhostClass} px-2.5 py-1.5 text-[10px] text-violet-200`}
              >
                Move back to Approved
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
