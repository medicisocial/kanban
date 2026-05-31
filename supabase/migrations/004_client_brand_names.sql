-- Globally unique client brand names across all SaaS workspaces.
-- Client names double as portal brand keys, so duplicates would collide platform-wide.

create table if not exists public.client_brand_names (
  name_normalized text primary key,
  display_name text not null,
  org_id text not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists client_brand_names_org_id_idx
  on public.client_brand_names (org_id);

alter table public.client_brand_names enable row level security;

drop policy if exists client_brand_names_member_read on public.client_brand_names;
create policy client_brand_names_member_read on public.client_brand_names
  for select to authenticated
  using (true);

drop policy if exists client_brand_names_member_insert on public.client_brand_names;
create policy client_brand_names_member_insert on public.client_brand_names
  for insert to authenticated
  with check (
    org_id in (select public.user_org_ids())
  );

drop policy if exists client_brand_names_member_delete on public.client_brand_names;
create policy client_brand_names_member_delete on public.client_brand_names
  for delete to authenticated
  using (org_id in (select public.user_org_ids()));

-- Backfill names already stored in workspace client blobs.
-- When the same name exists in multiple orgs, keep the most recently updated workspace copy.
insert into public.client_brand_names (name_normalized, display_name, org_id)
select distinct on (lower(trim(name)))
  lower(trim(name)),
  trim(name),
  c.org_id
from public.clients c
cross join lateral jsonb_array_elements_text(coalesce(c.data -> 'names', '[]'::jsonb)) as name
where trim(name) <> ''
  and name not like '__%'
order by lower(trim(name)), c.updated_at desc
on conflict (name_normalized) do nothing;

create or replace function public.normalize_client_brand_name(raw_name text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(coalesce(raw_name, ''), '\s+', ' ', 'g')));
$$;

create or replace function public.reserve_client_brand_name(p_display_name text, p_org_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  display text;
begin
  display := trim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g'));
  normalized := public.normalize_client_brand_name(display);

  if normalized = '' then
    return jsonb_build_object('ok', false, 'error', 'Please enter a client name.');
  end if;

  if normalized like '__%' then
    return jsonb_build_object('ok', false, 'error', 'That client name is reserved.');
  end if;

  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to add a client.');
  end if;

  if not exists (
    select 1 from public.organization_members
    where user_id = auth.uid() and org_id = p_org_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'You do not have access to this workspace.');
  end if;

  insert into public.client_brand_names (name_normalized, display_name, org_id)
  values (normalized, display, p_org_id);

  return jsonb_build_object('ok', true, 'name', display);
exception
  when unique_violation then
    return jsonb_build_object(
      'ok',
      false,
      'error',
      'A client with that name already exists on Medici Social. Choose a different name.'
    );
end;
$$;

create or replace function public.release_client_brand_name(p_display_name text, p_org_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  normalized := public.normalize_client_brand_name(p_display_name);
  if normalized = '' then
    return jsonb_build_object('ok', false);
  end if;

  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in required.');
  end if;

  delete from public.client_brand_names
  where name_normalized = normalized
    and org_id = p_org_id
    and org_id in (
      select om.org_id from public.organization_members om where om.user_id = auth.uid()
    );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.normalize_client_brand_name(text) from public;
grant execute on function public.normalize_client_brand_name(text) to authenticated;

revoke all on function public.reserve_client_brand_name(text, text) from public;
grant execute on function public.reserve_client_brand_name(text, text) to authenticated;

revoke all on function public.release_client_brand_name(text, text) from public;
grant execute on function public.release_client_brand_name(text, text) to authenticated;
