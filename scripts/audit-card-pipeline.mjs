import {
  CARD_PIPELINE_RANK,
  applyVaultIdeaShootSchedule,
  getCardPipelineRank,
  isActiveShootQueueCard,
  mergeCardPipelineFields,
} from '../src/utils/cardPipelineMerge.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const STATUS_FOR_COLUMN = {
  shoot: 'To Create',
  editing: 'Editing',
  'in-review': 'In Review',
  'not-approved': 'Not Approved',
  approved: 'Approved',
  scheduled: 'Scheduled',
  finished: 'Finished',
};

function getToCreateQueueCards(cards) {
  return cards.filter((card) => card.columnId === 'shoot');
}

function getShootCards(cards) {
  return cards.filter(
    (card) => card.shootDate && card.contentType !== 'Story' && card.columnId === 'shoot',
  );
}

function isShootSessionCandidate(card, dateKey) {
  if (!card || card.contentType === 'Story' || card.isShootSession) return false;
  if (card.columnId !== 'shoot') return false;
  return (card.shootDate || '') === dateKey;
}

function cardStatusMatchesColumn(card) {
  const expected = STATUS_FOR_COLUMN[card.columnId];
  if (!expected) return true;
  return (card.status || '') === expected;
}

function findDuplicateShootCopies(cards) {
  const advancedColumns = new Set(['editing', 'in-review', 'not-approved', 'approved', 'scheduled', 'finished']);
  const duplicates = [];

  for (const shootCard of cards) {
    if (shootCard.columnId !== 'shoot') continue;
    for (const other of cards) {
      if (other.id === shootCard.id) continue;
      if (other.client !== shootCard.client) continue;
      if ((other.title || '').trim().toLowerCase() !== (shootCard.title || '').trim().toLowerCase()) continue;
      if (!advancedColumns.has(other.columnId)) continue;
      duplicates.push({
        client: shootCard.client,
        title: shootCard.title,
        shootId: shootCard.id,
        advancedId: other.id,
        advancedColumn: other.columnId,
      });
    }
  }

  return duplicates;
}

function findFinishedCardsInCreateQueue(cards) {
  return cards.filter((card) => {
    const rank = getCardPipelineRank(card.columnId);
    return rank > CARD_PIPELINE_RANK.shoot && getToCreateQueueCards([card]).length > 0;
  });
}

function findFinishedCardsOnShootDay(cards) {
  return cards.filter((card) => {
    const rank = getCardPipelineRank(card.columnId);
    if (rank <= CARD_PIPELINE_RANK.shoot || !card.shootDate) return false;
    return getShootCards([card]).length > 0 || isShootSessionCandidate(card, card.shootDate);
  });
}

function auditCardCollection(cards) {
  const issues = [];

  for (const card of cards) {
    if (!cardStatusMatchesColumn(card)) {
      issues.push(
        `${card.client} · ${card.title}: status "${card.status}" does not match column "${card.columnId}"`,
      );
    }
  }

  for (const duplicate of findDuplicateShootCopies(cards)) {
    issues.push(
      `${duplicate.client} · ${duplicate.title}: duplicate in shoot (${duplicate.shootId}) and ${duplicate.advancedColumn} (${duplicate.advancedId})`,
    );
  }

  for (const card of findFinishedCardsInCreateQueue(cards)) {
    issues.push(
      `${card.client} · ${card.title}: column "${card.columnId}" would still appear in content creator To Create queue`,
    );
  }

  for (const card of findFinishedCardsOnShootDay(cards)) {
    issues.push(
      `${card.client} · ${card.title}: column "${card.columnId}" would still appear on shoot day for ${card.shootDate}`,
    );
  }

  return issues;
}

async function fetchLiveCards(orgId = 'medici') {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;

  const endpoint = `${url}/rest/v1/cards?select=id,data&org_id=eq.${encodeURIComponent(orgId)}`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Live card audit fetch failed: ${response.status}`);
  }

  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).map((row) => ({ id: row.id, ...(row.data || {}) }));
}

// Guard logic: re-scheduling a finished card must not move it back to shoot.
{
  const scheduled = applyVaultIdeaShootSchedule(
    { id: 'card-1', columnId: 'scheduled', status: 'Scheduled', title: 'Ara Tox Club' },
    { shootDate: '2026-06-18' },
    { isNew: false },
  );
  assert(scheduled.columnId === 'scheduled', 'vault re-schedule must not regress scheduled cards');
  assert(scheduled.shootDate === '2026-06-18', 'vault re-schedule should still update shoot date');
}

{
  const created = applyVaultIdeaShootSchedule(
    { id: 'card-2', columnId: 'shoot', status: 'To Create', title: 'New idea card' },
    { shootDate: '2026-06-18' },
    { isNew: true },
  );
  assert(created.columnId === 'shoot', 'new vault cards should start in shoot');
}

{
  const merged = mergeCardPipelineFields(
    { columnId: 'scheduled', status: 'Scheduled', updatedAt: 200 },
    { columnId: 'shoot', status: 'To Create', title: 'Burn It', updatedAt: 999 },
  );
  assert(merged.columnId === 'scheduled', 'pipeline merge must keep scheduled over stale shoot writes');
}

{
  const sample = [
    { id: '1', client: 'Ara Med Spa', title: 'Burn It', columnId: 'scheduled', status: 'Scheduled', shootDate: '2026-06-18' },
    { id: '2', client: 'Ara Med Spa', title: 'Burn It', columnId: 'shoot', status: 'To Create', shootDate: '2026-06-18' },
  ];
  const issues = auditCardCollection(sample);
  assert(issues.some((issue) => issue.includes('duplicate in shoot')), 'audit should flag duplicate shoot copies');
}

{
  const sample = [
    { id: '1', client: 'Ara Med Spa', title: 'Ara Tox Club', columnId: 'scheduled', status: 'Scheduled', shootDate: '2026-06-18' },
  ];
  assert(findFinishedCardsInCreateQueue(sample).length === 0, 'scheduled cards must not qualify for To Create queue');
  assert(findFinishedCardsOnShootDay(sample).length === 0, 'scheduled cards must not appear on shoot day views');
  assert(getShootCards(sample).length === 0, 'getShootCards must exclude scheduled cards');
  assert(!isActiveShootQueueCard(sample[0]), 'scheduled cards are not active shoot queue cards');
}

const liveCards = await fetchLiveCards();
if (liveCards) {
  const liveIssues = auditCardCollection(liveCards);
  if (liveIssues.length) {
    console.error('Live card pipeline audit found issues:');
    for (const issue of liveIssues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }
  console.log(`Live card pipeline audit passed for ${liveCards.length} cards.`);
} else {
  console.log('Live card pipeline audit skipped (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).');
}

console.log('Card pipeline audit tests passed.');
