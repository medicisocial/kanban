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
  return !findIdeaBoardCard(idea, cards);
}

function isIdeaScheduled(idea, cards = []) {
  if (!idea || idea.status !== 'approved') return false;
  return !isIdeaInVault(idea, cards);
}

function isIdeaToCreate(idea, cards = []) {
  if (!idea || idea.status !== 'approved') return false;
  const card = findIdeaBoardCard(idea, cards);
  return Boolean(card && card.columnId === 'shoot');
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
  !isIdeaInVault({ ...idea, boardCardId: 'card-1' }, [unscheduledCard]),
  'To Create board card leaves Approved even without a shoot date',
);
assert(
  isIdeaToCreate({ ...idea, boardCardId: 'card-1' }, [unscheduledCard]),
  'undated To Create board card appears on the Vault To Create tab',
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

function getToCreateCards(cards = [], { client } = {}) {
  return cards.filter((card) => {
    if (!card || card.columnId !== 'shoot') return false;
    if (client && client !== 'all' && card.client !== client) return false;
    return true;
  });
}

const oneOffShootCard = {
  id: 'fairplay',
  title: 'Fairplay song release',
  client: 'Plume',
  columnId: 'shoot',
  contentType: 'One-off Project',
  isOneOffProject: true,
  shootDate: '',
};
assert(
  getToCreateCards([oneOffShootCard, { id: 'edit', columnId: 'editing' }]).some(
    (card) => card.id === 'fairplay',
  ),
  'Vault To Create includes one-off board cards in shoot (no vault idea required)',
);
assert(
  getToCreateCards([oneOffShootCard], { client: 'Other' }).length === 0,
  'Vault To Create respects client filter for board cards',
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
  toCreateSource.includes('getToCreateCards') && toCreateSource.includes('sortCardsByShootSchedule'),
  'To Create view lists shoot board cards (including one-offs) chronologically',
);
assert(
  toCreateSource.includes('canReturnCardToVault'),
  'To Create only offers Move back to Approved for idea-linked reels',
);
assert(
  toCreateSource.includes('space-y-3') && toCreateSource.includes('TeamTaskCard'),
  'To Create view renders spaced team-task style cards',
);
assert(toCreateSource.includes('Go to shoot'), 'To Create row can navigate to its scheduled shoot');
assert(!toCreateSource.includes('Edit idea'), 'To Create removes duplicate idea editor action');
assert(!toCreateSource.includes('Open card'), 'To Create opens cards from the full row instead');
assert(toCreateSource.includes('onOpen={() => onOpenCard?.(card)}'), 'To Create rows open linked cards');
assert(
  toCreateSource.includes('taskActionBtnClass'),
  'To Create actions use compact team-card button styling',
);
assert(
  toCreateSource.includes('vaultRowActionsClass'),
  'To Create uses shared Vault action column width',
);
assert(
  toCreateSource.includes('contentTypePipelinePillProps'),
  'To Create uses team-task style content type pills',
);
assert(toCreateSource.includes('ClientAvatar'), 'To Create rows show client logo');
assert(
  !toCreateSource.includes("statusPipelinePillProps('create')"),
  'To Create rows do not show a To create status pill',
);
assert(
  !toCreateSource.includes('border-amber-400/20'),
  'To Create rows no longer use the old amber To Create badge fill',
);
{
  const typeIdx = toCreateSource.indexOf('contentTypePipelinePillProps(typeStyle)');
  const clientIdx = toCreateSource.indexOf('<ClientAvatar client={card.client}');
  const titleIdx = toCreateSource.indexOf("card.title || 'Untitled'");
  assert(typeIdx > 0 && typeIdx < clientIdx, 'To Create shows content type left of client');
  assert(clientIdx > 0 && clientIdx < titleIdx, 'To Create shows client above title');
}
assert(
  videoIdeasSource.includes('getToCreateCards'),
  'Vault To Create tab counts board cards in shoot, not only vault ideas',
);
assert(!toCreateSource.includes('onMakeOneOff'), 'To Create rows do not expose Make one-off');
assert(!toCreateSource.includes('Make one-off'), 'To Create rows do not show Make one-off action');
assert(
  !videoIdeasSource.includes('onConvertCardToOneOff'),
  'Vault no longer wires row-level To Create card → one-off conversion',
);
assert(
  !videoIdeasSource.includes('onMakeOneOff={setOneOffCard}'),
  'To Create tab does not open Make one-off from the row',
);
assert(
  !videoIdeasSource.includes('onUpdateReference') && !videoIdeasSource.includes('onUpdateContentType'),
  'Approved tab no longer inline-edits reference or content type on the row',
);
const approvedSource = readFileSync(new URL('../src/components/IdeaVaultTable.jsx', import.meta.url), 'utf8');
assert(approvedSource.includes('Add to shoot'), 'Approved rows keep Add to shoot action');
assert(approvedSource.includes('Move to Review'), 'Approved rows can return ideas to Review');
assert(
  !approvedSource.includes('Add to To Create'),
  'Approved rows do not use Add to To Create row action',
);
assert(
  videoIdeasSource.includes('+ Add card') && videoIdeasSource.includes('+ Add one-off project'),
  'Vault tabs expose Add card and Add one-off like Editors',
);
assert(
  !videoIdeasSource.includes('VideoIdeaQuickAdd'),
  'Vault no longer shows Review/Approved quick-add idea UI',
);
assert(
  videoIdeasSource.includes('AddEditorTaskModal') && videoIdeasSource.includes('onAddOneOffTask'),
  'Vault wires Add one-off project modal',
);
const makeOneOffModalSource = readFileSync(
  new URL('../src/components/MakeOneOffModal.jsx', import.meta.url),
  'utf8',
);
assert(
  makeOneOffModalSource.includes("id: 'shoot'") && makeOneOffModalSource.includes('Start in'),
  'Make one-off modal lets users start in To Create',
);
const addEditorModalSource = readFileSync(
  new URL('../src/components/AddEditorTaskModal.jsx', import.meta.url),
  'utf8',
);
assert(
  addEditorModalSource.includes("id: 'shoot'") && addEditorModalSource.includes('Start in'),
  'Add one-off modal lets users start in To Create',
);
assert(approvedSource.includes('taskActionBtnClass'), 'Approved actions use compact team-card button styling');
assert(approvedSource.includes('TeamTaskCard'), 'Approved rows use team-task separated cards');
assert(
  approvedSource.includes('space-y-3'),
  'Approved uses spaced team-task style card list',
);
assert(
  approvedSource.includes('vaultRowActionsClass'),
  'Approved uses shared Vault action column width',
);
assert(
  approvedSource.includes('contentTypePipelinePillProps'),
  'Approved uses team-task style content type pills',
);
assert(
  !approvedSource.includes("statusPipelinePillProps('approved')"),
  'Approved rows do not show a per-card Approved status pill',
);
assert(
  approvedSource.includes('rounded-full border border-white/10 bg-white/[0.04]'),
  'Approved script-ready chip uses the soft pill style',
);
{
  const typeIdx = approvedSource.indexOf('contentTypePipelinePillProps(typeStyle)');
  const clientIdx = approvedSource.indexOf('<ClientAvatar client={idea.client}');
  const titleIdx = approvedSource.indexOf('idea.title || \'Untitled idea\'');
  assert(typeIdx > 0 && typeIdx < clientIdx, 'Approved shows content type left of client');
  assert(clientIdx > 0 && clientIdx < titleIdx, 'Approved shows client above title');
}
assert(!approvedSource.includes('<select'), 'Approved content type is not a clickable select');
assert(!approvedSource.includes('DebouncedField'), 'Approved row has no inline paste-link field');
assert(!approvedSource.includes('Paste link'), 'Approved row does not show paste-link placeholder');
assert(!approvedSource.includes('min-w-[720px]'), 'Approved no longer uses a wide desktop table');
assert(
  !approvedSource.includes('min-h-10 flex-1') && !approvedSource.includes('w-[32%]'),
  'Approved action buttons do not stretch across a wide Actions column',
);
assert(!approvedSource.includes('onMakeOneOff'), 'Approved rows do not expose Make one-off');
assert(!approvedSource.includes('Make one-off'), 'Approved rows do not show Make one-off action');
assert(approvedSource.includes('ReferenceMusicLink'), 'Approved rows show clickable music links');
assert(approvedSource.includes('ReferenceVideoLink'), 'Approved rows show clickable video links when set');
assert(!/>\s*Edit\s*</.test(approvedSource), 'Approved rows do not show a standalone Edit action');
assert(!/>\s*Delete\s*</.test(approvedSource), 'Approved rows do not show a standalone Delete action');
const reviewSource = readFileSync(
  new URL('../src/components/clientPortal/AdminIdeasTable.jsx', import.meta.url),
  'utf8',
);
assert(reviewSource.includes('TeamTaskCard'), 'Review rows use team-task separated cards');
assert(reviewSource.includes('taskActionBtnClass'), 'Review actions use compact team-card button styling');
assert(
  reviewSource.includes('space-y-3'),
  'Review uses spaced team-task style card list',
);
assert(
  reviewSource.includes('vaultRowActionsClass'),
  'Review uses shared Vault action column width',
);
assert(
  reviewSource.includes('contentTypePipelinePillProps'),
  'Review uses team-task style content type pills',
);
assert(
  reviewSource.includes('rounded-full border border-white/10 bg-white/[0.04]'),
  'Review status badge uses Script ready soft pill style',
);
assert(
  !reviewSource.includes('statusPipelinePillProps'),
  'Review status badge no longer uses pipeline-style status pills',
);
assert(
  videoIdeasSource.includes('statusPipelinePillProps'),
  'Vault header counts use pipeline-style status pills',
);
assert(
  !videoIdeasSource.includes('border-amber-500/25'),
  'Vault header counts no longer use amber fill chips',
);
{
  const typeIdx = reviewSource.indexOf('contentTypePipelinePillProps(');
  const clientIdx = reviewSource.indexOf('<ClientAvatar client={idea.client}');
  const titleIdx = reviewSource.indexOf('idea.title || \'Untitled idea\'');
  const statusIdx = reviewSource.indexOf('<StatusBadge status={idea.status} />');
  assert(typeIdx > 0 && typeIdx < clientIdx, 'Review shows content type left of client');
  assert(clientIdx > 0 && clientIdx < titleIdx, 'Review shows client above title');
  assert(titleIdx > 0 && statusIdx > titleIdx, 'Review shows status badge below title');
}
assert(!reviewSource.includes('min-w-[940px]'), 'Review no longer uses a wide desktop table');
assert(
  !reviewSource.includes('min-h-10 flex-1') && !reviewSource.includes('w-[17%]'),
  'Review action buttons do not stretch across a wide Actions column',
);
assert(reviewSource.includes('ReferenceMusicLink'), 'Review rows show clickable music links');
assert(!reviewSource.includes('onMakeOneOff'), 'Review rows do not expose Make one-off');
assert(!reviewSource.includes('Make one-off'), 'Review rows do not show Make one-off action');
assert(
  videoIdeasSource.includes('onMakeOneOff={(idea, data)'),
  'Vault idea editor still supports Make one-off',
);
assert(!/>\s*Edit\s*</.test(reviewSource), 'Review rows do not show a standalone Edit action');
const uiSource = readFileSync(
  new URL('../src/components/clientPortal/clientPortalUi.js', import.meta.url),
  'utf8',
);
assert(
  uiSource.includes("sm:w-[9.5rem]") && uiSource.includes('vaultRowActionsClass'),
  'shared Vault action column uses fixed To Create-matched width',
);
assert(
  uiSource.includes('statusPipelinePillProps') && uiSource.includes('STATUS_PIPELINE_PILL_CLASS'),
  'shared status pipeline pill helper matches content-type pill treatment',
);
const ideaModalSource = readFileSync(
  new URL('../src/components/VideoIdeaModal.jsx', import.meta.url),
  'utf8',
);
assert(!ideaModalSource.includes('Client Comment'), 'idea editor hides client comments');
assert(ideaModalSource.includes('onDelete'), 'idea editor accepts Delete handler');
assert(ideaModalSource.includes('>Delete<') || ideaModalSource.includes('Delete\n'), 'idea editor exposes Delete for existing ideas');
assert(ideaModalSource.includes('Task Title'), 'idea editor Details use Task Title like calendar cards');
assert(ideaModalSource.includes('>Notes<') || ideaModalSource.includes('Notes</span>'), 'idea editor shows Notes on Details');
assert(!ideaModalSource.includes('Notes for Client'), 'idea editor no longer uses Notes for Client label');
assert(!ideaModalSource.includes('Idea Title'), 'idea editor no longer uses Idea Title label');
assert(ideaModalSource.includes('Editor points'), 'idea editor can set editor points on Details');
assert(ideaModalSource.includes('Make one-off project'), 'idea editor puts Make one-off project on Details');
{
  const makeOneOffIdx = ideaModalSource.indexOf('Make one-off project');
  const notesIdx = ideaModalSource.indexOf('Notes</span>');
  assert(
    makeOneOffIdx > 0 && notesIdx > makeOneOffIdx,
    'idea editor places Make one-off project above Notes',
  );
}
assert(
  !ideaModalSource.includes('>Make one-off<'),
  'idea editor no longer keeps Make one-off in the footer',
);
assert(
  ideaModalSource.includes('["references", "References"]') || ideaModalSource.includes("['references', 'References']"),
  'idea editor has a References tab',
);
assert(
  ideaModalSource.includes('activeTab === "references"') || ideaModalSource.includes("activeTab === 'references'"),
  'idea editor renders References tab content',
);
assert(
  ideaModalSource.includes('<ReferenceVideoLink') && ideaModalSource.includes('<ReferenceMusicLink'),
  'idea editor exposes clickable reference video and music links',
);
{
  const detailsIdx = ideaModalSource.indexOf('activeTab === "details"');
  const refsIdx = ideaModalSource.indexOf('activeTab === "references"');
  const refVideoInDetails =
    detailsIdx > 0 &&
    refsIdx > detailsIdx &&
    ideaModalSource.slice(detailsIdx, refsIdx).includes('Reference Video');
  assert(!refVideoInDetails, 'idea editor keeps reference video off Details');
}
assert(ideaModalSource.includes('MakeOneOffModal'), 'idea editor can open Make one-off modal');
assert(
  ideaModalSource.includes('isEdit ? "Save Changes" : "Share with Client"'),
  'idea editor edit footer uses Save Changes (not Done)',
);
assert(
  ideaModalSource.includes('flushEditSave') && ideaModalSource.includes('requestClose'),
  'idea editor flushes local draft on close in edit mode',
);
{
  const footerMarker = 'flex shrink-0 flex-wrap gap-2 border-t border-white/5 px-5 py-4';
  const footerIdx = ideaModalSource.indexOf(footerMarker);
  assert(footerIdx > 0, 'idea editor has a footer actions row');
  const footerSlice = ideaModalSource.slice(footerIdx, footerIdx + 900);
  const createOnlyIdx = footerSlice.indexOf('{!isEdit &&');
  const cancelIdx = footerSlice.indexOf('Cancel');
  assert(
    createOnlyIdx > 0 && cancelIdx > createOnlyIdx,
    'idea editor Cancel is gated behind create (!isEdit) — not shown on edit',
  );
}
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
assert(
  makeOneOffSource.includes('Team Tasks → Editors') || makeOneOffSource.includes('Start in'),
  'Make one-off modal explains Editing vs To Create placement',
);
const cardModalSource = readFileSync(new URL('../src/components/CardModal.jsx', import.meta.url), 'utf8');
assert(cardModalSource.includes('Make one-off project'), 'card editor exposes Make one-off project');
assert(cardModalSource.includes('MakeOneOffModal'), 'card editor opens Make one-off modal');
assert(
  cardModalSource.includes('Save Changes'),
  'card editor footer uses Save Changes when edits are not live-saved',
);
assert(
  !/>\s*Done\s*</.test(cardModalSource),
  'card editor footer no longer uses Done label',
);
assert(
  cardModalSource.includes('buildOneOffConversionUpdates'),
  'card editor uses shared one-off conversion helper',
);
assert(
  cardModalSource.includes('isOneOff || displayCard.contentType === \'Reel\''),
  'card editor shows editor points for one-offs and reels',
);
assert(
  cardModalSource.includes("['editing', 'in-review', 'not-approved', 'approved', 'scheduled']"),
  'card editor gates Video File Link to post-To Create stages',
);
const kanbanSource = readFileSync(new URL('../src/hooks/useKanban.js', import.meta.url), 'utf8');
assert(
  kanbanSource.includes('editorPoints: normalizeEditorPoints(idea.editorPoints)'),
  'scheduling an idea carries editor points onto the board card',
);
const ideasHookSource = readFileSync(new URL('../src/hooks/useVideoIdeas.js', import.meta.url), 'utf8');
assert(
  ideasHookSource.includes('editorPoints: 1'),
  'new ideas default to 1 editor point',
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
assert(
  videoIdeasUiSource.includes('onAddCard') && videoIdeasUiSource.includes('onAddOneOffTask'),
  'Vault accepts Add card and Add one-off handlers',
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
  shellSource.includes('onAddCard={() =>') && shellSource.includes("addCard('shoot'"),
  'AppShell wires Vault Add card into To Create',
);
assert(
  shellSource.includes('onAddOneOffTask={(data)') || shellSource.includes('onAddOneOffTask={'),
  'AppShell wires Vault Add one-off project',
);
assert(
  shellSource.includes("handleNavigate('shoot'"),
  'AppShell wires To Create shoot navigation',
);

console.log('Video idea vault tests passed.');
