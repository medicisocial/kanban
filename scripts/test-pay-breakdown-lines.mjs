import assert from 'node:assert/strict';
import { buildPlanBasedPayByAssignee } from '../src/utils/planBasedPay.js';
import { buildPayBreakdownLines } from '../src/utils/payBreakdownLines.js';
import { DEFAULT_PAY_RATES } from '../src/constants/clientPlans.js';

const rates = { ...DEFAULT_PAY_RATES };

// Two clients on one AM → two amBreakdown rows summing to amPay
{
  const { byName } = buildPlanBasedPayByAssignee({
    clients: ['Arco Fit', 'Plume'],
    getClientAccountManager: () => 'Jeslyn Test',
    getClientVideographer: () => '',
    getClientPhotographer: () => '',
    getClientReelPointsTarget: (c) => (c === 'Arco Fit' ? 2 : 0),
    getClientCarouselStaticTarget: () => 0,
    getClientShootDaysPerMonth: () => 0,
    getClientShootHoursPerDay: () => 0,
    rates,
  });
  const jeslyn = byName['jeslyn test'];
  assert.ok(jeslyn);
  assert.equal(jeslyn.amBreakdown.length, 2);
  const sum = jeslyn.amBreakdown.reduce((s, row) => s + row.amount, 0);
  assert.equal(sum, jeslyn.amPay);
  assert.ok(jeslyn.amBreakdown.some((row) => row.client === 'Arco Fit'));
  assert.ok(jeslyn.amBreakdown.some((row) => row.client === 'Plume'));
}

// Creator/photographer breakdown when shoot hours > 0
{
  const { byName } = buildPlanBasedPayByAssignee({
    clients: ['Arco Fit'],
    getClientAccountManager: () => '',
    getClientVideographer: () => 'Creator One',
    getClientPhotographer: () => 'Photo One',
    getClientReelPointsTarget: () => 0,
    getClientCarouselStaticTarget: () => 0,
    getClientShootDaysPerMonth: () => 2,
    getClientShootHoursPerDay: () => 3,
    rates,
  });
  const creator = byName['creator one'];
  const photo = byName['photo one'];
  assert.ok(creator.videographerPay > 0);
  assert.equal(creator.videographerBreakdown.length, 1);
  assert.equal(creator.videographerBreakdown[0].client, 'Arco Fit');
  assert.equal(creator.videographerBreakdown[0].shootHours, 6);
  assert.ok(photo.photographerPay > 0);
  assert.equal(photo.photographerBreakdown.length, 1);
}

// buildPayBreakdownLines attaches AM children from amBreakdown
{
  const person = {
    amPay: 200,
    amBreakdown: [
      { client: 'Plume', amount: 160, reelPoints: 0, carouselStaticPoints: 0 },
      { client: 'Arco Fit', amount: 40, reelPoints: 2, carouselStaticPoints: 0 },
    ],
    videographerPay: 0,
    photographerPay: 0,
    points: 0,
    carousels: 0,
    statics: 0,
  };
  const lines = buildPayBreakdownLines(person, rates, { completedCards: [] });
  const am = lines.find((line) => line.id === 'am');
  assert.ok(am);
  assert.equal(am.label, 'Account manager');
  assert.equal(am.children.length, 2);
  assert.equal(am.children[0].label, 'Arco Fit'); // sorted
  assert.equal(am.children[1].label, 'Plume');
}

// Editor reel children from completed cards
{
  const person = {
    amPay: 0,
    points: 1,
    reelPay: rates.reelPointRate,
    carousels: 0,
    statics: 0,
  };
  const lines = buildPayBreakdownLines(person, rates, {
    completedCards: [
      {
        id: '1',
        title: 'Hook reel',
        client: 'Arco Fit',
        contentType: 'Reel',
        editorPoints: 1,
      },
      {
        id: '2',
        title: 'Feed carousel',
        client: 'Plume',
        contentType: 'Carousel',
      },
    ],
  });
  const reels = lines.find((line) => line.id === 'reels');
  assert.ok(reels);
  assert.equal(reels.children.length, 1);
  assert.equal(reels.children[0].label, 'Hook reel');
  assert.equal(reels.children[0].hint, 'Arco Fit');
}

console.log('test-pay-breakdown-lines: ok');
