import { supabase } from './supabaseClient';
import { getOrgId } from './orgSession';

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
      const { data, error } = await supabase
        .from(table)
        .select('id, data')
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
          onChange,
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}
