import {
  isStoryOccurrenceDue,
  toDateKey,
  withStoryOccurrence,
} from './calendar';
import { formatEditorDateLabel } from './editorTodo';
import { matchesClientFilter } from './clients';
import { isPastScheduledBoardPost } from '../utils';
import { isScheduledPostType } from '../constants';
import { cardIsAssignedToAccountManager } from './staffMembers';

const COLUMN_SORT_ORDER = {
  shoot: 0,
  editing: 1,
  'in-review': 2,
  'not-approved': 3,
  approved: 4,
  scheduled: 5,
  finished: 6,
};

/** Pipeline stages where account managers still plan publish dates (incl. after handoff to Editing). */
export const POST_DATE_TASK_COLUMN_IDS = ['shoot', 'editing', 'not-approved', 'in-review'];

export function cardNeedsPostDate(card) {
  if (card.isOneOffProject || card.contentType === 'One-off Project') return false;
  if (!isScheduledPostType(card.contentType)) return false;
  if (String(card.dueDate || '').trim()) return false;
  if (card.postedAt) return false;
  if (card.columnId === 'finished') return false;
  if (!POST_DATE_TASK_COLUMN_IDS.includes(card.columnId)) return false;
  return true;
}

export function getCardsNeedingPostDate(
  cards,
  { staffName = '', personalScope = false, clientAccountManagers = {} } = {},
) {
  return cards.filter((card) => {
    if (!cardNeedsPostDate(card)) return false;
    if (isPastScheduledBoardPost(card)) return false;
    if (personalScope && staffName) {
      return cardIsAssignedToAccountManager(card, staffName, clientAccountManagers);
    }
    return true;
  });
}

/** @deprecated Use getCardsNeedingPostDate */
export const getToCreateCardsNeedingPostDate = getCardsNeedingPostDate;

export function resolveAccountManager(card, clientAccountManagers = {}) {
  return card.accountManager || clientAccountManagers[card.client] || '';
}

function buildSetPostDateTask(card, clientAccountManagers) {
  return {
    id: `set-post-date-${card.id}`,
    source: 'board',
    cardId: card.id,
    kind: 'set-post-date',
    label: 'Set post date',
    title: card.title,
    client: card.client,
    contentType: card.contentType,
    columnId: card.columnId,
    taskDate: '',
    dueDate: '',
    dueTime: card.dueTime || '',
    assignedTo: card.assignedTo || '',
    contentCreator: card.contentCreator || '',
    accountManager: resolveAccountManager(card, clientAccountManagers),
    notes: card.notes || '',
    card,
  };
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

/** Pipeline cards missing a target post date — account managers plan publish dates here. */
export function buildSetPostDateTasks(cards, clientAccountManagers = {}) {
  const tasks = getCardsNeedingPostDate(cards).map((card) =>
    buildSetPostDateTask(card, clientAccountManagers),
  );

  return tasks.sort(compareSetPostDateTasks);
}

/** @deprecated Use buildSetPostDateTasks */
export const buildToCreateTasks = buildSetPostDateTasks;

export function compareSetPostDateTasks(a, b) {
  const colA = COLUMN_SORT_ORDER[a.columnId] ?? 99;
  const colB = COLUMN_SORT_ORDER[b.columnId] ?? 99;
  if (colA !== colB) return colA - colB;
  return (a.title || '').localeCompare(b.title || '');
}

/** @deprecated Use compareSetPostDateTasks */
export const compareToCreateTasks = compareSetPostDateTasks;

/** Approved posts waiting to be marked scheduled on the board. */
export function buildPostsTodoTasks(cards, clientAccountManagers = {}) {
  const tasks = [];

  for (const card of cards) {
    if (!isScheduledPostType(card.contentType)) continue;
    if (card.isOneOffProject) continue;
    if (card.postedAt) continue;
    if (card.columnId !== 'approved') continue;

    tasks.push(buildScheduleTask(card, clientAccountManagers));
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
  if (task.kind === 'set-post-date') {
    return '0000-00-00T00:00';
  }
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
      : task.kind === 'set-post-date'
        ? 'Needs post date'
        : task.kind === 'schedule'
        ? 'Needs scheduling'
        : 'No date set';

    if (task.kind === 'set-post-date') {
      groupKey = 'needs-post-date';
      groupLabel = 'Needs post date';
    } else if (task.kind === 'schedule') {
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

export function filterAccountManagerTasks(tasks, { client, assignee, matchAccountManager = true } = {}) {
  return tasks.filter((task) => {
    if (!matchesClientFilter(task.client, client)) return false;
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

export function formatAccountManagerDateLabel(dateKey, todayKey = toDateKey(new Date())) {
  return formatEditorDateLabel(dateKey, todayKey);
}
