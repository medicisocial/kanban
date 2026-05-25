import { toDateKey } from './calendar';

export const EDIT_TASK_COLUMNS = ['editing', 'not-approved'];
export const APPROVE_TASK_COLUMNS = ['in-review', 'approved'];

export function getEditorTaskKind(columnId) {
  if (EDIT_TASK_COLUMNS.includes(columnId)) return 'edit';
  if (APPROVE_TASK_COLUMNS.includes(columnId)) return 'approve';
  return null;
}

export function getEditorTaskLabel(columnId) {
  if (columnId === 'editing') return 'Edit';
  if (columnId === 'not-approved') return 'Revise';
  if (columnId === 'in-review') return 'Review / Approve';
  if (columnId === 'approved') return 'Finalize';
  return 'Task';
}

function getTaskSortDate(card) {
  return card.dueDate || card.shootDate || '';
}

export function buildBoardEditorTasks(cards) {
  const tasks = [];

  for (const card of cards) {
    if (card.contentType === 'Story') continue;

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

export function buildOneOffEditorTask(task) {
  return {
    id: task.id,
    source: 'oneoff',
    cardId: null,
    kind: 'oneoff',
    label: 'One-off',
    title: task.title,
    client: task.projectName,
    projectName: task.projectName,
    contentType: '',
    columnId: '',
    dueDate: task.dueDate || '',
    assignedTo: task.assignedTo || '',
    notes: task.description || '',
    clientComment: '',
    completed: Boolean(task.completed),
    completedAt: task.completedAt || null,
  };
}

export function compareEditorTasks(a, b) {
  const dateA = a.dueDate || '9999-99-99';
  const dateB = b.dueDate || '9999-99-99';
  if (dateA !== dateB) return dateA.localeCompare(dateB);

  const kindOrder = { edit: 0, approve: 1, oneoff: 2 };
  const kindDiff = (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9);
  if (kindDiff !== 0) return kindDiff;

  return (a.title || '').localeCompare(b.title || '');
}

export function groupEditorTasksByDate(tasks, todayKey = toDateKey(new Date())) {
  const sorted = [...tasks].sort(compareEditorTasks);
  const groups = [];
  let currentKey = null;

  for (const task of sorted) {
    let groupKey = task.dueDate || 'no-date';
    let groupLabel = task.dueDate
      ? formatEditorDateLabel(task.dueDate, todayKey)
      : 'No date set';

    if (task.dueDate && task.dueDate < todayKey) {
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
    if (task.source === 'oneoff' && task.completed && !includeCompleted) return false;
    if (assignee && assignee !== 'all' && task.assignedTo !== assignee) return false;
    if (client && client !== 'all' && task.source === 'board' && task.client !== client) return false;
    if (!search) return true;

    const q = search.toLowerCase();
    const haystack = [
      task.title,
      task.client,
      task.projectName,
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
