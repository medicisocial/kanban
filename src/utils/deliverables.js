import { SCHEDULED_POST_CONTENT_TYPES } from '../constants';
import { clientMatchesBrand } from './clients';
import { isSameCalendarMonthDateKey } from './editorTodo';

/** Current month as "YYYY-MM". */
export function currentYearMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function shiftYearMonth(yearMonth, offset) {
  const [year, month] = String(yearMonth || currentYearMonth()).split('-').map(Number);
  const d = new Date(year, (month - 1) + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatYearMonthLabel(yearMonth) {
  const [year, month] = String(yearMonth || currentYearMonth()).split('-').map(Number);
  const d = new Date(year, (month || 1) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function yearMonthToReferenceDate(yearMonth) {
  const [year, month] = String(yearMonth || currentYearMonth()).split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1);
}

/** Cards that count toward a client's monthly deliverable target: scheduled post types with a dueDate that month. */
export function getPlannedCardsForClientMonth(cards, client, yearMonth) {
  const referenceDate = yearMonthToReferenceDate(yearMonth);
  return (cards || []).filter(
    (card) =>
      card &&
      clientMatchesBrand(card.client, client) &&
      SCHEDULED_POST_CONTENT_TYPES.includes(card.contentType) &&
      isSameCalendarMonthDateKey(card.dueDate, referenceDate),
  );
}

/** Story cards active that month (recurrence-based — shown separately, not counted toward the target). */
export function getStoryCardsForClientMonth(cards, client, yearMonth) {
  const referenceDate = yearMonthToReferenceDate(yearMonth);
  return (cards || []).filter(
    (card) =>
      card &&
      clientMatchesBrand(card.client, client) &&
      card.contentType === 'Story' &&
      (isSameCalendarMonthDateKey(card.dueDate, referenceDate) ||
        isSameCalendarMonthDateKey(card.shootDate, referenceDate)),
  );
}

export function buildClientDeliverableSummary(cards, client, yearMonth, target) {
  const planned = getPlannedCardsForClientMonth(cards, client, yearMonth);
  const byType = {};
  for (const type of SCHEDULED_POST_CONTENT_TYPES) {
    byType[type] = planned.filter((card) => card.contentType === type).length;
  }
  const storyCards = getStoryCardsForClientMonth(cards, client, yearMonth);
  const plannedCount = planned.length;
  const targetCount = Math.max(0, Number(target) || 0);
  return {
    client,
    target: targetCount,
    planned: plannedCount,
    byType,
    storyCount: storyCards.length,
    remaining: Math.max(0, targetCount - plannedCount),
    onTrack: targetCount === 0 || plannedCount >= targetCount,
    cards: planned,
    storyCards,
  };
}
