export function getClientPortalClient() {
  const params = new URLSearchParams(window.location.search);
  const client = params.get("client");
  return client ? decodeURIComponent(client) : null;
}

export function isClientPortal() {
  return Boolean(getClientPortalClient());
}

export function parseShareHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  try {
    const json = decodeURIComponent(escape(atob(hash)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function buildClientShareUrl(client, pendingIdeas) {
  const payload = btoa(
    unescape(
      encodeURIComponent(
        JSON.stringify({
          client,
          ideas: pendingIdeas,
          sharedAt: Date.now(),
        }),
      ),
    ),
  );
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?client=${encodeURIComponent(client)}#${payload}`;
}

export function mergePortalIdeas(storedIdeas, client, snapshot) {
  const storedPending = storedIdeas.filter(
    (i) => i.client === client && i.status === "pending",
  );

  if (!snapshot?.ideas?.length) return storedPending;

  const byId = new Map(storedPending.map((i) => [i.id, i]));
  for (const idea of snapshot.ideas) {
    if (idea.client === client && idea.status === "pending" && !byId.has(idea.id)) {
      byId.set(idea.id, idea);
    }
  }

  return [...byId.values()];
}

export function loadClientResponses() {
  try {
    const raw = localStorage.getItem("medici-social-client-responses");
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

export function saveClientResponses(responses) {
  localStorage.setItem("medici-social-client-responses", JSON.stringify(responses));
}

export function queueClientResponse(response) {
  const existing = loadClientResponses();
  const filtered = existing.filter((r) => r.ideaId !== response.ideaId);
  saveClientResponses([...filtered, response]);
}

export function clearClientResponses() {
  localStorage.removeItem("medici-social-client-responses");
}


export function buildImportUrl(responses) {
  const payload = btoa(
    unescape(encodeURIComponent(JSON.stringify({ responses, exportedAt: Date.now() }))),
  );
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?import=${payload}`;
}

export function parseImportParam() {
  const params = new URLSearchParams(window.location.search);
  const data = params.get("import");
  if (!data) return null;
  try {
    const json = decodeURIComponent(escape(atob(data)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
