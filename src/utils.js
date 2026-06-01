import { addDays, parseDateKey, toDateKey } from './utils/calendar';
import { isScheduledPostType } from './constants';

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatTimeRange(timeStr, endTimeStr) {
  if (!timeStr) return endTimeStr ? formatTime(endTimeStr) : '';
  if (endTimeStr) return `${formatTime(timeStr)} – ${formatTime(endTimeStr)}`;
  return formatTime(timeStr);
}

export function formatScheduledDateTime(dateStr, timeStr) {
  if (!dateStr) return '';
  const datePart = formatDate(dateStr);
  if (!timeStr) return datePart;
  return `${datePart} · ${formatTime(timeStr)}`;
}

export function isPostingTomorrow(postDate, todayKey = toDateKey(new Date())) {
  if (!postDate) return false;
  return postDate === toDateKey(addDays(parseDateKey(todayKey), 1));
}

export function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return due < today;
}

/** Scheduled non-story posts whose plan date has passed — off the board, still on calendar. */
export function isPastScheduledBoardPost(card, todayKey = toDateKey(new Date())) {
  if (!isScheduledPostType(card.contentType) || card.isOneOffProject) return false;
  if (card.columnId !== 'scheduled' || !card.dueDate) return false;
  return card.dueDate < todayKey;
}

export function getBoardCards(cards) {
  const todayKey = toDateKey(new Date());
  return cards.filter((card) => {
    if (card.contentType === 'Story') return false;
    if (card.postedAt) return false;
    if (isPastScheduledBoardPost(card, todayKey)) return false;
    return true;
  });
}

import { cardIsAssignedToStaff } from './utils/staffMembers';

export function filterCards(cards, { client, assigneeFilter = false, staffName = '', clientAccountManagers = {} }) {
  return cards.filter((card) => {
    if (client && client !== 'all' && card.client !== client) return false;
    if (assigneeFilter && staffName && !cardIsAssignedToStaff(card, staffName, clientAccountManagers)) {
      return false;
    }
    return true;
  });
}
