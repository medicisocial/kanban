import { COLUMNS, getContentTypeStyle } from "../constants";
import { contentTypeCardStyle, contentTypeLabelProps } from "../utils/contentTypeColors";
import { useClientsContext } from "../context/ClientsContext";
import { formatTime } from "../utils";
import { formatStoryScheduleSummary, hasStoryDailyRange, hasStoryRecurrence, isCalendarEventPosted } from "../utils/calendar";
import { getCalendarClientNote } from "../utils/calendarClientNote";
import CalendarDayCard from "./CalendarDayCard";

export default function CalendarEvent({
  card,
  onClick,
  onRemove,
  onMove,
  compact = false,
  hideClient = false,
  fullTitle = false,
  relaxed = false,
  clientPortal = false,
  highlighted = false,
}) {
  const { getClientColor } = useClientsContext();
  const typeStyle = getContentTypeStyle(card.contentType);
  const clientColor = getClientColor(card.client);
  const isShootSession = Boolean(card.isShootSession);
  const sessionTimeLabel =
    isShootSession && card.dueTime && card.shootEndTime
      ? `${formatTime(card.dueTime)} – ${formatTime(card.shootEndTime)}`
      : card.dueTime
        ? formatTime(card.dueTime)
        : '';
  const scheduleSummary = formatStoryScheduleSummary(card);
  const hasStorySchedule = hasStoryRecurrence(card) || hasStoryDailyRange(card);
  const isPosted = isCalendarEventPosted(card);
  const columnMeta = COLUMNS.find((col) => col.id === card.columnId);
  const boardStatus = isPosted ? 'Posted' : (columnMeta?.title ?? null);
  const showBoardStatus = boardStatus && (!hideClient || isPosted) && (!clientPortal || isPosted);
  const typeLabelClass = clientPortal
    ? 'text-[10px] font-medium uppercase tracking-wide'
    : 'text-[11px] font-semibold uppercase tracking-wide';
  const typeLabelPresentation = contentTypeLabelProps(typeStyle, typeLabelClass);
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
  const sheetNote = getCalendarClientNote(card);

  const canDrag =
    Boolean(onMove) &&
    !isShootSession &&
    !hasStoryRecurrence(card) &&
    !hasStoryDailyRange(card) &&
    card.id;

  const handleDragStart = (ev) => {
    if (!canDrag) return;
    ev.stopPropagation();
    ev.dataTransfer.setData('text/plain', card.id);
    ev.dataTransfer.effectAllowed = 'move';
  };

  const dragProps = canDrag
    ? {
        draggable: true,
        onDragStart: handleDragStart,
      }
    : {};

  const handleClick = (ev) => {
    ev.stopPropagation();
    onClick?.(card);
  };

  if (isShootSession) {
    return (
      <CalendarDayCard
        accentColor={clientColor}
        clientLabel={card.client}
        timeLabel={sessionTimeLabel}
        badgeLabel="Shoot"
        badgeClassName={
          relaxed ? 'text-[11px] font-semibold text-[#fca5a5]' : 'text-[9px] font-semibold text-[#fca5a5]'
        }
        title={`${card.title}${card.shootSessionCount > 1 ? ` · ${card.shootSessionCount} items` : ''}`}
        titleClassName={
          relaxed
            ? 'block whitespace-normal text-[13px] font-medium text-[#f9f6f2]'
            : undefined
        }
        onClick={handleClick}
        titleAttr={`${card.client} shoot${sessionTimeLabel ? ` · ${sessionTimeLabel}` : ''}`}
        dense
        relaxed={relaxed}
        clientPortal={clientPortal}
        sheetNote={sheetNote}
      />
    );
  }

  const handleRemove = (ev) => {
    ev.stopPropagation();
    onRemove?.(card);
  };

  const timeLabel = card.dueTime
    ? `${formatTime(card.dueTime)}${hasStorySchedule ? ' ↻' : ''}`
    : hasStorySchedule
      ? `↻ ${scheduleSummary || 'recurring'}`
      : scheduleSummary || '';

  return (
    <div className="relative min-w-0">
      {onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute right-0.5 top-0.5 z-10 rounded px-1 text-[9px] font-medium text-red-300/80 hover:bg-red-500/20 hover:text-red-300"
          aria-label={`Remove ${card.title} from calendar`}
        >
          ×
        </button>
      )}
      <CalendarDayCard
        accentColor={clientColor}
        surfaceStyle={contentTypeCardStyle(typeStyle)}
        clientLabel={card.client}
        hideClient={hideClient}
        timeLabel={timeLabel}
        badgeLabel={showBoardStatus ? boardStatus : ''}
        badgeClassName={`font-semibold ${statusClass}`}
        typeLabel={card.contentType}
        typeLabelProps={typeLabelPresentation}
        title={card.title}
        titleLink={card.dropboxLink}
        titleClassName={
          clientPortal
            ? undefined
            : `block min-w-0 font-medium leading-snug text-[#f9f6f2] ${
                fullTitle || relaxed
                  ? `line-clamp-2 ${relaxed ? 'text-[13px]' : 'text-[12px]'}`
                  : 'truncate text-[11px]'
              }`
        }
        onClick={() => onClick?.(card)}
        titleAttr={eventTitle}
        opacity={isPosted ? 0.72 : 1}
        dense
        relaxed={relaxed}
        clientPortal={clientPortal}
        className={`min-w-0 ${highlighted ? 'ring-1 ring-white/30' : ''} ${
          canDrag ? 'cursor-grab active:cursor-grabbing' : ''
        } ${onRemove ? (relaxed ? 'pr-6' : 'pr-5') : ''}`}
        dragProps={dragProps}
        sheetNote={sheetNote}
      />
    </div>
  );
}
