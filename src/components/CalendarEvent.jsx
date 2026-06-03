import { COLUMNS, getContentTypeStyle, PLATFORM_ICON } from "../constants";
import { contentTypeCardStyle, contentTypePillProps } from "../utils/contentTypeColors";
import { useClientsContext } from "../context/ClientsContext";
import { formatTime } from "../utils";
import { formatStoryScheduleSummary, hasStoryDailyRange, hasStoryRecurrence, isCalendarEventPosted } from "../utils/calendar";
import CardTitleLink from "./CardTitleLink";
import CalendarDayCard from "./CalendarDayCard";

export default function CalendarEvent({
  card,
  onClick,
  onRemove,
  onMove,
  compact = false,
  hideClient = false,
  fullTitle = false,
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
  const showBoardStatus = boardStatus && (!hideClient || isPosted);
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

  if (compact && isShootSession) {
    return (
      <CalendarDayCard
        accentColor={clientColor}
        clientLabel={card.client}
        timeLabel={sessionTimeLabel}
        badgeLabel="Shoot"
        badgeClassName="text-[9px] font-semibold text-[#fca5a5]"
        title={`${card.title}${card.shootSessionCount > 1 ? ` · ${card.shootSessionCount} items` : ''}`}
        onClick={handleClick}
        titleAttr={`${card.client} shoot${sessionTimeLabel ? ` · ${sessionTimeLabel}` : ''}`}
      />
    );
  }

  const handleRemove = (ev) => {
    ev.stopPropagation();
    onRemove?.(card);
  };

  if (compact) {
    const timeLabel = card.dueTime
      ? `${formatTime(card.dueTime)}${hasStorySchedule ? ' ↻' : ''}`
      : hasStorySchedule
        ? `↻ ${scheduleSummary || 'recurring'}`
        : '';

    return (
      <div className="relative">
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
          typePill={card.contentType}
          typePillProps={contentTypePillProps(
            typeStyle,
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
          )}
          title={card.title}
          titleLink={card.dropboxLink}
          titleClassName={`block font-medium text-[#f9f6f2] ${
            fullTitle ? 'whitespace-normal text-[11px] leading-snug' : 'truncate text-[10px]'
          }`}
          onClick={() => onClick?.(card)}
          titleAttr={eventTitle}
          opacity={isPosted ? 0.72 : 1}
          dense
          className={`${highlighted ? 'ring-1 ring-white/30' : ''} ${
            canDrag ? 'cursor-grab active:cursor-grabbing' : ''
          } ${onRemove ? 'pr-5' : ''}`}
          dragProps={dragProps}
        />
      </div>
    );
  }

  return (
    <div
      {...dragProps}
      className={`group/event relative w-full rounded-lg border border-white/8 text-left transition hover:brightness-110 ${
        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      style={{
        ...contentTypeCardStyle(typeStyle),
        opacity: isPosted ? 0.78 : 1,
      }}
    >
      <button
        type="button"
        onClick={() => onClick(card)}
        className="w-full p-2.5 text-left"
      >
        <div className="mb-1 flex items-center justify-between gap-1">
          {!hideClient && (
            <span
              className="truncate text-xs font-semibold"
              style={{ color: clientColor }}
            >
              {card.client}
            </span>
          )}
          <div className={`flex shrink-0 items-center gap-1${hideClient ? ' ml-auto' : ''}`}>
            {showBoardStatus && (
              <span className={`text-[9px] font-semibold ${statusClass}`}>{boardStatus}</span>
            )}
            <span {...contentTypePillProps(typeStyle, 'rounded-full px-1.5 py-0.5 text-[10px] font-semibold')}>
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
