import { toDateKey } from './calendar';
import {
  cardIsAssignedToStaff,
  cardIsAssignedToAccountManager,
} from './staffMembers';
import { cardIsAssignedToContentCreator } from './contentCreatorTodo';

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

function matchesStaff(card, staffName, clientAccountManagers, personalScope) {
  if (!personalScope || !staffName) return true;
  return cardIsAssignedToStaff(card, staffName, clientAccountManagers);
}

function cardNeedsScheduling(card) {
  if (card.contentType === 'Story') return false;
  if (card.isOneOffProject) return false;
  if (card.postedAt) return false;
  return card.columnId === 'approved';
}

function matchesAccountManagerQueue(card, staffName, clientAccountManagers, personalScope) {
  if (!personalScope || !staffName) return true;
  return cardIsAssignedToAccountManager(card, staffName, clientAccountManagers);
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
  companyWideView = false,
  showAccountManagerQueue = true,
}) {
  const personalScope = myWorkOnly && !companyWideView;

  const matchesClient = (item) =>
    clientFilter === 'all' || item.client === clientFilter;

  const scopedCards = cards.filter(matchesClient);
  const scopedIdeas = ideas.filter(matchesClient);

  const cardScope = (card) =>
    matchesStaff(card, staffName, clientAccountManagers, personalScope);

  const inReview = scopedCards.filter((c) => c.columnId === 'in-review');
  const myInReview = inReview.filter((c) =>
    matchesAccountManagerQueue(c, staffName, clientAccountManagers, personalScope),
  );
  const toCreate = scopedCards.filter((c) => {
    if (c.columnId !== 'shoot') return false;
    if (personalScope && staffName) {
      return cardIsAssignedToContentCreator(c, staffName);
    }
    return true;
  });
  const editing = companyWideView
    ? scopedCards.filter((c) => c.columnId === 'editing')
    : scopedCards.filter((c) => c.columnId === 'editing' && cardScope(c));
  const pendingIdeas = scopedIdeas.filter((i) => i.status === 'pending');
  const shootsTodayAll = scopedCards.filter(
    (c) =>
      c.shootDate &&
      isToday(c.shootDate) &&
      c.contentType !== 'Story',
  );
  const shootsToday = companyWideView
    ? shootsTodayAll
    : scopedCards.filter(
        (c) =>
          c.shootDate &&
          isToday(c.shootDate) &&
          c.contentType !== 'Story' &&
          cardScope(c),
      );
  const scheduledThisWeekAll = scopedCards.filter(
    (c) => c.columnId === 'scheduled' && c.dueDate && isThisWeek(c.dueDate),
  );
  const scheduledThisWeek = companyWideView
    ? scheduledThisWeekAll
    : scopedCards.filter(
        (c) => c.columnId === 'scheduled' && c.dueDate && isThisWeek(c.dueDate) && cardScope(c),
      );
  const needsSchedulingAll = scopedCards.filter(cardNeedsScheduling);
  const needsScheduling = needsSchedulingAll.filter((c) =>
    matchesAccountManagerQueue(c, staffName, clientAccountManagers, personalScope),
  );
  const openAdminTasks = (adminTasks || []).filter((t) => !t.completed);

  const includeAccountManagerQueue = !myWorkOnly || showAccountManagerQueue || companyWideView;
  const visibleInReview = includeAccountManagerQueue
    ? personalScope && staffName
      ? myInReview
      : inReview
    : [];
  const visibleNeedsScheduling = includeAccountManagerQueue
    ? personalScope && staffName
      ? needsScheduling
      : needsSchedulingAll
    : [];

  return {
    syncTotal,
    staffName,
    myWorkOnly,
    companyWideView,
    showAccountManagerQueue: !myWorkOnly || includeAccountManagerQueue,
    inReviewCount: visibleInReview.length,
    toCreateCount: toCreate.length,
    editingCount: editing.length,
    pendingIdeasCount: pendingIdeas.length,
    shootsTodayCount: shootsToday.length,
    scheduledThisWeekCount: scheduledThisWeek.length,
    needsSchedulingCount: visibleNeedsScheduling.length,
    openAdminTasksCount: openAdminTasks.length,
    shootsToday,
    inReview: visibleInReview.slice(0, 5),
    needsScheduling: visibleNeedsScheduling.slice(0, 5),
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
    summary.toCreateCount + summary.editingCount + summary.inReviewCount + summary.needsSchedulingCount;
  const activeCount = pipelineCount + summary.pendingIdeasCount;

  if (summary.companyWideView) {
    return {
      eyebrow: 'My work',
      title,
      description:
        activeCount > 0 || summary.shootsTodayCount > 0
          ? 'Company-wide production at a glance — pipeline, reviews, and schedules.'
          : "You're all caught up for now — nice work. Here's the full picture when something new comes in.",
    };
  }

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
        ? 'a scheduled shoot today'
        : `${summary.shootsTodayCount} scheduled shoots today`;
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
      description: `Busy day ahead — ${activeCount} item${activeCount === 1 ? '' : 's'} in your queue and shoots on the calendar. You've got this.`,
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
