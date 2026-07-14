-- Manual monthly package / contract amount per client.

alter table public.client_records
  add column if not exists monthly_package_amount numeric(10,2) not null default 0;

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
  v_carousel integer;
  v_static integer;
  v_feed numeric(6,1);
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

  v_carousel := coalesce((p_patch->>'carouselTarget')::integer, 0);
  v_static := coalesce((p_patch->>'staticTarget')::integer, 0);
  if p_patch ? 'carouselTarget' or p_patch ? 'staticTarget' then
    v_feed := (greatest(0, v_carousel)::numeric + greatest(0, v_static)::numeric * 0.5);
  elsif p_patch ? 'carouselStaticTarget' then
    v_feed := coalesce((p_patch->>'carouselStaticTarget')::numeric, 0);
  else
    v_feed := 0;
  end if;

  insert into public.client_records (
    org_id, brand_key, display_name,
    client_color, logo, contacts, social_logins, company_files, special_menus,
    photo_gallery_link, business_type, account_manager, videographer, photographer,
    deliverable_target, reel_points_target, carousel_static_target,
    carousel_target, static_target,
    plan_id, shoot_days_per_month, shoot_hours_per_day, monthly_package_amount,
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
    coalesce(p_patch->>'videographer', ''),
    coalesce(p_patch->>'photographer', ''),
    coalesce((p_patch->>'deliverableTarget')::integer, 0),
    coalesce((p_patch->>'reelPointsTarget')::numeric, 0),
    v_feed,
    greatest(0, v_carousel),
    greatest(0, v_static),
    coalesce(nullif(trim(p_patch->>'planId'), ''), 'custom'),
    coalesce((p_patch->>'shootDaysPerMonth')::integer, 0),
    coalesce((p_patch->>'shootHoursPerDay')::numeric, 0),
    coalesce((p_patch->>'monthlyPackageAmount')::numeric, 0),
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
      videographer = case when p_patch ? 'videographer' then excluded.videographer else client_records.videographer end,
      photographer = case when p_patch ? 'photographer' then excluded.photographer else client_records.photographer end,
      deliverable_target = case when p_patch ? 'deliverableTarget' then excluded.deliverable_target else client_records.deliverable_target end,
      reel_points_target = case when p_patch ? 'reelPointsTarget' then excluded.reel_points_target else client_records.reel_points_target end,
      carousel_target = case when p_patch ? 'carouselTarget' then excluded.carousel_target else client_records.carousel_target end,
      static_target = case when p_patch ? 'staticTarget' then excluded.static_target else client_records.static_target end,
      carousel_static_target = case
        when p_patch ? 'carouselTarget' or p_patch ? 'staticTarget' then
          (greatest(0, case when p_patch ? 'carouselTarget' then excluded.carousel_target else client_records.carousel_target end)::numeric
           + greatest(0, case when p_patch ? 'staticTarget' then excluded.static_target else client_records.static_target end)::numeric * 0.5)
        when p_patch ? 'carouselStaticTarget' then excluded.carousel_static_target
        else client_records.carousel_static_target
      end,
      plan_id = case when p_patch ? 'planId' then excluded.plan_id else client_records.plan_id end,
      shoot_days_per_month = case when p_patch ? 'shootDaysPerMonth' then excluded.shoot_days_per_month else client_records.shoot_days_per_month end,
      shoot_hours_per_day = case when p_patch ? 'shootHoursPerDay' then excluded.shoot_hours_per_day else client_records.shoot_hours_per_day end,
      monthly_package_amount = case when p_patch ? 'monthlyPackageAmount' then excluded.monthly_package_amount else client_records.monthly_package_amount end,
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

create or replace function public.get_brand_profile(p_org_id text, p_brand_key text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'brandKey',    b.brand_key,
    'brandId',     b.id::text,
    'displayName', b.display_name,
    'clientColor', nullif(trim(cr.client_color), ''),
    'clientLogo',  cr.logo,
    'contacts',    coalesce(cr.contacts, '[]'::jsonb),
    'socialLogins', coalesce(cr.social_logins, '{}'::jsonb),
    'companyFiles', coalesce(cr.company_files, '[]'::jsonb),
    'specialMenus', coalesce(cr.special_menus, '[]'::jsonb),
    'photoGalleryLink', nullif(trim(cr.photo_gallery_link), ''),
    'businessType', cr.business_type,
    'accountManager', cr.account_manager,
    'videographer', coalesce(cr.videographer, ''),
    'photographer', coalesce(cr.photographer, ''),
    'deliverableTarget', coalesce(cr.deliverable_target, 0),
    'reelPointsTarget', coalesce(cr.reel_points_target, 0),
    'carouselStaticTarget', coalesce(cr.carousel_static_target, 0),
    'carouselTarget', coalesce(cr.carousel_target, 0),
    'staticTarget', coalesce(cr.static_target, 0),
    'planId', coalesce(nullif(trim(cr.plan_id), ''), 'custom'),
    'shootDaysPerMonth', coalesce(cr.shoot_days_per_month, 0),
    'shootHoursPerDay', coalesce(cr.shoot_hours_per_day, 0),
    'monthlyPackageAmount', coalesce(cr.monthly_package_amount, 0)
  )
  from public.brands b
  left join public.client_records cr
    on cr.org_id = b.org_id and cr.brand_key = b.brand_key
  where b.org_id = p_org_id
    and b.brand_key = lower(trim(p_brand_key));
$$;

revoke all on function public.get_brand_profile(text, text) from public;
grant execute on function public.get_brand_profile(text, text) to service_role, authenticated, anon;
