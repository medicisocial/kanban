import { clientNamesConflict } from './clients';

export function filterEvents(events, { client } = {}) {
  if (!Array.isArray(events)) return [];
  let list = events;

  if (client && client !== 'all') {
    list = list.filter((event) => event?.client && clientNamesConflict(event.client, client));
  }

  return list;
}

export function groupEventsByDate(events) {
  return events.reduce((acc, event) => {
    if (!event.date) return acc;
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    acc[event.date].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    return acc;
  }, {});
}

export function getUpcomingEvents(events, fromDateKey) {
  const today = fromDateKey || new Date().toISOString().slice(0, 10);
  return [...events]
    .filter((event) => event.date && event.date >= today)
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.time || '').localeCompare(b.time || '');
    });
}
