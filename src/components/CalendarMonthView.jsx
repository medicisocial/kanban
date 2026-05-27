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
  overviewLabel = "overview",
  hideClient = false,
  expanded = false,
}) {
  const year = focusDate.getFullYear();
  const month = focusDate.getMonth();
  const weeks = getMonthWeeks(year, month);

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
                  className={`calendar-grid-cell p-1.5 sm:min-h-[140px] sm:p-2 ${
                    expanded ? 'min-h-[180px] align-top sm:min-h-[220px]' : 'min-h-[120px]'
                  } ${
                    !inMonth ? "bg-black/20 opacity-50" : ""
                  } ${today ? 'calendar-cell-today' : ''} ${
                    selected ? "bg-violet-500/15 ring-2 ring-inset ring-violet-400/60" : ""
                  }`}
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
                  </div>

                  <div className="space-y-0.5">
                    {visibleCards.map((card) => (
                      <CalendarEvent
                        key={`${card.id}-${key}`}
                        card={card}
                        onClick={(c) => {
                          onCardClick?.(c);
                        }}
                        onRemove={onRemoveFromCalendar}
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
