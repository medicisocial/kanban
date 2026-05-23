const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, "utf8");
}

let constants = fs.readFileSync(path.join(root, "src/constants.js"), "utf8");
if (!constants.includes("SHOOT_PLANS_STORAGE_KEY")) {
  constants = constants.replace(
    "export const CLIENT_RESPONSES_STORAGE_KEY = 'medici-social-client-responses';",
    "export const CLIENT_RESPONSES_STORAGE_KEY = 'medici-social-client-responses';\nexport const SHOOT_PLANS_STORAGE_KEY = 'medici-social-shoot-plans';",
  );
  constants = constants.replace(
    "export const CONTENT_TYPE_COLORS = {",
    `export const DEFAULT_SHOOT_DURATIONS = {
  Reel: 45,
  Story: 20,
  Carousel: 60,
  'Static Post': 30,
};

export const CONTENT_TYPE_COLORS = {`,
  );
  constants = constants.replace(
    "    shootDate: '',",
    `    shootDate: '',
    shootTime: '',
    shootDuration: 45,
    shootModels: '',
    shootNeeds: '',`,
  );
  fs.writeFileSync(path.join(root, "src/constants.js"), constants, "utf8");
}

write(
  "src/utils/shootDay.js",
  `import { CLIENTS, DEFAULT_SHOOT_DURATIONS } from "../constants";
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
  return cards.filter((c) => c.shootDate);
}

export function groupCardsByClient(cards) {
  const grouped = {};
  for (const card of cards) {
    if (!grouped[card.client]) grouped[card.client] = [];
    grouped[card.client].push(card);
  }

  return CLIENTS.filter((client) => grouped[client]?.length).map((client) => ({
    client,
    cards: grouped[client],
  }));
}

export function getUniqueClientsForDay(cards) {
  return [...new Set(cards.map((c) => c.client))];
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
  if (!time || !/^\\d{2}:\\d{2}$/.test(time)) return null;
  const [h, m] = time.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function minutesToTimeLabel(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return \`\${hour12}:\${String(m).padStart(2, "0")} \${period}\`;
}

export function formatTimeInput(time) {
  if (!time) return "";
  const mins = parseTimeToMinutes(time);
  if (mins == null) return time;
  return minutesToTimeLabel(mins);
}

export function buildShootTimeline(cards) {
  return cards
    .filter((c) => c.shootTime && parseTimeToMinutes(c.shootTime) != null)
    .map((card) => {
      const startMinutes = parseTimeToMinutes(card.shootTime);
      const duration = Number(card.shootDuration) || getDefaultDuration(card.contentType);
      return {
        card,
        startMinutes,
        endMinutes: startMinutes + duration,
        duration,
        startLabel: formatTimeInput(card.shootTime),
        endLabel: minutesToTimeLabel(startMinutes + duration),
      };
    })
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

export function splitList(value) {
  if (!value) return [];
  return value
    .split(/[,\\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function aggregateModels(cards, sessionModels = "") {
  const set = new Set(splitList(sessionModels));
  for (const card of cards) {
    for (const name of splitList(card.shootModels)) set.add(name);
  }
  return [...set];
}

export function aggregateNeeds(cards, sessionNeeds = "") {
  const set = new Set(splitList(sessionNeeds));
  for (const card of cards) {
    for (const item of splitList(card.shootNeeds)) set.add(item);
  }
  return [...set];
}

export function getShootPlanKey(client, dateKey) {
  return \`\${client}|\${dateKey}\`;
}

export { addDays, addMonths, toDateKey, isToday };
`,
);

write(
  "src/hooks/useShootPlans.js",
  `import { useState, useEffect, useCallback } from "react";
import { SHOOT_PLANS_STORAGE_KEY } from "../constants";
import { getShootPlanKey } from "../utils/shootDay";

function loadPlans() {
  try {
    const raw = localStorage.getItem(SHOOT_PLANS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function createPlan(client, dateKey) {
  return {
    client,
    dateKey,
    location: "",
    callTime: "",
    sessionModels: "",
    sessionNeeds: "",
    notes: "",
    updatedAt: Date.now(),
  };
}

export function useShootPlans() {
  const [plans, setPlans] = useState(loadPlans);

  useEffect(() => {
    localStorage.setItem(SHOOT_PLANS_STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  const getPlan = useCallback(
    (client, dateKey) => {
      const key = getShootPlanKey(client, dateKey);
      return plans[key] || createPlan(client, dateKey);
    },
    [plans],
  );

  const updatePlan = useCallback((client, dateKey, updates) => {
    const key = getShootPlanKey(client, dateKey);
    setPlans((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || createPlan(client, dateKey)),
        ...updates,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  return { getPlan, updatePlan };
}
`,
);

write(
  "src/utils/shootShare.js",
  `export function getShootPortalParams() {
  const params = new URLSearchParams(window.location.search);
  const client = params.get("shoot");
  const date = params.get("date");
  if (!client || !date) return null;
  return { client: decodeURIComponent(client), dateKey: date };
}

export function parseShootShareHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  try {
    const json = decodeURIComponent(escape(atob(hash)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function buildShootShareUrl(client, dateKey, cards, plan) {
  const payload = btoa(
    unescape(
      encodeURIComponent(
        JSON.stringify({
          client,
          dateKey,
          cards: cards.map((c) => ({
            id: c.id,
            title: c.title,
            contentType: c.contentType,
            shootTime: c.shootTime || "",
            shootDuration: c.shootDuration || "",
            shootModels: c.shootModels || "",
            shootNeeds: c.shootNeeds || "",
            notes: c.notes || "",
          })),
          plan: plan || {},
          sharedAt: Date.now(),
        }),
      ),
    ),
  );
  const base = \`\${window.location.origin}\${window.location.pathname}\`;
  return \`\${base}?shoot=\${encodeURIComponent(client)}&date=\${dateKey}#\${payload}\`;
}

export function mergeShootPortalCards(storedCards, client, dateKey, snapshot) {
  const stored = storedCards.filter((c) => c.client === client && c.shootDate === dateKey);
  if (!snapshot?.cards?.length) return stored;

  const byId = new Map(stored.map((c) => [c.id, c]));
  for (const item of snapshot.cards) {
    if (!byId.has(item.id)) {
      byId.set(item.id, {
        ...item,
        client,
        shootDate: dateKey,
        platform: "Instagram",
      });
    }
  }
  return [...byId.values()];
}

export function buildShootImportUrl(responses) {
  const payload = btoa(
    unescape(encodeURIComponent(JSON.stringify({ responses, exportedAt: Date.now() }))),
  );
  const base = \`\${window.location.origin}\${window.location.pathname}\`;
  return \`\${base}?importShoot=\${payload}\`;
}

export function parseShootImportParam() {
  const params = new URLSearchParams(window.location.search);
  const data = params.get("importShoot");
  if (!data) return null;
  try {
    const json = decodeURIComponent(escape(atob(data)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
`,
);

console.log("Core shoot planning files written");
