import { toDateKey } from './calendar';
import {
  filterMeetings,
  expandMeetingsForRange,
  getMeetingContactLabel,
} from './meetingsCalendar';

export function buildTodayHeadline(meetingCount, shootCount) {
  const parts = [];
  if (meetingCount > 0) {
    parts.push(`${meetingCount} meeting${meetingCount === 1 ? '' : 's'}`);
  }
  if (shootCount > 0) {
    parts.push(`${shootCount} shoot${shootCount === 1 ? '' : 's'}`);
  }
  if (!parts.length) return '';
  return `You have ${parts.join(' and ')} today.`;
}

export function buildTodayTimeline({ meetings = [], shoots = [], clientFilter = 'all' }) {
  const today = toDateKey(new Date());
  const visibleMeetings = filterMeetings(meetings, { client: clientFilter });
  const todayMeetings = expandMeetingsForRange(visibleMeetings, today, today);

  const items = [];

  for (const meeting of todayMeetings) {
    items.push({
      id: meeting.occurrenceKey || meeting.id,
      kind: 'meeting',
      sortTime: meeting.time || '',
      time: meeting.time || '',
      endTime: meeting.endTime || '',
      title: meeting.title,
      subtitle: [getMeetingContactLabel(meeting), meeting.location].filter(Boolean).join(' · '),
      meeting,
    });
  }

  for (const card of shoots) {
    items.push({
      id: `shoot-${card.id}`,
      kind: 'shoot',
      sortTime: card.shootTime || '',
      time: card.shootTime || '',
      endTime: card.shootEndTime || '',
      title: card.title,
      subtitle: [card.client, card.contentType, card.contentCreator].filter(Boolean).join(' · '),
      card,
    });
  }

  items.sort((a, b) => {
    const timeCompare = (a.sortTime || '99:99').localeCompare(b.sortTime || '99:99');
    if (timeCompare !== 0) return timeCompare;
    if (a.kind !== b.kind) return a.kind === 'meeting' ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return {
    today,
    meetingCount: todayMeetings.length,
    shootCount: shoots.length,
    items,
  };
}
