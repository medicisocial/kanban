import { SUPABASE_ENABLED, supabase } from './supabaseClient';
import { isStaffSessionValid, loadStaffSession } from '../utils/staffAuth';

async function supabaseJwtHeaders() {
  if (!SUPABASE_ENABLED || !supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return null;
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch {
    return null;
  }
}

async function legacyStaffHeaders() {
  const session = loadStaffSession();
  if (session?.username && session?.signature && (await isStaffSessionValid(session))) {
    return {
      Authorization: `Bearer ${btoa(JSON.stringify(session))}`,
      'Content-Type': 'application/json',
    };
  }
  return null;
}

/**
 * Auth headers for staff-only API routes (/api/staff-sync, /api/brand-record, …).
 * @param {{ preferSupabaseJwt?: boolean }} options
 *   When true, use the Supabase JWT first so the server can write under RLS
 *   (no service role required). Use for brand-record profile saves.
 */
export async function buildStaffApiAuthHeaders({ preferSupabaseJwt = false } = {}) {
  if (preferSupabaseJwt) {
    const jwtHeaders = await supabaseJwtHeaders();
    if (jwtHeaders) return jwtHeaders;
    return legacyStaffHeaders();
  }

  const legacyHeaders = await legacyStaffHeaders();
  if (legacyHeaders) return legacyHeaders;
  return supabaseJwtHeaders();
}
