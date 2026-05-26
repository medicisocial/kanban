import { Redis } from '@upstash/redis';

export const WORKSPACE_KEY = 'medici:workspace';

export function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function loadWorkspace(redis) {
  return redis.get(WORKSPACE_KEY);
}

export async function saveWorkspace(redis, payload) {
  await redis.set(WORKSPACE_KEY, payload);
}
