-- ============================================================================
-- Migration 019: Label "arco fit" as "Arco Fit" across all normalized tables
-- ============================================================================
-- Updates the display_name for brand_key = 'arco fit' so it renders properly
-- capitalized in the UI and client portal.
-- ============================================================================

-- 1. Update client_records display_name
update public.client_records
set display_name = 'Arco Fit',
    updated_at = now()
where org_id = 'medici'
  and brand_key = 'arco fit';

-- 2. Update brands display_name (triggered by sync trigger or directly)
update public.brands
set display_name = 'Arco Fit',
    updated_at = now()
where org_id = 'medici'
  and brand_key = 'arco fit';

-- 3. Update client_brand_names display_name (legacy name uniqueness table)
update public.client_brand_names
set display_name = 'Arco Fit'
where org_id = 'medici'
  and name_normalized = 'arco fit';