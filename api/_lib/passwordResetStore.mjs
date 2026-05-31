import { randomBytes } from 'crypto';
import { getRedis } from './redis.mjs';
import { fetchRecord, isSupabaseConfigured, upsertRecord } from './supabase.mjs';

const TOKEN_TTL_MS = 60 * 60 * 1000;
const REDIS_PREFIX = 'client-pw-reset:';
const SYSTEM_TOKEN_ROW_ID = '__password_reset_tokens';

export function createResetToken() {
  return randomBytes(32).toString('hex');
}

export async function storeClientResetToken(token, payload) {
  const record = {
    ...payload,
    expires: Date.now() + TOKEN_TTL_MS,
  };

  const redis = getRedis();
  if (redis) {
    await redis.set(`${REDIS_PREFIX}${token}`, record, { ex: Math.floor(TOKEN_TTL_MS / 1000) });
    return;
  }

  if (!isSupabaseConfigured()) {
    throw new Error('Password reset storage is not configured.');
  }

  const existing = (await fetchRecord('client_portal_credentials', SYSTEM_TOKEN_ROW_ID)) || { tokens: {} };
  const tokens = { ...(existing.tokens || {}) };
  tokens[token] = record;

  const now = Date.now();
  for (const [key, entry] of Object.entries(tokens)) {
    if (!entry?.expires || entry.expires <= now) delete tokens[key];
  }

  await upsertRecord('client_portal_credentials', SYSTEM_TOKEN_ROW_ID, { tokens });
}

export async function consumeClientResetToken(token) {
  const redis = getRedis();
  if (redis) {
    const key = `${REDIS_PREFIX}${token}`;
    const record = await redis.get(key);
    if (!record) return null;
    await redis.del(key);
    if (!record.expires || record.expires <= Date.now()) return null;
    return record;
  }

  if (!isSupabaseConfigured()) return null;

  const existing = (await fetchRecord('client_portal_credentials', SYSTEM_TOKEN_ROW_ID)) || { tokens: {} };
  const tokens = { ...(existing.tokens || {}) };
  const record = tokens[token];
  if (!record) return null;

  delete tokens[token];
  const now = Date.now();
  for (const [key, entry] of Object.entries(tokens)) {
    if (!entry?.expires || entry.expires <= now) delete tokens[key];
  }
  await upsertRecord('client_portal_credentials', SYSTEM_TOKEN_ROW_ID, { tokens });

  if (!record.expires || record.expires <= Date.now()) return null;
  return record;
}
