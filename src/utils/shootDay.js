import { DEFAULT_SHOOT_DURATIONS, needsShootSchedule } from "../constants";
import { compareClientNames } from "./clients";
import { toDateKey, addDays, addMonths, parseDateKey, isToday } from "./calendar";

export function getDefaultShootDate() {
  return new Date();
}

export function formatShootDayLabel(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonthYear(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function getCardsForShootDate(cards, dateKey) {
  return cards.filter((card) => card.shootDate === dateKey);
}

export function groupCardsByShootDate(cards) {
  const map = {};
  for (const card of cards) {
    if (!card.shootDate) continue;
    if (!map[card.shootDate]) map[card.shootDate] = [];
    map[card.shootDate].push(card);
  }
  return map;
}

export function getShootCards(cards) {
  return cards.filter((c) => c.shootDate && c.contentType !== 'Story');
}

export function getUnscheduledShootCards(cards, client) {
  return cards.filter(
    (card) =>
      card.client === client &&
      needsShootSchedule(card.contentType) &&
      !card.shootDate,
  );
}

export function groupCardsByClient(cards, { getPlan, dateKey, clientOrder } = {}) {
  const grouped = {};
  for (const card of cards) {
    if (!grouped[card.client]) grouped[card.client] = [];
    grouped[card.client].push(card);
  }

  return Object.keys(grouped)
    .map((client) => {
      const clientCards = sortCardsByShootTime(grouped[client]);
      const plan = getPlan && dateKey ? getPlan(client, dateKey) : null;
      return {
        client,
        cards: clientCards,
        startMinutes: getClientStartMinutes(clientCards, plan),
      };
    })
    .sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      return compareClientNames(a.client, b.client, clientOrder);
    });
}

export function sortCardsByShootTime(cards) {
  return [...cards].sort((a, b) => {
    const ta = parseTimeToMinutes(a.shootTime) ?? Number.POSITIVE_INFINITY;
    const tb = parseTimeToMinutes(b.shootTime) ?? Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return a.title.localeCompare(b.title);
  });
}

function getClientStartMinutes(cards, plan) {
  const cardTimes = cards
    .map((c) => parseTimeToMinutes(c.shootTime))
    .filter((m) => m != null);
  if (cardTimes.length) return Math.min(...cardTimes);

  const planStart = parseTimeToMinutes(plan?.shootStartTime);
  if (planStart != null) return planStart;

  return Number.POSITIVE_INFINITY;
}

export function getPlanClientsForDate(plans, dateKey, clientOrder = []) {
  if (!plans || typeof plans !== "object") return [];
  const clients = [];
  for (const plan of Object.values(plans)) {
    if (plan.dateKey === dateKey && plan.client && plan.manual && !clients.includes(plan.client)) {
      clients.push(plan.client);
    }
  }
  return clients.sort((a, b) => compareClientNames(a, b, clientOrder));
}

export function groupShootDayClients(cards, dateKey, getPlan, plans = {}, clientOrder = []) {
  const fromCards = groupCardsByClient(cards, { getPlan, dateKey, clientOrder });
  const existing = new Set(fromCards.map((group) => group.client));
  const extras = getPlanClientsForDate(plans, dateKey, clientOrder)
    .filter((client) => !existing.has(client))
    .map((client) => ({
      client,
      cards: [],
      startMinutes: getClientStartMinutes([], getPlan?.(client, dateKey)),
    }));

  return [...fromCards, ...extras].sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    return compareClientNames(a.client, b.client, clientOrder);
  });
}

export function getUniqueClientsForDay(cards, { getPlan, dateKey, plans, clientOrder = [] } = {}) {
  const fromCards = groupCardsByClient(cards, { getPlan, dateKey, clientOrder }).map((group) => group.client);
  const fromPlans = plans && dateKey ? getPlanClientsForDate(plans, dateKey, clientOrder) : [];
  return [...new Set([...fromCards, ...fromPlans])].sort(
    (a, b) => compareClientNames(a, b, clientOrder),
  );
}

export function dateKeyToInputValue(date) {
  return toDateKey(date);
}

export function inputValueToDate(value) {
  return value ? parseDateKey(value) : new Date();
}

export function getDefaultDuration(contentType) {
  return DEFAULT_SHOOT_DURATIONS[contentType] ?? 30;
}

export function parseTimeToMinutes(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function minutesToTimeLabel(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatTimeInput(time) {
  if (!time) return "";
  const mins = parseTimeToMinutes(time);
  if (mins == null) return time;
  return minutesToTimeLabel(mins);
}

export function minutesToTimeInput(totalMinutes) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getDefaultShootEndTime(shootTime, contentType) {
  const startMinutes = parseTimeToMinutes(shootTime);
  if (startMinutes == null) return "";
  return minutesToTimeInput(startMinutes + getDefaultDuration(contentType));
}

function resolveShootSlot(card) {
  const startMinutes = parseTimeToMinutes(card.shootTime);
  if (startMinutes == null) return null;

  const endMinutesFromField = parseTimeToMinutes(card.shootEndTime);
  if (endMinutesFromField != null && endMinutesFromField > startMinutes) {
    return {
      startMinutes,
      endMinutes: endMinutesFromField,
      duration: endMinutesFromField - startMinutes,
      startLabel: formatTimeInput(card.shootTime),
      endLabel: formatTimeInput(card.shootEndTime),
    };
  }

  const duration = Number(card.shootDuration) || getDefaultDuration(card.contentType);
  return {
    startMinutes,
    endMinutes: startMinutes + duration,
    duration,
    startLabel: formatTimeInput(card.shootTime),
    endLabel: minutesToTimeLabel(startMinutes + duration),
  };
}

export function buildShootTimeline(cards) {
  return cards
    .map((card) => {
      const slot = resolveShootSlot(card);
      if (!slot) return null;
      return { card, ...slot };
    })
    .filter(Boolean)
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

export function getShootWindow(plan, entries = []) {
  const start = parseTimeToMinutes(plan?.shootStartTime);
  const end = parseTimeToMinutes(plan?.shootEndTime);

  if (start != null && end != null && end > start) {
    return {
      startMinutes: start,
      endMinutes: end,
      span: end - start,
      startLabel: formatTimeInput(plan.shootStartTime),
      endLabel: formatTimeInput(plan.shootEndTime),
      fromPlan: true,
    };
  }

  if (entries.length) {
    const min = Math.min(...entries.map((e) => e.startMinutes));
    const max = Math.max(...entries.map((e) => e.endMinutes));
    const padding = 30;
    const windowStart = Math.max(0, min - padding);
    const windowEnd = max + padding;
    return {
      startMinutes: windowStart,
      endMinutes: windowEnd,
      span: windowEnd - windowStart,
      startLabel: minutesToTimeLabel(windowStart),
      endLabel: minutesToTimeLabel(windowEnd),
      fromPlan: false,
    };
  }

  return null;
}

export function buildHourMarkers(window, { edgePct = 8 } = {}) {
  if (!window) return [];
  const markers = [];
  const firstHour = Math.ceil(window.startMinutes / 60) * 60;
  for (let m = firstHour; m <= window.endMinutes; m += 60) {
    if (m >= window.startMinutes && m <= window.endMinutes) {
      const pct = ((m - window.startMinutes) / window.span) * 100;
      if (pct >= edgePct && pct <= 100 - edgePct) {
        markers.push({
          minutes: m,
          label: minutesToTimeLabel(m),
          pct,
        });
      }
    }
  }
  return markers;
}

export function positionOnTimeline(entry, window, minBlockPct = 0) {
  if (!window) return null;
  const leftPct = ((entry.startMinutes - window.startMinutes) / window.span) * 100;
  const widthPct = Math.max((entry.duration / window.span) * 100, minBlockPct);
  const outsideBefore = entry.startMinutes < window.startMinutes;
  const outsideAfter = entry.endMinutes > window.endMinutes;
  return { leftPct, widthPct, outsideBefore, outsideAfter };
}

function visualEndMinutes(entry, window, minBlockPct = 0) {
  const pos = positionOnTimeline(entry, window, minBlockPct);
  if (!pos) return entry.endMinutes;
  return entry.startMinutes + (pos.widthPct / 100) * window.span;
}

export function assignTimelineLanes(entries, window = null, minBlockPct = 0) {
  const sorted = [...entries].sort((a, b) => a.startMinutes - b.startMinutes);
  const lanes = [];

  for (const entry of sorted) {
    let placed = false;
    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex++) {
      const last = lanes[laneIndex][lanes[laneIndex].length - 1];
      const lastVisualEnd = window
        ? visualEndMinutes(last, window, minBlockPct)
        : last.endMinutes;
      if (lastVisualEnd <= entry.startMinutes) {
        lanes[laneIndex].push({ ...entry, lane: laneIndex });
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([{ ...entry, lane: lanes.length }]);
    }
  }

  return lanes.flat();
}

export function splitList(value) {
  if (!value) return [];
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinList(items) {
  return items.filter(Boolean).join(", ");
}

export function aggregateModelsWithSlots(cards, sessionModels = "", plan = {}) {
  const modelSlots = new Map();

  function addSlot(name, { timeLabel, sortKey, endMinutes, contentTitle, contentType, cardId }) {
    if (!name) return;
    if (!modelSlots.has(name)) modelSlots.set(name, new Map());
    const key = cardId ? `${cardId}|${sortKey}|${endMinutes}` : `${sortKey}|${endMinutes}|${timeLabel}`;
    modelSlots.get(name).set(key, {
      timeLabel,
      sortKey,
      endMinutes: endMinutes ?? sortKey,
      contentTitle: contentTitle || "",
      contentType: contentType || "",
    });
  }

  const timeline = buildShootTimeline(cards);
  const timelineByCardId = new Map(timeline.map((entry) => [entry.card.id, entry]));
  const cardModelNames = new Set();

  for (const card of cards) {
    const names = splitList(card.shootModels);
    for (const name of names) cardModelNames.add(name.toLowerCase());
    if (!names.length) continue;

    const entry = timelineByCardId.get(card.id);
    let timeLabel = "Time TBD";
    let sortKey = Number.POSITIVE_INFINITY;
    let endMinutes = Number.POSITIVE_INFINITY;

    if (entry) {
      timeLabel =
        entry.duration > 0
          ? `${entry.startLabel} – ${entry.endLabel}`
          : entry.startLabel;
      sortKey = entry.startMinutes;
      endMinutes = entry.endMinutes;
    } else if (parseTimeToMinutes(card.shootTime) != null) {
      sortKey = parseTimeToMinutes(card.shootTime);
      endMinutes = sortKey;
      timeLabel = formatTimeInput(card.shootTime);
    }

    for (const name of names) {
      addSlot(name, {
        timeLabel,
        sortKey,
        endMinutes,
        contentTitle: card.title,
        contentType: card.contentType,
        cardId: card.id,
      });
    }
  }

  const sessionNames = splitList(sessionModels);
  if (sessionNames.length) {
    const sessionStart = parseTimeToMinutes(plan.shootStartTime);
    const sessionEnd = parseTimeToMinutes(plan.shootEndTime);
    let sessionLabel = "Full session";
    let sessionSortKey = Number.POSITIVE_INFINITY - 1;
    let sessionEndMinutes = Number.POSITIVE_INFINITY;

    if (sessionStart != null && sessionEnd != null && sessionEnd > sessionStart) {
      sessionLabel = `${formatTimeInput(plan.shootStartTime)} – ${formatTimeInput(plan.shootEndTime)} (session)`;
      sessionSortKey = sessionStart;
      sessionEndMinutes = sessionEnd;
    }

    for (const name of sessionNames) {
      if (!cardModelNames.has(name.toLowerCase())) {
        addSlot(name, {
          timeLabel: sessionLabel,
          sortKey: sessionSortKey,
          endMinutes: sessionEndMinutes,
          contentTitle: "Full session",
        });
      }
    }
  }

  const result = [...modelSlots.entries()].map(([name, slotMap]) => ({
    name,
    slots: [...slotMap.values()].sort(
      (a, b) => a.sortKey - b.sortKey || a.endMinutes - b.endMinutes,
    ),
  }));

  result.sort((a, b) => {
    const aKey = a.slots[0]?.sortKey ?? Number.POSITIVE_INFINITY;
    const bKey = b.slots[0]?.sortKey ?? Number.POSITIVE_INFINITY;
    if (aKey !== bKey) return aKey - bKey;
    return a.name.localeCompare(b.name);
  });

  return result;
}

export function formatModelScheduleLines(schedules) {
  return schedules.map(({ name, slots }) => {
    const times = slots
      .map((slot) => {
        if (slot.contentTitle && slot.contentTitle !== "Full session") {
          return `${slot.timeLabel} (${slot.contentTitle})`;
        }
        return slot.timeLabel;
      })
      .join("; ");
    return `${name} — ${times}`;
  });
}

export function aggregateModels(cards, sessionModels = "", plan = {}) {
  return aggregateModelsWithSlots(cards, sessionModels, plan).map((entry) => entry.name);
}

export function aggregateNeeds(cards, sessionNeeds = "") {
  const set = new Set(splitList(sessionNeeds));
  for (const card of cards) {
    for (const item of splitList(card.shootNeeds)) set.add(item);
  }
  return [...set];
}

export function getShootDayTitle(plan, client) {
  const trimmed = plan?.title?.trim();
  if (trimmed) return trimmed;
  return `${client} shoot`;
}

export function resolveShootDayTime(plan, cards = []) {
  if (plan?.shootStartTime) return plan.shootStartTime;
  if (plan?.callTime) return plan.callTime;

  const cardTimes = cards
    .map((card) => card.shootTime)
    .filter(Boolean)
    .sort((a, b) => (parseTimeToMinutes(a) ?? 9999) - (parseTimeToMinutes(b) ?? 9999));
  return cardTimes[0] || '';
}

export function resolveShootDayEndTime(plan, cards = []) {
  if (plan?.shootEndTime) return plan.shootEndTime;

  const cardEndTimes = cards
    .map((card) => card.shootEndTime || getDefaultShootEndTime(card.shootTime, card.contentType))
    .filter(Boolean)
    .sort((a, b) => (parseTimeToMinutes(b) ?? 0) - (parseTimeToMinutes(a) ?? 0));
  return cardEndTimes[0] || '';
}

export function buildShootDayTimelineSubtitle(client, cards, plan) {
  const parts = [client];
  if (cards.length > 0) {
    parts.push(`${cards.length} item${cards.length === 1 ? '' : 's'}`);
  }
  if (plan?.location?.trim()) parts.push(plan.location.trim());
  return parts.join(' · ');
}

export function getClientUpcomingShoots(cards, plans, client) {
  const dateKeys = new Set();

  for (const card of getShootCards(cards)) {
    if (card.client === client && card.shootDate) {
      dateKeys.add(card.shootDate);
    }
  }

  if (plans && typeof plans === 'object') {
    for (const plan of Object.values(plans)) {
      if (
        plan.client === client &&
        plan.dateKey &&
        (plan.manual || plan.shootStartTime || plan.callTime)
      ) {
        dateKeys.add(plan.dateKey);
      }
    }
  }

  return [...dateKeys]
    .sort()
    .map((dateKey) => {
      const plan = plans?.[getShootPlanKey(client, dateKey)] || {};
      const dayCards = cards.filter(
        (entry) =>
          entry.client === client &&
          entry.shootDate === dateKey &&
          needsShootSchedule(entry.contentType),
      );
      const shootTime = resolveShootDayTime(plan, dayCards);
      const shootEndTime = resolveShootDayEndTime(plan, dayCards);
      return {
        client,
        dateKey,
        shootTime,
        shootEndTime,
        cardCount: dayCards.length,
        cards: sortCardsByShootTime(dayCards),
        plan,
      };
    });
}

export function getShootPlanKey(client, dateKey) {
  return `${client}|${dateKey}`;
}

export { addDays, addMonths, toDateKey, isToday, parseDateKey };
