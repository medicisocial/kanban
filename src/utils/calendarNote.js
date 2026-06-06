/** Build a portal payload for POST /api/client-responses type calendar-note. */
export function buildCalendarNoteResponse({ card, comment, client, action = 'save' }) {
  return {
    cardId: card.id,
    action,
    comment: action === 'delete' ? '' : String(comment || '').trim(),
    occurrenceDate: card.occurrenceDate || '',
    client,
    timestamp: Date.now(),
  };
}

/** Staff-side card patch when removing a client calendar note. */
export function buildCalendarNoteDeletePatch(
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
