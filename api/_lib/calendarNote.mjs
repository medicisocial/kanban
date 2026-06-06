const STAFF_CALENDAR_COLUMN_IDS = ['editing', 'in-review', 'approved', 'scheduled'];
const SCHEDULED_POST_TYPES = new Set(['Reel', 'Carousel', 'Static Post']);

function parseRecurrenceDays(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function hasStoryDailyRange(card) {
  return Boolean(card?.storyDailyStart && card?.storyDailyEnd);
}

function isStaffCalendarCard(card) {
  if (!card || card.isOneOffProject || card.contentType === 'One-off Project') return false;
  return STAFF_CALENDAR_COLUMN_IDS.includes(card.columnId);
}

export function isPortalContentCalendarCard(card) {
  if (!isStaffCalendarCard(card)) return false;
  if (card.contentType === 'Story') {
    return Boolean(
      card.dueDate ||
        parseRecurrenceDays(card.storyRecurrenceDays).length ||
        hasStoryDailyRange(card),
    );
  }
  return Boolean(card.dueDate && SCHEDULED_POST_TYPES.has(card.contentType));
}

export function buildCalendarNoteUpdates(
  card,
  { comment, occurrenceDate, timestamp = Date.now() } = {},
) {
  const trimmed = String(comment || '').trim();
  if (!trimmed) {
    throw new Error('Note is required.');
  }

  const stamp = new Date(timestamp).toLocaleDateString();
  const noteAppend = `\n\nClient calendar note (${stamp}): ${trimmed}`;
  const updates = {
    clientComment: trimmed,
    calendarNoteAt: timestamp,
    updatedAt: timestamp,
    notes: `${card.notes || ''}${noteAppend}`.trim(),
  };

  const dateKey = String(occurrenceDate || '').trim();
  if (card.contentType === 'Story' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const existing =
      card.storyOccurrenceNotes && typeof card.storyOccurrenceNotes === 'object'
        ? { ...card.storyOccurrenceNotes }
        : {};
    existing[dateKey] = trimmed;
    updates.storyOccurrenceNotes = existing;
  }

  return updates;
}

export function buildCalendarNoteDeleteUpdates(
  card,
  { occurrenceDate, timestamp = Date.now() } = {},
) {
  const stamp = new Date(timestamp).toLocaleDateString();
  const noteAppend = `\n\nClient calendar note removed (${stamp})`;
  const updates = {
    clientComment: '',
    calendarNoteAt: 0,
    updatedAt: timestamp,
    notes: `${card.notes || ''}${noteAppend}`.trim(),
  };

  const dateKey = String(occurrenceDate || '').trim();
  if (card.contentType === 'Story' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const existing =
      card.storyOccurrenceNotes && typeof card.storyOccurrenceNotes === 'object'
        ? { ...card.storyOccurrenceNotes }
        : {};
    delete existing[dateKey];
    updates.storyOccurrenceNotes = existing;
  }

  return updates;
}
