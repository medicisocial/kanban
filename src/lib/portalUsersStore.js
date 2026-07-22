import { SUPABASE_ENABLED, supabase } from './supabaseClient';
import { fetchStaffSyncRows } from './staffSyncApi';
import { mustUseStaffSyncOnly } from './staffSyncReadPolicy';

const PORTAL_USERS_SELECT =
  'id, username, password_hash, display_name, avatar, brands!inner ( brand_key, org_id )';

function rowsToCredentialMap(rows = []) {
  const map = {};
  for (const row of rows) {
    const brandKey =
      row.brand_key ||
      row.brands?.brand_key ||
      (Array.isArray(row.brands) ? row.brands[0]?.brand_key : null);
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

/**
 * Direct org-wide portal_users read. Must NEVER run for personal/restricted
 * staff sessions — password hashes would leak across brands.
 */
async function fetchPortalUsersDirect(orgId) {
  if (!supabase) return null;
  if (mustUseStaffSyncOnly()) {
    console.warn('[portal_users] blocked direct Supabase read for personal staff session');
    return null;
  }
  const { data, error } = await supabase
    .from('portal_users')
    .select(PORTAL_USERS_SELECT)
    .eq('brands.org_id', orgId);
  if (error) {
    console.warn('[portal_users] Supabase read failed:', error.message || error);
    return null;
  }
  return rowsToCredentialMap(Array.isArray(data) ? data : []);
}

async function fetchPortalUsersViaStaffSync(orgId) {
  const rows = await fetchStaffSyncRows('portal_users', orgId);
  if (!Array.isArray(rows)) return null;
  return rowsToCredentialMap(rows);
}

/**
 * Load portal users keyed by brand_key.
 * Personal staff sessions: staff-sync only (server allowlist). Never direct.
 * Ops / no staff session: staff-sync first, then direct as last resort.
 */
export async function loadPortalUsers(orgId) {
  if (!SUPABASE_ENABLED || !orgId) return {};

  const viaSync = await fetchPortalUsersViaStaffSync(orgId);
  if (viaSync !== null) return viaSync;

  if (mustUseStaffSyncOnly()) return {};

  const direct = await fetchPortalUsersDirect(orgId);
  return direct || {};
}

/** Subscribe to portal_users changes for an org (refetch on any change). */
export function subscribePortalUsers(orgId, onChange) {
  if (!SUPABASE_ENABLED || !supabase || !orgId) return () => {};

  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => onChange(), 120);
  };

  const channel = supabase
    .channel(`portal_users:${orgId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'portal_users',
      },
      schedule,
    )
    .subscribe();

  return () => {
    clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}

export { rowsToCredentialMap, fetchPortalUsersDirect };
