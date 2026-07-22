/**
 * Account manager "Set post date" task rules.
 */
import { readFileSync } from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SCHEDULED_POST_CONTENT_TYPES = ['Reel', 'Carousel', 'Static Post'];
const POST_DATE_TASK_COLUMN_IDS = ['shoot', 'editing', 'not-approved', 'in-review'];

function isScheduledPostType(contentType) {
  return SCHEDULED_POST_CONTENT_TYPES.includes(contentType);
}

function cardNeedsPostDate(card) {
  if (card.isOneOffProject || card.contentType === 'One-off Project') return false;
  if (!isScheduledPostType(card.contentType)) return false;
  if (String(card.dueDate || '').trim()) return false;
  if (card.postedAt) return false;
  if (card.columnId === 'finished') return false;
  if (!POST_DATE_TASK_COLUMN_IDS.includes(card.columnId)) return false;
  return true;
}

function buildSetPostDateTasks(cards) {
  return cards.filter((card) => cardNeedsPostDate(card)).map((card) => ({
    cardId: card.id,
    columnId: card.columnId,
  }));
}

const reel = {
  id: 'reel-1',
  title: 'Summer promo',
  client: 'Plume',
  contentType: 'Reel',
  dueDate: '',
  postedAt: null,
  isOneOffProject: false,
};

assert(POST_DATE_TASK_COLUMN_IDS.includes('editing'), 'editing is a post-date task column');

assert(cardNeedsPostDate({ ...reel, columnId: 'shoot' }), 'To Create reel without post date qualifies');
assert(
  cardNeedsPostDate({ ...reel, columnId: 'editing' }),
  'Editing reel without post date qualifies after handoff',
);
assert(
  cardNeedsPostDate({ ...reel, columnId: 'not-approved' }),
  'Not approved reel without post date qualifies',
);
assert(
  !cardNeedsPostDate({ ...reel, columnId: 'editing', dueDate: '2026-06-15' }),
  'Editing reel with post date is excluded',
);
assert(
  !cardNeedsPostDate({ ...reel, columnId: 'approved' }),
  'Approved reels use the schedule queue instead',
);
assert(
  !cardNeedsPostDate({ ...reel, columnId: 'scheduled' }),
  'Scheduled reels use other AM queues',
);
assert(!cardNeedsPostDate({ ...reel, columnId: 'shoot', contentType: 'Story' }), 'Stories are excluded');

const tasks = buildSetPostDateTasks([
  { ...reel, id: 'shoot-card', columnId: 'shoot' },
  { ...reel, id: 'edit-card', columnId: 'editing' },
  { ...reel, id: 'dated-card', columnId: 'editing', dueDate: '2026-06-12' },
]);
assert(
  tasks.some((task) => task.cardId === 'edit-card'),
  'buildSetPostDateTasks includes editing cards missing a post date',
);
assert(
  tasks.some((task) => task.cardId === 'shoot-card'),
  'buildSetPostDateTasks includes To Create cards missing a post date',
);
assert(
  !tasks.some((task) => task.cardId === 'dated-card'),
  'buildSetPostDateTasks skips cards that already have a post date',
);

const editorTodoSource = readFileSync(new URL('../src/components/EditorTodo.jsx', import.meta.url), 'utf8');
assert(editorTodoSource.includes("useState('editing')"), 'editor task tabs default to Needs editing');
assert(
  editorTodoSource.includes("['review', 'In review', approveCount]"),
  'editor tasks expose In review as a tab',
);
assert(
  editorTodoSource.includes("activeQueue === 'editing'"),
  'editor renders only the selected task queue',
);
assert(
  editorTodoSource.includes('`${btnPrimaryClass} !px-4 !py-1.5 !text-xs !tracking-wider`'),
  'editor tabs reuse Vault selected styling',
);
assert(editorTodoSource.includes('onAddCard'), 'editor supports manual board card add');
assert(editorTodoSource.includes('+ Add card'), 'editor exposes Add card control');
assert(
  editorTodoSource.includes('task.label') && editorTodoSource.includes('kindStyles'),
  'editor cards show Edit / In review kind pills',
);

const accountTodoSource = readFileSync(
  new URL('../src/components/AccountManagerTodo.jsx', import.meta.url),
  'utf8',
);
assert(accountTodoSource.includes("useState('post-date')"), 'account manager tabs default to Set post date');
assert(
  accountTodoSource.includes("['review', 'In review', orderedInReviewTasks.length]"),
  'account manager exposes In review as a tab',
);
assert(
  accountTodoSource.includes("kindStyles['set-post-date']"),
  'set post date cards show Set post date kind pill',
);
assert(
  accountTodoSource.includes('inReviewKindStyle'),
  'in review cards show In review kind pill',
);
assert(
  (accountTodoSource.match(/\{task\.label\}/g) || []).length >= 4,
  'AM cards show kind labels for set post date, in review, approved schedule, and publish/story',
);
assert(
  accountTodoSource.includes('Mark scheduled'),
  'Posts & content action uses Mark scheduled label',
);
assert(
  accountTodoSource.includes("['stories', 'Stories to post', orderedStoryTasks.length]"),
  'account manager exposes Stories to post as a tab',
);
assert(
  accountTodoSource.includes("['posts', 'Posts & content', visiblePostsTasks.length]"),
  'account manager exposes Posts & content as a tab',
);
assert(
  accountTodoSource.includes('`${btnPrimaryClass} !px-4 !py-1.5 !text-xs !tracking-wider`'),
  'account tabs reuse Vault selected styling',
);
assert(
  (accountTodoSource.match(/onOpen=\{openCard\}/g) || []).length >= 4,
  'all account manager task card types open from the full card',
);
assert(accountTodoSource.includes('onAddCard'), 'AM todo accepts onAddCard for creating cards');
assert(accountTodoSource.includes('+ Add card'), 'AM todo exposes Add card control');
assert(
  accountTodoSource.includes('matchAccountManager: !restrictAssigneeFilter'),
  'personal AM queues skip card accountManager name match',
);

const teamCardSource = readFileSync(new URL('../src/components/TeamTaskCard.jsx', import.meta.url), 'utf8');
assert(teamCardSource.includes('openFromTaskCard'), 'shared team cards support row-open clicks');
assert(
  teamCardSource.includes("closest('button, a, input, select, textarea, label')"),
  'row-open ignores interactive controls',
);

const companyTasksSource = readFileSync(
  new URL('../src/components/CompanyTasks.jsx', import.meta.url),
  'utf8',
);
assert(
  companyTasksSource.includes('onAddCard={onAddToCreateCard}'),
  'AM tab wires Add card to to-create card creation',
);

// Pure filter behavior (mirrors accountManagerTodo / editorTodo — avoid Vite-only imports).
function filterAccountManagerTasks(tasks, { client, assignee, matchAccountManager = true } = {}) {
  return tasks.filter((task) => {
    if (client && client !== 'all' && task.client !== client) return false;
    if (
      matchAccountManager &&
      assignee &&
      assignee !== 'all' &&
      task.accountManager !== assignee
    ) {
      return false;
    }
    return true;
  });
}
function filterEditorTasks(tasks, { assignee, client } = {}) {
  return tasks.filter((task) => {
    if (assignee && assignee !== 'all' && task.assignedTo !== assignee) return false;
    if (client && client !== 'all' && task.client !== client) return false;
    return true;
  });
}

const arcoTasks = [
  {
    id: '1',
    client: 'Arco Fit',
    accountManager: 'Valerie Landeros',
    assignedTo: 'Jordan Nguyen',
  },
  {
    id: '2',
    client: 'Arco Fit',
    accountManager: '',
    assignedTo: 'Jeslyn Nguyen',
  },
  {
    id: '3',
    client: 'Plume',
    accountManager: 'Jeslyn Nguyen',
    assignedTo: 'Jeslyn Nguyen',
  },
];

const jeslynAmVisible = filterAccountManagerTasks(arcoTasks, {
  client: 'all',
  assignee: 'Jeslyn Nguyen',
  matchAccountManager: false,
});
assert(jeslynAmVisible.length === 3, 'allowlist-scoped AM queue shows all clients regardless of card AM');
assert(
  jeslynAmVisible.some((t) => t.accountManager === 'Valerie Landeros'),
  'Jeslyn sees Arco AM tasks even when card accountManager is Valerie',
);

const leadershipAmFilter = filterAccountManagerTasks(arcoTasks, {
  client: 'all',
  assignee: 'Jeslyn Nguyen',
  matchAccountManager: true,
});
assert(
  leadershipAmFilter.length === 1,
  'company-wide AM filter still matches exact accountManager when enabled',
);

const jeslynEditorVisible = filterEditorTasks(arcoTasks, {
  assignee: 'Jeslyn Nguyen',
  client: 'all',
});
assert(jeslynEditorVisible.length === 2, 'editor tab only shows assignedTo === Jeslyn');
assert(
  !jeslynEditorVisible.some((t) => t.assignedTo === 'Jordan Nguyen'),
  'editor filter untouched — Jordan-assigned cards hidden from Jeslyn editor queue',
);

const editorTodoSourceCheck = readFileSync(
  new URL('../src/utils/editorTodo.js', import.meta.url),
  'utf8',
);
assert(
  editorTodoSourceCheck.includes('task.assignedTo !== assignee'),
  'editor filter still keys off assignedTo only',
);
assert(
  !editorTodoSourceCheck.includes('matchAccountManager'),
  'editor filter does not use AM allowlist match flag',
);

const amUtilSource = readFileSync(
  new URL('../src/utils/accountManagerTodo.js', import.meta.url),
  'utf8',
);
assert(
  amUtilSource.includes('matchAccountManager = true'),
  'AM filter supports matchAccountManager flag',
);

console.log('Account manager todo tests passed.');
