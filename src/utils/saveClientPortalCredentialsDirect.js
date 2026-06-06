import { supabase } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { mergePortalCredentialDataForPush } from '../lib/syncHelpers';
import { normalizeBrandUsers } from './clientPortalCredentials';

/**
 * Write one brand's portal credentials directly from the browser (bypasses Vercel
 * serverless time limits). Requires an active staff Supabase Auth session.
 *
 * `brandVault` is an optional { [userId]: plainPassword } map persisted to the
 * clients workspace vault (what the staff editor re-displays after refresh).
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

  const payload = mergePortalCredentialDataForPush(existingData, users, { allowPasswordChange });
  if (!payload.length) {
    return { ok: false, error: 'Set a username and password for at least one portal user.' };
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

  let vaultWarning = null;
  if (brandVault && Object.keys(brandVault).length) {
    const { error: vaultError } = await supabase.rpc('patch_clients_portal_password_vault', {
      p_org_id: getOrgId(),
      p_brand: brand,
      p_brand_vault: brandVault,
    });
    if (vaultError) {
      console.warn('[portal-credentials] vault patch failed:', vaultError.message || vaultError);
      vaultWarning =
        'Portal logins saved. The saved password may not show on other devices until the next sync.';
    }
  }

  const usersForClient = normalizeBrandUsers(
    payload.map(({ _passwordChangeAuthorized: _ignored, ...user }) => user),
  );

  return { ok: true, users: usersForClient, vaultWarning };
}
