import {
  getMonthWeeks,
  toDateKey,
  isToday,
  formatMonthYear,
} from '../utils/calendar';
import { formatTime } from '../utils';
import { useClientsContext } from '../context/ClientsContext';
import { getMeetingContactLabel, isRecurringMeeting } from '../utils/meetingsCalendar';
import { getMeetingLinkShortLabel, getMeetingVideoLink } from '../utils/meetingLinks';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MeetingsMonthView({
  focusDate,
  meetingsByDate,
  onMeetingClick,
  onDayClick,
  onSelectDate,
  selectedDateKey = '',
  showClientName = false,
}) {
  const { getClientColor } = useClientsContext();
  const year = focusDate.getFullYear();
  const month = focusDate.getMonth();
  const weeks = getMonthWeeks(year, month);

  const getMeetingStyle = (meeting) => {
    if (meeting.prospectName) {
      return {
        borderColor: 'rgba(251, 191, 36, 0.35)',
        backgroundColor: 'rgba(251, 191, 36, 0.12)',
        color: 'rgba(253, 230, 138, 0.95)',
      };
    }
    if (meeting.client) {
      const color = getClientColor(meeting.client);
      return {
        borderColor: `${color}55`,
        backgroundColor: `${color}18`,
        color,
      };
    }
    return {
      borderColor: 'rgba(255,255,255,0.15)',
      backgroundColor: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.85)',
    };
  };

  const getMeetingTitle = (meeting) => {
    const contact = getMeetingContactLabel(meeting);
    const recurring = isRecurringMeeting(meeting) ? ' ↻' : '';
    const video = getMeetingLinkShortLabel(getMeetingVideoLink(meeting));
    const videoSuffix = video ? ` · ${video}` : '';
    return `${contact} · ${meeting.title}${recurring}${videoSuffix}`;
  };

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
              const dayMeetings = meetingsByDate[key] || [];
              const inMonth = day.getMonth() === month;
              const today = isToday(day);

              const selected = selectedDateKey === key;

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
                  className={`calendar-grid-cell min-h-[108px] p-1.5 sm:min-h-[124px] sm:p-2 ${
                    !inMonth ? 'bg-black/20 opacity-45' : ''
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
                            ? 'flex h-6 w-6 items-center justify-center text-white/85'
                            : 'flex h-6 w-6 items-center justify-center text-white/35'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayMeetings.length > 0 && (
                      <span className="text-[10px] tabular-nums text-white/35">{dayMeetings.length}</span>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {dayMeetings.slice(0, 3).map((meeting) => (
                      <button
                        key={meeting.occurrenceKey || meeting.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMeetingClick(meeting);
                        }}
                        className="block w-full truncate border px-1.5 py-0.5 text-left text-[10px] transition hover:brightness-110"
                        style={getMeetingStyle(meeting)}
                        title={getMeetingTitle(meeting)}
                      >
                        {isRecurringMeeting(meeting) && (
                          <span className="mr-0.5 opacity-70">↻</span>
                        )}
                        {meeting.time ? `${formatTime(meeting.time)} ` : ''}
                        {showClientName && `${getMeetingContactLabel(meeting)}: `}
                        {meeting.title}
                      </button>
                    ))}
                    {dayMeetings.length > 3 && (
                      <p className="px-1 text-[10px] text-white/35">+{dayMeetings.length - 3} more</p>
                    )}
                    {dayMeetings.length === 0 && inMonth && (
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
