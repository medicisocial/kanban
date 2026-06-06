/** Build a portal payload for POST /api/client-responses type calendar-note. */
export function buildCalendarNoteResponse({ card, comment, client }) {
  return {
    cardId: card.id,
    comment: String(comment || '').trim(),
    occurrenceDate: card.occurrenceDate || '',
    client,
    timestamp: Date.now(),
  };
}
