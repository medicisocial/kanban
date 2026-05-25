import { getContentTypeStyle, PLATFORM_ICON } from "../constants";
import { useClientsContext } from "../context/ClientsContext";
import { formatTime } from "../utils";
import { formatRecurrenceDays, hasStoryRecurrence } from "../utils/calendar";
import CardTitleLink from "./CardTitleLink";

export default function CalendarEvent({ card, onClick, onRemove, compact = false, hideClient = false }) {
  const { getClientColor } = useClientsContext();
  const typeStyle = getContentTypeStyle(card.contentType);
  const clientColor = getClientColor(card.client);
  const recurring = hasStoryRecurrence(card);
  const isPlanned = card.columnId === 'editing';
  const eventTitle = hideClient
    ? card.title
    : `${card.client}: ${card.title}${recurring ? ` (Every ${formatRecurrenceDays(card.storyRecurrenceDays)})` : ""}`;

  const handleRemove = (ev) => {
    ev.stopPropagation();
    onRemove?.(card);
  };

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={(ev) => {
          ev.stopPropagation();
          onClick(card);
        }}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            onClick(card);
          }
        }}
        className="group/event relative mb-1 w-full cursor-pointer rounded px-1.5 py-1 text-left transition hover:brightness-125"
        style={{
          backgroundColor: typeStyle.border + "33",
          borderLeft: `2px solid ${typeStyle.border}`,
        }}
        title={eventTitle}
      >
        {onRemove && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute right-0.5 top-0.5 rounded px-1 text-[9px] font-medium text-red-300/80 hover:bg-red-500/20 hover:text-red-300"
            aria-label={`Remove ${card.title} from calendar`}
          >
            ×
          </button>
        )}
        {!hideClient && (
          <span
            className="mb-0.5 block truncate text-[9px] font-semibold uppercase tracking-wide"
            style={{ color: clientColor }}
          >
            {card.client}
          </span>
        )}
        {card.dueTime && (
          <span className="mb-0.5 block text-[9px] font-medium text-gray-400">
            {formatTime(card.dueTime)}
            {recurring && <span className="ml-1 text-purple-300">↻</span>}
          </span>
        )}
        {!card.dueTime && recurring && (
          <span className="mb-0.5 block text-[9px] font-medium text-purple-300">↻ weekly</span>
        )}
        {isPlanned && (
          <span className="mb-0.5 block text-[9px] font-medium text-amber-300">Planning</span>
        )}
        <CardTitleLink
          title={card.title}
          dropboxLink={card.dropboxLink}
          className="block truncate text-[10px] font-medium text-gray-200"
        />
      </div>
    );
  }

  return (
    <div
      className="group/event relative w-full rounded-lg border border-white/8 text-left transition hover:brightness-110"
      style={{
        backgroundColor: typeStyle.bg,
        borderLeftColor: typeStyle.border,
        borderLeftWidth: "3px",
      }}
    >
      <button
        type="button"
        onClick={() => onClick(card)}
        className="w-full p-2.5 text-left"
      >
        <div className="mb-1.5 flex items-center justify-between gap-1">
          {!hideClient && (
            <span
              className="truncate text-xs font-semibold"
              style={{ color: clientColor }}
            >
              {card.client}
            </span>
          )}
          <span className={`shrink-0 text-[10px] font-semibold ${typeStyle.label}${hideClient ? " ml-auto" : ""}`}>
            {card.contentType}
          </span>
        </div>
        <CardTitleLink
          title={card.title}
          dropboxLink={card.dropboxLink}
          className="line-clamp-2 block text-xs font-medium leading-snug text-white"
        />
        <p className="mt-1 truncate text-[10px] text-gray-500">
          {isPlanned ? 'Planning · ' : ''}
          {card.dueTime ? `${formatTime(card.dueTime)} · ` : ""}
          {recurring ? `Every ${formatRecurrenceDays(card.storyRecurrenceDays)} · ` : ""}
          {PLATFORM_ICON} {card.assignedTo}
        </p>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute right-2 top-2 rounded border border-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-300/80 transition hover:bg-red-500/10 hover:text-red-300"
        >
          Remove
        </button>
      )}
    </div>
  );
}
