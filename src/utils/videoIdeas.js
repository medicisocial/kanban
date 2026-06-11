/** Approved ideas waiting to be scheduled on a shoot day. */
export function findIdeaBoardCard(idea, cards = []) {
  if (!idea) return null;
  if (idea.boardCardId) {
    const linked = cards.find((card) => card.id === idea.boardCardId);
    if (linked) return linked;
  }
  return cards.find((card) => card.sourceIdeaId === idea.id) || null;
}

/** Idea is in the bank when approved and not yet on a shoot day. */
export function isIdeaInVault(idea, cards = []) {
  if (!idea || idea.status !== 'approved') return false;
  const card = findIdeaBoardCard(idea, cards);
  if (!card) return true;
  if (card.columnId !== 'shoot') return false;
  return !String(card.shootDate || '').trim();
}

export function getVaultIdeas(ideas, cards = [], { client } = {}) {
  return ideas.filter((idea) => {
    if (!isIdeaInVault(idea, cards)) return false;
    if (client && client !== 'all' && idea.client !== client) return false;
    return true;
  });
}

/** Approved ideas that left the bank (on pipeline or finished). */
export function isIdeaScheduled(idea, cards = []) {
  if (!idea || idea.status !== 'approved') return false;
  return !isIdeaInVault(idea, cards);
}

export function canReturnCardToVault(card) {
  if (!card?.sourceIdeaId) return false;
  return card.columnId === 'shoot';
}
