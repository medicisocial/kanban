import { toDateKey } from './calendar';
import { formatEditorDateLabel } from './editorTodo';

export function buildAdminTodoTasks(tasks) {
  return tasks
    .map((task) => ({
      id: task.id,
      title: task.title,
      client: task.client || 'General',
      dueDate: task.dueDate || '',
      assignedTo: task.assignedTo || '',
      notes: task.description || '',
      completed: Boolean(task.completed),
      completedAt: task.completedAt || null,
    }))
    .sort(compareAdminTasks);
}

export function compareAdminTasks(a, b) {
  const dateA = a.dueDate || '9999-99-99';
  const dateB = b.dueDate || '9999-99-99';
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return (a.title || '').localeCompare(b.title || '');
}

export function groupAdminTasksByDate(tasks, todayKey = toDateKey(new Date())) {
  const groups = [];
  let currentKey = null;

  for (const task of tasks) {
    let groupKey = task.dueDate || 'no-date';
    let groupLabel = task.dueDate
      ? formatEditorDateLabel(task.dueDate, todayKey)
      : 'No date set';

    if (task.dueDate && task.dueDate < todayKey && !task.completed) {
      groupKey = 'overdue';
      groupLabel = 'Overdue';
    }

    if (groupKey !== currentKey) {
      currentKey = groupKey;
      groups.push({ key: groupKey, label: groupLabel, tasks: [] });
    }
    groups[groups.length - 1].tasks.push(task);
  }

  return groups;
}

export function filterAdminTasks(tasks, { search, client, assignee, includeCompleted = true }) {
  return tasks.filter((task) => {
    if (task.completed && !includeCompleted) return false;
    if (assignee && assignee !== 'all' && task.assignedTo !== assignee) return false;
    if (client && client !== 'all' && task.client !== client) return false;
    if (!search) return true;

    const q = search.toLowerCase();
    const haystack = [task.title, task.client, task.notes, task.assignedTo].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}
