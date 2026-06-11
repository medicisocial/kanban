-- Keep brand_id in sync on all client-scoped content rows so every client portal
-- reads the correct cards, shoot plans, events, and meetings.

create or replace function public.sync_content_brand_id()
returns trigger
language plpgsql
as $$
declare
  v_client text;
  v_brand_id uuid;
begin
  if new.data is null or not (new.data ? 'client') then
    return new;
  end if;

  v_client := nullif(trim(new.data->>'client'), '');
  if v_client is null then
    return new;
  end if;

  select b.id
  into v_brand_id
  from public.brands b
  where b.org_id = new.org_id
    and (
      lower(trim(v_client)) = b.brand_key
      or lower(trim(v_client)) = lower(trim(b.display_name))
    )
  order by b.created_at nulls last
  limit 1;

  if v_brand_id is not null then
    new.brand_id := v_brand_id;
  end if;

  return new;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'cards', 'shoot_plans', 'video_ideas', 'admin_tasks', 'events', 'meetings'
  ] loop
    execute format('drop trigger if exists trg_sync_%I_brand_id on public.%I', tbl, tbl);
    execute format(
      'create trigger trg_sync_%I_brand_id before insert or update on public.%I for each row execute function public.sync_content_brand_id()',
      tbl,
      tbl
    );
  end loop;
end $$;
