import { toDateKey } from './calendar';
import {
  filterMeetings,
  expandMeetingsForRange,
  getMeetingContactLabel,
} from './meetingsCalendar';
import { cardIsAssignedToStaff } from './staffMembers';
import {
  getShootCards,
  getCardsForShootDate,
  groupShootDayClients,
  getShootDayTitle,
  resolveShootDayTime,
  resolveShootDayEndTime,
  buildShootDayTimelineSubtitle,
} from './shootDay';

export function buildTodayHeadline(meetingCount, shootCount) {
  const parts = [];
  if (meetingCount > 0) {
    parts.push(`${meetingCount} meeting${meetingCount === 1 ? '' : 's'}`);
  }
  if (shootCount > 0) {
    parts.push(`${shootCount} shoot${shootCount === 1 ? '' : 's'}`);
  }
  if (!parts.length) return '';
  return `You have ${parts.join(' and ')} today.`;
}

function cardMatchesScope(card, personalScope, staffName, clientAccountManagers) {
  if (!personalScope || !staffName) return true;
  return cardIsAssignedToStaff(card, staffName, clientAccountManagers);
}

function buildTodayShootItems({
  cards,
  plans,
  getPlan,
  today,
  clientFilter = 'all',
  clientOrder = [],
  staffName = '',
  clientAccountManagers = {},
  personalScope = false,
  includePlanOnlyDays = true,
}) {
  let shootCards = getShootCards(cards);
  if (clientFilter !== 'all') {
    shootCards = shootCards.filter((card) => card.client === clientFilter);
  }

  const todayCards = getCardsForShootDate(shootCards, today);
  const cardSource = includePlanOnlyDays ? todayCards : todayCards.filter((card) =>
    cardMatchesScope(card, personalScope, staffName, clientAccountManagers),
  );

  const groups = groupShootDayClients(
    cardSource,
    today,
    getPlan,
    plans,
    clientOrder,
  );

  const items = [];

  for (const group of groups) {
    if (clientFilter !== 'all' && group.client !== clientFilter) continue;

    const scopedCards = group.cards.filter((card) =>
      cardMatchesScope(card, personalScope, staffName, clientAccountManagers),
    );

    if (personalScope && staffName && scopedCards.length === 0) continue;
    if (scopedCards.length === 0 && !includePlanOnlyDays) continue;

    const plan = getPlan?.(group.client, today) || {};
    const time = resolveShootDayTime(plan, scopedCards);
    const endTime = resolveShootDayEndTime(plan, scopedCards);

    items.push({
      id: `shoot-day-${group.client}-${today}`,
      kind: 'shoot',
      sortTime: time,
      time,
      endTime,
      title: getShootDayTitle(plan, group.client),
      subtitle: buildShootDayTimelineSubtitle(group.client, scopedCards, plan),
      shootDay: {
        client: group.client,
        dateKey: today,
      },
    });
  }

  return items;
}

export function buildTodayTimeline({
  meetings = [],
  cards = [],
  plans = {},
  getPlan,
  clientFilter = 'all',
  clientOrder = [],
  staffName = '',
  clientAccountManagers = {},
  personalScope = false,
  includePlanOnlyDays = true,
}) {
  const today = toDateKey(new Date());
  const visibleMeetings = filterMeetings(meetings, { client: clientFilter });
  const todayMeetings = expandMeetingsForRange(visibleMeetings, today, today);
  const shootItems = buildTodayShootItems({
    cards,
    plans,
    getPlan,
    today,
    clientFilter,
    clientOrder,
    staffName,
    clientAccountManagers,
    personalScope,
    includePlanOnlyDays,
  });

  const items = [];

  for (const meeting of todayMeetings) {
    items.push({
      id: meeting.occurrenceKey || meeting.id,
      kind: 'meeting',
      sortTime: meeting.time || '',
      time: meeting.time || '',
      endTime: meeting.endTime || '',
      title: meeting.title,
      subtitle: [getMeetingContactLabel(meeting), meeting.location].filter(Boolean).join(' · '),
      meeting,
    });
  }

  items.push(...shootItems);

  items.sort((a, b) => {
    const timeCompare = (a.sortTime || '99:99').localeCompare(b.sortTime || '99:99');
    if (timeCompare !== 0) return timeCompare;
    if (a.kind !== b.kind) return a.kind === 'meeting' ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return {
    today,
    meetingCount: todayMeetings.length,
    shootCount: shootItems.length,
    shootDayCount: shootItems.length,
    items,
  };
}
