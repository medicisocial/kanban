-- Let signed-in org members patch client_records via patch_brand_profile RPC (browser Supabase client).
-- service_role (API) continues to bypass the membership check.

create or replace function public.patch_brand_profile(
  p_org_id text,
  p_brand_key text,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_brand_key text := lower(trim(p_brand_key));
  v_merged_deleted jsonb;
begin
  if v_brand_key = '' then
    raise exception 'brand key required';
  end if;

  if auth.role() = 'authenticated' then
    if p_org_id is null
      or trim(p_org_id) = ''
      or not (p_org_id in (select public.user_org_ids()))
    then
      raise exception 'not authorized for organization';
    end if;
  end if;

  if p_patch ? 'appendDeletedCompanyFileIds' then
    select coalesce(jsonb_agg(distinct elem), '[]'::jsonb)
    into v_merged_deleted
    from (
      select jsonb_array_elements_text(
        coalesce(
          (select cr.deleted_company_file_ids
           from public.client_records cr
           where cr.org_id = p_org_id and cr.brand_key = v_brand_key),
          '[]'::jsonb
        )
      ) as elem
      union
      select jsonb_array_elements_text(coalesce(p_patch->'appendDeletedCompanyFileIds', '[]'::jsonb))
    ) merged;
  end if;

  insert into public.client_records (
    org_id, brand_key, display_name,
    client_color, logo, contacts, social_logins, company_files, special_menus,
    photo_gallery_link, business_type, account_manager,
    deleted_company_file_ids, data, updated_at
  )
  values (
    p_org_id,
    v_brand_key,
    coalesce(nullif(trim(p_patch->>'displayName'), ''), v_brand_key),
    coalesce(p_patch->>'clientColor', ''),
    coalesce(p_patch->'clientLogo', '{}'::jsonb),
    coalesce(p_patch->'contacts', '[]'::jsonb),
    coalesce(p_patch->'socialLogins', '{}'::jsonb),
    coalesce(p_patch->'companyFiles', '[]'::jsonb),
    coalesce(p_patch->'specialMenus', '[]'::jsonb),
    coalesce(p_patch->>'photoGalleryLink', ''),
    coalesce(p_patch->>'businessType', ''),
    coalesce(p_patch->>'accountManager', ''),
    coalesce(v_merged_deleted, coalesce(p_patch->'deletedCompanyFileIds', '[]'::jsonb)),
    '{}'::jsonb,
    now()
  )
  on conflict (org_id, brand_key) do update
    set
      display_name = coalesce(nullif(excluded.display_name, ''), client_records.display_name),
      client_color = case when p_patch ? 'clientColor' then excluded.client_color else client_records.client_color end,
      logo = case when p_patch ? 'clientLogo' then excluded.logo else client_records.logo end,
      contacts = case when p_patch ? 'contacts' then excluded.contacts else client_records.contacts end,
      social_logins = case when p_patch ? 'socialLogins' then excluded.social_logins else client_records.social_logins end,
      company_files = case when p_patch ? 'companyFiles' then excluded.company_files else client_records.company_files end,
      special_menus = case when p_patch ? 'specialMenus' then excluded.special_menus else client_records.special_menus end,
      photo_gallery_link = case when p_patch ? 'photoGalleryLink' then excluded.photo_gallery_link else client_records.photo_gallery_link end,
      business_type = case when p_patch ? 'businessType' then excluded.business_type else client_records.business_type end,
      account_manager = case when p_patch ? 'accountManager' then excluded.account_manager else client_records.account_manager end,
      deleted_company_file_ids = case
        when p_patch ? 'appendDeletedCompanyFileIds' then v_merged_deleted
        when p_patch ? 'deletedCompanyFileIds' then excluded.deleted_company_file_ids
        else client_records.deleted_company_file_ids
      end,
      updated_at = now();
end;
$$;

revoke all on function public.patch_brand_profile(text, text, jsonb) from public, anon;
grant execute on function public.patch_brand_profile(text, text, jsonb) to authenticated, service_role;
