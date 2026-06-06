import { supabase } from '../lib/supabaseClient';
import { getOrgId } from '../lib/orgSession';
import { mergePortalCredentialDataForPush } from '../lib/syncHelpers';
import { normalizeBrandUsers } from './clientPortalCredentials';

/**
 * Write one brand's portal credentials directly from the browser (bypasses Vercel
 * serverless time limits). Requires an active staff Supabase Auth session.
 */
export async function saveClientPortalCredentialsDirect({
  brand,
  users,
  existingData,
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

  const usersForClient = normalizeBrandUsers(
    payload.map(({ _passwordChangeAuthorized: _ignored, ...user }) => user),
  );

  return { ok: true, users: usersForClient };
}
