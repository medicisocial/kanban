import {
  FEED_POST_CONTENT_TYPES,
  SCHEDULED_POST_CONTENT_TYPES,
  normalizeEditorPoints,
  normalizeReelPointsTarget,
} from '../constants';
import { clientBrandNameKey, clientMatchesBrand } from './clients';
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

function isContractDeliverableCard(card) {
  if (!card || card.isOneOffProject || card.contentType === 'One-off Project') return false;
  return SCHEDULED_POST_CONTENT_TYPES.includes(card.contentType);
}

/** Cards that count toward contract quotas: Reel / Carousel / Static with dueDate that month (not one-offs). */
export function getPlannedCardsForClientMonth(cards, client, yearMonth) {
  const referenceDate = yearMonthToReferenceDate(yearMonth);
  return (cards || []).filter(
    (card) =>
      isContractDeliverableCard(card) &&
      clientMatchesBrand(card.client, client) &&
      isSameCalendarMonthDateKey(card.dueDate, referenceDate),
  );
}

/** Story cards active that month (shown separately, not counted toward contract quotas). */
export function getStoryCardsForClientMonth(cards, client, yearMonth) {
  const referenceDate = yearMonthToReferenceDate(yearMonth);
  return (cards || []).filter(
    (card) =>
      card &&
      !card.isOneOffProject &&
      clientMatchesBrand(card.client, client) &&
      card.contentType === 'Story' &&
      (isSameCalendarMonthDateKey(card.dueDate, referenceDate) ||
        isSameCalendarMonthDateKey(card.shootDate, referenceDate)),
  );
}

/**
 * Single pass over all cards, bucketed by normalized client key — used so the
 * Deliverables page doesn't re-scan the entire card list once per client.
 */
export function groupCardsByClientForMonth(cards, yearMonth) {
  const referenceDate = yearMonthToReferenceDate(yearMonth);
  const planned = new Map();
  const stories = new Map();
  for (const card of cards || []) {
    if (!card || !card.client) continue;
    const key = clientBrandNameKey(card.client);
    if (!key) continue;

    if (isContractDeliverableCard(card) && isSameCalendarMonthDateKey(card.dueDate, referenceDate)) {
      if (!planned.has(key)) planned.set(key, []);
      planned.get(key).push(card);
    }

    if (
      !card.isOneOffProject &&
      card.contentType === 'Story' &&
      (isSameCalendarMonthDateKey(card.dueDate, referenceDate) ||
        isSameCalendarMonthDateKey(card.shootDate, referenceDate))
    ) {
      if (!stories.has(key)) stories.set(key, []);
      stories.get(key).push(card);
    }
  }
  return { planned, stories };
}

/**
 * @param {object} grouped — from groupCardsByClientForMonth
 * @param {string} client
 * @param {{ reelPointsTarget?: number, carouselStaticTarget?: number }} targets
 */
export function buildClientDeliverableSummary(grouped, client, targets = {}) {
  const key = clientBrandNameKey(client);
  const planned = grouped?.planned?.get(key) || [];
  const storyCards = grouped?.stories?.get(key) || [];

  const byType = {};
  for (const type of SCHEDULED_POST_CONTENT_TYPES) {
    byType[type] = 0;
  }

  let reelPointsPlanned = 0;
  let feedPlanned = 0;

  for (const card of planned) {
    if (byType[card.contentType] !== undefined) byType[card.contentType] += 1;
    if (card.contentType === 'Reel') {
      reelPointsPlanned += normalizeEditorPoints(card.editorPoints);
    } else if (FEED_POST_CONTENT_TYPES.includes(card.contentType)) {
      feedPlanned += 1;
    }
  }

  const reelPointsTarget = normalizeReelPointsTarget(targets.reelPointsTarget);
  const carouselStaticTarget = Math.max(0, Math.round(Number(targets.carouselStaticTarget) || 0));

  const reelRemaining = Math.max(0, reelPointsTarget - reelPointsPlanned);
  const feedRemaining = Math.max(0, carouselStaticTarget - feedPlanned);
  const reelOnTrack = reelPointsTarget === 0 || reelPointsPlanned >= reelPointsTarget;
  const feedOnTrack = carouselStaticTarget === 0 || feedPlanned >= carouselStaticTarget;
  const hasAnyTarget = reelPointsTarget > 0 || carouselStaticTarget > 0;
  const onTrack = !hasAnyTarget || (reelOnTrack && feedOnTrack);

  return {
    client,
    reelPointsTarget,
    carouselStaticTarget,
    reelPointsPlanned,
    feedPlanned,
    reelRemaining,
    feedRemaining,
    remaining: reelRemaining + feedRemaining,
    byType,
    storyCount: storyCards.length,
    onTrack,
    reelOnTrack,
    feedOnTrack,
    hasAnyTarget,
    cards: planned,
    storyCards,
    // Back-compat aliases for any old callers (prefer reel/feed fields)
    target: reelPointsTarget + carouselStaticTarget,
    planned: reelPointsPlanned + feedPlanned,
  };
}
