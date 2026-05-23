import { hasStoryRecurrence } from './calendar';

export function getCalendarPortalClient() {
  const params = new URLSearchParams(window.location.search);
  const client = params.get('calendar');
  return client ? decodeURIComponent(client) : null;
}

export function parseCalendarShareHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  try {
    const json = decodeURIComponent(escape(atob(hash)));
    return JSON.parse(json);
  } catch {
    return null;
  }
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
  const payload = btoa(
    unescape(
      encodeURIComponent(
        JSON.stringify({
          client,
          cards: clientCards.map(snapshotCalendarCard),
          sharedAt: Date.now(),
        }),
      ),
    ),
  );
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
