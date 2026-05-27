import {
  getMonthWeeks,
  toDateKey,
  isToday,
  formatMonthYear,
} from '../utils/calendar';
import { formatTime } from '../utils';
import { useClientsContext } from '../context/ClientsContext';

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

      <div className="overflow-x-auto border border-white/10 bg-white/[0.02]">
        <div className="grid grid-cols-7 border-b border-white/10">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-white/40"
            >
              {name}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-white/[0.06] last:border-b-0">
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
                  className={`min-h-[108px] border-r border-white/[0.06] p-1.5 text-left transition last:border-r-0 sm:min-h-[124px] sm:p-2 ${
                    !inMonth ? 'bg-black/20 opacity-45' : 'hover:bg-white/[0.03]'
                  } ${today ? 'bg-[#810100]/10 ring-1 ring-inset ring-[#810100]/25' : ''}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`flex h-6 w-6 items-center justify-center text-xs font-semibold ${
                        today ? 'bg-[#810100] text-white' : inMonth ? 'text-white/85' : 'text-white/35'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] tabular-nums text-white/35">{dayEvents.length}</span>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
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
                        title={`${event.client ? `${event.client} · ` : ''}${event.title}${event.status === 'draft' ? ' (Draft)' : ''}`}
                      >
                        {event.status === 'draft' && (
                          <span className="mr-0.5 opacity-70">◦</span>
                        )}
                        {event.time ? `${formatTime(event.time)} ` : ''}
                        {showClientName && event.client ? `${event.client}: ` : ''}
                        {event.title}
                      </button>
                    ))}
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
