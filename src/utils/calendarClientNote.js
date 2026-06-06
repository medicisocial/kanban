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
