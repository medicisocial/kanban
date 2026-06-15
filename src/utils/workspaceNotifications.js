import { toDateKey, parseDateKey, addDays } from './calendar';
import { isOverdue } from '../utils';
import { cardIsAssignedToStaff } from './staffMembers';

import { matchesClientFilter } from './clients';

function matchesClient(item, clientFilter) {
  return matchesClientFilter(item.client, clientFilter);
}

function isDueWithinDays(dateKey, days, todayKey = toDateKey(new Date())) {
  if (!dateKey) return false;
  const due = parseDateKey(dateKey);
  const today = parseDateKey(todayKey);
  const limit = addDays(today, days);
  return due >= today && due <= limit;
}

export function buildWorkspaceAlerts({
  cards,
  ideas,
  clientFilter = 'all',
  staffName = '',
  clientAccountManagers = {},
  personalTaskScope = false,
}) {
  const alerts = [];
  const scopedCards = cards.filter((c) => matchesClient(c, clientFilter));
  const scopedIdeas = ideas.filter((i) => matchesClient(i, clientFilter));

  const cardScope = (card) => {
    if (!personalTaskScope || !staffName) return true;
    return cardIsAssignedToStaff(card, staffName, clientAccountManagers);
  };

  const overdueCreate = scopedCards.filter(
    (c) =>
      c.columnId === 'shoot' &&
      cardScope(c) &&
      ((c.shootDate && isOverdue(c.shootDate)) || (c.dueDate && isOverdue(c.dueDate))),
  );
  if (overdueCreate.length > 0) {
    alerts.push({
      id: 'overdue-create',
      tone: 'warning',
      title: `${overdueCreate.length} overdue to create`,
      detail: 'Shoot or plan dates have passed.',
      view: 'board',
    });
  }

  const overdueEditing = scopedCards.filter(
    (c) => c.columnId === 'editing' && cardScope(c) && c.dueDate && isOverdue(c.dueDate),
  );
  if (overdueEditing.length > 0) {
    alerts.push({
      id: 'overdue-editing',
      tone: 'warning',
      title: `${overdueEditing.length} overdue in editing`,
      detail: 'Editing deadlines need attention.',
      view: 'board',
    });
  }

  const inReview = scopedCards.filter((c) => c.columnId === 'in-review');
  if (inReview.length > 0) {
    alerts.push({
      id: 'in-review',
      tone: 'info',
      title: `${inReview.length} awaiting client review`,
      detail: 'Share review links from Clients if needed.',
      view: 'board',
    });
  }

  const scheduledSoon = scopedCards.filter(
    (c) =>
      c.columnId === 'scheduled' &&
      cardScope(c) &&
      isDueWithinDays(c.dueDate, 2),
  );
  if (scheduledSoon.length > 0) {
    alerts.push({
      id: 'scheduled-soon',
      tone: 'info',
      title: `${scheduledSoon.length} posting in 48 hours`,
      detail: 'Scheduled content goes live soon.',
      view: 'calendars',
    });
  }

  const calendarNoteWindowMs = 14 * 24 * 60 * 60 * 1000;
  const recentCalendarNotes = scopedCards.filter(
    (c) =>
      cardScope(c) &&
      Number(c.calendarNoteAt) > 0 &&
      Date.now() - Number(c.calendarNoteAt) <= calendarNoteWindowMs,
  );
  if (recentCalendarNotes.length > 0) {
    alerts.push({
      id: 'calendar-notes',
      tone: 'info',
      title: `${recentCalendarNotes.length} client calendar note${recentCalendarNotes.length === 1 ? '' : 's'}`,
      detail: 'A client left feedback on scheduled content.',
      view: 'calendars',
    });
  }

  const pendingIdeas = scopedIdeas.filter((i) => i.status === 'pending');
  if (pendingIdeas.length > 0) {
    alerts.push({
      id: 'pending-ideas',
      tone: 'info',
      title: `${pendingIdeas.length} ideas pending client approval`,
      detail: 'Waiting on client review in the portal.',
      view: 'ideas',
    });
  }

  return alerts;
}
