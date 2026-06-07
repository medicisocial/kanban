-- Backfill of a change first applied directly to the production DB.
-- Wrap auth.uid() in a scalar subselect so it is evaluated once per query
-- instead of once per row (Supabase auth_rls_initplan perf advisory).
ALTER POLICY organization_members_own_read ON public.organization_members
  USING (user_id = (select auth.uid()));

ALTER POLICY organizations_member_read ON public.organizations
  USING (id IN (
    SELECT om.org_id FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
  ));

-- cards is realtime-published and frequently updated; keep dead tuples low so
-- it does not bloat.
ALTER TABLE public.cards SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 50,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_analyze_threshold = 50
);
