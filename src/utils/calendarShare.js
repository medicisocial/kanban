import { hasStoryRecurrence, getContentCalendarCards } from './calendar';
import { clientMatchesBrand } from './clients';
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
    ...rest
  ] = tuple;

  // Legacy share links included assignedTo before platform (11 fields).
  let platform = 'Instagram';
  let notes = '';
  if (tuple.length >= 11) {
    platform = rest[1] || 'Instagram';
    notes = rest[2] || '';
  } else {
    platform = rest[0] || 'Instagram';
    notes = rest[1] || '';
  }

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
    platform: card.platform || 'Instagram',
    notes: card.notes || '',
  };
}

export function buildCalendarShareUrl(client, cards) {
  const clientCards = getContentCalendarCards(cards).filter((c) => clientMatchesBrand(c.client, client));
  const payload = encodeSharePayload({
    v: 2,
    i: clientCards.map(compactCalendarCard),
  });
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?calendar=${encodeURIComponent(client)}#${payload}`;
}

export function mergePortalCalendarCards(storedCards, client, snapshot) {
  const stored = getContentCalendarCards(storedCards).filter((c) => clientMatchesBrand(c.client, client));

  if (!snapshot?.cards?.length) return stored;

  const byId = new Map(stored.map((c) => [c.id, c]));
  for (const item of snapshot.cards) {
    if (
      clientMatchesBrand(item.client, client) &&
      (item.dueDate || hasStoryRecurrence(item)) &&
      !byId.has(item.id)
    ) {
      byId.set(item.id, item);
    }
  }

  return [...byId.values()];
}
