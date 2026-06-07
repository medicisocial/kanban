create table if not exists public.client_records (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations (id) on delete cascade,
  brand_key text not null,
  display_name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, brand_key)
);

create index if not exists client_records_org_id_idx
  on public.client_records (org_id);

insert into public.client_records (org_id, brand_key, display_name, data, updated_at)
select
  c.org_id,
  lower(trim(brand_name)),
  trim(brand_name),
  jsonb_build_object(
    'colors',           coalesce(c.data->'colors'->>trim(brand_name), ''),
    'logos',            coalesce(c.data->'logos'->trim(brand_name), '{}'::jsonb),
    'contacts',         coalesce(c.data->'contacts'->trim(brand_name), '[]'::jsonb),
    'socialLogins',     coalesce(c.data->'socialLogins'->trim(brand_name), '{}'::jsonb),
    'companyFiles',     coalesce(c.data->'companyFiles'->trim(brand_name), '[]'::jsonb),
    'specialMenus',     coalesce(c.data->'specialMenus'->trim(brand_name), '[]'::jsonb),
    'photoGalleryLink', coalesce(c.data->'photoGalleryLinks'->>trim(brand_name), ''),
    'businessType',     coalesce(c.data->'businessTypes'->>trim(brand_name), ''),
    'accountManager',   coalesce(c.data->'accountManagers'->>trim(brand_name), '')
  ),
  c.updated_at
from public.clients c
cross join lateral jsonb_array_elements_text(coalesce(c.data->'names', '[]'::jsonb)) as brand_name
where trim(brand_name) <> ''
  and brand_name not like '\__%' escape '\'
on conflict (org_id, brand_key) do nothing;

do $$
declare
  tbl text;
  tables text[] := array[
    'cards', 'shoot_plans', 'video_ideas', 'admin_tasks', 'events',
    'meetings', 'clients', 'team_members', 'client_portal_credentials'
  ];
begin
  foreach tbl in array tables loop
    execute format($f$
      alter table public.%I
        add constraint %I
        foreign key (org_id) references public.organizations (id)
        on delete cascade;
    $f$, tbl, tbl || '_org_id_fkey');
  end loop;
end $$;

insert into public.client_records (org_id, brand_key, display_name, data, updated_at)
select
  cpc.org_id,
  lower(trim(cpc.id)),
  trim(cpc.id),
  '{}'::jsonb,
  cpc.updated_at
from public.client_portal_credentials cpc
where not exists (
  select 1 from public.client_records cr
  where cr.org_id = cpc.org_id
    and cr.brand_key = lower(trim(cpc.id))
)
on conflict (org_id, brand_key) do nothing;

create or replace function public.normalize_credential_brand_key()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.id := lower(trim(coalesce(new.id, '')));
  if new.id = '' then
    raise exception 'client_portal_credentials.id must not be blank';
  end if;
  insert into public.client_records (org_id, brand_key, display_name, data)
  values (new.org_id, new.id, new.id, '{}'::jsonb)
  on conflict (org_id, brand_key) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_normalize_credential_brand_key on public.client_portal_credentials;
create trigger trg_normalize_credential_brand_key
  before insert or update on public.client_portal_credentials
  for each row execute function public.normalize_credential_brand_key();

update public.client_portal_credentials
set id = lower(trim(id))
where id <> lower(trim(id));

alter table public.client_portal_credentials
  add constraint client_portal_credentials_brand_fkey
  foreign key (org_id, id) references public.client_records (org_id, brand_key)
  on delete cascade;

-- Backfill client_records from client_brand_names for any brands that were reserved
-- via reserve_client_brand_name() but never appeared in clients.data->'names' or
-- client_portal_credentials. Without this, the FK below would fail.
insert into public.client_records (org_id, brand_key, display_name, data)
select
  cbn.org_id,
  cbn.name_normalized,
  cbn.display_name,
  '{}'::jsonb
from public.client_brand_names cbn
where not exists (
  select 1 from public.client_records cr
  where cr.org_id = cbn.org_id
    and cr.brand_key = cbn.name_normalized
)
on conflict (org_id, brand_key) do nothing;

alter table public.client_brand_names
  add constraint client_brand_names_client_fkey
  foreign key (org_id, name_normalized) references public.client_records (org_id, brand_key)
  on delete cascade;

create or replace function public.sync_client_record_to_blob()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
begin
  row_data := jsonb_build_object(
    new.brand_key, jsonb_build_object(
      'displayName',     new.display_name,
      'colors',          new.data->'colors',
      'logos',           new.data->'logos',
      'contacts',        new.data->'contacts',
      'socialLogins',    new.data->'socialLogins',
      'companyFiles',    new.data->'companyFiles',
      'specialMenus',    new.data->'specialMenus',
      'photoGalleryLink', new.data->>'photoGalleryLink',
      'businessType',    new.data->>'businessType',
      'accountManager',  new.data->>'accountManager'
    )
  );
  update public.clients
  set
    data = jsonb_set(
      jsonb_set(
        coalesce(public.clients.data, '{}'::jsonb),
        '{names}',
        case
          when coalesce(public.clients.data->'names', '[]'::jsonb) @> to_jsonb(new.display_name)::jsonb
            then public.clients.data->'names'
          else coalesce(public.clients.data->'names', '[]'::jsonb) || to_jsonb(new.display_name)::jsonb
        end,
        true
      ),
      '{logos}',
      coalesce(public.clients.data->'logos', '{}'::jsonb) || (row_data->new.brand_key->'logos'),
      true
    ),
    updated_at = greatest(public.clients.updated_at, new.updated_at)
  where id = 'workspace' and org_id = new.org_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_client_record_to_blob on public.client_records;
create trigger trg_sync_client_record_to_blob after insert or update on public.client_records for each row execute function public.sync_client_record_to_blob();

alter table public.client_records enable row level security;

drop policy if exists client_records_tenant_write on public.client_records;
create policy client_records_tenant_write on public.client_records
  for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

drop policy if exists client_records_anon_legacy_read on public.client_records;
create policy client_records_anon_legacy_read on public.client_records
  for select to anon
  using (org_id = 'medici');

alter publication supabase_realtime add table public.client_records;