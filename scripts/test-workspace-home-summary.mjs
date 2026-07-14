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

function cardCountsAsEditorCompleted(card) {
  if (card.contentType === 'Story') return false;
  if (card.isOneOffProject) return card.columnId === 'finished';
  if (card.columnId === 'approved' || card.columnId === 'scheduled') return true;
  if (card.postedAt) return true;
  return false;
}

function isSameCalendarMonthDateKey(dateKey, referenceDate = new Date()) {
  if (!dateKey || typeof dateKey !== 'string') return false;
  const match = dateKey.trim().match(/^(\d{4})-(\d{2})-/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return year === referenceDate.getFullYear() && month === referenceDate.getMonth();
}

function getEditorCompletedScheduleDate(card) {
  if (card.isOneOffProject) return card.dueDate || card.shootDate || '';
  return card.dueDate || '';
}

function cardCountsAsEditorCompletedThisMonth(card, referenceDate = new Date()) {
  if (!cardCountsAsEditorCompleted(card)) return false;
  const scheduleDate = getEditorCompletedScheduleDate(card);
  if (!scheduleDate) return false;
  return isSameCalendarMonthDateKey(scheduleDate, referenceDate);
}

function buildEditorCompletedCount(cards, { assignee = 'all', referenceDate = new Date() } = {}) {
  return cards.filter((card) => {
    if (!cardCountsAsEditorCompletedThisMonth(card, referenceDate)) return false;
    if (assignee && assignee !== 'all' && card.assignedTo !== assignee) return false;
    return true;
  }).length;
}

function buildEditorCompletedByAssignee(cards, { editorNames = [], referenceDate = new Date() } = {}) {
  const displayNameByKey = new Map();
  const counts = new Map();
  const pointsByKey = new Map();
  const PAY_RATE = 70;

  const registerName = (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (!displayNameByKey.has(key)) displayNameByKey.set(key, trimmed);
    if (!counts.has(key)) counts.set(key, 0);
    if (!pointsByKey.has(key)) pointsByKey.set(key, 0);
  };

  for (const name of editorNames) registerName(name);

  for (const card of cards) {
    if (!cardCountsAsEditorCompletedThisMonth(card, referenceDate)) continue;
    const assignee = (card.assignedTo || '').trim();
    if (!assignee) continue;
    const key = assignee.toLowerCase();
    if (!displayNameByKey.has(key)) displayNameByKey.set(key, assignee);
    counts.set(key, (counts.get(key) || 0) + 1);
    if (card.contentType === 'Reel') {
      const pts = Number(card.editorPoints) === 0.5 ? 0.5 : 1;
      pointsByKey.set(key, (pointsByKey.get(key) || 0) + pts);
    }
  }

  return [...displayNameByKey.keys()]
    .map((key) => {
      const points = pointsByKey.get(key) || 0;
      return {
        name: displayNameByKey.get(key),
        count: counts.get(key) || 0,
        points,
        pay: points * PAY_RATE,
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
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
const now = new Date();
const thisMonth = Date.now();
const thisMonthDateKey = toDateKey(now);
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).getTime();
const lastMonthDateKey = toDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 15));

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
  {
    id: 'approved-jordan',
    columnId: 'approved',
    contentType: 'Reel',
    assignedTo: 'Jordan',
    dueDate: thisMonthDateKey,
    editorCompletedAt: thisMonth,
  },
  {
    id: 'approved-sam',
    columnId: 'approved',
    contentType: 'Reel',
    assignedTo: 'Sam',
    dueDate: thisMonthDateKey,
    editorCompletedAt: thisMonth,
    editorPoints: 0.5,
  },
  {
    id: 'scheduled-jordan',
    columnId: 'scheduled',
    contentType: 'Reel',
    assignedTo: 'Jordan',
    dueDate: thisMonthDateKey,
    editorCompletedAt: thisMonth,
  },
  {
    id: 'posted-jordan',
    columnId: 'approved',
    contentType: 'Reel',
    assignedTo: 'Jordan',
    dueDate: thisMonthDateKey,
    postedAt: thisMonth,
    editorCompletedAt: thisMonth,
  },
  {
    id: 'story-approved',
    columnId: 'approved',
    contentType: 'Story',
    assignedTo: 'Jordan',
    dueDate: thisMonthDateKey,
    editorCompletedAt: thisMonth,
  },
  {
    id: 'oneoff-finished',
    columnId: 'finished',
    contentType: 'Reel',
    assignedTo: 'Jordan',
    isOneOffProject: true,
    dueDate: thisMonthDateKey,
    editorCompletedAt: thisMonth,
  },
  {
    id: 'approved-last-month',
    columnId: 'approved',
    contentType: 'Reel',
    assignedTo: 'Jordan',
    dueDate: lastMonthDateKey,
    editorCompletedAt: lastMonth,
  },
  {
    id: 'approved-no-date',
    columnId: 'approved',
    contentType: 'Reel',
    assignedTo: 'Jordan',
    editorCompletedAt: thisMonth,
  },
];

assert(buildShootsTodayCount(cards) === 1, 'shoots today counts only To Create cards');

const companyEditor = buildEditorQueueCounts(cards, { assignee: 'all' });
assert(companyEditor.editingCount === 3, 'company editor editing count uses editor task rules');
assert(companyEditor.editorInReviewCount === 1, 'company editor in-review count is included');

const personalEditor = buildEditorQueueCounts(cards, { assignee: 'Jordan' });
assert(personalEditor.editingCount === 2, 'personal editor count respects assignee');
assert(personalEditor.editorInReviewCount === 1, 'personal in-review count respects assignee');

const companyEdited = buildEditorCompletedCount(cards, { assignee: 'all' });
assert(companyEdited === 5, 'company edited count includes only posts scheduled this month');

const personalEdited = buildEditorCompletedCount(cards, { assignee: 'Jordan' });
assert(personalEdited === 4, 'personal edited count respects assignee and excludes stories');

const byAssignee = buildEditorCompletedByAssignee(cards, {
  editorNames: ['Jordan', 'Sam', 'Alex'],
});
assert(byAssignee.length === 3, 'lists each configured editor');
assert(byAssignee[0].name === 'Jordan' && byAssignee[0].count === 4, 'Jordan leads scheduled count this month');
assert(byAssignee[0].points === 4 && byAssignee[0].pay === 280, 'Jordan reel points default to 1 each');
assert(byAssignee[1].name === 'Sam' && byAssignee[1].count === 1, 'Sam second in scheduled breakdown');
assert(byAssignee[1].points === 0.5 && byAssignee[1].pay === 35, 'half-point reels pay $35');
assert(byAssignee[2].name === 'Alex' && byAssignee[2].count === 0, 'editors with no scheduled posts still listed');
assert(byAssignee[2].points === 0, 'editors with no reels have zero points');

const lastMonthOnly = buildEditorCompletedCount(
  [
    {
      id: 'old',
      columnId: 'approved',
      contentType: 'Reel',
      assignedTo: 'Jordan',
      dueDate: lastMonthDateKey,
      editorCompletedAt: lastMonth,
    },
  ],
  { assignee: 'Jordan' },
);
assert(lastMonthOnly === 0, 'posts scheduled for last month are excluded');

const approvedNoDate = buildEditorCompletedCount(
  [{ id: 'no-date', columnId: 'approved', contentType: 'Reel', assignedTo: 'Jordan', editorCompletedAt: thisMonth }],
  { assignee: 'Jordan' },
);
assert(approvedNoDate === 0, 'approved posts without a schedule date are excluded');

console.log('Workspace home summary tests passed.');
