/** First-approval-wins for multi-recipient content review share links. */

function mergeContentReviewQueueEntry(existing, incoming) {
  if (!incoming?.cardId) return existing || null;
  if (existing?.action === 'approved') return existing;
  if (incoming.action === 'approved') return incoming;
  return incoming;
}

function finalizeContentReviewResponses(responses) {
  const byCardId = new Map();
  for (const response of responses || []) {
    if (!response?.cardId) continue;
    const prev = byCardId.get(response.cardId);
    if (response.action === 'approved') {
      byCardId.set(response.cardId, response);
      continue;
    }
    if (!prev || prev.action !== 'approved') {
      byCardId.set(response.cardId, response);
    }
  }
  return [...byCardId.values()];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const cardId = 'card-1';

assert(
  mergeContentReviewQueueEntry(
    { cardId, action: 'approved', comment: 'Looks good' },
    { cardId, action: 'denied', comment: 'Wait' },
  ).action === 'approved',
  'queued approval is not replaced by a later deny',
);

assert(
  mergeContentReviewQueueEntry(
    { cardId, action: 'denied', comment: 'Revise' },
    { cardId, action: 'approved', comment: 'Actually fine' },
  ).action === 'approved',
  'queued approval replaces an earlier deny',
);

const finalized = finalizeContentReviewResponses([
  { cardId, action: 'denied', comment: 'No' },
  { cardId, action: 'approved', comment: 'Yes' },
  { cardId: 'card-2', action: 'denied', comment: 'Fix hook' },
]);

assert(finalized.length === 2, 'one final response per card');
assert(
  finalized.find((entry) => entry.cardId === cardId)?.action === 'approved',
  'approval wins when collapsing responses for the same card',
);

console.log('test-content-review-first-approve: ok');
