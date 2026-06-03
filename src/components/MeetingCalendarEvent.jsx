import { useClientsContext } from '../context/ClientsContext';
import { formatTime } from '../utils';
import {
  getMeetingContactLabel,
  isOccurrenceRescheduled,
  isRecurringMeeting,
} from '../utils/meetingsCalendar';
import { getMeetingLinkShortLabel, getMeetingVideoLink } from '../utils/meetingLinks';
import CalendarDayCard from './CalendarDayCard';
import MeetingVideoLink from './MeetingVideoLink';

export default function MeetingCalendarEvent({
  meeting,
  onClick,
  showClientName = false,
  clientPortal = false,
}) {
  const { getClientColor } = useClientsContext();

  const accentColor = meeting.prospectName
    ? '#fbbf24'
    : meeting.client
      ? getClientColor(meeting.client)
      : '#a78bfa';

  const contactLabel = getMeetingContactLabel(meeting);
  const showContact = showClientName || Boolean(meeting.prospectName) || !meeting.client;

  const timeLabel = meeting.time
    ? `${formatTime(meeting.time)}${meeting.endTime ? ` – ${formatTime(meeting.endTime)}` : ''}`
    : '';

  const badgeParts = [];
  if (isRecurringMeeting(meeting)) badgeParts.push('Recurring');
  if (isOccurrenceRescheduled(meeting)) badgeParts.push('Rescheduled');

  const videoLabel = getMeetingLinkShortLabel(getMeetingVideoLink(meeting));
  const typeLabel = videoLabel || 'Meeting';
  const typeLabelClass = videoLabel ? 'text-sky-300' : 'text-violet-300';

  const titleAttr = [
    contactLabel,
    meeting.title,
    isRecurringMeeting(meeting) ? 'Recurring' : '',
    isOccurrenceRescheduled(meeting) ? 'Rescheduled' : '',
    videoLabel,
  ]
    .filter(Boolean)
    .join(' · ');

  const handleClick = () => onClick?.(meeting);

  return (
    <div className="relative min-w-0">
      <CalendarDayCard
        accentColor={accentColor}
        clientLabel={contactLabel}
        hideClient={!showContact}
        timeLabel={timeLabel}
        badgeLabel={badgeParts.join(' · ')}
        badgeClassName="text-[10px] font-semibold text-sky-300"
        typeLabel={typeLabel}
        typeLabelProps={{ className: typeLabelClass }}
        title={meeting.title}
        titleClassName={
          clientPortal
            ? undefined
            : 'block whitespace-normal text-[12px] font-medium leading-snug text-[#f9f6f2]'
        }
        onClick={handleClick}
        titleAttr={titleAttr}
        dense
        relaxed={!clientPortal}
        clientPortal={clientPortal}
      />
      {getMeetingVideoLink(meeting) && (
        <p className={`px-0.5 ${clientPortal ? 'mt-1' : 'mt-0.5'}`} onClick={(event) => event.stopPropagation()}>
          <MeetingVideoLink
            meeting={meeting}
            compact
            linkClassName={`font-medium text-violet-300 ${clientPortal ? 'text-[11px]' : 'text-[10px]'}`}
          />
        </p>
      )}
    </div>
  );
}
