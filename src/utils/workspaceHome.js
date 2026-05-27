import { toDateKey } from './calendar';
import { cardIsAssignedToStaff } from './staffMembers';

function isToday(dateKey) {
  return dateKey === toDateKey(new Date());
}

function isThisWeek(dateKey) {
  if (!dateKey) return false;
  const date = new Date(`${dateKey}T12:00:00`);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function matchesStaff(card, staffName, clientAccountManagers, myWorkOnly) {
  if (!myWorkOnly || !staffName) return true;
  return cardIsAssignedToStaff(card, staffName, clientAccountManagers);
}

export function buildWorkspaceHomeSummary({
  cards,
  ideas,
  adminTasks,
  clientFilter = 'all',
  syncTotal = 0,
  staffName = '',
  clientAccountManagers = {},
  myWorkOnly = true,
}) {
  const matchesClient = (item) =>
    clientFilter === 'all' || item.client === clientFilter;

  const scopedCards = cards.filter(matchesClient);
  const scopedIdeas = ideas.filter(matchesClient);

  const cardScope = (card) =>
    matchesStaff(card, staffName, clientAccountManagers, myWorkOnly);

  const inReview = scopedCards.filter((c) => c.columnId === 'in-review');
  const toCreate = scopedCards.filter((c) => c.columnId === 'shoot' && cardScope(c));
  const editing = scopedCards.filter((c) => c.columnId === 'editing' && cardScope(c));
  const pendingIdeas = scopedIdeas.filter((i) => i.status === 'pending');
  const shootsToday = scopedCards.filter(
    (c) =>
      c.shootDate &&
      isToday(c.shootDate) &&
      c.contentType !== 'Story' &&
      cardScope(c),
  );
  const scheduledThisWeek = scopedCards.filter(
    (c) => c.columnId === 'scheduled' && c.dueDate && isThisWeek(c.dueDate) && cardScope(c),
  );
  const openAdminTasks = (adminTasks || []).filter((t) => !t.completed);

  const myInReview = inReview.filter(cardScope);

  return {
    syncTotal,
    staffName,
    myWorkOnly,
    inReviewCount: myWorkOnly && staffName ? myInReview.length : inReview.length,
    toCreateCount: toCreate.length,
    editingCount: editing.length,
    pendingIdeasCount: pendingIdeas.length,
    shootsTodayCount: shootsToday.length,
    scheduledThisWeekCount: scheduledThisWeek.length,
    openAdminTasksCount: openAdminTasks.length,
    shootsToday,
    inReview: (myWorkOnly && staffName ? myInReview : inReview).slice(0, 5),
    scheduledThisWeek: scheduledThisWeek.slice(0, 5),
  };
}
