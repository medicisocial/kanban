import {
  getMonthWeeks,
  toDateKey,
  isToday,
  formatMonthYear,
} from '../utils/calendar';
import MeetingCalendarEvent from './MeetingCalendarEvent';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function sortMeetingsByTime(meetings) {
  return [...meetings].sort((a, b) => {
    const byTime = (a.time || '99:99').localeCompare(b.time || '99:99');
    if (byTime !== 0) return byTime;
    return (a.title || '').localeCompare(b.title || '');
  });
}

export default function MeetingsMonthView({
  focusDate,
  meetingsByDate,
  onMeetingClick,
  onDayClick,
  onSelectDate,
  selectedDateKey = '',
  showClientName = false,
  clientPortal = false,
  maxVisibleCards = 5,
}) {
  const year = focusDate.getFullYear();
  const month = focusDate.getMonth();
  const weeks = getMonthWeeks(year, month);

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
              const dayMeetings = sortMeetingsByTime(meetingsByDate[key] || []);
              const inMonth = day.getMonth() === month;
              const today = isToday(day);
              const selected = selectedDateKey === key;
              const visibleMeetings = dayMeetings.slice(0, maxVisibleCards);
              const hiddenCount = Math.max(0, dayMeetings.length - maxVisibleCards);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (onSelectDate) {
                      onSelectDate(day, key);
                    } else {
                      onDayClick?.(day, key);
                    }
                  }}
                  className={`calendar-grid-cell min-h-[120px] p-1.5 sm:min-h-[140px] sm:p-2 ${
                    !inMonth ? 'bg-black/20 opacity-50' : ''
                  } ${today ? 'calendar-cell-today' : ''} ${
                    selected ? 'bg-violet-500/15 ring-2 ring-inset ring-violet-400/60' : ''
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
                    {dayMeetings.length > 0 && (
                      <span className="text-[10px] text-gray-500">{dayMeetings.length}</span>
                    )}
                  </div>

                  <div className={clientPortal ? 'space-y-1.5' : 'space-y-1'}>
                    {visibleMeetings.map((meeting) => (
                      <MeetingCalendarEvent
                        key={meeting.occurrenceKey || meeting.id}
                        meeting={meeting}
                        onClick={onMeetingClick}
                        showClientName={showClientName}
                        clientPortal={clientPortal}
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
