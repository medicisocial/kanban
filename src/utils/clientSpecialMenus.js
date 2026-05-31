import { normalizeEventPdfAttachment, readEventPdfUpload } from './eventPdfUpload';
import { toDateKey } from './calendar';

export function createSpecialMenuId() {
  return `sm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizePdfAttachment(value) {
  return normalizeEventPdfAttachment(value);
}

export function normalizeClientSpecialMenu(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const name = String(entry.name || '').trim();
  const startDate = String(entry.startDate || '').trim();
  const endDate = String(entry.endDate || '').trim();
  if (!name || !startDate || !endDate) return null;

  const hasDrinkMenu = Boolean(entry.hasDrinkMenu);
  const hasFoodMenu = Boolean(entry.hasFoodMenu);
  const drinkMenuPdf = hasDrinkMenu ? normalizePdfAttachment(entry.drinkMenuPdf) : null;
  const foodMenuPdf = hasFoodMenu ? normalizePdfAttachment(entry.foodMenuPdf) : null;

  if (hasDrinkMenu && !drinkMenuPdf) return null;
  if (hasFoodMenu && !foodMenuPdf) return null;

  return {
    id: String(entry.id || createSpecialMenuId()),
    name,
    startDate,
    endDate,
    hasDrinkMenu,
    drinkMenuPdf,
    hasFoodMenu,
    foodMenuPdf,
    createdAt: Number(entry.createdAt) || Date.now(),
    updatedAt: Number(entry.updatedAt) || Date.now(),
  };
}

export function normalizeClientSpecialMenus(menus) {
  if (!Array.isArray(menus)) return [];
  return menus
    .map((entry) => normalizeClientSpecialMenu(entry))
    .filter(Boolean)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function formatSpecialMenuDates(startDate, endDate) {
  if (!startDate && !endDate) return '';
  if (startDate === endDate) return startDate;
  return `${startDate} – ${endDate}`;
}

function parseMenuDate(dateKey) {
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatSpecialMenuDateRange(startDate, endDate) {
  const start = parseMenuDate(startDate);
  const end = parseMenuDate(endDate);
  if (!start || !end) return formatSpecialMenuDates(startDate, endDate);

  const short = { month: 'short', day: 'numeric' };
  const withYear = { month: 'short', day: 'numeric', year: 'numeric' };
  const withWeekday = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };

  if (startDate === endDate) {
    return start.toLocaleDateString('en-US', withWeekday);
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(
    'en-US',
    sameYear ? { weekday: 'short', ...short } : withWeekday,
  );
  const endLabel = end.toLocaleDateString('en-US', withWeekday);
  return `${startLabel} – ${endLabel}`;
}

export function getSpecialMenuRunStatus(startDate, endDate, todayKey = toDateKey(new Date())) {
  if (!startDate || !endDate) return 'unknown';
  if (endDate < todayKey) return 'ended';
  if (startDate > todayKey) return 'upcoming';
  return 'active';
}

export function getSpecialMenuRunLabel(status) {
  if (status === 'active') return 'Running now';
  if (status === 'upcoming') return 'Upcoming';
  if (status === 'ended') return 'Ended';
  return 'Scheduled';
}

export function getSpecialMenuRunDaysLabel(startDate, endDate) {
  const start = parseMenuDate(startDate);
  const end = parseMenuDate(endDate);
  if (!start || !end) return '';

  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
  if (days <= 1) return '1 day';
  return `${days} days`;
}

export async function readSpecialMenuPdfUpload(file) {
  return readEventPdfUpload(file);
}

export const MAX_SPECIAL_MENUS = 20;
