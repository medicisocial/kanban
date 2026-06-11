import { useEffect, useRef, useCallback } from 'react';
import { SUPABASE_ENABLED } from '../lib/supabaseClient';
import { isCloudSourceOfTruth } from '../lib/cloudSourceOfTruth';
import { fetchStaffSyncRows } from '../lib/staffSyncApi';
import { getOrgId } from '../lib/orgSession';
import { normalizeBrandUsers } from '../utils/clientPortalCredentials';

function rowsToCredentialMap(rows = []) {
  const map = {};
  for (const row of rows) {
    const brandKey = row.brand_key || row.brands?.brand_key;
    if (!brandKey) continue;
    const users = map[brandKey] || [];
    users.push({
      id: String(row.id),
      username: row.username,
      passwordHash: row.password_hash,
      displayName: row.display_name || '',
      avatar: row.avatar || null,
    });
    map[brandKey] = users;
  }
  return map;
}

/** Hydrate portal credentials from normalized portal_users (cloud mode). */
export function usePortalUsersSync({ credentials, setCredentials, orgReady }) {
  const loadedRef = useRef(false);

  const reload = useCallback(async () => {
    if (!SUPABASE_ENABLED || !orgReady || !isCloudSourceOfTruth()) return;
    const rows = await fetchStaffSyncRows('portal_users', getOrgId());
    if (!Array.isArray(rows)) return;
    setCredentials(rowsToCredentialMap(rows));
    loadedRef.current = true;
  }, [orgReady, setCredentials]);

  useEffect(() => {
    loadedRef.current = false;
    void reload();
  }, [reload]);

  return { portalUsersLoaded: loadedRef.current, reloadPortalUsers: reload };
}

export function mergePortalUserDraftIntoMap(map, brandKey, users) {
  return { ...map, [brandKey]: normalizeBrandUsers(users) };
}
