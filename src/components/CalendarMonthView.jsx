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

      <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#111111]">
        <div className="grid grid-cols-7 border-b border-white/5">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500"
            >
              {name}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-white/5 last:border-b-0">
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
                  className={`border-r border-white/5 p-1.5 text-left transition last:border-r-0 hover:bg-white/5 sm:p-2 ${
                    expanded ? 'min-h-[180px] align-top sm:min-h-[220px]' : 'min-h-[120px] sm:min-h-[140px]'
                  } ${
                    !inMonth ? "bg-black/20 opacity-50" : ""
                  } ${today ? "bg-[#a00000]/10 ring-1 ring-inset ring-[#810100]/30" : ""} ${
                    selected ? "bg-violet-500/15 ring-2 ring-inset ring-violet-400/60" : ""
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        today
                          ? "bg-[#a00000] text-white"
                          : inMonth
                            ? "text-[#f9f6f2]"
                            : "text-gray-600"
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
