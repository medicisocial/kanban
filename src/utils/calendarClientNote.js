const STAFF_CALENDAR_COLUMN_IDS = ['editing', 'in-review', 'approved', 'scheduled'];
const SCHEDULED_POST_TYPES = new Set(['Reel', 'Carousel', 'Static Post']);

function parseRecurrenceDays(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function hasStoryDailyRange(card) {
  return Boolean(card?.storyDailyStart && card?.storyDailyEnd);
}

function parseStoryOccurrenceNotes(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const notes = {};
  for (const [dateKey, text] of Object.entries(value)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && typeof text === 'string') {
      notes[dateKey] = text;
    }
  }
  return notes;
}

/** Client-facing calendar note for a card (respects story occurrence date). */
export function getCalendarClientNote(card) {
  if (!card) return '';
  const dateKey = card.occurrenceDate;
  if (card.contentType === 'Story' && dateKey) {
    const overrides = parseStoryOccurrenceNotes(card.storyOccurrenceNotes);
    if (overrides[dateKey]) return overrides[dateKey];
  }
  return String(card.clientComment || '').trim();
}

export function hasCalendarClientNote(card) {
  return Boolean(getCalendarClientNote(card));
}

export function isContentCalendarCard(card) {
  if (!card || card.isOneOffProject || card.contentType === 'One-off Project') return false;
  if (!STAFF_CALENDAR_COLUMN_IDS.includes(card.columnId)) return false;
  if (card.contentType === 'Story') {
    return Boolean(
      card.dueDate ||
        parseRecurrenceDays(card.storyRecurrenceDays).length ||
        hasStoryDailyRange(card),
    );
  }
  return Boolean(card.dueDate && SCHEDULED_POST_TYPES.has(card.contentType));
}
