import { encodeSharePayload, decodeSharePayload, decodeShareQueryParam } from './sharePayload';

export function getShootPortalParams() {
  const params = new URLSearchParams(window.location.search);
  const client = params.get('shoot');
  const date = params.get('date');
  if (!client || !date) return null;
  return { client: decodeURIComponent(client), dateKey: date };
}

function compactShootCard(card) {
  return [
    card.id,
    card.title,
    card.contentType,
    card.shootTime || '',
    card.shootEndTime || '',
    card.shootDuration || '',
    card.shootModels || '',
    card.shootNeeds || '',
    card.shootScript || '',
    card.referenceVideo || '',
    card.notes || '',
  ];
}

function expandShootCard(client, dateKey, tuple) {
  const [
    id,
    title,
    contentType,
    shootTime,
    shootEndTime,
    shootDuration,
    shootModels,
    shootNeeds,
    shootScript,
    referenceVideo,
    notes,
  ] = tuple;

  return {
    id,
    client,
    title,
    contentType,
    shootTime,
    shootEndTime,
    shootDuration,
    shootModels,
    shootNeeds,
    shootScript,
    referenceVideo,
    notes,
    shootDate: dateKey,
  };
}

function expandShootSnapshot(data, client, dateKey) {
  if (data.v === 2 && Array.isArray(data.i)) {
    return {
      client,
      dateKey,
      plan: data.p || {},
      cards: data.i.map((tuple) => expandShootCard(client, dateKey, tuple)),
    };
  }

  return data;
}

export function parseShootShareHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const data = decodeSharePayload(hash);
  if (!data) return null;
  const portal = getShootPortalParams();
  const client = portal?.client || data.client;
  const dateKey = portal?.dateKey || data.dateKey;
  return expandShootSnapshot(data, client, dateKey);
}

export function buildShootShareUrl(client, dateKey, cards, plan) {
  const payload = encodeSharePayload({
    v: 2,
    p: plan || {},
    i: cards.map(compactShootCard),
  });
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?shoot=${encodeURIComponent(client)}&date=${dateKey}#${payload}`;
}

export function mergeShootPortalCards(storedCards, client, dateKey, snapshot) {
  const stored = storedCards.filter((c) => c.client === client && c.shootDate === dateKey);
  if (!snapshot?.cards?.length) return stored;

  const byId = new Map(stored.map((c) => [c.id, c]));
  for (const item of snapshot.cards) {
    if (!byId.has(item.id)) {
      byId.set(item.id, {
        ...item,
        client,
        shootDate: dateKey,
        platform: 'Instagram',
      });
    }
  }
  return [...byId.values()];
}

export function buildShootImportUrl(submission) {
  const payload = encodeSharePayload({
    v: 2,
    t: Date.now(),
    s: submission,
  });
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?importShoot=${payload}`;
}

export function parseShootImportParam() {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('importShoot');
  if (!data) return null;
  const parsed = decodeShareQueryParam(data);
  if (!parsed) return null;
  if (parsed.v === 2 && parsed.s) {
    return { responses: parsed.s, exportedAt: parsed.t || Date.now() };
  }
  return parsed;
}

const RESPONSES_KEY = 'medici-social-shoot-responses';

export function buildShootSubmission(client, dateKey, plan, cards) {
  return {
    client,
    dateKey,
    plan: plan || {},
    cards: cards.map((c) => ({
      id: c.id,
      shootTime: c.shootTime || '',
      shootEndTime: c.shootEndTime || '',
      shootDuration: c.shootDuration || '',
      shootModels: c.shootModels || '',
      shootNeeds: c.shootNeeds || '',
      shootScript: c.shootScript || '',
    })),
  };
}

export function applyShootSubmission(submission, cards, { updateCard, updatePlan }) {
  if (!submission?.client || !submission?.dateKey) return 0;

  if (submission.plan && updatePlan) {
    updatePlan(submission.client, submission.dateKey, submission.plan);
  }

  let applied = 0;
  for (const item of submission.cards || []) {
    if (cards.some((c) => c.id === item.id)) {
      updateCard(item.id, {
        shootTime: item.shootTime || '',
        shootEndTime: item.shootEndTime || '',
        shootDuration: item.shootDuration || '',
        shootModels: item.shootModels || '',
        shootNeeds: item.shootNeeds || '',
        shootScript: item.shootScript || '',
      });
      applied += 1;
    }
  }

  return applied;
}

export function loadShootResponses() {
  try {
    const raw = localStorage.getItem(RESPONSES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

export function saveShootResponses(responses) {
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(responses));
}

export function queueShootResponse(response) {
  const key = `${response.client}|${response.dateKey}`;
  const existing = loadShootResponses().filter(
    (r) => `${r.client}|${r.dateKey}` !== key,
  );
  saveShootResponses([...existing, { ...response, timestamp: Date.now() }]);
}

export function clearShootResponses() {
  localStorage.removeItem(RESPONSES_KEY);
}
