import { addDays, addMonths, parseDateKey, toDateKey } from './calendar';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getMeetingRecurrence(meeting) {
  return meeting?.recurrence && meeting.recurrence !== 'none' ? meeting.recurrence : 'none';
}

export function isRecurringMeeting(meeting) {
  return getMeetingRecurrence(meeting) !== 'none';
}

export function getMeetingContactLabel(meeting) {
  if (meeting?.prospectName) return `${meeting.prospectName} (Prospect)`;
  if (meeting?.client) return meeting.client;
  return 'Internal';
}

export function filterMeetings(meetings, { client } = {}) {
  if (!Array.isArray(meetings)) return [];
  if (!client || client === 'all') return meetings;

  return meetings.filter((meeting) => {
    if (!meeting.client && !meeting.prospectName) return true;
    if (meeting.prospectName) return false;
    return meeting.client === client;
  });
}

/** Client portal — only meetings tagged to this brand (excludes internal team meetings). */
export function filterClientBrandMeetings(meetings, client) {
  if (!Array.isArray(meetings) || !client) return [];
  return meetings.filter((meeting) => meeting.client === client);
}

function compareDateKeys(a, b) {
  return a.localeCompare(b);
}

function nextOccurrenceDate(meeting, cursor) {
  const recurrence = getMeetingRecurrence(meeting);
  if (recurrence === 'weekly') return addDays(cursor, 7);
  if (recurrence === 'biweekly') return addDays(cursor, 14);
  if (recurrence === 'monthly') return addMonths(cursor, 1);
  return addDays(cursor, 1);
}

function advanceToDateKey(meeting, cursor, targetKey) {
  const target = parseDateKey(targetKey);
  let next = cursor;

  if (next >= target) return next;

  const recurrence = getMeetingRecurrence(meeting);
  if (recurrence === 'monthly') {
    while (next < target) {
      next = addMonths(next, 1);
    }
    return next;
  }

  const intervalDays = recurrence === 'biweekly' ? 14 : 7;
  const diffDays = Math.floor((target - next) / DAY_MS);
  const steps = Math.max(0, Math.floor(diffDays / intervalDays));
  next = addDays(next, steps * intervalDays);
  while (next < target) {
    next = addDays(next, intervalDays);
  }
  return next;
}

export function expandMeetingOccurrences(meeting, rangeStartKey, rangeEndKey) {
  if (!meeting?.date || !rangeStartKey || !rangeEndKey) return [];

  const recurrence = getMeetingRecurrence(meeting);
  const seriesEndKey = meeting.recurrenceEndDate || rangeEndKey;
  const effectiveEndKey = compareDateKeys(seriesEndKey, rangeEndKey) <= 0 ? seriesEndKey : rangeEndKey;

  if (recurrence === 'none') {
    if (
      compareDateKeys(meeting.date, rangeStartKey) >= 0 &&
      compareDateKeys(meeting.date, effectiveEndKey) <= 0
    ) {
      return [
        {
          ...meeting,
          occurrenceDate: meeting.date,
          occurrenceKey: meeting.id,
        },
      ];
    }
    return [];
  }

  const occurrences = [];
  let cursor = parseDateKey(meeting.date);
  const rangeStart = parseDateKey(rangeStartKey);
  const rangeEnd = parseDateKey(effectiveEndKey);

  if (cursor < rangeStart) {
    cursor = advanceToDateKey(meeting, cursor, rangeStartKey);
  }

  while (cursor <= rangeEnd) {
    const dateKey = toDateKey(cursor);
    occurrences.push({
      ...meeting,
      occurrenceDate: dateKey,
      occurrenceKey: `${meeting.id}:${dateKey}`,
    });
    cursor = nextOccurrenceDate(meeting, cursor);
  }

  return occurrences;
}

export function expandMeetingsForRange(meetings, rangeStartKey, rangeEndKey) {
  if (!Array.isArray(meetings)) return [];

  return meetings
    .flatMap((meeting) => expandMeetingOccurrences(meeting, rangeStartKey, rangeEndKey))
    .sort((a, b) => {
      const dateCompare = compareDateKeys(a.occurrenceDate, b.occurrenceDate);
      if (dateCompare !== 0) return dateCompare;
      return (a.time || '').localeCompare(b.time || '');
    });
}

export function groupMeetingsByDate(meetings) {
  return meetings.reduce((acc, meeting) => {
    const dateKey = meeting.occurrenceDate || meeting.date;
    if (!dateKey) return acc;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(meeting);
    acc[dateKey].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    return acc;
  }, {});
}

export function getUpcomingMeetings(meetings, fromDateKey, dayCount = 7) {
  const today = fromDateKey || toDateKey(new Date());
  const end = toDateKey(addDays(parseDateKey(today), Math.max(0, dayCount - 1)));
  return expandMeetingsForRange(meetings, today, end);
}
