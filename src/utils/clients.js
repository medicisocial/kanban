export function compareClientNames(a, b, clientOrder = []) {
  const indexA = clientOrder.indexOf(a);
  const indexB = clientOrder.indexOf(b);
  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  return a.localeCompare(b);
}

export function getClientColor(client, clientColors) {
  return resolveClientMapValue(client, clientColors) || '#9ca3af';
}

export function resolveClientMapValue(client, map = {}) {
  if (!client || !map || typeof map !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(map, client)) return map[client];
  const targetKey = clientBrandNameKey(client);
  for (const [name, value] of Object.entries(map)) {
    if (clientBrandNameKey(name) === targetKey) return value;
  }
  return undefined;
}

export function formatClientDisplayName(name) {
  const trimmed = normalizeClientName(String(name || ''));
  if (!trimmed) return '';
  if (trimmed === trimmed.toLowerCase() && /[a-z]/.test(trimmed)) {
    return trimmed.replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }
  return trimmed;
}

export function matchesClientFilter(itemClient, clientFilter) {
  if (!clientFilter || clientFilter === 'all') return true;
  if (!itemClient) return false;
  return clientMatchesBrand(itemClient, clientFilter);
}

export function pickNextClientColor(clientColors, palette) {
  const used = new Set(Object.values(clientColors || {}));
  for (const color of palette) {
    if (!used.has(color)) return color;
  }
  return palette[Object.keys(clientColors || {}).length % palette.length];
}

export function normalizeClientName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

export function clientBrandNameKey(name) {
  return normalizeClientName(name).toLowerCase();
}

export function isInternalClientName(name) {
  const trimmed = normalizeClientName(name);
  return trimmed === '__internal__' || trimmed.startsWith('__');
}

const TEST_CLIENT_NAME_PATTERNS = [
  /^cursor audit sync\b/i,
  /^cursor api test\b/i,
  /^pipeline audit client\b/i,
  /^e2e[\s-]/i,
  /\be2e test\b/i,
  /-test-upsert$/i,
];

/** Names created by automated audits/E2E runs — never persisted or shown in the UI. */
export function isTestClientName(name) {
  const trimmed = normalizeClientName(String(name || ''));
  if (!trimmed) return false;
  return TEST_CLIENT_NAME_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function clientNamesConflict(a, b) {
  return clientBrandNameKey(a) === clientBrandNameKey(b);
}

/** Case-insensitive brand match for portal session keys vs card/idea client names. */
export function clientMatchesBrand(itemClient, brand) {
  if (!itemClient || !brand) return false;
  return clientNamesConflict(itemClient, brand);
}

export function mergeDefaultClients(names, defaults) {
  const merged = [...names];
  for (const client of defaults) {
    if (!merged.some((name) => clientNamesConflict(name, client))) {
      merged.push(client);
    }
  }
  return merged;
}

export function sortClientNamesAlphabetically(names = []) {
  return [...names].sort((a, b) =>
    normalizeClientName(a).localeCompare(normalizeClientName(b), undefined, { sensitivity: 'base' }),
  );
}

export function getClientPortalBrands(clients, internalClient) {
  return sortClientNamesAlphabetically(
    clients.filter((client) => client !== internalClient),
  );
}

const ALL_CLIENTS_FILTER_OPTION = {
  id: 'all',
  label: 'All clients',
  color: 'rgba(255, 255, 255, 0.42)',
};

export function buildClientFilterOptions(clients, getClientColor) {
  const seen = new Set();
  const clientOptions = [];

  for (const client of sortClientNamesAlphabetically(clients)) {
    const key = clientBrandNameKey(client);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const label = formatClientDisplayName(client);
    clientOptions.push({
      id: label,
      label,
      color: getClientColor(client),
    });
  }

  return [ALL_CLIENTS_FILTER_OPTION, ...clientOptions];
}
