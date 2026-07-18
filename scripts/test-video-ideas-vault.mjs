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

function sortIdeasByShootSchedule(ideas, cards = []) {
  return [...ideas].sort((a, b) => {
    const aCard = findIdeaBoardCard(a, cards);
    const bCard = findIdeaBoardCard(b, cards);
    const dateCompare = String(aCard?.shootDate || '9999-12-31').localeCompare(
      String(bCard?.shootDate || '9999-12-31'),
    );
    if (dateCompare !== 0) return dateCompare;
    return String(aCard?.shootTime || '99:99').localeCompare(
      String(bCard?.shootTime || '99:99'),
    );
  });
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

const orderedIdeas = sortIdeasByShootSchedule(
  [
    { id: 'late', boardCardId: 'late-card' },
    { id: 'early-late-time', boardCardId: 'early-late-card' },
    { id: 'undated', boardCardId: 'undated-card' },
    { id: 'early', boardCardId: 'early-card' },
  ],
  [
    { id: 'late-card', shootDate: '2026-08-20', shootTime: '09:00' },
    { id: 'early-late-card', shootDate: '2026-08-01', shootTime: '14:00' },
    { id: 'undated-card', shootDate: '', shootTime: '' },
    { id: 'early-card', shootDate: '2026-08-01', shootTime: '09:00' },
  ],
);
assert(
  orderedIdeas.map((entry) => entry.id).join(',') === 'early,early-late-time,late,undated',
  'To Create ideas sort by shoot date then time with undated items last',
);

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

const returnedToReview = {
  ...bankPayload,
  status: 'pending',
  reviewedAt: null,
  boardCardId: null,
};
assert(returnedToReview.status === 'pending', 'approved idea can return to Review');
assert(returnedToReview.reviewedAt === null, 'returning to Review clears approval timestamp');
assert(returnedToReview.title === bankPayload.title, 'returning to Review preserves idea content');

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
assert(
  toCreateSource.includes('sortIdeasByShootSchedule(ideas, cards)'),
  'To Create view uses chronological shoot ordering',
);
assert(
  toCreateSource.includes('divide-y divide-white'),
  'To Create view renders one compact divided list',
);
assert(toCreateSource.includes('Go to shoot'), 'To Create row can navigate to its scheduled shoot');
assert(!toCreateSource.includes('Edit idea'), 'To Create removes duplicate idea editor action');
assert(!toCreateSource.includes('Open card'), 'To Create opens cards from the full row instead');
assert(toCreateSource.includes('openCardFromRow(event, card)'), 'To Create rows open linked cards');
assert(
  toCreateSource.includes('taskActionBtnClass'),
  'To Create actions use compact team-card button styling',
);
assert(toCreateSource.includes('onMakeOneOff'), 'To Create rows can make a one-off from a card');
assert(toCreateSource.includes('Make one-off'), 'To Create rows expose Make one-off action');
assert(
  videoIdeasSource.includes('onConvertCardToOneOff'),
  'Vault wires in-place To Create card → one-off conversion',
);
assert(
  videoIdeasSource.includes('onMakeOneOff={setOneOffCard}'),
  'To Create tab opens Make one-off against the linked board card',
);
const approvedSource = readFileSync(new URL('../src/components/IdeaVaultTable.jsx', import.meta.url), 'utf8');
assert(approvedSource.includes('Add to shoot'), 'Approved rows keep Add to shoot primary action');
assert(approvedSource.includes('Move to Review'), 'Approved rows can return ideas to Review');
assert(approvedSource.includes('taskActionBtnClass'), 'Approved actions use compact team-card button styling');
assert(approvedSource.includes('openIdeaFromRow(event, idea)'), 'Approved rows open idea editor');
assert(approvedSource.includes('align-middle'), 'Approved title cell is vertically centered');
assert(
  approvedSource.includes('flex flex-col items-stretch gap-1.5'),
  'Approved actions stack like editor task card actions',
);
assert(approvedSource.includes('onMakeOneOff'), 'Approved rows can make a one-off from an idea');
assert(approvedSource.includes('Make one-off'), 'Approved rows expose Make one-off action');
assert(approvedSource.includes('ReferenceMusicLink'), 'Approved rows show clickable music links');
assert(!/>\s*Edit\s*</.test(approvedSource), 'Approved rows do not show a standalone Edit action');
assert(!/>\s*Delete\s*</.test(approvedSource), 'Approved rows do not show a standalone Delete action');
const reviewSource = readFileSync(
  new URL('../src/components/clientPortal/AdminIdeasTable.jsx', import.meta.url),
  'utf8',
);
assert(reviewSource.includes('openIdeaFromRow(event, idea)'), 'Review rows open idea editor');
assert(reviewSource.includes('taskActionBtnClass'), 'Review actions use compact team-card button styling');
assert(reviewSource.includes('ReferenceMusicLink'), 'Review rows show clickable music links');
assert(reviewSource.includes('onMakeOneOff'), 'Review rows can make a one-off from an idea');
assert(!/>\s*Edit\s*</.test(reviewSource), 'Review rows do not show a standalone Edit action');
const ideaModalSource = readFileSync(
  new URL('../src/components/VideoIdeaModal.jsx', import.meta.url),
  'utf8',
);
assert(!ideaModalSource.includes('Client Comment'), 'idea editor hides client comments');
assert(ideaModalSource.includes('onDelete'), 'idea editor accepts Delete handler');
assert(ideaModalSource.includes('>Delete<') || ideaModalSource.includes('Delete\n'), 'idea editor exposes Delete for existing ideas');
assert(
  ideaModalSource.includes('<ReferenceVideoLink') && ideaModalSource.includes('<ReferenceMusicLink'),
  'idea editor exposes clickable reference video and music links',
);
assert(ideaModalSource.includes('MakeOneOffModal'), 'idea editor can open Make one-off modal');
const makeOneOffSource = readFileSync(
  new URL('../src/components/MakeOneOffModal.jsx', import.meta.url),
  'utf8',
);
assert(makeOneOffSource.includes('ClientNameInput'), 'Make one-off modal allows custom client names');
assert(makeOneOffSource.includes('EDITOR_POINT_OPTIONS'), 'Make one-off modal assigns editor points');
assert(
  makeOneOffSource.includes('editor payroll only'),
  'Make one-off points copy is editor-pay only',
);
const cardModalSource = readFileSync(new URL('../src/components/CardModal.jsx', import.meta.url), 'utf8');
assert(cardModalSource.includes('Make one-off project'), 'card editor exposes Make one-off project');
assert(cardModalSource.includes('MakeOneOffModal'), 'card editor opens Make one-off modal');
assert(
  cardModalSource.includes('buildOneOffConversionUpdates'),
  'card editor uses shared one-off conversion helper',
);
assert(
  cardModalSource.includes('isOneOff || displayCard.contentType === \'Reel\''),
  'card editor shows editor points for one-offs and reels',
);
const shootItemSource = readFileSync(
  new URL('../src/components/ShootDayItem.jsx', import.meta.url),
  'utf8',
);
assert(
  shootItemSource.includes('ReferenceMusicLink') && !shootItemSource.includes('Music ref'),
  'shoot day items open music references as links',
);
const kanbanCardSource = readFileSync(
  new URL('../src/components/KanbanCard.jsx', import.meta.url),
  'utf8',
);
assert(kanbanCardSource.includes('ReferenceMusicLink'), 'board cards show clickable music links');
const quickAddSource = readFileSync(
  new URL('../src/components/VideoIdeaQuickAdd.jsx', import.meta.url),
  'utf8',
);
assert(quickAddSource.includes('ReferenceVideoLink'), 'quick add shows clickable reference video links');
const videoIdeasUiSource = readFileSync(
  new URL('../src/components/VideoIdeas.jsx', import.meta.url),
  'utf8',
);
assert(
  videoIdeasUiSource.includes('onDelete={handleDeleteIdeaFromModal}'),
  'Vault wires idea modal Delete handler',
);
assert(
  videoIdeasUiSource.includes('onCreateOneOffFromIdea'),
  'Vault wires create one-off from idea',
);
const navSource = readFileSync(
  new URL('../src/components/clientPortal/AdminConsoleLayout.jsx', import.meta.url),
  'utf8',
);
assert(!navSource.includes("label: 'Pipeline'"), 'Pipeline is removed from primary navigation');
const shellSource = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
assert(shellSource.includes('activeView === "board"'), 'legacy direct board route remains supported');
assert(
  shellSource.includes('handleMoveApprovedIdeaToReview'),
  'AppShell wires Approved-to-Review lifecycle handler',
);
assert(
  shellSource.includes('onCreateOneOffFromIdea') && shellSource.includes('addOneOffProject'),
  'AppShell creates one-off board cards from vault ideas',
);
assert(
  shellSource.includes("handleNavigate('shoot'"),
  'AppShell wires To Create shoot navigation',
);

console.log('Video idea vault tests passed.');
