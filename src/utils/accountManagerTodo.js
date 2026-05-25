import {
  isStoryOccurrenceOnDate,
  toDateKey,
  withStoryOccurrence,
} from './calendar';
import { compareEditorTasks, formatEditorDateLabel } from './editorTodo';

function buildScheduleTask(card) {
  return {
    id: `schedule-${card.id}`,
    source: 'board',
    cardId: card.id,
    kind: 'schedule',
    label: card.contentType === 'Story' ? 'Schedule story' : 'Schedule',
    title: card.title,
    client: card.client,
    contentType: card.contentType,
    columnId: card.columnId,
    taskDate: '',
    dueDate: card.dueDate || '',
    dueTime: card.dueTime || '',
    assignedTo: card.assignedTo || '',
    notes: card.notes || '',
    card,
  };
}

function buildPublishTask(card, taskDate) {
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
    notes: occurrenceCard.notes || '',
    card: occurrenceCard,
  };
}

export function buildAccountManagerTasks(cards, focusDate = toDateKey(new Date())) {
  const scheduleTasks = [];
  const dailyTasks = [];

  for (const card of cards) {
    if (card.columnId === 'approved') {
      scheduleTasks.push(buildScheduleTask(card));
      continue;
    }

    if (card.columnId !== 'scheduled') continue;

    if (card.contentType === 'Story') {
      if (isStoryOccurrenceOnDate(card, focusDate)) {
        dailyTasks.push(buildPublishTask(card, focusDate));
      }
      continue;
    }

    if (card.dueDate === focusDate) {
      dailyTasks.push(buildPublishTask(card, focusDate));
    }
  }

  scheduleTasks.sort(compareAccountManagerTasks);
  dailyTasks.sort(compareAccountManagerTasks);

  return { scheduleTasks, dailyTasks };
}

export function compareAccountManagerTasks(a, b) {
  const clientDiff = (a.client || '').localeCompare(b.client || '');
  if (clientDiff !== 0) return clientDiff;
  return compareEditorTasks(a, b);
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

export function splitAccountManagerTasksByContentType(tasks) {
  const stories = [];
  const posts = [];

  for (const task of tasks) {
    if (task.contentType === 'Story') {
      stories.push(task);
    } else {
      posts.push(task);
    }
  }

  return { stories, posts };
}

export function filterAccountManagerTasks(tasks, { search, client, assignee }) {
  return tasks.filter((task) => {
    if (client && client !== 'all' && task.client !== client) return false;
    if (assignee && assignee !== 'all' && task.assignedTo !== assignee) return false;
    if (!search) return true;

    const q = search.toLowerCase();
    const haystack = [
      task.title,
      task.client,
      task.contentType,
      task.notes,
      task.assignedTo,
      task.label,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function formatAccountManagerDateLabel(dateKey, todayKey = toDateKey(new Date())) {
  return formatEditorDateLabel(dateKey, todayKey);
}
