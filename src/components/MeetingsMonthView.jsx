import {
  getMonthWeeks,
  toDateKey,
  isToday,
  formatMonthYear,
} from '../utils/calendar';
import { formatTime } from '../utils';
import { useClientsContext } from '../context/ClientsContext';
import { getMeetingContactLabel, isRecurringMeeting, isOccurrenceRescheduled } from '../utils/meetingsCalendar';
import { getMeetingLinkShortLabel, getMeetingVideoLink } from '../utils/meetingLinks';
import CalendarDayCard from './CalendarDayCard';

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

  const getMeetingAccent = (meeting) => {
    if (meeting.prospectName) return '#fbbf24';
    if (meeting.client) return getClientColor(meeting.client);
    return '#f9f6f2';
  };

  const getMeetingBadge = (meeting) => {
    const parts = [];
    if (isRecurringMeeting(meeting)) parts.push('Recurring');
    if (isOccurrenceRescheduled(meeting)) parts.push('Rescheduled');
    const video = getMeetingLinkShortLabel(getMeetingVideoLink(meeting));
    if (video) parts.push(video);
    return parts.join(' · ');
  };

  const getMeetingTitleAttr = (meeting) => {
    const contact = getMeetingContactLabel(meeting);
    const recurring = isRecurringMeeting(meeting) ? ' ↻' : '';
    const moved = isOccurrenceRescheduled(meeting) ? ' ↔' : '';
    const video = getMeetingLinkShortLabel(getMeetingVideoLink(meeting));
    const videoSuffix = video ? ` · ${video}` : '';
    return `${contact} · ${meeting.title}${recurring}${moved}${videoSuffix}`;
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
              const dayMeetings = meetingsByDate[key] || [];
              const inMonth = day.getMonth() === month;
              const today = isToday(day);
              const selected = selectedDateKey === key;
              const visibleMeetings = dayMeetings.slice(0, 3);
              const hiddenCount = Math.max(0, dayMeetings.length - 3);

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

                  <div className="space-y-0.5">
                    {visibleMeetings.map((meeting) => {
                      const accentColor = getMeetingAccent(meeting);
                      const contactLabel = getMeetingContactLabel(meeting);

                      return (
                        <CalendarDayCard
                          key={meeting.occurrenceKey || meeting.id}
                          accentColor={accentColor}
                          clientLabel={contactLabel}
                          hideClient={Boolean(meeting.client) && !showClientName}
                          timeLabel={meeting.time ? formatTime(meeting.time) : ''}
                          badgeLabel={getMeetingBadge(meeting)}
                          badgeClassName="text-[9px] font-semibold text-sky-300"
                          title={meeting.title}
                          onClick={() => onMeetingClick(meeting)}
                          titleAttr={getMeetingTitleAttr(meeting)}
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
