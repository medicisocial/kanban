import { supabase } from './supabaseClient';
import { fetchStaffSyncRows } from './staffSyncApi';
import { fetchLegacyWorkspaceBlobRows } from './workspaceBlobFallback';
import { ensureStaffSupabaseSession, hasStaffSupabaseSession } from './staffSupabaseAuth';
import { getOrgId, LEGACY_ORG_ID } from './orgSession';
import {
  isSharedOperationsLogin,
  loadStaffSession,
  usesPersonalWorkspaceView,
} from '../utils/staffAuth';

const REST_FETCH_TIMEOUT_MS = 5000;

/** Personal team logins must not fall open to org-wide REST/RLS when staff-sync fails. */
function mustFailClosedWithoutStaffSync() {
  const session = loadStaffSession();
  if (!session) return false;
  if (isSharedOperationsLogin(session)) return false;
  return usesPersonalWorkspaceView(session);
}

async function fetchAllViaRest(table, orgId) {
  // Anon REST only works for the legacy org where RLS allows unauthenticated reads.
  if (orgId !== LEGACY_ORG_ID) return null;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REST_FETCH_TIMEOUT_MS);

  try {
    const endpoint = `${url}/rest/v1/${table}?select=id,data,updated_at&org_id=eq.${encodeURIComponent(orgId)}`;
    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Build a Supabase query filter string.
 * If brandId is provided, adds a brand_id filter for brand-scoped queries.
 */
function buildFilters(orgId, brandId) {
  const filters = [`org_id=eq.${encodeURIComponent(orgId)}`];
  if (brandId) {
    filters.push(`brand_id=eq.${encodeURIComponent(brandId)}`);
  }
  return filters.join(',');
}

/**
 * A thin per-record store for one workspace collection (table).
 * Each record is stored as { id, org_id, data: <full record>, updated_at }.
 *
 * When brandId is provided, queries are scoped to that brand (migration 018+).
 */
function buildTableStore(table, orgId, brandId) {
  const filters = buildFilters(orgId, brandId);

  return {
    async fetchAll() {
      // Warm DB session in the background; reads must not wait on it.
      void ensureStaffSupabaseSession();

      // Prefer staff-sync (server-scoped). An empty array is a valid restricted
      // result — never fall through to org-wide REST/anon when the API answered.
      const staffRows = await fetchStaffSyncRows(table, orgId);
      if (staffRows !== null) return staffRows;
      if (mustFailClosedWithoutStaffSync()) return [];

      // No staff-sync auth/response. Legacy anon REST only for unauthenticated
      // bootstrap of the legacy org — never used after a scoped staff session.
      const restRows =
        orgId === LEGACY_ORG_ID ? await fetchAllViaRest(table, orgId) : null;
      if (Array.isArray(restRows)) return restRows;

      if (supabase && (await hasStaffSupabaseSession())) {
        let query = supabase
          .from(table)
          .select('id, data, updated_at')
          .eq('org_id', orgId);
        if (brandId) {
          query = query.eq('brand_id', brandId);
        }
        const { data, error } = await query;
        if (!error) return data || [];
        console.warn(`[supabase:${table}] client fetch failed:`, error.message);
      }

      if (supabase) {
        let query = supabase
          .from(table)
          .select('id, data, updated_at')
          .eq('org_id', orgId);
        if (brandId) {
          query = query.eq('brand_id', brandId);
        }
        const { data, error } = await query;
        if (!error) return data || [];
        console.warn(`[supabase:${table}] anon client fetch failed:`, error.message);
      }

      const blobRows = await fetchLegacyWorkspaceBlobRows(table);
      if (blobRows?.length) return blobRows;

      return [];
    },

    async fetchByBrandId(brandIdValue) {
      if (!brandIdValue || !supabase) return [];
      const { data, error } = await supabase
        .from(table)
        .select('id, data, updated_at')
        .eq('org_id', orgId)
        .eq('brand_id', brandIdValue);
      if (error) {
        console.warn(`[supabase:${table}] brand-scoped fetch failed:`, error.message);
        return [];
      }
      return data || [];
    },

    async upsertRecords(records) {
      if (!records.length) return;
      const rows = records.map((record) => ({
        id: String(record.id),
        org_id: orgId,
        data: record.data,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from(table).upsert(rows);
      if (error) throw error;
    },

    async deleteRecords(ids) {
      if (!ids.length) return;
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('org_id', orgId)
        .in('id', ids.map(String));
      if (error) throw error;
    },

    subscribe(onChange) {
      const channelSuffix =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const channel = supabase
        .channel(`${table}_${orgId}_${brandId || 'all'}_${channelSuffix}_changes`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: filters },
          (payload) => onChange(payload),
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}

export function createCollectionStore(table, brandId) {
  return buildTableStore(table, getOrgId(), brandId);
}

export function createBrandScopedStore(table, brandId) {
  if (!brandId) return createCollectionStore(table);
  return buildTableStore(table, getOrgId(), brandId);
}