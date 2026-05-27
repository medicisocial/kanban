import { COLUMNS, getContentTypeStyle, PLATFORM_ICON } from "../constants";
import { useClientsContext } from "../context/ClientsContext";
import { formatTime } from "../utils";
import { formatStoryScheduleSummary, hasStoryDailyRange, hasStoryRecurrence, isCalendarEventPosted } from "../utils/calendar";
import CardTitleLink from "./CardTitleLink";

export default function CalendarEvent({
  card,
  onClick,
  onRemove,
  compact = false,
  hideClient = false,
  fullTitle = false,
  highlighted = false,
}) {
  const { getClientColor } = useClientsContext();
  const typeStyle = getContentTypeStyle(card.contentType);
  const clientColor = getClientColor(card.client);
  const scheduleSummary = formatStoryScheduleSummary(card);
  const hasStorySchedule = hasStoryRecurrence(card) || hasStoryDailyRange(card);
  const isPosted = isCalendarEventPosted(card);
  const columnMeta = COLUMNS.find((col) => col.id === card.columnId);
  const boardStatus = isPosted ? 'Posted' : (columnMeta?.title ?? null);
  const statusClass = isPosted
    ? 'text-gray-400'
    : card.columnId === 'scheduled'
      ? 'text-emerald-300'
      : card.columnId === 'approved'
        ? 'text-blue-300'
        : card.columnId === 'in-review'
          ? 'text-[#fca5a5]'
          : 'text-amber-300';
  const eventTitle = hideClient
    ? card.title
    : `${card.client}: ${card.title}${scheduleSummary ? ` (${scheduleSummary})` : ""}`;

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
          onClick?.(card);
        }}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            onClick?.(card);
          }
        }}
        className={`group/event relative mb-1 w-full cursor-pointer rounded px-1.5 py-1 text-left transition hover:brightness-125 ${
          highlighted ? 'ring-1 ring-white/30' : ''
        }`}
        style={{
          backgroundColor: typeStyle.border + (isPosted ? "22" : "33"),
          borderLeft: `2px solid ${typeStyle.border}`,
          opacity: isPosted ? 0.72 : 1,
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
            {hasStorySchedule && <span className="ml-1 text-[#fca5a5]">↻</span>}
          </span>
        )}
        {!card.dueTime && hasStorySchedule && (
          <span className="mb-0.5 block text-[9px] font-medium text-[#fca5a5]">↻ {scheduleSummary || 'recurring'}</span>
        )}
        {boardStatus && (
          <span className={`mb-0.5 block text-[9px] font-semibold ${statusClass}`}>
            {boardStatus}
          </span>
        )}
        <CardTitleLink
          title={card.title}
          dropboxLink={card.dropboxLink}
          className={`block font-medium text-[#f9f6f2] ${
            fullTitle ? 'whitespace-normal text-[11px] leading-snug' : 'truncate text-[10px]'
          }`}
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
        opacity: isPosted ? 0.78 : 1,
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
          <div className={`flex shrink-0 items-center gap-1.5${hideClient ? ' ml-auto' : ''}`}>
            {boardStatus && (
              <span className={`text-[10px] font-semibold ${statusClass}`}>{boardStatus}</span>
            )}
            <span className={`text-[10px] font-semibold ${typeStyle.label}`}>
              {card.contentType}
            </span>
          </div>
        </div>
        <CardTitleLink
          title={card.title}
          dropboxLink={card.dropboxLink}
          className="line-clamp-2 block text-xs font-medium leading-snug text-white"
        />
        {(card.dueTime || scheduleSummary || (!hideClient && card.assignedTo)) && (
          <p className="mt-1 truncate text-[10px] text-gray-500">
            {card.dueTime ? `${formatTime(card.dueTime)}` : ""}
            {card.dueTime && scheduleSummary ? " · " : ""}
            {scheduleSummary ? `${scheduleSummary}` : ""}
            {(card.dueTime || scheduleSummary) && !hideClient && card.assignedTo ? " · " : ""}
            {!hideClient && card.assignedTo ? `${PLATFORM_ICON} ${card.assignedTo}` : ""}
          </p>
        )}
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
