/** Apply temporary due-date overrides while a calendar drag is being persisted. */
export function applyPendingCalendarMoves(cards = [], pendingMoves = {}) {
  if (!Object.keys(pendingMoves).length) return cards;
  return cards.map((card) => {
    const dueDate = pendingMoves[card.id];
    return dueDate && dueDate !== card.dueDate ? { ...card, dueDate } : card;
  });
}
