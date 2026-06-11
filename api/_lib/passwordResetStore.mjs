import { getWriteConfig, isSupabaseConfigured } from './supabase.mjs';

const TOKEN_TTL_MS = 15 * 60 * 1000;

async function restFetch(path, options = {}) {
  const { url, key } = getWriteConfig();
  if (!url || !key) throw new Error('Cloud sync is not configured.');
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {}),
    },
  });
  return response;
}

/**
 * Store a password reset token in the normalized portal_password_reset_tokens table.
 */
export async function storeClientResetToken(token, brand, username, orgId) {
  if (!isSupabaseConfigured()) {
    throw new Error('Cloud sync is required for password reset.');
  }

  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const response = await restFetch('portal_password_reset_tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([
      {
        token,
        org_id: orgId,
        brand_key: String(brand || '').trim().toLowerCase(),
        username: String(username || '').trim().toLowerCase(),
        expires_at: expiresAt,
      },
    ]),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || 'Could not store password reset token.');
  }
}

/** Consume (look up and delete) a password reset token. */
export async function consumeClientResetToken(token) {
  if (!isSupabaseConfigured()) {
    throw new Error('Cloud sync is required for password reset.');
  }

  const lookup = await restFetch(
    `portal_password_reset_tokens?token=eq.${encodeURIComponent(token)}&select=token,org_id,brand_key,username,expires_at&limit=1`,
  );
  if (!lookup.ok) return null;
  const rows = await lookup.json().catch(() => []);
  const record = rows?.[0];
  if (!record) return null;

  await restFetch(`portal_password_reset_tokens?token=eq.${encodeURIComponent(token)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });

  const expiresMs = record.expires_at ? Date.parse(record.expires_at) : 0;
  if (!expiresMs || expiresMs <= Date.now()) return null;

  return {
    token: record.token,
    brand: record.brand_key,
    username: record.username,
    orgId: record.org_id,
    expires: expiresMs,
  };
}
