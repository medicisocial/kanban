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

  // Store tokens in an org-scoped row; orgId comes from the payload (set during login).
  const orgId = payload.orgId;
  const rowId = `${SYSTEM_TOKEN_ROW_ID}${orgId ? `:${orgId}` : ''}`;
  const existing = (await fetchRecord('client_portal_credentials', rowId, orgId)) || { tokens: {} };
  const tokens = { ...(existing.tokens || {}) };
  tokens[token] = record;

  const now = Date.now();
  for (const [key, entry] of Object.entries(tokens)) {
    if (!entry?.expires || entry.expires <= now) delete tokens[key];
  }

  await upsertRecord('client_portal_credentials', rowId, { tokens }, orgId);
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

  // To find the token, we must scan across org-scoped token rows.
  // We use fetchRowsAcrossOrgs so each org's token bucket is checked.
  const { fetchRowsAcrossOrgs } = await import('./supabase.mjs');
  const rows = await fetchRowsAcrossOrgs('client_portal_credentials');
  const tokenRows = (rows || []).filter((r) => String(r.id).startsWith(SYSTEM_TOKEN_ROW_ID));

  for (const row of tokenRows) {
    const tokens = { ...(row.data?.tokens || {}) };
    if (!tokens[token]) continue;

    const record = tokens[token];
    delete tokens[token];

    const now = Date.now();
    for (const [key, entry] of Object.entries(tokens)) {
      if (!entry?.expires || entry.expires <= now) delete tokens[key];
    }
    await upsertRecord('client_portal_credentials', row.id, { tokens }, row.org_id);

    if (!record.expires || record.expires <= Date.now()) return null;
    return record;
  }

  return null;
}
