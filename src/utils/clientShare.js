import { clientMatchesBrand } from './clients';
import { encodeSharePayload, decodeSharePayload, decodeShareQueryParam } from './sharePayload';

export function getClientPortalClient() {
  const params = new URLSearchParams(window.location.search);
  const client = params.get('client');
  if (!client || client === '1') return null;
  return decodeURIComponent(client);
}

export function isClientPortal() {
  return Boolean(getClientPortalClient());
}

function compactIdea(idea) {
  return [
    idea.id,
    idea.title,
    idea.contentType,
    idea.referenceVideo || '',
    idea.description || '',
    idea.status,
    idea.clientComment || '',
  ];
}

function expandIdea(client, tuple) {
  const [id, title, contentType, referenceVideo, description, status, clientComment] = tuple;
  return {
    id,
    client,
    title,
    contentType,
    referenceVideo,
    description,
    status,
    clientComment,
  };
}

function expandIdeaSnapshot(data, client) {
  if (data.v === 2 && Array.isArray(data.i)) {
    return {
      client,
      ideas: data.i.map((tuple) => expandIdea(client, tuple)),
    };
  }

  return data;
}

export function parseShareHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const data = decodeSharePayload(hash);
  if (!data) return null;
  const client = getClientPortalClient() || data.client || data.c;
  return expandIdeaSnapshot(data, client);
}

export function buildClientShareUrl(client, pendingIdeas) {
  const payload = encodeSharePayload({
    v: 2,
    i: pendingIdeas.map(compactIdea),
  });
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?client=${encodeURIComponent(client)}#${payload}`;
}

export function mergePortalIdeas(storedIdeas, client, snapshot) {
  const storedPending = storedIdeas.filter(
    (i) => clientMatchesBrand(i.client, client) && i.status === 'pending',
  );

  if (!snapshot?.ideas?.length) return storedPending;

  const byId = new Map(storedPending.map((i) => [i.id, i]));
  for (const idea of snapshot.ideas) {
    if (clientMatchesBrand(idea.client, client) && idea.status === 'pending' && !byId.has(idea.id)) {
      byId.set(idea.id, idea);
    }
  }

  return [...byId.values()];
}

export function loadClientResponses() {
  try {
    const raw = localStorage.getItem('medici-social-client-responses');
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

export function saveClientResponses(responses) {
  localStorage.setItem('medici-social-client-responses', JSON.stringify(responses));
}

export function queueClientResponse(response) {
  const existing = loadClientResponses();
  const filtered = existing.filter((r) => r.ideaId !== response.ideaId);
  saveClientResponses([...filtered, response]);
}

export function clearClientResponses() {
  localStorage.removeItem('medici-social-client-responses');
}

function compactIdeaResponse(response) {
  const idea = response.idea ? compactIdea(response.idea) : null;
  return [
    response.ideaId,
    response.action,
    response.comment || '',
    response.timestamp,
    response.client,
    idea,
  ];
}

function expandIdeaResponses(data) {
  if (data.v === 2 && Array.isArray(data.r)) {
    return {
      exportedAt: data.t || Date.now(),
      responses: data.r.map(([ideaId, action, comment, timestamp, client, ideaTuple]) => ({
        ideaId,
        action,
        comment,
        timestamp,
        client,
        idea: ideaTuple ? expandIdea(client, ideaTuple) : null,
      })),
    };
  }

  return data;
}

export function buildImportUrl(responses) {
  const payload = encodeSharePayload({
    v: 2,
    t: Date.now(),
    r: responses.map(compactIdeaResponse),
  });
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?import=${payload}`;
}

export function parseImportParam() {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('import');
  if (!data) return null;
  const parsed = decodeShareQueryParam(data);
  if (!parsed) return null;
  return expandIdeaResponses(parsed);
}
