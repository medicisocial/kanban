import { isOneOffProjectCard, isScheduledPostType } from '../constants';

/** Parse a scheduled post datetime from dueDate (YYYY-MM-DD) + optional dueTime (HH:MM). */
export function parseScheduledDateTime(dueDate, dueTime) {
  if (!dueDate) return null;
  const scheduledAt = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(scheduledAt.getTime())) return null;
  if (dueTime) {
    const [hours, minutes] = dueTime.split(':').map(Number);
    scheduledAt.setHours(hours || 0, minutes || 0, 0, 0);
    return scheduledAt;
  }
  scheduledAt.setHours(23, 59, 59, 999);
  return scheduledAt;
}

/** True when a scheduled content card's post datetime is in the past. */
export function isScheduledPostTimePassed(card, now = new Date()) {
  if (!card || card.contentType === 'Story') return false;
  if (isOneOffProjectCard(card)) return false;
  if (!isScheduledPostType(card.contentType)) return false;
  if (card.columnId !== 'scheduled' || !card.dueDate) return false;
  const scheduledAt = parseScheduledDateTime(card.dueDate, card.dueTime);
  if (!scheduledAt) return false;
  return now >= scheduledAt;
}

/** Cards that should be auto-marked posted (past schedule, not yet stamped). */
export function findCardsDueForAutoPost(cards, now = new Date()) {
  return (cards || []).filter(
    (card) => !card.postedAt && isScheduledPostTimePassed(card, now),
  );
}
