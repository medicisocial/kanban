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
