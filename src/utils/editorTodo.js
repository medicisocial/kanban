import { COLUMNS } from '../constants';
import { toDateKey } from './calendar';
import { matchesClientFilter } from './clients';

export const EDIT_TASK_COLUMNS = ['editing', 'not-approved'];
export const APPROVE_TASK_COLUMNS = ['in-review'];
export const ONE_OFF_EDITOR_COLUMNS = ['editing', 'in-review', 'finished'];

export const REGULAR_EDITOR_STATUS_COLUMN_IDS = [
  'shoot',
  'editing',
  'in-review',
  'not-approved',
  'approved',
  'scheduled',
];

export const ONE_OFF_STATUS_COLUMN_IDS = [
  'editing',
  'in-review',
  'approved',
  'finished',
];

export function getEditorTaskStatusOptions(isOneOffProject = false) {
  const allowed = isOneOffProject ? ONE_OFF_STATUS_COLUMN_IDS : REGULAR_EDITOR_STATUS_COLUMN_IDS;
  return COLUMNS.filter((col) => allowed.includes(col.id));
}

export function buildSendBackForEditingUpdates(card, comment = '') {
  const trimmed = (comment || '').trim();
  const updates = {
    columnId: 'editing',
    status: 'Editing',
    editorCompletedAt: null,
  };

  if (trimmed) {
    const stamp = new Date().toLocaleDateString();
    updates.clientComment = trimmed;
    updates.notes = `${card.notes || ''}\n\nRevision notes (${stamp}): ${trimmed}`.trim();
  }

  return updates;
}

export function getEditorTaskKind(columnId) {
  if (EDIT_TASK_COLUMNS.includes(columnId)) return 'edit';
  if (APPROVE_TASK_COLUMNS.includes(columnId)) return 'approve';
  return null;
}

export function getEditorTaskLabel(columnId, isOneOffProject = false) {
  if (columnId === 'editing') return isOneOffProject ? 'One-off · Edit' : 'Edit';
  if (columnId === 'not-approved') return isOneOffProject ? 'One-off · Revise' : 'Revise';
  if (columnId === 'in-review') return isOneOffProject ? 'One-off · Review' : 'In review';
  if (columnId === 'approved') return 'One-off · Approved';
  if (columnId === 'finished') return 'One-off · Finished';
  return 'Task';
}

function getTaskSortDate(card) {
  return card.dueDate || card.shootDate || '';
}

function buildEditorTaskFromCard(card, overrides = {}) {
  return {
    id: `board-${card.id}`,
    source: 'board',
    cardId: card.id,
    title: card.title,
    client: card.client,
    contentType: card.contentType,
    columnId: card.columnId,
    dueDate: getTaskSortDate(card),
    dueTime: card.dueTime || '',
    postDate: card.dueDate || '',
    assignedTo: card.assignedTo || '',
    notes: card.notes || '',
    clientComment: card.clientComment || '',
    isOneOffProject: Boolean(card.isOneOffProject),
    card,
    ...overrides,
  };
}

export function buildBoardEditorTasks(cards) {
  const tasks = [];

  for (const card of cards) {
    if (card.contentType === 'Story') continue;
    if (card.columnId === 'approved') continue;

    if (card.isOneOffProject) {
      if (!ONE_OFF_EDITOR_COLUMNS.includes(card.columnId)) continue;

      if (card.columnId === 'finished') {
        tasks.push(
          buildEditorTaskFromCard(card, {
            kind: 'oneoff',
            label: getEditorTaskLabel('finished', true),
            completed: true,
          }),
        );
        continue;
      }

      const kind = getEditorTaskKind(card.columnId);
      if (!kind) continue;

      tasks.push(
        buildEditorTaskFromCard(card, {
          kind,
          label: getEditorTaskLabel(card.columnId, true),
        }),
      );
      continue;
    }

    const kind = getEditorTaskKind(card.columnId);
    if (!kind) continue;

    tasks.push(
      buildEditorTaskFromCard(card, {
        kind,
        label: getEditorTaskLabel(card.columnId),
      }),
    );
  }

  return tasks;
}

export function applyEditorTaskOrder(tasks, orderIds = []) {
  if (!orderIds.length) {
    return [...tasks].sort(compareEditorTasks);
  }

  const orderMap = new Map(orderIds.map((id, index) => [id, index]));
  return [...tasks].sort((a, b) => {
    const aIndex = orderMap.has(a.id) ? orderMap.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bIndex = orderMap.has(b.id) ? orderMap.get(b.id) : Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return compareEditorTasks(a, b);
  });
}

export function syncEditorTaskOrder(orderIds, taskIds) {
  const next = orderIds.filter((id) => taskIds.includes(id));
  for (const id of taskIds) {
    if (!next.includes(id)) next.push(id);
  }
  return next;
}

export function buildInitialTaskOrder(tasks) {
  return [...tasks].sort(compareEditorTasks).map((task) => task.id);
}

export function compareEditorTasks(a, b) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;

  const keyA = getEditorPostSortKey(a);
  const keyB = getEditorPostSortKey(b);
  if (keyA !== keyB) return keyA.localeCompare(keyB);

  return (a.title || '').localeCompare(b.title || '');
}

function getEditorPostSortKey(task) {
  if (!task.postDate) return '9999-99-99T99:99';
  const time = task.dueTime || '99:99';
  return `${task.postDate}T${time}`;
}

export function groupEditorTasksByDate(tasks, todayKey = toDateKey(new Date())) {
  const groups = [];
  let currentKey = null;

  for (const task of tasks) {
    let groupKey = task.dueDate || 'no-date';
    let groupLabel = task.dueDate
      ? formatEditorDateLabel(task.dueDate, todayKey)
      : 'No date set';

    if (task.isOneOffProject && !task.dueDate) {
      groupKey = 'no-date';
      groupLabel = 'No posting date';
    } else if (task.dueDate && task.dueDate < todayKey) {
      groupKey = 'overdue';
      groupLabel = 'Overdue';
    }

    if (groupKey !== currentKey) {
      currentKey = groupKey;
      groups.push({ key: groupKey, label: groupLabel, date: task.dueDate || '', tasks: [] });
    }
    groups[groups.length - 1].tasks.push(task);
  }

  return groups;
}

export function formatEditorDateLabel(dateKey, todayKey = toDateKey(new Date())) {
  const date = new Date(`${dateKey}T12:00:00`);
  const formatted = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (dateKey === todayKey) return `Today · ${formatted}`;
  return formatted;
}

export function splitEditorTasksByQueue(tasks) {
  const editing = [];
  const inReview = [];
  const finished = [];

  for (const task of tasks) {
    if (task.completed) finished.push(task);
    else if (task.kind === 'approve') inReview.push(task);
    else editing.push(task);
  }

  return { editing, inReview, finished };
}

export function filterEditorTasks(tasks, { assignee, client, includeCompleted = true }) {
  return tasks.filter((task) => {
    if (task.isOneOffProject && task.completed && !includeCompleted) return false;
    if (assignee && assignee !== 'all' && task.assignedTo !== assignee) return false;
    if (!matchesClientFilter(task.client, client)) return false;
    return true;
  });
}

const EDITOR_COMPLETED_COLUMN_IDS = ['approved', 'scheduled'];

export function cardCountsAsEditorCompleted(card) {
  if (card.contentType === 'Story') return false;
  if (card.isOneOffProject) return card.columnId === 'finished';
  if (EDITOR_COMPLETED_COLUMN_IDS.includes(card.columnId)) return true;
  if (card.postedAt) return true;
  return false;
}

export function isSameCalendarMonth(timestamp, referenceDate = new Date()) {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth()
  );
}

export function getEditorCompletedAt(card) {
  if (card.editorCompletedAt) return card.editorCompletedAt;
  if (card.postedAt) return card.postedAt;
  if (cardCountsAsEditorCompleted(card)) {
    return card.updatedAt || card.createdAt || null;
  }
  return null;
}

export function cardCountsAsEditorCompletedThisMonth(card, referenceDate = new Date()) {
  if (!cardCountsAsEditorCompleted(card)) return false;
  return isSameCalendarMonth(getEditorCompletedAt(card), referenceDate);
}

export function buildEditorCompletionStampUpdates(card, targetColumnId) {
  const wasCompleted = cardCountsAsEditorCompleted(card);
  const willBeCompleted = cardCountsAsEditorCompleted({
    ...card,
    columnId: targetColumnId,
  });

  if (willBeCompleted && !wasCompleted) {
    return { editorCompletedAt: Date.now() };
  }
  if (!willBeCompleted && wasCompleted) {
    return { editorCompletedAt: null };
  }
  return {};
}

function matchesEditorAssignee(card, assignee) {
  if (!assignee || assignee === 'all') return true;
  const normalized = assignee.trim().toLowerCase();
  return (card.assignedTo || '').trim().toLowerCase() === normalized;
}

export function getEditorCompletedStatusLabel(card) {
  if (card.postedAt) return 'Posted';
  if (card.isOneOffProject && card.columnId === 'finished') return 'Finished';
  const column = COLUMNS.find((col) => col.id === card.columnId);
  return column?.title || card.status || 'Completed';
}

export function buildEditorCompletedCards(
  cards,
  { clientFilter = 'all', assignee = 'all', referenceDate = new Date() } = {},
) {
  return cards
    .filter((card) => {
      if (!cardCountsAsEditorCompletedThisMonth(card, referenceDate)) return false;
      if (!matchesEditorAssignee(card, assignee)) return false;
      if (!matchesClientFilter(card.client, clientFilter)) return false;
      return true;
    })
    .sort((a, b) => (getEditorCompletedAt(b) || 0) - (getEditorCompletedAt(a) || 0));
}

export function buildEditorCompletedCount(
  cards,
  options = {},
) {
  return buildEditorCompletedCards(cards, options).length;
}

export function buildEditorCompletedByAssignee(
  cards,
  { clientFilter = 'all', editorNames = [], referenceDate = new Date() } = {},
) {
  const displayNameByKey = new Map();
  const counts = new Map();

  const registerName = (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (!displayNameByKey.has(key)) displayNameByKey.set(key, trimmed);
    if (!counts.has(key)) counts.set(key, 0);
  };

  for (const name of editorNames) registerName(name);

  for (const card of cards) {
    if (!cardCountsAsEditorCompletedThisMonth(card, referenceDate)) continue;
    if (!matchesClientFilter(card.client, clientFilter)) continue;
    const assignee = (card.assignedTo || '').trim();
    if (!assignee) continue;
    const key = assignee.toLowerCase();
    if (!displayNameByKey.has(key)) displayNameByKey.set(key, assignee);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...displayNameByKey.keys()]
    .map((key) => ({
      name: displayNameByKey.get(key),
      count: counts.get(key) || 0,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
}
