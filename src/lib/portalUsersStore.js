import { SUPABASE_ENABLED, supabase } from './supabaseClient';
import { fetchStaffSyncRows } from './staffSyncApi';

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

async function fetchPortalUsersDirect(orgId) {
  if (!supabase) return null;
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

async function fetchPortalUsersFallback(orgId) {
  const rows = await fetchStaffSyncRows('portal_users', orgId);
  if (!Array.isArray(rows)) return null;
  return rowsToCredentialMap(rows);
}

/** Load portal users keyed by brand_key — Supabase direct read, staff-sync fallback. */
export async function loadPortalUsers(orgId) {
  if (!SUPABASE_ENABLED || !orgId) return {};

  const direct = await fetchPortalUsersDirect(orgId);
  if (direct && Object.keys(direct).length) return direct;

  const fallback = await fetchPortalUsersFallback(orgId);
  return fallback || {};
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

export { rowsToCredentialMap };
