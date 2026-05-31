import {
  getMonthWeeks,
  toDateKey,
  isToday,
  formatMonthYear,
} from '../utils/calendar';
import { formatTime } from '../utils';
import { useClientsContext } from '../context/ClientsContext';
import { getEventAttachmentChipLabel } from '../utils/eventPdfUpload';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function EventsMonthView({
  focusDate,
  eventsByDate,
  onEventClick,
  onDayClick,
  showClientName = false,
}) {
  const { getClientColor } = useClientsContext();
  const year = focusDate.getFullYear();
  const month = focusDate.getMonth();
  const weeks = getMonthWeeks(year, month);

  return (
    <div className="flex flex-col">
      <p className="mb-3 text-xs text-white/45">{formatMonthYear(focusDate)}</p>

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
              const dayEvents = eventsByDate[key] || [];
              const inMonth = day.getMonth() === month;
              const today = isToday(day);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onDayClick?.(day, key)}
                  className={`calendar-grid-cell min-h-[108px] p-1.5 sm:min-h-[124px] sm:p-2 ${
                    !inMonth ? 'bg-black/20 opacity-45' : ''
                  } ${today ? 'calendar-cell-today' : ''}`}
                  aria-current={today ? 'date' : undefined}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        today
                          ? 'calendar-day-number-today'
                          : inMonth
                            ? 'flex h-6 w-6 items-center justify-center text-white/85'
                            : 'flex h-6 w-6 items-center justify-center text-white/35'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] tabular-nums text-white/35">{dayEvents.length}</span>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => {
                      const attachmentLabel = getEventAttachmentChipLabel(event);

                      return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        className="block w-full truncate border px-1.5 py-0.5 text-left text-[10px] transition hover:brightness-110"
                        style={{
                          borderColor: `${getClientColor(event.client)}55`,
                          backgroundColor: `${getClientColor(event.client)}18`,
                          color: getClientColor(event.client),
                        }}
                        title={`${event.client ? `${event.client} · ` : ''}${event.title}${event.status === 'draft' ? ' (Draft)' : ''}${attachmentLabel ? ` · ${attachmentLabel}` : ''}`}
                      >
                        {event.status === 'draft' && (
                          <span className="mr-0.5 opacity-70">◦</span>
                        )}
                        {event.time ? `${formatTime(event.time)} ` : ''}
                        {showClientName && event.client ? `${event.client}: ` : ''}
                        {event.title}
                        {attachmentLabel && (
                          <span className="ml-1 opacity-75">· {attachmentLabel}</span>
                        )}
                      </button>
                    );})}
                    {dayEvents.length > 3 && (
                      <p className="px-1 text-[10px] text-white/35">+{dayEvents.length - 3} more</p>
                    )}
                    {dayEvents.length === 0 && inMonth && (
                      <p className="px-1 text-[10px] text-white/20">+</p>
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
