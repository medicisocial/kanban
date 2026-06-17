/** Multi-recipient content review — deny overrides approval. */

function mergeContentReviewQueueEntry(existing, incoming) {
  if (!incoming?.cardId) return existing || null;
  if (incoming.action === 'denied') return incoming;
  if (existing?.action === 'denied') return existing;
  if (incoming.action === 'approved') return incoming;
  return incoming;
}

function finalizeContentReviewResponses(responses) {
  const byCardId = new Map();
  for (const response of responses || []) {
    if (!response?.cardId) continue;
    const prev = byCardId.get(response.cardId);
    if (response.action === 'denied') {
      byCardId.set(response.cardId, response);
      continue;
    }
    if (!prev || prev.action !== 'denied') {
      byCardId.set(response.cardId, response);
    }
  }
  return [...byCardId.values()];
}

function shouldShowShareReviewCard(share, reviewerEmail) {
  const normalized = String(reviewerEmail || '').trim().toLowerCase();
  if (!normalized) return true;
  const responses = share?.responses || [];
  const viewerResponded = responses.some((entry) => entry.email === normalized);
  if (!viewerResponded) return true;
  return responses.some(
    (entry) => entry.email !== normalized && entry.action === 'denied',
  );
}

function buildPeerDenialMessage(response, contentType = 'reel') {
  const name = response?.name?.split(/\s+/)[0] || 'Someone';
  const label = String(contentType || 'reel').toLowerCase();
  return `${name} did not approve this ${label}`;
}

function resolveShareBoardAction(responses) {
  const list = Array.isArray(responses) ? responses : [];
  if (list.some((entry) => entry.action === 'denied')) return 'denied';
  if (list.some((entry) => entry.action === 'approved')) return 'approved';
  return null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const cardId = 'card-1';

assert(
  mergeContentReviewQueueEntry(
    { cardId, action: 'approved', comment: 'Looks good' },
    { cardId, action: 'denied', comment: 'Wait' },
  ).action === 'denied',
  'queued deny replaces an earlier approval',
);

assert(
  mergeContentReviewQueueEntry(
    { cardId, action: 'denied', comment: 'Revise' },
    { cardId, action: 'approved', comment: 'Actually fine' },
  ).action === 'denied',
  'queued deny is not replaced by a later approval',
);

const finalized = finalizeContentReviewResponses([
  { cardId, action: 'approved', comment: 'Yes' },
  { cardId, action: 'denied', comment: 'No' },
  { cardId: 'card-2', action: 'approved', comment: 'Good' },
]);

assert(finalized.length === 2, 'one final response per card');
assert(
  finalized.find((entry) => entry.cardId === cardId)?.action === 'denied',
  'deny wins when collapsing responses for the same card',
);

const shareResponses = [
  { email: 'matt@example.com', name: 'Matt', action: 'approved', comment: '', timestamp: 1 },
  { email: 'jason@example.com', name: 'Jason', action: 'denied', comment: 'Fix hook', timestamp: 2 },
];
assert(resolveShareBoardAction(shareResponses) === 'denied', 'any deny sends the card back to edit');
assert(
  resolveShareBoardAction([shareResponses[0]]) === 'approved',
  'one approval is enough when nobody denies',
);

const shareRound = {
  responses: shareResponses,
};
assert(
  shouldShowShareReviewCard(shareRound, 'matt@example.com'),
  'approver still sees the card after a peer denies so they can read why',
);
assert(
  !shouldShowShareReviewCard(
    { responses: [{ email: 'matt@example.com', action: 'approved' }] },
    'matt@example.com',
  ),
  'hide card once viewer responded and no peer denial exists',
);
assert(
  buildPeerDenialMessage({ name: 'Jason' }, 'Reel') === 'Jason did not approve this reel',
  'denial banner names the reviewer',
);

console.log('test-content-review-first-approve: ok');
