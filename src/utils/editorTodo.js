import { toDateKey } from './calendar';

export const EDIT_TASK_COLUMNS = ['editing', 'not-approved'];
export const APPROVE_TASK_COLUMNS = ['in-review'];
export const ONE_OFF_TASK_COLUMNS = ['editing', 'finished'];

export function getEditorTaskKind(columnId, isOneOffProject = false) {
  if (isOneOffProject && ONE_OFF_TASK_COLUMNS.includes(columnId)) return 'oneoff';
  if (EDIT_TASK_COLUMNS.includes(columnId)) return 'edit';
  if (APPROVE_TASK_COLUMNS.includes(columnId)) return 'approve';
  return null;
}

export function getEditorTaskLabel(columnId, isOneOffProject = false) {
  if (isOneOffProject) return 'One-off';
  if (columnId === 'editing') return 'Edit';
  if (columnId === 'not-approved') return 'Revise';
  if (columnId === 'in-review') return 'Review / Approve';
  return 'Task';
}

function getTaskSortDate(card) {
  return card.dueDate || card.shootDate || '';
}

function buildOneOffBoardTask(card) {
  return {
    id: `board-${card.id}`,
    source: 'board',
    cardId: card.id,
    kind: 'oneoff',
    label: 'One-off',
    title: card.title,
    client: card.client,
    contentType: card.contentType,
    columnId: card.columnId,
    dueDate: getTaskSortDate(card),
    assignedTo: card.assignedTo || '',
    notes: card.notes || '',
    clientComment: card.clientComment || '',
    completed: card.columnId === 'finished',
    card,
  };
}

export function buildBoardEditorTasks(cards) {
  const tasks = [];

  for (const card of cards) {
    if (card.contentType === 'Story') continue;

    if (card.isOneOffProject) {
      if (card.columnId === 'editing' || card.columnId === 'finished') {
        tasks.push(buildOneOffBoardTask(card));
      }
      continue;
    }

    const kind = getEditorTaskKind(card.columnId);
    if (!kind) continue;

    tasks.push({
      id: `board-${card.id}`,
      source: 'board',
      cardId: card.id,
      kind,
      label: getEditorTaskLabel(card.columnId),
      title: card.title,
      client: card.client,
      contentType: card.contentType,
      columnId: card.columnId,
      dueDate: getTaskSortDate(card),
      assignedTo: card.assignedTo || '',
      notes: card.notes || '',
      clientComment: card.clientComment || '',
      card,
    });
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

    if (task.kind === 'oneoff' && !task.dueDate) {
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

export function filterEditorTasks(tasks, { search, assignee, client, includeCompleted = true }) {
  return tasks.filter((task) => {
    if (task.kind === 'oneoff' && task.completed && !includeCompleted) return false;
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
