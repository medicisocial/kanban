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

  const hasVideoLink = Boolean(getMeetingVideoLink(meeting));
  const videoLabel = hasVideoLink ? getMeetingLinkShortLabel(getMeetingVideoLink(meeting)) : '';
  const typeLabel = clientPortal ? 'Meeting' : videoLabel || 'Meeting';
  const typeLabelClass = clientPortal
    ? 'text-[10px] font-medium uppercase tracking-wide text-white/50'
    : videoLabel
      ? 'text-sky-300'
      : 'text-violet-300';

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

  const meetLinkClass = clientPortal
    ? 'inline-flex w-fit max-w-full items-center gap-1 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300 no-underline transition hover:border-violet-400/50 hover:bg-violet-500/20 hover:text-violet-200'
    : 'font-medium text-violet-300 text-[10px]';

  return (
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
      footerContent={
        hasVideoLink ? (
          <MeetingVideoLink meeting={meeting} compact linkClassName={meetLinkClass} />
        ) : null
      }
    />
  );
}
