import { supabase, SUPABASE_ENABLED } from '../lib/supabaseClient';
import { clientBrandNameKey, isInternalClientName, normalizeClientName } from './clients';

function parseRpcResult(data, fallbackError) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: fallbackError };
  }
  if (data.ok) {
    return { ok: true, name: data.name || null };
  }
  return { ok: false, error: data.error || fallbackError };
}

/** Reserve a globally unique client brand name for this workspace (Supabase only). */
export async function reserveClientBrandName(name, orgId) {
  const trimmed = normalizeClientName(name);
  if (!trimmed) {
    return { ok: false, error: 'Please enter a client name.' };
  }
  if (isInternalClientName(trimmed)) {
    return { ok: false, error: 'That client name is reserved.' };
  }
  if (!SUPABASE_ENABLED || !supabase || !orgId) {
    return { ok: true, name: trimmed };
  }

  const { data, error } = await supabase.rpc('reserve_client_brand_name', {
    p_display_name: trimmed,
    p_org_id: orgId,
  });

  if (error) {
    console.error('[clientBrandNames] reserve failed:', error.message || error);
    return {
      ok: false,
      error: 'Could not verify client name availability. Try again in a moment.',
    };
  }

  return parseRpcResult(data, 'Could not reserve client name.');
}

/** Undo a reservation when local client creation fails after the global lock succeeds. */
export async function releaseClientBrandName(name, orgId) {
  const trimmed = normalizeClientName(name);
  if (!trimmed || !SUPABASE_ENABLED || !supabase || !orgId) {
    return { ok: true };
  }

  const { data, error } = await supabase.rpc('release_client_brand_name', {
    p_display_name: trimmed,
    p_org_id: orgId,
  });

  if (error) {
    console.error('[clientBrandNames] release failed:', error.message || error);
    return { ok: false, error: error.message || 'Could not release client name.' };
  }

  return parseRpcResult(data, 'Could not release client name.');
}

export { clientBrandNameKey };
