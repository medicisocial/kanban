import { supabase } from './supabaseClient';
import { getOrgId } from './orgSession';

const REST_FETCH_TIMEOUT_MS = 12000;

async function fetchAllViaRest(table, orgId) {
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
 * A thin per-record store for one workspace collection (table).
 * Each record is stored as { id, org_id, data: <full record>, updated_at }.
 *
 * org_id is resolved at call time so legacy (medici) and SaaS workspaces share
 * the same sync layer without duplicating hooks.
 */
export function createCollectionStore(table) {
  return {
    async fetchAll() {
      const orgId = getOrgId();

      const restRows = await fetchAllViaRest(table, orgId);
      if (restRows !== null) return restRows;

      const { data, error } = await supabase
        .from(table)
        .select('id, data, updated_at')
        .eq('org_id', orgId);
      if (error) throw error;
      return data || [];
    },

    async upsertRecords(records) {
      if (!records.length) return;
      const orgId = getOrgId();
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
      const orgId = getOrgId();
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('org_id', orgId)
        .in('id', ids.map(String));
      if (error) throw error;
    },

    subscribe(onChange) {
      const orgId = getOrgId();
      const channel = supabase
        .channel(`${table}_${orgId}_changes`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `org_id=eq.${orgId}` },
          (payload) => onChange(payload),
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}
