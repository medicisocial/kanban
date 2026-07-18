/**
 * Idea bank (vault) rules for approved concepts.
 */
import { readFileSync } from 'fs';

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

function isIdeaToCreate(idea, cards = []) {
  if (!idea || idea.status !== 'approved') return false;
  const card = findIdeaBoardCard(idea, cards);
  return Boolean(card && card.columnId === 'shoot' && String(card.shootDate || '').trim());
}

function findIdeaForCard(card, ideas = []) {
  if (!card || card.columnId !== 'shoot') return null;
  if (card.sourceIdeaId) {
    const bySource = ideas.find((idea) => idea.id === card.sourceIdeaId);
    if (bySource) return bySource;
  }
  return ideas.find((idea) => idea.boardCardId === card.id) || null;
}

function isToCreatePipelineCard(card) {
  return Boolean(card && card.columnId === 'shoot' && card.contentType !== 'One-off Project');
}

function canReturnCardToVault(card) {
  return isToCreatePipelineCard(card);
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
assert(
  isIdeaToCreate({ id: 'idea-2', status: 'approved', boardCardId: 'card-2' }, [scheduledCard]),
  'approved idea with a scheduled To Create card appears in To Create',
);
assert(!isIdeaToCreate(idea, []), 'approved vault-only idea does not appear in To Create');
assert(
  !isIdeaToCreate(
    { id: 'idea-3', status: 'approved', boardCardId: 'card-3' },
    [{ id: 'card-3', sourceIdeaId: 'idea-3', columnId: 'editing', shootDate: '2026-06-12' }],
  ),
  'idea leaves the Vault To Create tab after advancing to editing',
);
assert(!isIdeaInVault({ id: 'pending', status: 'pending' }, []), 'pending idea stays in Review');

const ideas = [
  { id: 'idea-2', status: 'approved', boardCardId: 'card-2' },
];

assert(
  canReturnCardToVault({ sourceIdeaId: 'idea-2', columnId: 'shoot', contentType: 'Reel' }),
  'shoot cards can return to vault',
);
assert(
  canReturnCardToVault({ id: 'card-legacy', columnId: 'shoot', contentType: 'Reel' }),
  'To Create cards without idea links can return to vault',
);
assert(
  findIdeaForCard({ sourceIdeaId: 'idea-2', columnId: 'shoot' }, ideas)?.id === 'idea-2',
  'findIdeaForCard resolves sourceIdeaId',
);
assert(
  !canReturnCardToVault({ sourceIdeaId: 'idea-2', columnId: 'editing', contentType: 'Reel' }),
  'cards that moved past To Create cannot return to vault',
);
assert(
  !canReturnCardToVault({ columnId: 'shoot', contentType: 'One-off Project', isOneOffProject: true }),
  'one-off projects in To Create cannot return to vault',
);

function buildBankIdeaData(ideaData = {}) {
  const now = Date.now();
  return {
    ...ideaData,
    status: 'approved',
    boardCardId: null,
    reviewedAt: now,
  };
}

const bankPayload = buildBankIdeaData({ title: 'Direct bank idea', client: 'Plume' });
assert(bankPayload.status === 'approved', 'bank payload is approved');
assert(bankPayload.boardCardId === null, 'bank payload has no board card');
assert(bankPayload.reviewedAt, 'bank payload sets reviewedAt');

const videoIdeasSource = readFileSync(new URL('../src/components/VideoIdeas.jsx', import.meta.url), 'utf8');
assert(videoIdeasSource.includes("{ id: 'approved', label: 'Approved' }"), 'staff Vault has Approved tab');
assert(videoIdeasSource.includes("{ id: 'to-create', label: 'To Create' }"), 'staff Vault has To Create tab');
assert(
  videoIdeasSource.includes("idea.status !== 'approved'"),
  'staff Review excludes approved lifecycle items',
);
const toCreateSource = readFileSync(
  new URL('../src/components/ToCreateIdeasTable.jsx', import.meta.url),
  'utf8',
);
assert(toCreateSource.includes('Move back to Approved'), 'To Create view can restore approved ideas');
const navSource = readFileSync(
  new URL('../src/components/clientPortal/AdminConsoleLayout.jsx', import.meta.url),
  'utf8',
);
assert(!navSource.includes("label: 'Pipeline'"), 'Pipeline is removed from primary navigation');
const shellSource = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
assert(shellSource.includes('activeView === "board"'), 'legacy direct board route remains supported');

console.log('Video idea vault tests passed.');
