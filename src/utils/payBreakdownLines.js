import { DEFAULT_PAY_RATES } from '../constants/clientPlans.js';

function normalizeEditorPoints(value) {
  const num = Number(value);
  if (num === 0.5) return 0.5;
  return 1;
}

/** Mirror of getCardEditorPay — local so node tests avoid constants.js side imports. */
function cardEditorPay(card, rates = {}) {
  if (!card) return 0;
  const reelRate = Number(rates.reelPointRate);
  const carouselRate = Number(rates.carouselRate);
  const staticRate = Number(rates.staticPostRate);
  const reel =
    Number.isFinite(reelRate) && reelRate >= 0
      ? reelRate
      : DEFAULT_PAY_RATES.reelPointRate;
  const carousel =
    Number.isFinite(carouselRate) && carouselRate >= 0
      ? carouselRate
      : DEFAULT_PAY_RATES.carouselRate;
  const staticPost =
    Number.isFinite(staticRate) && staticRate >= 0
      ? staticRate
      : DEFAULT_PAY_RATES.staticPostRate;
  if (
    card.contentType === 'Reel' ||
    card.isOneOffProject ||
    card.contentType === 'One-off Project'
  ) {
    return normalizeEditorPoints(card.editorPoints) * reel;
  }
  if (card.contentType === 'Carousel') return carousel;
  if (card.contentType === 'Static Post') return staticPost;
  return 0;
}

function sortBreakdown(rows = []) {
  return [...rows].sort((a, b) =>
    String(a.label || a.client || '').localeCompare(String(b.label || b.client || '')),
  );
}

function amClientChildren(breakdown = [], rates = {}) {
  const base = rates.accountManagerBase ?? DEFAULT_PAY_RATES.accountManagerBase;
  const perReel =
    rates.accountManagerPerReelPoint ?? DEFAULT_PAY_RATES.accountManagerPerReelPoint;
  const perFeed =
    rates.accountManagerPerCarousel ?? DEFAULT_PAY_RATES.accountManagerPerCarousel;
  return sortBreakdown(
    (breakdown || []).map((row) => {
      const reels = Number(row.reelPoints) || 0;
      const feed = Number(row.carouselStaticPoints) || 0;
      const parts = [`$${base} base`];
      if (reels) parts.push(`${reels} reel pts × $${perReel}`);
      if (feed) parts.push(`${feed} feed pts × $${perFeed}`);
      return {
        label: row.client,
        amount: Number(row.amount) || 0,
        hint: parts.join(' + '),
      };
    }),
  );
}

function shootClientChildren(breakdown = [], rates = {}, hourlyKey) {
  const hourly = rates[hourlyKey] ?? DEFAULT_PAY_RATES[hourlyKey];
  return sortBreakdown(
    (breakdown || []).map((row) => {
      const hours = Number(row.shootHours) || 0;
      return {
        label: row.client,
        amount: Number(row.amount) || 0,
        hint: hours ? `${hours} hrs × $${hourly}` : undefined,
      };
    }),
  );
}

function editorCardChildren(cards = [], contentFilter, rates = {}) {
  const rows = [];
  for (const card of cards || []) {
    if (!contentFilter(card)) continue;
    const amount = Number(cardEditorPay(card, rates)) || 0;
    if (!(amount > 0)) continue;
    const title = String(card.title || '').trim() || 'Untitled';
    const client = String(card.client || '').trim();
    rows.push({
      label: title,
      amount,
      hint: client || undefined,
    });
  }
  return rows;
}

/**
 * Build auto pay lines for Finances, with optional expandable children.
 * @param {object} person - snapshot payroll person
 * @param {object} rates
 * @param {{ completedCards?: array }} [options]
 */
export function buildPayBreakdownLines(person, rates = {}, { completedCards = [] } = {}) {
  const reelRate = rates?.reelPointRate ?? DEFAULT_PAY_RATES.reelPointRate;
  const carouselRate = rates?.carouselRate ?? DEFAULT_PAY_RATES.carouselRate;
  const staticRate = rates?.staticPostRate ?? DEFAULT_PAY_RATES.staticPostRate;
  const lines = [];

  if ((person.amPay || 0) > 0) {
    lines.push({
      id: 'am',
      label: 'Account manager',
      amount: person.amPay,
      children: amClientChildren(person.amBreakdown, rates),
    });
  }
  if ((person.videographerPay || 0) > 0) {
    lines.push({
      id: 'videographer',
      label: 'Content creator',
      amount: person.videographerPay,
      children: shootClientChildren(
        person.videographerBreakdown,
        rates,
        'videographerHourly',
      ),
    });
  }
  if ((person.photographerPay || 0) > 0) {
    lines.push({
      id: 'photographer',
      label: 'Photographer',
      amount: person.photographerPay,
      children: shootClientChildren(
        person.photographerBreakdown,
        rates,
        'photographerHourly',
      ),
    });
  }
  if ((person.points || 0) > 0 || (person.reelPay || 0) > 0) {
    lines.push({
      id: 'reels',
      label: `Reels · ${person.points || 0} pts`,
      amount: person.reelPay ?? (person.points || 0) * reelRate,
      hint: `$${reelRate}/pt`,
      children: editorCardChildren(
        completedCards,
        (card) =>
          card.contentType === 'Reel' ||
          card.isOneOffProject ||
          card.contentType === 'One-off Project',
        rates,
      ),
    });
  }
  if ((person.carousels || 0) > 0 || (person.carouselPay || 0) > 0) {
    lines.push({
      id: 'carousels',
      label: `Carousels · ${person.carousels || 0}`,
      amount: person.carouselPay || 0,
      hint: `$${carouselRate}`,
      children: editorCardChildren(
        completedCards,
        (card) => card.contentType === 'Carousel',
        rates,
      ),
    });
  }
  if ((person.statics || 0) > 0 || (person.staticPay || 0) > 0) {
    lines.push({
      id: 'statics',
      label: `Statics · ${person.statics || 0}`,
      amount: person.staticPay || 0,
      hint: `$${staticRate}`,
      children: editorCardChildren(
        completedCards,
        (card) => card.contentType === 'Static Post',
        rates,
      ),
    });
  }

  return lines;
}
