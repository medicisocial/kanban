import { toDateKey } from './calendar';

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

export function buildWorkspaceHomeSummary({
  cards,
  ideas,
  adminTasks,
  clientFilter = 'all',
  syncTotal = 0,
}) {
  const matchesClient = (item) =>
    clientFilter === 'all' || item.client === clientFilter;

  const scopedCards = cards.filter(matchesClient);
  const scopedIdeas = ideas.filter(matchesClient);

  const inReview = scopedCards.filter((c) => c.columnId === 'in-review');
  const toCreate = scopedCards.filter((c) => c.columnId === 'shoot');
  const editing = scopedCards.filter((c) => c.columnId === 'editing');
  const pendingIdeas = scopedIdeas.filter((i) => i.status === 'pending');
  const shootsToday = scopedCards.filter(
    (c) => c.shootDate && isToday(c.shootDate) && c.contentType !== 'Story',
  );
  const scheduledThisWeek = scopedCards.filter(
    (c) => c.columnId === 'scheduled' && c.dueDate && isThisWeek(c.dueDate),
  );
  const openAdminTasks = (adminTasks || []).filter((t) => !t.completed);

  return {
    syncTotal,
    inReviewCount: inReview.length,
    toCreateCount: toCreate.length,
    editingCount: editing.length,
    pendingIdeasCount: pendingIdeas.length,
    shootsTodayCount: shootsToday.length,
    scheduledThisWeekCount: scheduledThisWeek.length,
    openAdminTasksCount: openAdminTasks.length,
    shootsToday,
    inReview: inReview.slice(0, 5),
    scheduledThisWeek: scheduledThisWeek.slice(0, 5),
  };
}
