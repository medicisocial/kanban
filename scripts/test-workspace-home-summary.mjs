/**
 * Overview counts should match Team tasks queue rules.
 */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isToday(dateKey) {
  return dateKey === toDateKey(new Date());
}

function getEditorTaskKind(columnId) {
  if (columnId === 'editing' || columnId === 'not-approved') return 'edit';
  if (columnId === 'in-review') return 'approve';
  return null;
}

function buildBoardEditorTasks(cards) {
  const tasks = [];
  for (const card of cards) {
    if (card.contentType === 'Story') continue;
    if (card.columnId === 'approved') continue;
    const kind = getEditorTaskKind(card.columnId);
    if (!kind) continue;
    tasks.push({ ...card, kind, assignedTo: card.assignedTo || '' });
  }
  return tasks;
}

function filterEditorTasks(tasks, { assignee, includeCompleted = true }) {
  return tasks.filter((task) => {
    if (task.completed && !includeCompleted) return false;
    if (assignee && assignee !== 'all' && task.assignedTo !== assignee) return false;
    return true;
  });
}

function splitEditorTasksByQueue(tasks) {
  const editing = [];
  const inReview = [];
  for (const task of tasks) {
    if (task.kind === 'approve') inReview.push(task);
    else editing.push(task);
  }
  return { editing, inReview };
}

function buildEditorQueueCounts(cards, { assignee = 'all', includeCompleted = false } = {}) {
  const editorTasks = filterEditorTasks(buildBoardEditorTasks(cards), {
    assignee,
    includeCompleted,
  });
  const { editing, inReview } = splitEditorTasksByQueue(editorTasks);
  return {
    editingCount: editing.length,
    editorInReviewCount: inReview.length,
  };
}

function buildShootsTodayCount(cards) {
  return cards.filter(
    (card) =>
      card.columnId === 'shoot' &&
      card.shootDate &&
      isToday(card.shootDate) &&
      card.contentType !== 'Story',
  ).length;
}

const today = toDateKey(new Date());

const cards = [
  {
    id: 'shoot-today',
    columnId: 'shoot',
    shootDate: today,
    contentType: 'Reel',
    assignedTo: 'Jordan',
  },
  {
    id: 'handed-off',
    columnId: 'editing',
    shootDate: today,
    contentType: 'Reel',
    assignedTo: 'Jordan',
  },
  {
    id: 'edit-a',
    columnId: 'editing',
    contentType: 'Reel',
    assignedTo: 'Jordan',
  },
  {
    id: 'edit-b',
    columnId: 'editing',
    contentType: 'Reel',
    assignedTo: 'Sam',
  },
  {
    id: 'review-a',
    columnId: 'in-review',
    contentType: 'Reel',
    assignedTo: 'Jordan',
  },
];

assert(buildShootsTodayCount(cards) === 1, 'shoots today counts only To Create cards');

const companyEditor = buildEditorQueueCounts(cards, { assignee: 'all' });
assert(companyEditor.editingCount === 3, 'company editor editing count uses editor task rules');
assert(companyEditor.editorInReviewCount === 1, 'company editor in-review count is included');

const personalEditor = buildEditorQueueCounts(cards, { assignee: 'Jordan' });
assert(personalEditor.editingCount === 2, 'personal editor count respects assignee');
assert(personalEditor.editorInReviewCount === 1, 'personal in-review count respects assignee');

console.log('Workspace home summary tests passed.');
