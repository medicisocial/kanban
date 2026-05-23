import { getWeekDays, toDateKey, isToday, formatWeekRange, startOfWeek } from "../utils/calendar";
import CalendarEvent from "./CalendarEvent";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarWeekView({
  focusDate,
  cardsByDate,
  onCardClick,
  onAddPost,
  onRemoveFromCalendar,
  overviewLabel,
  hideClient = false,
}) {
  const weekStart = startOfWeek(focusDate);
  const days = getWeekDays(weekStart);

  return (
    <div className="flex flex-col">
      <p className="mb-3 text-sm text-gray-400">
        {formatWeekRange(weekStart)}
        {overviewLabel ? ` · ${overviewLabel}` : ""}
      </p>
      <div className="flex min-h-[calc(100vh-220px)] gap-2 overflow-x-auto pb-4">
        {days.map((day) => {
          const key = toDateKey(day);
          const dayCards = cardsByDate[key] || [];
          const today = isToday(day);

          return (
            <div
              key={key}
              className={`flex w-[160px] shrink-0 flex-col rounded-xl sm:w-[200px] ${
                today ? "bg-violet-500/10 ring-1 ring-violet-500/30" : "bg-[#1a1d2e]"
              }`}
            >
              <div className={`border-b border-white/5 px-3 py-2.5 ${today ? "text-violet-300" : "text-gray-300"}`}>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  {DAY_NAMES[day.getDay()]}
                </p>
                <p className="text-lg font-semibold">{day.getDate()}</p>
                <p className="text-[10px] text-gray-500">
                  {dayCards.length} post{dayCards.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ minHeight: "480px" }}>
                {dayCards.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 py-6">
                    <p className="text-[10px] text-gray-600">No posts</p>
                    {onAddPost && (
                      <button
                        type="button"
                        onClick={() => onAddPost(key)}
                        className="mt-2 rounded-md border border-white/10 px-2 py-1 text-[10px] text-gray-400 hover:bg-white/5 hover:text-white"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {dayCards.map((card) => (
                      <CalendarEvent
                        key={`${card.id}-${key}`}
                        card={card}
                        onClick={onCardClick}
                        onRemove={onRemoveFromCalendar}
                        hideClient={hideClient}
                      />
                    ))}
                    {onAddPost && (
                      <button
                        type="button"
                        onClick={() => onAddPost(key)}
                        className="rounded-md border border-dashed border-white/10 py-2 text-[10px] text-gray-500 hover:bg-white/5 hover:text-gray-300"
                      >
                        + Add post
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
