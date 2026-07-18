import { useClientsContext } from '../context/ClientsContext';
import { getContentTypeStyle } from '../constants';
import { formatDate, formatTime } from '../utils';
import { findIdeaBoardCard, sortIdeasByShootSchedule } from '../utils/videoIdeas';
import { contentTypePipelinePillProps } from '../utils/contentTypeColors';
import ClientAvatar from './ClientAvatar';
import TeamTaskCard from './TeamTaskCard';
import {
  surfacePanelClass,
  taskActionBtnClass,
  vaultRowActionsClass,
} from './clientPortal/clientPortalUi';

export default function ToCreateIdeasTable({
  ideas,
  cards,
  onOpenCard,
  onOpenShoot,
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
    <div className="space-y-3">
      {scheduledIdeas.map(({ idea, card }, index) => {
        const typeStyle = getContentTypeStyle(card.contentType);
        const clientColor = getClientColor(card.client);
        return (
          <TeamTaskCard
            key={idea.id}
            accentColor={clientColor}
            animationDelay={`${0.08 + index * 0.05}s`}
            onOpen={() => onOpenCard?.(card)}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                  <div className="tesla-task-card-meta mb-2">
                    <span {...contentTypePipelinePillProps(typeStyle)}>
                      {card.contentType}
                    </span>
                    <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-white/45">
                      <ClientAvatar client={card.client} size="xs" color={clientColor} />
                      <span className="truncate">{card.client}</span>
                    </div>
                  </div>
                  <h3 className="truncate text-sm font-semibold text-white">
                    {card.title || idea.title || 'Untitled idea'}
                  </h3>
                </div>
              </div>

              <div className={vaultRowActionsClass}>
                <button
                  type="button"
                  onClick={() => onOpenShoot?.(card)}
                  className={taskActionBtnClass}
                >
                  Go to shoot
                </button>
                <button
                  type="button"
                  onClick={() => onReturnToApproved?.(card)}
                  className={taskActionBtnClass}
                >
                  Move back to Approved
                </button>
              </div>
            </div>
          </TeamTaskCard>
        );
      })}
    </div>
  );
}
