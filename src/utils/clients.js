export function compareClientNames(a, b, clientOrder = []) {
  const indexA = clientOrder.indexOf(a);
  const indexB = clientOrder.indexOf(b);
  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  return a.localeCompare(b);
}

export function getClientColor(client, clientColors) {
  return clientColors?.[client] || '#9ca3af';
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

export function mergeDefaultClients(names, defaults) {
  const merged = [...names];
  for (const client of defaults) {
    if (!merged.some((name) => name.toLowerCase() === client.toLowerCase())) {
      merged.push(client);
    }
  }
  return merged;
}

export function getClientPortalBrands(clients, internalClient) {
  return clients.filter((client) => client !== internalClient);
}
