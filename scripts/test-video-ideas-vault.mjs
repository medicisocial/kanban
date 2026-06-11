/**
 * Idea bank (vault) rules for approved concepts.
 */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function findIdeaBoardCard(idea, cards = []) {
  if (!idea) return null;
  if (idea.boardCardId) {
    const linked = cards.find((card) => card.id === idea.boardCardId);
    if (linked) return linked;
  }
  return cards.find((card) => card.sourceIdeaId === idea.id) || null;
}

function isIdeaInVault(idea, cards = []) {
  if (!idea || idea.status !== 'approved') return false;
  const card = findIdeaBoardCard(idea, cards);
  if (!card) return true;
  if (card.columnId !== 'shoot') return false;
  return !String(card.shootDate || '').trim();
}

function isIdeaScheduled(idea, cards = []) {
  if (!idea || idea.status !== 'approved') return false;
  return !isIdeaInVault(idea, cards);
}

function findIdeaForCard(card, ideas = []) {
  if (!card || card.columnId !== 'shoot') return null;
  if (card.sourceIdeaId) {
    const bySource = ideas.find(
      (idea) => idea.id === card.sourceIdeaId && idea.status === 'approved',
    );
    if (bySource) return bySource;
  }
  return (
    ideas.find(
      (idea) => idea.status === 'approved' && idea.boardCardId === card.id,
    ) || null
  );
}

function canReturnCardToVault(card, ideas = []) {
  return Boolean(findIdeaForCard(card, ideas));
}

const idea = {
  id: 'idea-1',
  status: 'approved',
  title: 'Summer promo',
  client: 'Plume',
  boardCardId: null,
};

assert(isIdeaInVault(idea, []), 'approved idea without a board card is in the vault');

const unscheduledCard = {
  id: 'card-1',
  sourceIdeaId: 'idea-1',
  columnId: 'shoot',
  shootDate: '',
};
assert(
  isIdeaInVault({ ...idea, boardCardId: 'card-1' }, [unscheduledCard]),
  'legacy board card in To Create without shoot date counts as vault',
);

const scheduledCard = {
  id: 'card-2',
  sourceIdeaId: 'idea-2',
  columnId: 'shoot',
  shootDate: '2026-06-12',
};
assert(
  !isIdeaInVault({ id: 'idea-2', status: 'approved', boardCardId: 'card-2' }, [scheduledCard]),
  'scheduled shoot removes idea from vault',
);
assert(
  isIdeaScheduled({ id: 'idea-2', status: 'approved', boardCardId: 'card-2' }, [scheduledCard]),
  'scheduled idea is tracked as on pipeline',
);

const ideas = [
  { id: 'idea-2', status: 'approved', boardCardId: 'card-2' },
];

assert(
  canReturnCardToVault({ sourceIdeaId: 'idea-2', columnId: 'shoot' }, ideas),
  'shoot cards from ideas can return to vault',
);
assert(
  canReturnCardToVault({ id: 'card-legacy', columnId: 'shoot' }, [
    { id: 'idea-3', status: 'approved', boardCardId: 'card-legacy' },
  ]),
  'legacy boardCardId link can return to vault',
);
assert(
  !canReturnCardToVault({ sourceIdeaId: 'idea-2', columnId: 'editing' }, ideas),
  'cards that moved past To Create cannot return to vault',
);

console.log('Video idea vault tests passed.');
