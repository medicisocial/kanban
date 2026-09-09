-- Soft-delete tombstone for client brands. Keeps historical content; list/sync
-- loaders skip rows where deleted_at is set. Re-add clears deleted_at.

alter table public.client_records
  add column if not exists deleted_at timestamptz null;

alter table public.client_records
  add column if not exists deleted_by text null;

create index if not exists client_records_org_active_idx
  on public.client_records (org_id)
  where deleted_at is null;

-- Backfill from org-level removedNames maps (newest removal with no newer restore).
do $$
declare
  rec record;
  v_brand_key text;
  removed_ts numeric;
  restored_ts numeric;
begin
  for rec in
    select org_id, removed_names, restored_names
    from public.org_workspace_settings
  loop
    if rec.removed_names is null or jsonb_typeof(rec.removed_names) <> 'object' then
      continue;
    end if;
    for v_brand_key, removed_ts in
      select key, (value#>>'{}')::numeric
      from jsonb_each(rec.removed_names)
    loop
      restored_ts := null;
      if rec.restored_names is not null and rec.restored_names ? v_brand_key then
        restored_ts := (rec.restored_names ->> v_brand_key)::numeric;
      end if;
      if removed_ts is null or removed_ts <= 0 then
        continue;
      end if;
      if restored_ts is not null and restored_ts >= removed_ts then
        continue;
      end if;
      update public.client_records cr
      set
        deleted_at = to_timestamp(removed_ts / 1000.0),
        updated_at = now()
      where cr.org_id = rec.org_id
        and cr.brand_key = v_brand_key
        and cr.deleted_at is null;
    end loop;
  end loop;
end $$;

-- Org brand list excludes soft-deleted client_records.
create or replace function public.get_org_brand_names(p_org_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(cr.display_name order by lower(cr.display_name)), '[]'::jsonb)
  from public.client_records cr
  where cr.org_id = p_org_id
    and cr.deleted_at is null
    and not cr.brand_key like '__%';
$$;

revoke all on function public.get_org_brand_names(text) from public;
grant execute on function public.get_org_brand_names(text) to service_role, authenticated;

-- Soft-delete / restore RPCs for staff API (service role + authenticated org members).
create or replace function public.tombstone_client_record(
  p_org_id text,
  p_brand_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := lower(trim(coalesce(p_brand_key, '')));
begin
  if p_org_id is null or trim(p_org_id) = '' or v_key = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing org or brand.');
  end if;

  update public.client_records
  set
    deleted_at = coalesce(deleted_at, now()),
    updated_at = now()
  where org_id = p_org_id
    and brand_key = v_key;

  if not found then
    -- No row yet — still ok; org tombstone map covers cold cases.
    return jsonb_build_object('ok', true, 'missing', true);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.restore_client_record(
  p_org_id text,
  p_brand_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := lower(trim(coalesce(p_brand_key, '')));
begin
  if p_org_id is null or trim(p_org_id) = '' or v_key = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing org or brand.');
  end if;

  update public.client_records
  set
    deleted_at = null,
    deleted_by = null,
    updated_at = now()
  where org_id = p_org_id
    and brand_key = v_key;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.tombstone_client_record(text, text) from public;
revoke all on function public.restore_client_record(text, text) from public;
grant execute on function public.tombstone_client_record(text, text) to service_role, authenticated;
grant execute on function public.restore_client_record(text, text) to service_role, authenticated;
