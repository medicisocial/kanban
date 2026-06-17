import { clientMatchesBrand } from './clients';
import { isCloudSourceOfTruth } from '../lib/cloudSourceOfTruth';
import { shouldUsePortalResponseQueue, queueStorageKey } from './portalResponseQueue';

const RESPONSES_KEY = 'medici-social-content-review-responses';

export function getContentReviewPortalClient() {
  const params = new URLSearchParams(window.location.search);
  const client = params.get('content');
  return client ? decodeURIComponent(client) : null;
}

export function getContentReviewReviewer() {
  const params = new URLSearchParams(window.location.search);
  const email = params.get('reviewAs');
  return email ? decodeURIComponent(email).trim().toLowerCase() : '';
}

function normalizeShareEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeContentReviewShare(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const invited = Array.isArray(source.invited)
    ? source.invited
        .map((entry) => ({
          email: normalizeShareEmail(entry?.email),
          name: String(entry?.name || '').trim(),
          invitedAt: Number(entry?.invitedAt) || Date.now(),
        }))
        .filter((entry) => entry.email)
    : [];
  const responses = Array.isArray(source.responses)
    ? source.responses
        .map((entry) => ({
          email: normalizeShareEmail(entry?.email),
          name: String(entry?.name || '').trim(),
          action: entry?.action === 'approved' ? 'approved' : entry?.action === 'denied' ? 'denied' : '',
          comment: String(entry?.comment || '').trim(),
          timestamp: Number(entry?.timestamp) || Date.now(),
        }))
        .filter((entry) => entry.email && entry.action)
    : [];

  return { invited, responses, roundStartedAt: Number(source.roundStartedAt) || null };
}

export function reviewerHasResponded(share, email) {
  const normalized = normalizeShareEmail(email);
  if (!normalized) return false;
  return normalizeContentReviewShare(share).responses.some((entry) => entry.email === normalized);
}

export function getPeerShareResponses(share, viewerEmail) {
  const normalized = normalizeShareEmail(viewerEmail);
  return normalizeContentReviewShare(share).responses.filter((entry) => entry.email !== normalized);
}

export function resolveShareBoardAction(responses) {
  const list = Array.isArray(responses) ? responses : [];
  if (list.some((entry) => entry.action === 'denied')) return 'denied';
  if (list.some((entry) => entry.action === 'approved')) return 'approved';
  return null;
}

export function formatReviewerFirstName(response) {
  const name = String(response?.name || '').trim();
  if (name) return name.split(/\s+/)[0];
  const email = normalizeShareEmail(response?.email);
  if (!email) return 'Someone';
  const local = email.split('@')[0] || email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function buildPeerApprovalMessage(response, contentType = 'reel') {
  const label = String(contentType || 'reel').toLowerCase();
  return `${formatReviewerFirstName(response)} approved this ${label}`;
}

function expandContentSnapshot(data, client) {
  if (data.v === 2 && Array.isArray(data.i)) {
    return {
      client,
      cards: data.i.map(([id, title, contentType, dropboxLink, notes]) => ({
        id,
        client,
        title,
        contentType,
        dropboxLink: dropboxLink || '',
        notes: notes || '',
        columnId: 'in-review',
      })),
    };
  }

  return data;
}

export function parseContentShareHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const data = decodeSharePayload(hash);
  if (!data) return null;
  const client = getContentReviewPortalClient() || data.client || data.c;
  return expandContentSnapshot(data, client);
}

export function snapshotCard(card) {
  return {
    id: card.id,
    client: card.client,
    title: card.title,
    contentType: card.contentType,
    dropboxLink: card.dropboxLink || '',
    notes: card.notes || '',
    columnId: 'in-review',
  };
}

export function buildContentReviewShareUrl(client, reviewCards) {
  const payload = encodeSharePayload({
    v: 2,
    i: reviewCards.map((card) => [
      card.id,
      card.title,
      card.contentType,
      card.dropboxLink || '',
      card.notes || '',
    ]),
  });
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?content=${encodeURIComponent(client)}#${payload}`;
}

/** Payload for ClientEmailSendModal from one or more in-review cards. */
export function buildContentReviewSharePayload(client, reviewCards) {
  const cards = (reviewCards || []).filter(Boolean);
  return {
    client,
    shareUrl: buildContentReviewShareUrl(client, cards),
    itemCount: cards.length,
  };
}

export function mergePortalCards(storedCards, client, snapshot, { reviewerEmail = '' } = {}) {
  const snapshotIds = new Set((snapshot?.cards || []).map((item) => item.id));

  const stored = storedCards.filter((c) => {
    if (!clientMatchesBrand(c.client, client)) return false;
    if (snapshotIds.has(c.id)) {
      if (reviewerEmail && reviewerHasResponded(c.contentReviewShare, reviewerEmail)) return false;
      return true;
    }
    return c.columnId === 'in-review';
  });

  if (!snapshot?.cards?.length) return stored;

  const byId = new Map(stored.map((c) => [c.id, c]));
  for (const item of snapshot.cards) {
    if (!clientMatchesBrand(item.client, client)) continue;
    if (reviewerEmail && reviewerHasResponded(byId.get(item.id)?.contentReviewShare, reviewerEmail)) {
      continue;
    }
    if (!byId.has(item.id)) {
      byId.set(item.id, {
        ...item,
        platform: 'Instagram',
        columnId: item.columnId || 'in-review',
        status: item.status || 'In Review',
      });
    }
  }

  return [...byId.values()];
}

export function loadContentReviewResponses() {
  if (!shouldUsePortalResponseQueue()) return [];
  try {
    const raw = localStorage.getItem(queueStorageKey(RESPONSES_KEY));
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

export function saveContentReviewResponses(responses) {
  if (!shouldUsePortalResponseQueue()) return;
  localStorage.setItem(queueStorageKey(RESPONSES_KEY), JSON.stringify(responses));
}

/** Deny overrides approval when merging offline responses for the same card. */
export function mergeContentReviewQueueEntry(existing, incoming) {
  if (!incoming?.cardId) return existing || null;
  if (incoming.action === 'denied') return incoming;
  if (existing?.action === 'denied') return existing;
  if (incoming.action === 'approved') return incoming;
  return incoming;
}

/** Collapse queued responses — any deny wins over approvals for the same card. */
export function finalizeContentReviewResponses(responses) {
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

export function queueContentReviewResponse(response) {
  if (!shouldUsePortalResponseQueue()) return;
  const existing = loadContentReviewResponses();
  const prior = existing.find((r) => r.cardId === response.cardId);
  const merged = mergeContentReviewQueueEntry(prior, response);
  const filtered = existing.filter((r) => r.cardId !== response.cardId);
  saveContentReviewResponses([...filtered, merged]);
}

export function clearContentReviewResponses() {
  if (!shouldUsePortalResponseQueue()) return;
  localStorage.removeItem(queueStorageKey(RESPONSES_KEY));
}

function compactContentResponse(response) {
  return [
    response.cardId,
    response.action,
    response.comment || '',
    response.timestamp,
    response.client,
  ];
}

function expandContentResponses(data) {
  if (data.v === 2 && Array.isArray(data.r)) {
    return {
      exportedAt: data.t || Date.now(),
      responses: data.r.map(([cardId, action, comment, timestamp, client]) => ({
        cardId,
        action,
        comment,
        timestamp,
        client,
      })),
    };
  }

  return data;
}

export function buildContentImportUrl(responses) {
  const payload = encodeSharePayload({
    v: 2,
    t: Date.now(),
    r: responses.map(compactContentResponse),
  });
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?importContent=${payload}`;
}

export function parseContentImportParam() {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('importContent');
  if (!data) return null;
  const parsed = decodeShareQueryParam(data);
  if (!parsed) return null;
  return expandContentResponses(parsed);
}

export function buildContentReviewDenyUpdates(card, comment, timestamp = Date.now()) {
  const trimmed = (comment || '').trim();
  const stamp = new Date(timestamp).toLocaleDateString();
  const noteAppend = trimmed
    ? `\n\nClient revision notes (${stamp}): ${trimmed}`
    : '';
  const backToEditing = Boolean(card.isOneOffProject);
  return {
    columnId: backToEditing ? 'editing' : 'not-approved',
    status: backToEditing ? 'Editing' : 'Not Approved',
    clientComment: trimmed,
    notes: `${card.notes || ''}${noteAppend}`.trim(),
  };
}

export function applyContentReviewResponses(cards, responses, { updateCard }) {
  let applied = 0;

  for (const response of finalizeContentReviewResponses(responses)) {
    const card = cards.find((c) => c.id === response.cardId);
    if (!card) continue;

    const comment = (response.comment || '').trim();

    if (response.action === 'approved') {
      if (card.columnId === 'approved') continue;
      if (!['in-review', 'not-approved'].includes(card.columnId)) continue;
      updateCard(response.cardId, {
        columnId: 'approved',
        status: 'Approved',
        clientComment: comment,
      });
      applied += 1;
      continue;
    }

    if (response.action === 'denied') {
      if (card.columnId !== 'in-review' && card.columnId !== 'approved') continue;
      if (!comment) continue;
      updateCard(response.cardId, buildContentReviewDenyUpdates(card, comment, response.timestamp));
      applied += 1;
    }
  }

  if (applied > 0) clearContentReviewResponses();
  return applied;
}

export async function fetchContentReviewShareState({ brand, cardIds }) {
  if (!cardIds?.length) return { cards: [] };
  const params = new URLSearchParams({
    brand,
    cardIds: cardIds.join(','),
  });
  const response = await fetch(`/api/content-review-share?${params}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Could not load review items.');
  }
  return payload;
}

export async function submitContentReviewShareResponse({
  brand,
  cardId,
  action,
  comment = '',
  timestamp = Date.now(),
  reviewerEmail = getContentReviewReviewer(),
  reviewerName = '',
}) {
  const response = await fetch('/api/content-review-share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brand,
      cardId,
      action,
      comment,
      timestamp,
      reviewerEmail,
      reviewerName,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Could not save your response.');
  }
  return payload;
}

export function shouldApplyContentReviewViaShareApi() {
  return isCloudSourceOfTruth() && Boolean(getContentReviewPortalClient());
}
