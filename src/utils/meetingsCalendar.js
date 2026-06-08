import { addDays, addMonths, parseDateKey, toDateKey } from './calendar';
import { clientNamesConflict } from './clients';

const DAY_MS = 24 * 60 * 60 * 1000;

function meetingMatchesClient(meeting, client) {
  if (!meeting?.client || !client) return false;
  return clientNamesConflict(meeting.client, client);
}

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
    return meetingMatchesClient(meeting, client);
  });
}

/** Client portal — only meetings tagged to this brand (excludes internal team meetings). */
export function filterClientBrandMeetings(meetings, client) {
  if (!Array.isArray(meetings) || !client) return [];
  return meetings.filter((meeting) => meetingMatchesClient(meeting, client));
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

function normalizeOccurrenceOverrides(overrides) {
  if (!overrides || typeof overrides !== 'object') return {};
  const next = {};
  for (const [slot, value] of Object.entries(overrides)) {
    if (!value || typeof value !== 'object') continue;
    const date = String(value.date || '').trim();
    if (!date) continue;
    next[slot] = {
      date,
      time: String(value.time || '').trim(),
      endTime: String(value.endTime || '').trim(),
    };
  }
  return next;
}

export function getMeetingScheduledDate(meeting, occurrenceDate) {
  if (meeting?.scheduledDate) return meeting.scheduledDate;
  const target = occurrenceDate || meeting?.occurrenceDate;
  const overrides = meeting?.occurrenceOverrides || {};
  if (target && overrides && typeof overrides === 'object') {
    for (const [slot, override] of Object.entries(overrides)) {
      if (override?.date === target) return slot;
    }
  }
  return target || meeting?.date || '';
}

export function isOccurrenceRescheduled(meeting) {
  const scheduled = meeting?.scheduledDate;
  const display = meeting?.occurrenceDate || meeting?.date;
  return Boolean(scheduled && display && scheduled !== display);
}

export function buildMeetingUpdate(existing, formData, { editScope = 'series', scheduledDate } = {}) {
  const shared = {
    title: formData.title,
    location: formData.location,
    videoLink: formData.videoLink,
    notes: formData.notes,
  };

  if (!isRecurringMeeting(existing) || editScope === 'series') {
    return {
      ...shared,
      date: formData.date,
      time: formData.time,
      endTime: formData.endTime,
      recurrence: formData.recurrence,
      recurrenceEndDate: formData.recurrenceEndDate,
      client: formData.client,
      prospectName: formData.prospectName,
    };
  }

  const slot = scheduledDate || getMeetingScheduledDate(existing, formData.date);
  const overrides = normalizeOccurrenceOverrides(existing.occurrenceOverrides);
  const matchesSeries =
    formData.date === slot &&
    formData.time === existing.time &&
    formData.endTime === existing.endTime;

  if (matchesSeries) {
    delete overrides[slot];
  } else {
    overrides[slot] = {
      date: formData.date,
      time: formData.time,
      endTime: formData.endTime,
    };
  }

  return {
    ...shared,
    occurrenceOverrides: overrides,
  };
}

function pushOccurrence(occurrences, meeting, naturalKey, rangeStartKey, effectiveEndKey) {
  const overrides = normalizeOccurrenceOverrides(meeting.occurrenceOverrides);
  const override = overrides[naturalKey];
  const displayDate = override?.date || naturalKey;
  const displayTime = override?.time || meeting.time;
  const displayEndTime = override?.endTime || meeting.endTime;

  if (
    compareDateKeys(displayDate, rangeStartKey) < 0 ||
    compareDateKeys(displayDate, effectiveEndKey) > 0
  ) {
    return;
  }

  occurrences.push({
    ...meeting,
    scheduledDate: naturalKey,
    occurrenceDate: displayDate,
    time: displayTime,
    endTime: displayEndTime,
    occurrenceKey: `${meeting.id}:${naturalKey}`,
    rescheduled: Boolean(override?.date && override.date !== naturalKey),
  });
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
    const naturalKey = toDateKey(cursor);
    pushOccurrence(occurrences, meeting, naturalKey, rangeStartKey, effectiveEndKey);
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
