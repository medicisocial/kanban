import { toDateKey } from './calendar';
import { matchesClientFilter } from './clients';
import { isScheduledPostType } from '../constants';
import {
  cardIsAssignedToStaff,
  cardIsAssignedToAccountManager,
} from './staffMembers';
import {
  buildContentCreatorTasks,
  cardIsAssignedToContentCreator,
  getToCreateQueueCards,
} from './contentCreatorTodo';
import {
  buildInReviewTasks,
  buildPostsTodoTasks,
  buildSetPostDateTasks,
  buildStoryTasksToday,
  filterAccountManagerTasks,
  getCardsNeedingPostDate,
} from './accountManagerTodo';
import {
  buildBoardEditorTasks,
  buildEditorCompletedByAssignee,
  buildEditorCompletedCount,
  filterEditorTasks,
  splitEditorTasksByQueue,
} from './editorTodo';
import { getMemberNamesByRole } from './teamMembers';

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
  if (!isScheduledPostType(card.contentType)) return false;
  if (card.isOneOffProject) return false;
  if (card.postedAt) return false;
  return card.columnId === 'approved';
}

function matchesAccountManagerQueue(card, staffName, clientAccountManagers, personalScope) {
  if (!personalScope || !staffName) return true;
  return cardIsAssignedToAccountManager(card, staffName, clientAccountManagers);
}

function matchesClientFilterItem(item, clientFilter) {
  return matchesClientFilter(item.client, clientFilter);
}

function buildEditorQueueCounts(
  cards,
  { clientFilter = 'all', assignee = 'all', includeCompleted = false } = {},
) {
  const editorTasks = filterEditorTasks(buildBoardEditorTasks(cards), {
    client: clientFilter,
    assignee,
    includeCompleted,
  });
  const { editing, inReview } = splitEditorTasksByQueue(editorTasks);
  return {
    editingCount: editing.length,
    editorInReviewCount: inReview.length,
  };
}

function buildShootsTodayCount(
  cards,
  { clientFilter = 'all', staffName = '', personalScope = false } = {},
) {
  return cards.filter(
    (card) =>
      card.columnId === 'shoot' &&
      card.shootDate &&
      isToday(card.shootDate) &&
      card.contentType !== 'Story' &&
      matchesClientFilterItem(card, clientFilter) &&
      (!personalScope || !staffName || cardIsAssignedToContentCreator(card, staffName)),
  ).length;
}

/** Overview counts that use the same rules as Team tasks tabs (per-role assignee fields). */
function buildPersonalWorkspaceHomeSummary({
  cards,
  ideas,
  adminTasks,
  clientFilter,
  syncTotal,
  staffName,
  clientAccountManagers,
  showAccountManagerQueue,
}) {
  const assignee = staffName;
  const amFilter = { client: clientFilter, assignee };

  const toCreateCount = buildContentCreatorTasks(cards, {
    client: clientFilter,
    staffName,
  }).length;

  const shootsTodayCount = buildShootsTodayCount(cards, {
    clientFilter,
    staffName,
    personalScope: true,
  });

  const { editingCount, editorInReviewCount } = buildEditorQueueCounts(cards, {
    clientFilter,
    assignee,
    includeCompleted: false,
  });
  const editorCompletedCount = buildEditorCompletedCount(cards, {
    clientFilter,
    assignee,
  });

  const inReviewTasks = filterAccountManagerTasks(
    buildInReviewTasks(cards, clientAccountManagers),
    amFilter,
  );
  const needPostDateTasks = filterAccountManagerTasks(
    buildSetPostDateTasks(cards, clientAccountManagers),
    amFilter,
  );
  const needsSchedulingTasks = filterAccountManagerTasks(
    buildPostsTodoTasks(cards, clientAccountManagers),
    amFilter,
  );
  const storiesTodayTasks = filterAccountManagerTasks(
    buildStoryTasksToday(cards, toDateKey(new Date()), clientAccountManagers),
    amFilter,
  );

  const inReviewCount = inReviewTasks.length;
  const needPostDateCount = needPostDateTasks.length;
  const needsSchedulingCount = needsSchedulingTasks.length;
  const storiesTodayCount = storiesTodayTasks.length;
  const accountManagerTaskCount =
    inReviewCount + needPostDateCount + needsSchedulingCount + storiesTodayCount;

  const scheduledThisWeek = cards.filter(
    (card) =>
      card.columnId === 'scheduled' &&
      card.dueDate &&
      isThisWeek(card.dueDate) &&
      matchesClientFilterItem(card, clientFilter) &&
      cardIsAssignedToStaff(card, staffName, clientAccountManagers),
  );

  const openAdminTasks = (adminTasks || []).filter((t) => !t.completed);

  return {
    syncTotal,
    staffName,
    myWorkOnly: true,
    companyWideView: false,
    showAccountManagerQueue,
    inReviewCount,
    toCreateCount,
    editingCount,
    editorInReviewCount,
    editorCompletedCount,
    pendingIdeasCount: 0,
    shootsTodayCount,
    scheduledThisWeekCount: scheduledThisWeek.length,
    needsSchedulingCount,
    needPostDateCount,
    storiesTodayCount,
    accountManagerTaskCount,
    openAdminTasksCount: openAdminTasks.length,
    shootsToday: [],
    inReview: inReviewTasks.slice(0, 5).map((t) => t.card),
    needsScheduling: needsSchedulingTasks.slice(0, 5).map((t) => t.card),
    needPostDate: needPostDateTasks.slice(0, 5).map((t) => t.card),
    scheduledThisWeek: scheduledThisWeek.slice(0, 5),
  };
}

export function buildWorkspaceHomeSummary({
  cards,
  ideas,
  adminTasks,
  clientFilter = 'all',
  syncTotal = 0,
  staffName = '',
  clientAccountManagers = {},
  teamMembers = [],
  myWorkOnly = false,
  companyWideView = false,
  showAccountManagerQueue = true,
}) {
  const personalScope = myWorkOnly && !companyWideView;
  const companyMetrics = companyWideView || !myWorkOnly;

  if (personalScope && staffName) {
    return buildPersonalWorkspaceHomeSummary({
      cards,
      ideas,
      adminTasks,
      clientFilter,
      syncTotal,
      staffName,
      clientAccountManagers,
      showAccountManagerQueue,
    });
  }

  const matchesClient = (item) => matchesClientFilterItem(item, clientFilter);

  const scopedCards = cards.filter(matchesClient);
  const scopedIdeas = ideas.filter(matchesClient);

  const cardScope = (card) =>
    matchesStaff(card, staffName, clientAccountManagers, personalScope);

  const inReview = scopedCards.filter((c) => c.columnId === 'in-review');
  const myInReview = inReview.filter((c) =>
    matchesAccountManagerQueue(c, staffName, clientAccountManagers, personalScope),
  );
  const toCreate = companyMetrics
    ? getToCreateQueueCards(scopedCards)
    : getToCreateQueueCards(scopedCards, { staffName, personalScope: true });
  const editorAssignee =
    companyMetrics || !personalScope || !staffName ? 'all' : staffName;
  const { editingCount, editorInReviewCount } = buildEditorQueueCounts(scopedCards, {
    clientFilter,
    assignee: editorAssignee,
    includeCompleted: false,
  });
  const editorCompletedCount = buildEditorCompletedCount(scopedCards, {
    clientFilter,
    assignee: editorAssignee,
  });
  const editorCompletedByAssignee = companyMetrics
    ? buildEditorCompletedByAssignee(scopedCards, {
        clientFilter,
        editorNames: getMemberNamesByRole(teamMembers, 'Editor'),
      })
    : [];
  const pendingIdeas = scopedIdeas.filter((i) => i.status === 'pending');
  const shootsTodayCount = buildShootsTodayCount(scopedCards, {
    clientFilter,
    staffName,
    personalScope: personalScope && !companyMetrics,
  });
  const shootsToday = scopedCards.filter(
    (c) =>
      c.columnId === 'shoot' &&
      c.shootDate &&
      isToday(c.shootDate) &&
      c.contentType !== 'Story' &&
      (!personalScope || !staffName || cardScope(c)),
  );
  const scheduledThisWeekAll = scopedCards.filter(
    (c) => c.columnId === 'scheduled' && c.dueDate && isThisWeek(c.dueDate),
  );
  const scheduledThisWeek = companyMetrics
    ? scheduledThisWeekAll
    : scopedCards.filter(
        (c) => c.columnId === 'scheduled' && c.dueDate && isThisWeek(c.dueDate) && cardScope(c),
      );
  const needsSchedulingAll = scopedCards.filter(cardNeedsScheduling);
  const needsScheduling = needsSchedulingAll.filter((c) =>
    matchesAccountManagerQueue(c, staffName, clientAccountManagers, personalScope),
  );
  const needPostDateAll = getCardsNeedingPostDate(scopedCards, {
    clientAccountManagers,
  });
  const needPostDate = getCardsNeedingPostDate(scopedCards, {
    staffName,
    personalScope,
    clientAccountManagers,
  });
  const openAdminTasks = (adminTasks || []).filter((t) => !t.completed);

  const includeAccountManagerQueue = !myWorkOnly || showAccountManagerQueue || companyWideView;
  const visibleInReview = includeAccountManagerQueue
    ? companyMetrics
      ? inReview
      : personalScope && staffName
        ? myInReview
        : inReview
    : [];
  const visibleNeedsScheduling = includeAccountManagerQueue
    ? companyMetrics
      ? needsSchedulingAll
      : personalScope && staffName
        ? needsScheduling
        : needsSchedulingAll
    : [];
  const visibleNeedPostDate = includeAccountManagerQueue
    ? companyMetrics
      ? needPostDateAll
      : personalScope && staffName
        ? needPostDate
        : needPostDateAll
    : [];

  return {
    syncTotal,
    staffName,
    myWorkOnly,
    companyWideView,
    showAccountManagerQueue: !myWorkOnly || includeAccountManagerQueue,
    inReviewCount: visibleInReview.length,
    toCreateCount: toCreate.length,
    editingCount,
    editorInReviewCount,
    editorCompletedCount,
    editorCompletedByAssignee,
    pendingIdeasCount: pendingIdeas.length,
    shootsTodayCount,
    scheduledThisWeekCount: scheduledThisWeek.length,
    needsSchedulingCount: visibleNeedsScheduling.length,
    needPostDateCount: visibleNeedPostDate.length,
    openAdminTasksCount: openAdminTasks.length,
    shootsToday,
    inReview: visibleInReview.slice(0, 5),
    needsScheduling: visibleNeedsScheduling.slice(0, 5),
    needPostDate: visibleNeedPostDate.slice(0, 5),
    scheduledThisWeek: scheduledThisWeek.slice(0, 5),
  };
}

export function buildNavBadgeCounts(summary, syncTotal = 0, visibleTaskTabs = null) {
  const todo = visibleTaskTabs
    ? countTodoBadgeForVisibleTabs(summary, visibleTaskTabs)
    : summary.toCreateCount +
      summary.editingCount +
      (summary.editorInReviewCount || 0) +
      summary.needPostDateCount +
      summary.needsSchedulingCount +
      summary.inReviewCount +
      (summary.storiesTodayCount || 0);

  const home =
    todo +
    summary.pendingIdeasCount +
    summary.openAdminTasksCount +
    syncTotal;

  const badges = {};
  if (home > 0) badges.home = home;
  if (todo > 0) badges.todo = todo;
  if (summary.pendingIdeasCount > 0) badges.ideas = summary.pendingIdeasCount;
  return badges;
}

function countTodoBadgeForVisibleTabs(summary, visibleTaskTabs) {
  let total = 0;
  if (visibleTaskTabs.includes('creator')) {
    total += summary.toCreateCount + summary.shootsTodayCount;
  }
  if (visibleTaskTabs.includes('editor')) {
    total += summary.editingCount + (summary.editorInReviewCount || 0);
  }
  if (visibleTaskTabs.includes('account')) {
    total +=
      summary.accountManagerTaskCount ??
      summary.inReviewCount + summary.needsSchedulingCount + summary.needPostDateCount;
  }
  if (visibleTaskTabs.includes('admin')) {
    total += summary.openAdminTasksCount;
  }
  return total;
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
    summary.toCreateCount +
    summary.shootsTodayCount +
    summary.editingCount +
    (summary.editorInReviewCount || 0) +
    (summary.accountManagerTaskCount ??
      summary.inReviewCount + summary.needsSchedulingCount + summary.needPostDateCount);
  const activeCount = pipelineCount + summary.pendingIdeasCount;

  if (summary.companyWideView) {
    const todayParts = [];
    if (summary.meetingsTodayCount > 0) {
      todayParts.push(
        `${summary.meetingsTodayCount} meeting${summary.meetingsTodayCount === 1 ? '' : 's'}`,
      );
    }
    if (summary.shootsTodayCount > 0) {
      todayParts.push(
        `${summary.shootsTodayCount} shoot${summary.shootsTodayCount === 1 ? '' : 's'}`,
      );
    }

    return {
      eyebrow: 'Overview',
      title,
      description:
        todayParts.length > 0
          ? `Company-wide view — ${todayParts.join(' and ')} today, plus pipeline and reviews across all clients.`
          : activeCount > 0
            ? 'Company-wide production at a glance — pipeline, reviews, and schedules.'
            : "You're all caught up for now — nice work. Here's the full picture when something new comes in.",
    };
  }

  if (activeCount === 0 && summary.shootsTodayCount === 0) {
    const editedCount = summary.editorCompletedCount || 0;
    if (editedCount > 0) {
      return {
        eyebrow: 'My work',
        title,
        description: `You're all caught up for now — nice work. You've edited ${editedCount} video${editedCount === 1 ? '' : 's'} so far.`,
      };
    }

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
