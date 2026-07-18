import { useClientsContext } from '../context/ClientsContext';
import { getContentTypeStyle } from '../constants';
import { formatDate, formatTime } from '../utils';
import { findIdeaBoardCard } from '../utils/videoIdeas';
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

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {ideas.map((idea) => {
        const card = findIdeaBoardCard(idea, cards);
        if (!card) return null;
        const typeStyle = getContentTypeStyle(card.contentType);
        const clientColor = getClientColor(card.client);
        return (
          <article key={idea.id} className={`${surfacePanelClass} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p {...contentTypeLabelProps(typeStyle, 'text-[10px] font-semibold uppercase')}>
                  {card.contentType}
                </p>
                <h3 className="mt-1 truncate text-sm font-semibold text-white">
                  {card.title || idea.title || 'Untitled idea'}
                </h3>
              </div>
              <span className="shrink-0 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-amber-200">
                To Create
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-white/55">
              <ClientAvatar client={card.client} size="sm" color={clientColor} />
              <span>{card.client}</span>
            </div>

            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/35">
                Shoot
              </p>
              <p className="mt-1 text-sm text-white/80">
                {formatDate(card.shootDate)}
                {card.shootTime ? ` · ${formatTime(card.shootTime)}` : ''}
                {card.shootEndTime ? ` – ${formatTime(card.shootEndTime)}` : ''}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpenCard?.(card)}
                className={`${btnPrimaryClass} px-3 py-2 text-[11px]`}
              >
                Open card
              </button>
              <button
                type="button"
                onClick={() => onEdit?.(idea)}
                className={`${btnGhostClass} px-3 py-2 text-[11px]`}
              >
                Edit idea
              </button>
              <button
                type="button"
                onClick={() => onReturnToApproved?.(card)}
                className={`${btnGhostClass} px-3 py-2 text-[11px] text-violet-200`}
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
