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
  myWorkOnly = false,
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

function getTimeOfDayGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function buildMyWorkGreeting(firstName, summary) {
  const timeGreeting = getTimeOfDayGreeting();
  const title = firstName ? `${timeGreeting}, ${firstName}.` : `${timeGreeting}.`;

  const pipelineCount =
    summary.toCreateCount + summary.editingCount + summary.inReviewCount;
  const activeCount = pipelineCount + summary.pendingIdeasCount;

  if (activeCount === 0 && summary.shootsTodayCount === 0) {
    return {
      eyebrow: 'My work',
      title,
      description:
        "You're all caught up for now — nice work. Take a breath, or peek at the pipeline when you're ready for what's next.",
    };
  }

  if (summary.shootsTodayCount > 0 && activeCount === 0) {
    const shootLabel =
      summary.shootsTodayCount === 1
        ? 'a production day today'
        : `${summary.shootsTodayCount} production days today`;
    return {
      eyebrow: 'My work',
      title,
      description: `You've got ${shootLabel}. Hope it goes smoothly — here's what's on the schedule.`,
    };
  }

  if (summary.shootsTodayCount > 0) {
    return {
      eyebrow: 'My work',
      title,
      description: `Busy day ahead — ${activeCount} item${activeCount === 1 ? '' : 's'} in your queue and production on the calendar. You've got this.`,
    };
  }

  if (activeCount === 1) {
    return {
      eyebrow: 'My work',
      title,
      description: "Just one thing needs you right now. Here's a quick look at where to focus.",
    };
  }

  if (summary.scheduledThisWeekCount > 0) {
    return {
      eyebrow: 'My work',
      title,
      description: `${activeCount} items waiting on you, with ${summary.scheduledThisWeekCount} scheduled this week. Here's your queue at a glance.`,
    };
  }

  return {
    eyebrow: 'My work',
    title,
    description: `${activeCount} items in your queue right now. Here's what needs your attention today.`,
  };
}
