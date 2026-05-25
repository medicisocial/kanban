export function getDefaultCalendarDate() {
  return new Date();
}

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

export function addWeeks(date, weeks) {
  return addDays(date, weeks * 7);
}

export function addMonths(date, months) {
  return startOfDay(new Date(date.getFullYear(), date.getMonth() + months, date.getDate()));
}

export function startOfWeek(date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

export function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function getMonthWeeks(year, month) {
  const first = new Date(year, month, 1);
  const gridStart = startOfWeek(first);
  const weeks = [];
  let cursor = gridStart;

  for (let w = 0; w < 6; w += 1) {
    weeks.push(getWeekDays(cursor));
    cursor = addDays(cursor, 7);
    if (w >= 4 && cursor.getMonth() !== month && cursor > new Date(year, month + 1, 0)) {
      break;
    }
  }

  return weeks;
}

export function formatWeekRange(weekStart) {
  const weekEnd = endOfWeek(weekStart);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const startFmt = weekStart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const endFmt = weekEnd.toLocaleDateString("en-US", {
    month: sameMonth ? undefined : "long",
    day: "numeric",
    year: "numeric",
  });
  return `${startFmt} – ${endFmt}`;
}

export function formatMonthYear(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function isSameDay(a, b) {
  return toDateKey(a) === toDateKey(b);
}

export function isToday(date) {
  return isSameDay(date, new Date());
}

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseRecurrenceDays(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  );
}

export function formatRecurrenceDays(days) {
  const parsed = parseRecurrenceDays(days);
  if (!parsed.length) return "";
  return parsed.map((d) => WEEKDAY_NAMES[d]).join(", ");
}

export function hasStoryRecurrence(card) {
  return parseRecurrenceDays(card?.storyRecurrenceDays).length > 0;
}

export function parseStoryOccurrenceNotes(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const notes = {};
  for (const [dateKey, text] of Object.entries(value)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && typeof text === "string") {
      notes[dateKey] = text;
    }
  }
  return notes;
}

export function getStoryOccurrenceNotes(card, dateKey) {
  if (!dateKey) return card?.notes || "";
  const overrides = parseStoryOccurrenceNotes(card?.storyOccurrenceNotes);
  if (Object.prototype.hasOwnProperty.call(overrides, dateKey)) {
    return overrides[dateKey];
  }
  return card?.notes || "";
}

export function withStoryOccurrence(card, dateKey) {
  if (!dateKey || !hasStoryRecurrence(card)) return card;
  return {
    ...card,
    occurrenceDate: dateKey,
    notes: getStoryOccurrenceNotes(card, dateKey),
  };
}

export function getMonthGridRange(focusDate) {
  const year = focusDate.getFullYear();
  const month = focusDate.getMonth();
  const weeks = getMonthWeeks(year, month);
  const rangeStart = weeks[0][0];
  const lastWeek = weeks[weeks.length - 1];
  const rangeEnd = lastWeek[lastWeek.length - 1];
  return { rangeStart, rangeEnd };
}

export function expandStoriesForRange(cards, rangeStart, rangeEnd) {
  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  const occurrences = [];

  for (const card of cards) {
    const days = parseRecurrenceDays(card.storyRecurrenceDays);
    if (!days.length) {
      if (card.dueDate) {
        const date = parseDateKey(card.dueDate);
        if (date >= start && date <= end) {
          occurrences.push({ card, dateKey: card.dueDate });
        }
      }
      continue;
    }

    const from = card.dueDate ? parseDateKey(card.dueDate) : start;
    let cursor = from > start ? startOfDay(from) : startOfDay(start);

    while (cursor <= end) {
      if (days.includes(cursor.getDay()) && cursor >= from) {
        occurrences.push({ card, dateKey: toDateKey(cursor) });
      }
      cursor = addDays(cursor, 1);
    }
  }

  return occurrences;
}

export function groupStoryOccurrencesByDate(occurrences) {
  const map = {};
  for (const { card, dateKey } of occurrences) {
    if (!map[dateKey]) map[dateKey] = [];
    if (!map[dateKey].some((c) => c.id === card.id)) {
      map[dateKey].push(hasStoryRecurrence(card) ? withStoryOccurrence(card, dateKey) : card);
    }
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => (a.dueTime || "99:99").localeCompare(b.dueTime || "99:99"));
  }
  return map;
}

export function buildStoryCalendarByDate(cards, focusDate, viewMode) {
  const range =
    viewMode === "week"
      ? { rangeStart: startOfWeek(focusDate), rangeEnd: endOfWeek(focusDate) }
      : getMonthGridRange(focusDate);
  const occurrences = expandStoriesForRange(cards, range.rangeStart, range.rangeEnd);
  return groupStoryOccurrencesByDate(occurrences);
}

export function groupCardsByDate(cards) {
  const map = {};
  for (const card of cards) {
    if (!card.dueDate) continue;
    if (!map[card.dueDate]) map[card.dueDate] = [];
    map[card.dueDate].push(card);
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'));
  }
  return map;
}

export const STAFF_CALENDAR_COLUMN_IDS = ['editing', 'scheduled'];

export function isStaffCalendarCard(card) {
  return STAFF_CALENDAR_COLUMN_IDS.includes(card.columnId);
}

export function getCalendarCards(cards) {
  return cards.filter((c) => isStaffCalendarCard(c) && c.dueDate);
}

export function getCalendarPosts(cards) {
  return cards.filter(
    (c) => isStaffCalendarCard(c) && c.dueDate && c.contentType !== 'Story',
  );
}

export function getCalendarStories(cards) {
  return cards.filter((c) => {
    if (c.contentType !== 'Story' || !isStaffCalendarCard(c)) return false;
    return c.dueDate || parseRecurrenceDays(c.storyRecurrenceDays).length > 0;
  });
}

/** Client-facing share links — finalized schedule only */
export function getScheduledCards(cards) {
  return cards.filter((c) => c.columnId === 'scheduled' && c.dueDate);
}

export function getScheduledPosts(cards) {
  return cards.filter(
    (c) => c.columnId === 'scheduled' && c.dueDate && c.contentType !== 'Story',
  );
}

export function getScheduledStories(cards) {
  return cards.filter((c) => {
    if (c.columnId !== 'scheduled' || c.contentType !== 'Story') return false;
    return c.dueDate || parseRecurrenceDays(c.storyRecurrenceDays).length > 0;
  });
}
