import { SUPABASE_ENABLED, supabase } from './supabaseClient';
import { fetchClientRecordRows } from '../utils/clientRecordsCloud.js';

const CLIENT_RECORDS_SELECT =
  'id,org_id,brand_key,display_name,client_color,logo,contacts,social_logins,company_files,special_menus,photo_gallery_link,business_type,account_manager,updated_at,deleted_company_file_ids';

/** Load all client profile rows for an org — Supabase first, staff-sync fallback. */
export async function loadClientRecords(orgId) {
  if (!SUPABASE_ENABLED || !orgId) return [];
  return fetchClientRecordRows(orgId);
}

/** Subscribe to client_records changes for an org (refetch on any change). */
export function subscribeClientRecords(orgId, onChange) {
  if (!SUPABASE_ENABLED || !supabase || !orgId) return () => {};

  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => onChange(), 120);
  };

  const channel = supabase
    .channel(`client_records:${orgId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'client_records',
        filter: `org_id=eq.${orgId}`,
      },
      schedule,
    )
    .subscribe();

  return () => {
    clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}

export { CLIENT_RECORDS_SELECT };
