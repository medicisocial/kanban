import { isOneOffProjectCard } from '../constants';
import { matchesClientFilter } from './clients';

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
    if (!matchesClientFilter(idea.client, client)) return false;
    return true;
  });
}

/** Approved ideas that left the bank (on pipeline or finished). */
export function isIdeaScheduled(idea, cards = []) {
  if (!idea || idea.status !== 'approved') return false;
  return !isIdeaInVault(idea, cards);
}

/** Pipeline card in the To Create column (not a one-off project). */
export function isToCreatePipelineCard(card) {
  return Boolean(card && card.columnId === 'shoot' && !isOneOffProjectCard(card));
}

/** Idea linked to a To Create card (by sourceIdeaId or boardCardId). */
export function findIdeaForCard(card, ideas = []) {
  if (!isToCreatePipelineCard(card)) return null;
  if (card.sourceIdeaId) {
    const bySource = ideas.find((idea) => idea.id === card.sourceIdeaId);
    if (bySource) return bySource;
  }
  return ideas.find((idea) => idea.boardCardId === card.id) || null;
}

export function canReturnCardToVault(card) {
  return isToCreatePipelineCard(card);
}

/** Fields for an idea added straight to the bank (skips review). */
export function buildBankIdeaData(ideaData = {}) {
  const now = Date.now();
  return {
    ...ideaData,
    status: 'approved',
    boardCardId: null,
    reviewedAt: now,
  };
}
