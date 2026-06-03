import {
  getMonthWeeks,
  toDateKey,
  isToday,
  formatMonthYear,
} from '../utils/calendar';
import { formatTimeRange } from '../utils';
import { useClientsContext } from '../context/ClientsContext';
import { getEventAttachmentChipLabel } from '../utils/eventPdfUpload';
import { getDisplayEventType } from '../utils/eventFormSchemas';
import CalendarDayCard from './CalendarDayCard';

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

  const getEventAccent = (event) => {
    if (event.client) return getClientColor(event.client);
    return '#a78bfa';
  };

  return (
    <div className="flex flex-col">
      <p className="mb-3 text-sm text-gray-400">{formatMonthYear(focusDate)} overview</p>

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
              const visibleEvents = dayEvents.slice(0, 3);
              const hiddenCount = Math.max(0, dayEvents.length - 3);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onDayClick?.(day, key)}
                  className={`calendar-grid-cell min-h-[120px] p-1.5 sm:min-h-[140px] sm:p-2 ${
                    !inMonth ? 'bg-black/20 opacity-50' : ''
                  } ${today ? 'calendar-cell-today' : ''}`}
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
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] text-gray-500">{dayEvents.length}</span>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {visibleEvents.map((event) => {
                      const attachmentLabel = getEventAttachmentChipLabel(event);
                      const accentColor = getEventAccent(event);
                      const eventType = getDisplayEventType(event.fields);
                      const badgeParts = [
                        event.status === 'draft' ? 'Draft' : '',
                        eventType,
                        attachmentLabel,
                      ].filter(Boolean);

                      return (
                        <CalendarDayCard
                          key={event.id}
                          accentColor={accentColor}
                          clientLabel={event.client}
                          hideClient={!event.client || !showClientName}
                          timeLabel={
                            event.time || event.endTime
                              ? formatTimeRange(event.time, event.endTime)
                              : ''
                          }
                          badgeLabel={badgeParts.join(' · ')}
                          badgeClassName={`text-[9px] font-semibold ${
                            event.status === 'draft' ? 'text-amber-300' : 'text-violet-300'
                          }`}
                          title={event.title}
                          onClick={() => onEventClick(event)}
                          titleAttr={`${event.client ? `${event.client} · ` : ''}${event.title}${
                            event.status === 'draft' ? ' (Draft)' : ''
                          }${attachmentLabel ? ` · ${attachmentLabel}` : ''}`}
                        />
                      );
                    })}
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
