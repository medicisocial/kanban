import { SUPABASE_ENABLED, supabase } from './supabaseClient';
import {
  fetchClientRecordListRows,
  fetchClientRecordFullRows,
} from '../utils/clientRecordsCloud.js';

/** Load client list rows (fast) for filter/sidebar. */
export async function loadClientRecords(orgId) {
  if (!SUPABASE_ENABLED || !orgId) return [];
  return fetchClientRecordListRows(orgId);
}

/** Load full profile rows — after list is visible. */
export async function loadClientRecordsFull(orgId) {
  if (!SUPABASE_ENABLED || !orgId) return [];
  return fetchClientRecordFullRows(orgId);
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

export { CLIENT_RECORDS_LIST_SELECT as CLIENT_RECORDS_SELECT } from '../utils/clientRecordsCloud.js';
