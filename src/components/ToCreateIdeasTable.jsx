import { useMemo } from 'react';
import { useClientsContext } from '../context/ClientsContext';
import { getContentTypeStyle } from '../constants';
import { formatDate, formatTime } from '../utils';
import {
  canReturnCardToVault,
  getToCreateCards,
  sortCardsByShootSchedule,
} from '../utils/videoIdeas';
import { contentTypePipelinePillProps } from '../utils/contentTypeColors';
import ClientAvatar from './ClientAvatar';
import TeamTaskCard from './TeamTaskCard';
import {
  surfacePanelClass,
  taskActionBtnClass,
  vaultRowActionsClass,
} from './clientPortal/clientPortalUi';

export default function ToCreateIdeasTable({
  cards = [],
  clientFilter,
  onOpenCard,
  onOpenShoot,
  onReturnToApproved,
}) {
  const { getClientColor } = useClientsContext();

  const toCreateCards = useMemo(
    () => sortCardsByShootSchedule(getToCreateCards(cards, { client: clientFilter })),
    [cards, clientFilter],
  );

  if (!toCreateCards.length) {
    return (
      <div className={`${surfacePanelClass} px-4 py-16 text-center`}>
        <p className="text-sm text-white/45">No cards are in To Create yet.</p>
        <p className="mt-2 text-xs text-white/35">
          Use Add card or Add one-off project, or schedule an Approved idea onto a shoot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toCreateCards.map((card, index) => {
        const typeStyle = getContentTypeStyle(card.contentType);
        const clientColor = getClientColor(card.client);
        const canReturn = canReturnCardToVault(card);
        return (
          <TeamTaskCard
            key={card.id}
            accentColor={clientColor}
            animationDelay={`${0.08 + index * 0.05}s`}
            onOpen={() => onOpenCard?.(card)}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="w-[6.75rem] shrink-0">
                  <p className="text-xs font-medium tabular-nums text-white/80">
                    {card.shootDate ? formatDate(card.shootDate) : 'No shoot date'}
                  </p>
                  <p className="mt-0.5 text-[10px] tabular-nums text-white/35">
                    {card.shootDate
                      ? `${card.shootTime ? formatTime(card.shootTime) : 'Time not set'}${
                          card.shootEndTime ? ` – ${formatTime(card.shootEndTime)}` : ''
                        }`
                      : 'Add a date on the card or via Add to shoot'}
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
                    {card.title || 'Untitled'}
                  </h3>
                </div>
              </div>

              <div className={vaultRowActionsClass}>
                {card.shootDate ? (
                  <button
                    type="button"
                    onClick={() => onOpenShoot?.(card)}
                    className={taskActionBtnClass}
                  >
                    Go to shoot
                  </button>
                ) : null}
                {canReturn ? (
                  <button
                    type="button"
                    onClick={() => onReturnToApproved?.(card)}
                    className={taskActionBtnClass}
                  >
                    Move back to Approved
                  </button>
                ) : null}
              </div>
            </div>
          </TeamTaskCard>
        );
      })}
    </div>
  );
}
