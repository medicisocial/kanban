import { supabase } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { mergePortalCredentialDataForPush } from '../lib/syncHelpers';
import { normalizeBrandUsers } from './clientPortalCredentials';
import { patchPortalPasswordVaultInBackground } from './patchPortalPasswordVaultBackground';

function attachPasswordChangeMarkers(payload, previousUsers) {
  const prevById = new Map(previousUsers.map((user) => [user.id, user]));
  const prevByUsername = new Map(
    previousUsers.map((user) => [user.username.trim().toLowerCase(), user]),
  );

  return payload.map((user) => {
    const previous =
      prevById.get(user.id) || prevByUsername.get(user.username.trim().toLowerCase());
    const prevHash = previous?.passwordHash?.trim().toLowerCase() || '';
    const nextHash = user.passwordHash?.trim().toLowerCase() || '';
    if (nextHash && prevHash && nextHash !== prevHash) {
      return { ...user, _passwordChangeAuthorized: true };
    }
    return user;
  });
}

/**
 * Write one brand's portal credentials directly from the browser (bypasses Vercel
 * serverless time limits). Requires an active staff Supabase Auth session.
 *
 * Login hashes are written synchronously; the plaintext vault patches in the
 * background so Save is not blocked on the large clients workspace row.
 */
export async function saveClientPortalCredentialsDirect({
  brand,
  users,
  existingData,
  brandVault = {},
  allowPasswordChange = false,
}) {
  if (!supabase) {
    return { ok: false, error: 'Cloud sync is not configured.' };
  }

  let serverExisting = [];
  try {
    const { data: row } = await supabase
      .from('client_portal_credentials')
      .select('data')
      .eq('org_id', getOrgId())
      .eq('id', brand)
      .maybeSingle();
    if (row?.data) {
      serverExisting = normalizeBrandUsers(row.data);
    }
  } catch {
    /* fall back to local existingData */
  }

  const mergeBase = serverExisting.length ? serverExisting : normalizeBrandUsers(existingData);
  let payload = mergePortalCredentialDataForPush(mergeBase, users, {
    allowPasswordChange,
    authoritativeUserList: true,
  });
  if (!payload.length) {
    return { ok: false, error: 'Set a username and password for at least one portal user.' };
  }

  if (allowPasswordChange) {
    payload = attachPasswordChangeMarkers(payload, mergeBase);
  }

  const { error } = await supabase.from('client_portal_credentials').upsert({
    id: brand,
    org_id: getOrgId(),
    data: payload,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return { ok: false, error: error.message || 'Could not save portal passwords.' };
  }

  if (allowPasswordChange && serverExisting.length) {
    try {
      const { data: verifyRow } = await supabase
        .from('client_portal_credentials')
        .select('data')
        .eq('org_id', getOrgId())
        .eq('id', brand)
        .maybeSingle();
      const verified = normalizeBrandUsers(verifyRow?.data);
      for (const user of payload) {
        const saved = verified.find(
          (entry) =>
            entry.id === user.id ||
            entry.username.toLowerCase() === user.username.trim().toLowerCase(),
        );
        const expected = user.passwordHash?.trim().toLowerCase() || '';
        const actual = saved?.passwordHash?.trim().toLowerCase() || '';
        if (expected && actual !== expected) {
          return {
            ok: false,
            error: 'Password change was blocked by the server. Try again or sign in again.',
          };
        }
      }
    } catch {
      /* verification is best-effort */
    }
  }

  patchPortalPasswordVaultInBackground(brand, brandVault);

  const usersForClient = normalizeBrandUsers(
    payload.map(({ _passwordChangeAuthorized: _ignored, ...user }) => user),
  );

  return { ok: true, users: usersForClient };
}
