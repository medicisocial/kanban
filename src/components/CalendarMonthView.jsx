import { useState } from "react";
import {
  getMonthWeeks,
  toDateKey,
  isToday,
  formatMonthYear,
} from "../utils/calendar";
import CalendarEvent from "./CalendarEvent";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarMonthView({
  focusDate,
  cardsByDate,
  onCardClick,
  onDayClick,
  onSelectDate,
  selectedDateKey = '',
  onRemoveFromCalendar,
  onMoveCalendarPost,
  overviewLabel = "overview",
  hideClient = false,
  expanded = false,
  markedDates = {},
}) {
  const year = focusDate.getFullYear();
  const month = focusDate.getMonth();
  const weeks = getMonthWeeks(year, month);
  const [dragOverKey, setDragOverKey] = useState("");

  const handleDrop = (dateKey, event) => {
    event.preventDefault();
    event.stopPropagation();
    const cardId = event.dataTransfer.getData("text/plain");
    if (cardId && onMoveCalendarPost) {
      onMoveCalendarPost(cardId, dateKey);
    }
    setDragOverKey("");
  };

  return (
    <div className="flex flex-col">
      <p className="mb-3 text-sm text-gray-400">{formatMonthYear(focusDate)} {overviewLabel}</p>

      <div className="calendar-grid-shell">
        <div className="calendar-grid-head grid grid-cols-7">
          {DAY_NAMES.map((name) => (
            <div key={name} className="calendar-grid-head-cell">
              {name}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="calendar-grid-row grid grid-cols-7">
            {week.map((day) => {
              const key = toDateKey(day);
              const dayCards = cardsByDate[key] || [];
              const markedLabel = markedDates[key];
              const inMonth = day.getMonth() === month;
              const today = isToday(day);

              const selected = selectedDateKey === key;
              const visibleCards = expanded ? dayCards : dayCards.slice(0, 3);
              const hiddenCount = expanded ? 0 : Math.max(0, dayCards.length - 3);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (onSelectDate) {
                      onSelectDate(day);
                    } else {
                      onDayClick?.(day);
                    }
                  }}
                  onDragOver={(event) => {
                    if (!onMoveCalendarPost) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDragOverKey(key);
                  }}
                  onDragLeave={() => setDragOverKey("")}
                  onDrop={(event) => handleDrop(key, event)}
                  className={`calendar-grid-cell p-1.5 sm:min-h-[140px] sm:p-2 ${
                    expanded ? 'min-h-[180px] align-top sm:min-h-[220px]' : 'min-h-[120px]'
                  } ${
                    !inMonth ? "bg-black/20 opacity-50" : ""
                  } ${today ? 'calendar-cell-today' : ''} ${
                    selected ? "bg-violet-500/15 ring-2 ring-inset ring-violet-400/60" : ""
                  } ${dragOverKey === key ? 'ring-2 ring-inset ring-[#810100]/60' : ''}`}
                  aria-current={today ? 'date' : undefined}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        today
                          ? 'calendar-day-number-today'
                          : inMonth
                            ? 'flex h-6 w-6 items-center justify-center text-[#f9f6f2]'
                            : 'flex h-6 w-6 items-center justify-center text-gray-600'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayCards.length > 0 && (
                      <span className="text-[10px] text-gray-500">{dayCards.length}</span>
                    )}
                    {dayCards.length === 0 && markedLabel && (
                      <span className="rounded-full bg-[#a00000]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#fca5a5]">
                        •
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {dayCards.length === 0 && markedLabel && inMonth && (
                      <p className="px-1 text-[10px] font-medium text-[#fca5a5]/80">{markedLabel}</p>
                    )}
                    {visibleCards.map((card) => (
                      <CalendarEvent
                        key={`${card.id}-${key}`}
                        card={card}
                        onClick={(c) => {
                          onCardClick?.(c);
                        }}
                        onRemove={onRemoveFromCalendar}
                        onMove={onMoveCalendarPost}
                        compact
                        hideClient={hideClient}
                        fullTitle={expanded}
                        highlighted={false}
                      />
                    ))}
                    {hiddenCount > 0 && (
                      <p className="px-1 text-[10px] text-gray-500">+{hiddenCount} more</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
