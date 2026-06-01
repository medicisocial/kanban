import { getRedis, loadWorkspace, saveWorkspace } from './redis.mjs';
import { STORAGE_KEY } from './portalWorkspace.mjs';

/** Keep the legacy KV workspace cards in sync when staff-sync writes to Supabase. */
export async function patchRedisWorkspaceCards(upserts = [], deleteIds = []) {
  const redis = getRedis();
  if (!redis) return;

  const workspace = (await loadWorkspace(redis)) || { exportedAt: null, data: {} };
  const data = workspace.data && typeof workspace.data === 'object' ? workspace.data : {};
  const cards = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  const byId = new Map(cards.map((card) => [String(card.id), card]));

  for (const id of deleteIds || []) {
    byId.delete(String(id));
  }

  for (const row of upserts || []) {
    const id = row?.id != null ? String(row.id) : '';
    if (!id || !row?.data) continue;
    byId.set(id, row.data);
  }

  await saveWorkspace(redis, {
    ...workspace,
    exportedAt: new Date().toISOString(),
    data: {
      ...data,
      [STORAGE_KEY]: [...byId.values()],
    },
  });
}
