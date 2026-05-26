import {
  isStoryOccurrenceDue,
  toDateKey,
  withStoryOccurrence,
} from './calendar';
import { formatEditorDateLabel } from './editorTodo';

export function resolveAccountManager(card, clientAccountManagers = {}) {
  return card.accountManager || clientAccountManagers[card.client] || '';
}

function buildScheduleTask(card, clientAccountManagers) {
  return {
    id: `schedule-${card.id}`,
    source: 'board',
    cardId: card.id,
    kind: 'schedule',
    label: 'Approved',
    title: card.title,
    client: card.client,
    contentType: card.contentType,
    columnId: card.columnId,
    taskDate: '',
    dueDate: card.dueDate || '',
    dueTime: card.dueTime || '',
    assignedTo: card.assignedTo || '',
    accountManager: resolveAccountManager(card, clientAccountManagers),
    notes: card.notes || '',
    card,
  };
}

function buildPublishTask(card, taskDate, clientAccountManagers) {
  const isStory = card.contentType === 'Story';
  const occurrenceCard = isStory ? withStoryOccurrence(card, taskDate) : card;

  return {
    id: isStory ? `post-${card.id}-${taskDate}` : `publish-${card.id}-${taskDate}`,
    source: 'board',
    cardId: card.id,
    kind: isStory ? 'post-story' : 'publish',
    label: isStory ? 'Post story' : 'Publish',
    title: card.title,
    client: card.client,
    contentType: card.contentType,
    columnId: card.columnId,
    taskDate,
    dueDate: taskDate,
    dueTime: card.dueTime || '',
    assignedTo: card.assignedTo || '',
    accountManager: resolveAccountManager(card, clientAccountManagers),
    notes: occurrenceCard.notes || '',
    card: occurrenceCard,
  };
}

function buildInReviewTask(card, clientAccountManagers) {
  return {
    id: `review-${card.id}`,
    source: 'board',
    cardId: card.id,
    kind: 'in-review',
    label: 'In review',
    title: card.title,
    client: card.client,
    contentType: card.contentType,
    columnId: card.columnId,
    taskDate: card.dueDate || '',
    dueDate: card.dueDate || '',
    dueTime: card.dueTime || '',
    assignedTo: card.assignedTo || '',
    accountManager: resolveAccountManager(card, clientAccountManagers),
    notes: card.notes || '',
    clientComment: card.clientComment || '',
    isOneOffProject: Boolean(card.isOneOffProject),
    card,
  };
}

/** Cards in In Review — same queue as the editor task page. */
export function buildInReviewTasks(cards, clientAccountManagers = {}) {
  const tasks = [];

  for (const card of cards) {
    if (card.contentType === 'Story') continue;
    if (card.columnId !== 'in-review') continue;
    tasks.push(buildInReviewTask(card, clientAccountManagers));
  }

  return tasks.sort(compareAccountManagerTasks);
}

/** Scheduled stories that need to be posted on a given day (usually today). */
export function buildStoryTasksToday(cards, todayKey = toDateKey(new Date()), clientAccountManagers = {}) {
  const tasks = [];

  for (const card of cards) {
    if (card.contentType !== 'Story' || card.columnId !== 'scheduled') continue;
    if (isStoryOccurrenceDue(card, todayKey)) {
      tasks.push(buildPublishTask(card, todayKey, clientAccountManagers));
    }
  }

  return tasks.sort(compareAccountManagerTasks);
}

/** Overall to-do for non-story content: approved + scheduled posts. */
export function buildPostsTodoTasks(cards, clientAccountManagers = {}) {
  const tasks = [];

  for (const card of cards) {
    if (card.contentType === 'Story') continue;
    if (card.isOneOffProject) continue;
    if (card.postedAt) continue;

    if (card.columnId === 'approved') {
      tasks.push(buildScheduleTask(card, clientAccountManagers));
      continue;
    }

    if (card.columnId === 'scheduled' && card.dueDate && !card.postedAt) {
      tasks.push(buildPublishTask(card, card.dueDate, clientAccountManagers));
    }
  }

  return tasks.sort(compareAccountManagerTasks);
}

export function compareAccountManagerTasks(a, b) {
  const keyA = getAccountManagerPostSortKey(a);
  const keyB = getAccountManagerPostSortKey(b);
  if (keyA !== keyB) return keyA.localeCompare(keyB);
  return (a.title || '').localeCompare(b.title || '');
}

function getAccountManagerPostSortKey(task) {
  const postDate = task.dueDate || task.taskDate || '';
  if (!postDate) return '9999-99-99T99:99';
  const time = task.dueTime || '99:99';
  return `${postDate}T${time}`;
}

export function applyAccountManagerTaskOrder(tasks, orderIds = []) {
  if (!orderIds.length) {
    return [...tasks].sort(compareAccountManagerTasks);
  }

  const orderMap = new Map(orderIds.map((id, index) => [id, index]));
  return [...tasks].sort((a, b) => {
    const aIndex = orderMap.has(a.id) ? orderMap.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bIndex = orderMap.has(b.id) ? orderMap.get(b.id) : Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return compareAccountManagerTasks(a, b);
  });
}

export function buildInitialAccountManagerTaskOrder(tasks) {
  return [...tasks].sort(compareAccountManagerTasks).map((task) => task.id);
}

export function groupAccountManagerTasksByClient(tasks) {
  const groups = [];
  let currentClient = null;

  for (const task of tasks) {
    if (task.client !== currentClient) {
      currentClient = task.client;
      groups.push({ client: task.client, tasks: [] });
    }
    groups[groups.length - 1].tasks.push(task);
  }

  return groups;
}

export function groupAccountManagerTasksByDate(tasks, todayKey = toDateKey(new Date())) {
  const groups = [];
  let currentKey = null;

  for (const task of tasks) {
    let groupKey = task.dueDate || 'no-date';
    let groupLabel = task.dueDate
      ? formatEditorDateLabel(task.dueDate, todayKey)
      : task.kind === 'schedule'
        ? 'Needs scheduling'
        : 'No date set';

    if (task.kind === 'schedule') {
      groupKey = 'needs-scheduling';
      groupLabel = 'Needs scheduling';
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

export function filterAccountManagerTasks(tasks, { search, client, assignee }) {
  return tasks.filter((task) => {
    if (client && client !== 'all' && task.client !== client) return false;
    if (assignee && assignee !== 'all' && task.accountManager !== assignee) return false;
    if (!search) return true;

    const q = search.toLowerCase();
    const haystack = [
      task.title,
      task.client,
      task.contentType,
      task.notes,
      task.assignedTo,
      task.accountManager,
      task.label,
      task.clientComment,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function formatAccountManagerDateLabel(dateKey, todayKey = toDateKey(new Date())) {
  return formatEditorDateLabel(dateKey, todayKey);
}
