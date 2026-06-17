import { SUPABASE_ENABLED, supabase } from './supabaseClient';
import { isStaffSessionValid, loadStaffSession } from '../utils/staffAuth';

/** Auth headers for staff-only API routes (/api/staff-sync, /api/brand-record, …). */
export async function buildStaffApiAuthHeaders() {
  const session = loadStaffSession();
  if (session?.username && session?.signature && (await isStaffSessionValid(session))) {
    return {
      Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
      'Content-Type': 'application/json',
    };
  }

  if (SUPABASE_ENABLED && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        return {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}
