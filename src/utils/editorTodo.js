import { COLUMNS } from '../constants';
import { toDateKey } from './calendar';

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

  const dateA = a.dueDate || '9999-99-99';
  const dateB = b.dueDate || '9999-99-99';
  if (dateA !== dateB) return dateA.localeCompare(dateB);

  const kindOrder = { edit: 0, oneoff: 1, approve: 2 };
  const kindDiff = (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9);
  if (kindDiff !== 0) return kindDiff;

  return (a.title || '').localeCompare(b.title || '');
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

  for (const task of tasks) {
    if (task.kind === 'approve') inReview.push(task);
    else editing.push(task);
  }

  return { editing, inReview };
}

export function filterEditorTasks(tasks, { search, assignee, client, includeCompleted = true }) {
  return tasks.filter((task) => {
    if (task.isOneOffProject && task.completed && !includeCompleted) return false;
    if (assignee && assignee !== 'all' && task.assignedTo !== assignee) return false;
    if (client && client !== 'all' && task.client !== client) return false;
    if (!search) return true;

    const q = search.toLowerCase();
    const haystack = [
      task.title,
      task.client,
      task.contentType,
      task.label,
      task.notes,
      task.clientComment,
      task.assignedTo,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}
