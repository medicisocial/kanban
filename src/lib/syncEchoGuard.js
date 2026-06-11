/** Suppress applying our own cloud writes back through realtime for a short window. */
const RECENT_PUSH_TTL_MS = 3000;
const recentPushes = new Map();

export function markRecentlyPushed(table, ids, ttlMs = RECENT_PUSH_TTL_MS) {
  if (!table || !ids?.length) return;
  const expiresAt = Date.now() + ttlMs;
  for (const id of ids) {
    recentPushes.set(`${table}:${String(id)}`, expiresAt);
  }
}

export function wasRecentlyPushed(table, id) {
  const key = `${table}:${String(id)}`;
  const expiresAt = recentPushes.get(key);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    recentPushes.delete(key);
    return false;
  }
  return true;
}
