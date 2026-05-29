import { supabase, ORG_ID } from './supabaseClient';

/**
 * A thin per-record store for one workspace collection (table).
 * Each record is stored as { id, org_id, data: <full record>, updated_at }.
 *
 * Per-record upsert/delete is what fixes the old "whole-blob, last-write-wins"
 * problem: two people editing different records no longer clobber each other.
 */
export function createCollectionStore(table) {
  return {
    async fetchAll() {
      const { data, error } = await supabase
        .from(table)
        .select('id, data')
        .eq('org_id', ORG_ID);
      if (error) throw error;
      return data || [];
    },

    async upsertRecords(records) {
      if (!records.length) return;
      const rows = records.map((record) => ({
        id: String(record.id),
        org_id: ORG_ID,
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
        .eq('org_id', ORG_ID)
        .in('id', ids.map(String));
      if (error) throw error;
    },

    subscribe(onChange) {
      const channel = supabase
        .channel(`${table}_changes`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          onChange,
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}
