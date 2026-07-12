-- Medici Social is both the agency org and a content brand. It lived in
-- `brands` / `client_brand_names` but had no `client_records` row, so cloud
-- mode (which builds the client list from client_records) hid it from filters,
-- Deliverables, and client management.

insert into public.client_records (
  org_id,
  brand_key,
  display_name,
  client_color,
  logo,
  contacts,
  social_logins,
  company_files,
  special_menus,
  photo_gallery_link,
  business_type,
  account_manager,
  deliverable_target,
  deleted_company_file_ids,
  data,
  updated_at
)
values (
  'medici',
  'medici social',
  'Medici Social',
  '#810100',
  '{}'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '',
  '',
  '',
  0,
  '[]'::jsonb,
  '{}'::jsonb,
  now()
)
on conflict (org_id, brand_key) do update
  set
    display_name = excluded.display_name,
    client_color = case
      when client_records.client_color is null or trim(client_records.client_color) = ''
        then excluded.client_color
      else client_records.client_color
    end,
    updated_at = now();
