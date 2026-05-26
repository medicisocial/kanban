import { hasStoryRecurrence } from './calendar';
import { encodeSharePayload, decodeSharePayload } from './sharePayload';

export function getCalendarPortalClient() {
  const params = new URLSearchParams(window.location.search);
  const client = params.get('calendar');
  return client ? decodeURIComponent(client) : null;
}

function compactCalendarCard(card) {
  return [
    card.id,
    card.title,
    card.contentType,
    card.dueDate || '',
    card.dueTime || '',
    card.storyRecurrenceDays || [],
    card.storyOccurrenceNotes || {},
    card.dropboxLink || '',
    card.assignedTo || '',
    card.platform || 'Instagram',
    card.notes || '',
  ];
}

function expandCalendarCard(client, tuple) {
  const [
    id,
    title,
    contentType,
    dueDate,
    dueTime,
    storyRecurrenceDays,
    storyOccurrenceNotes,
    dropboxLink,
    assignedTo,
    platform,
    notes,
  ] = tuple;

  return {
    id,
    client,
    title,
    contentType,
    dueDate,
    dueTime,
    storyRecurrenceDays,
    storyOccurrenceNotes,
    dropboxLink,
    assignedTo,
    platform,
    notes,
  };
}

function expandCalendarSnapshot(data, client) {
  if (data.v === 2 && Array.isArray(data.i)) {
    return {
      client,
      cards: data.i.map((tuple) => expandCalendarCard(client, tuple)),
    };
  }

  return data;
}

export function parseCalendarShareHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const data = decodeSharePayload(hash);
  if (!data) return null;
  const client = getCalendarPortalClient() || data.client;
  return expandCalendarSnapshot(data, client);
}

export function snapshotCalendarCard(card) {
  return {
    id: card.id,
    client: card.client,
    title: card.title,
    contentType: card.contentType,
    dueDate: card.dueDate,
    dueTime: card.dueTime || '',
    storyRecurrenceDays: card.storyRecurrenceDays || [],
    storyOccurrenceNotes: card.storyOccurrenceNotes || {},
    dropboxLink: card.dropboxLink || '',
    assignedTo: card.assignedTo || '',
    platform: card.platform || 'Instagram',
    notes: card.notes || '',
  };
}

export function buildCalendarShareUrl(client, scheduledCards) {
  const clientCards = scheduledCards.filter(
    (c) =>
      c.client === client &&
      c.columnId === 'scheduled' &&
      (c.dueDate || hasStoryRecurrence(c)),
  );
  const payload = encodeSharePayload({
    v: 2,
    i: clientCards.map(compactCalendarCard),
  });
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?calendar=${encodeURIComponent(client)}#${payload}`;
}

export function mergePortalCalendarCards(storedCards, client, snapshot) {
  const stored = storedCards.filter(
    (c) =>
      c.client === client &&
      c.columnId === 'scheduled' &&
      (c.dueDate || hasStoryRecurrence(c)),
  );

  if (!snapshot?.cards?.length) return stored;

  const byId = new Map(stored.map((c) => [c.id, c]));
  for (const item of snapshot.cards) {
    if (
      item.client === client &&
      (item.dueDate || hasStoryRecurrence(item)) &&
      !byId.has(item.id)
    ) {
      byId.set(item.id, item);
    }
  }

  return [...byId.values()];
}
