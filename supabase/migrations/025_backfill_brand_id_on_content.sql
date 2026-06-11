-- Backfill brand_id on workspace content rows where client text matches brands.brand_key
-- but brand_id was never set (portal reads by brand_id first, then falls back to client text).

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'cards', 'shoot_plans', 'video_ideas', 'admin_tasks', 'events', 'meetings'
  ] loop
    execute format(
      $sql$
      update public.%I t
      set brand_id = b.id
      from public.brands b
      where t.org_id = b.org_id
        and t.brand_id is null
        and t.data ? 'client'
        and lower(trim(t.data->>'client')) = b.brand_key
      $sql$,
      tbl
    );
  end loop;
end $$;
