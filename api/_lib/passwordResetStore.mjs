import { fetchRecord, isSupabaseConfigured, upsertRecord } from './supabase.mjs';

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Store a password reset token in Supabase.
 * Uses the client_portal_credentials table's data blob to store pending resets.
 */
export async function storeClientResetToken(token, brand, username, orgId) {
  const record = {
    token,
    brand,
    username: username.toLowerCase().trim(),
    orgId,
    expires: Date.now() + TOKEN_TTL_MS,
  };

  if (!isSupabaseConfigured()) {
    throw new Error('Cloud sync is required for password reset.');
  }

  // Store the token in a simple key-value pattern using the client_records table
  // or fall back to the clients workspace blob
  try {
    await upsertRecord('clients', 'workspace', {
      _passwordResetTokens: {
        ...(await fetchRecord('clients', 'workspace', orgId))._passwordResetTokens || {},
        [token]: record,
      },
    }, orgId);
  } catch (error) {
    console.error('[password-reset-store] store failed:', error?.message || error);
    throw new Error('Could not store password reset token.');
  }
}

/**
 * Consume (look up and delete) a password reset token.
 */
export async function consumeClientResetToken(token) {
  if (!isSupabaseConfigured()) {
    throw new Error('Cloud sync is required for password reset.');
  }

  const orgId = 'medici'; // Tokens are org-scoped; try medici first
  try {
    const workspace = await fetchRecord('clients', 'workspace', orgId);
    const tokens = workspace?._passwordResetTokens || {};
    const record = tokens[token];
    if (!record) return null;

    // Delete the token regardless of expiry
    delete tokens[token];
    await upsertRecord('clients', 'workspace', { _passwordResetTokens: tokens }, orgId);

    if (!record.expires || record.expires <= Date.now()) return null;
    return record;
  } catch (error) {
    console.error('[password-reset-store] consume failed:', error?.message || error);
    return null;
  }
}