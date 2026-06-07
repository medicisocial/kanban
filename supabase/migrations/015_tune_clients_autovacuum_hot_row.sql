-- Backfill of a change first applied directly to the production DB.
-- public.clients is a single hot row (the workspace blob) rewritten constantly;
-- make autovacuum (and its TOAST table) reclaim dead tuples aggressively so the
-- table never bloats the way it did before logos moved to storage.
ALTER TABLE public.clients SET (
  autovacuum_enabled = true,
  autovacuum_vacuum_scale_factor = 0,
  autovacuum_vacuum_threshold = 10,
  autovacuum_vacuum_insert_scale_factor = 0,
  autovacuum_vacuum_insert_threshold = 10,
  autovacuum_vacuum_cost_delay = 0,
  autovacuum_vacuum_cost_limit = 10000,
  autovacuum_analyze_scale_factor = 0,
  autovacuum_analyze_threshold = 20,
  toast.autovacuum_enabled = true,
  toast.autovacuum_vacuum_scale_factor = 0,
  toast.autovacuum_vacuum_threshold = 10,
  toast.autovacuum_vacuum_cost_delay = 0,
  toast.autovacuum_vacuum_cost_limit = 10000
);
