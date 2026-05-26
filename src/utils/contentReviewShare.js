import { encodeSharePayload, decodeSharePayload, decodeShareQueryParam } from './sharePayload';

const RESPONSES_KEY = 'medici-social-content-review-responses';

export function getContentReviewPortalClient() {
  const params = new URLSearchParams(window.location.search);
  const client = params.get('content');
  return client ? decodeURIComponent(client) : null;
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

export function mergePortalCards(storedCards, client, snapshot) {
  const stored = storedCards.filter(
    (c) => c.client === client && c.columnId === 'in-review',
  );

  if (!snapshot?.cards?.length) return stored;

  const byId = new Map(stored.map((c) => [c.id, c]));
  for (const item of snapshot.cards) {
    if (item.client === client && !byId.has(item.id)) {
      byId.set(item.id, {
        ...item,
        platform: 'Instagram',
        columnId: 'in-review',
        status: 'In Review',
      });
    }
  }

  return [...byId.values()];
}

export function loadContentReviewResponses() {
  try {
    const raw = localStorage.getItem(RESPONSES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

export function saveContentReviewResponses(responses) {
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(responses));
}

export function queueContentReviewResponse(response) {
  const existing = loadContentReviewResponses();
  const filtered = existing.filter((r) => r.cardId !== response.cardId);
  saveContentReviewResponses([...filtered, response]);
}

export function clearContentReviewResponses() {
  localStorage.removeItem(RESPONSES_KEY);
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

  for (const response of responses) {
    const card = cards.find((c) => c.id === response.cardId);
    if (!card || card.columnId !== 'in-review') continue;

    const comment = (response.comment || '').trim();

    if (response.action === 'approved') {
      updateCard(response.cardId, {
        columnId: 'approved',
        status: 'Approved',
        clientComment: comment,
      });
      applied += 1;
      continue;
    }

    if (response.action === 'denied') {
      if (!comment) continue;
      updateCard(response.cardId, buildContentReviewDenyUpdates(card, comment, response.timestamp));
      applied += 1;
    }
  }

  if (applied > 0) clearContentReviewResponses();
  return applied;
}
