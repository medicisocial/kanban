import { isOneOffProjectCard } from '../constants';
import { matchesClientFilter } from './clients';
import { getCalendarPosts } from './calendar';
import { isSameCalendarMonthDateKey } from './editorTodo';
import {
  currentYearMonth,
  formatYearMonthLabel,
  shiftYearMonth,
} from './deliverables';

export { currentYearMonth, formatYearMonthLabel, shiftYearMonth };

export const METRIC_FIELDS = [
  'views',
  'likes',
  'shares',
  'saves',
  'comments',
  'follows',
];

export const METRIC_FIELD_LABELS = {
  views: 'Views',
  likes: 'Likes',
  shares: 'Shares',
  saves: 'Saves',
  comments: 'Comments',
  follows: 'Follows',
};

function toNonNegativeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** Normalize a metrics object (or card.metrics) to zeros for missing fields. */
export function normalizeCardMetrics(metricsOrCard = {}) {
  const raw =
    metricsOrCard && typeof metricsOrCard === 'object' && metricsOrCard.metrics
      ? metricsOrCard.metrics
      : metricsOrCard;
  const source = raw && typeof raw === 'object' ? raw : {};
  const next = {};
  for (const key of METRIC_FIELDS) {
    next[key] = toNonNegativeInt(source[key]);
  }
  return next;
}

/** Publish month key (YYYY-MM) for metrics bucketing. */
export function getCardMetricsMonthKey(card) {
  if (!card) return '';
  const dateKey = isOneOffProjectCard(card)
    ? String(card.dueDate || card.shootDate || '').trim()
    : String(card.dueDate || '').trim();
  if (!dateKey || dateKey.length < 7) return '';
  return dateKey.slice(0, 7);
}

function yearMonthToReferenceDate(yearMonth) {
  const [year, month] = String(yearMonth || currentYearMonth()).split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1);
}

/** Calendar posts whose publish date falls in the selected month. */
export function getMetricsCardsForMonth(cards = [], { monthKey, client } = {}) {
  const key = monthKey || currentYearMonth();
  const referenceDate = yearMonthToReferenceDate(key);
  return getCalendarPosts(cards)
    .filter((card) => {
      const dateKey = isOneOffProjectCard(card)
        ? String(card.dueDate || card.shootDate || '').trim()
        : String(card.dueDate || '').trim();
      if (!dateKey) return false;
      if (!isSameCalendarMonthDateKey(dateKey, referenceDate)) return false;
      if (!matchesClientFilter(card.client, client)) return false;
      return true;
    })
    .sort((a, b) => {
      const dateCompare = String(a.dueDate || a.shootDate || '').localeCompare(
        String(b.dueDate || b.shootDate || ''),
      );
      if (dateCompare !== 0) return dateCompare;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
}

export function sumCardMetrics(cards = []) {
  const totals = normalizeCardMetrics({});
  for (const card of cards) {
    const metrics = normalizeCardMetrics(card);
    for (const key of METRIC_FIELDS) {
      totals[key] += metrics[key];
    }
  }
  return totals;
}

/** Content mix for the monthly overview. */
export function countMetricsContentTypes(cards = []) {
  let reels = 0;
  let carouselStatics = 0;
  for (const card of cards) {
    if (card.contentType === 'Reel') reels += 1;
    else if (card.contentType === 'Carousel' || card.contentType === 'Static Post') {
      carouselStatics += 1;
    }
  }
  return {
    reels,
    carouselStatics,
    total: cards.length,
  };
}

export function patchCardMetrics(card, field, value) {
  return {
    ...normalizeCardMetrics(card),
    [field]: toNonNegativeInt(value),
  };
}

/**
 * Build a metrics-only card update. Never includes columnId/status/postedAt —
 * those must stay out of metrics writes so intentional pipeline regressions
 * (and `_allowPipelineRegression`) are not disturbed by analytics edits.
 */
export function buildCardMetricsUpdate(card, field, value) {
  return { metrics: patchCardMetrics(card, field, value) };
}
