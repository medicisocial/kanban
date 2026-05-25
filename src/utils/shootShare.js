export function getShootPortalParams() {
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
            shootEndTime: c.shootEndTime || "",
            shootDuration: c.shootDuration || "",
            shootModels: c.shootModels || "",
            shootNeeds: c.shootNeeds || "",
            shootScript: c.shootScript || "",
            referenceVideo: c.referenceVideo || "",
            notes: c.notes || "",
          })),
          plan: plan || {},
          sharedAt: Date.now(),
        }),
      ),
    ),
  );
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?shoot=${encodeURIComponent(client)}&date=${dateKey}#${payload}`;
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
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?importShoot=${payload}`;
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

const RESPONSES_KEY = "medici-social-shoot-responses";

export function buildShootSubmission(client, dateKey, plan, cards) {
  return {
    client,
    dateKey,
    plan: plan || {},
    cards: cards.map((c) => ({
      id: c.id,
      shootTime: c.shootTime || "",
      shootEndTime: c.shootEndTime || "",
      shootDuration: c.shootDuration || "",
      shootModels: c.shootModels || "",
      shootNeeds: c.shootNeeds || "",
      shootScript: c.shootScript || "",
    })),
  };
}

export function applyShootSubmission(submission, cards, { updateCard, updatePlan }) {
  if (!submission?.client || !submission?.dateKey) return 0;

  if (submission.plan && updatePlan) {
    updatePlan(submission.client, submission.dateKey, submission.plan);
  }

  let applied = 0;
  for (const item of submission.cards || []) {
    if (cards.some((c) => c.id === item.id)) {
      updateCard(item.id, {
        shootTime: item.shootTime || "",
        shootEndTime: item.shootEndTime || "",
        shootDuration: item.shootDuration || "",
        shootModels: item.shootModels || "",
        shootNeeds: item.shootNeeds || "",
        shootScript: item.shootScript || "",
      });
      applied += 1;
    }
  }

  return applied;
}

export function loadShootResponses() {
  try {
    const raw = localStorage.getItem(RESPONSES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

export function saveShootResponses(responses) {
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(responses));
}

export function queueShootResponse(response) {
  const key = `${response.client}|${response.dateKey}`;
  const existing = loadShootResponses().filter(
    (r) => `${r.client}|${r.dateKey}` !== key,
  );
  saveShootResponses([...existing, { ...response, timestamp: Date.now() }]);
}

export function clearShootResponses() {
  localStorage.removeItem(RESPONSES_KEY);
}
