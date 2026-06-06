-- Return one brand's portal profile without downloading the full clients workspace row
-- (logos for all brands can exceed 1 MB and slow or break /api/client-portal).

create or replace function public.resolve_client_brand_key(p_names jsonb, p_brand text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select value
      from jsonb_array_elements_text(coalesce(p_names, '[]'::jsonb)) as value
      where lower(trim(value)) = lower(trim(p_brand))
      limit 1
    ),
    nullif(trim(p_brand), '')
  );
$$;

create or replace function public.get_portal_brand_profile(p_org_id text, p_brand text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'brandKey',
    public.resolve_client_brand_key(c.data->'names', p_brand),
    'clientColor',
    c.data->'colors'->>public.resolve_client_brand_key(c.data->'names', p_brand),
    'clientLogo',
    c.data->'logos'->public.resolve_client_brand_key(c.data->'names', p_brand),
    'businessType',
    c.data->'businessTypes'->>public.resolve_client_brand_key(c.data->'names', p_brand),
    'photoGalleryLink',
    nullif(trim(c.data->'photoGalleryLinks'->>public.resolve_client_brand_key(c.data->'names', p_brand)), ''),
    'contacts',
    coalesce(c.data->'contacts'->public.resolve_client_brand_key(c.data->'names', p_brand), '[]'::jsonb),
    'socialLogins',
    coalesce(c.data->'socialLogins'->public.resolve_client_brand_key(c.data->'names', p_brand), '{}'::jsonb),
    'companyFiles',
    coalesce(c.data->'companyFiles'->public.resolve_client_brand_key(c.data->'names', p_brand), '[]'::jsonb),
    'specialMenus',
    coalesce(c.data->'specialMenus'->public.resolve_client_brand_key(c.data->'names', p_brand), '[]'::jsonb),
    'contentTypeColors',
    coalesce(c.data->'contentTypeColors', '{}'::jsonb)
  )
  from public.clients c
  where c.id = 'workspace' and c.org_id = p_org_id;
$$;

revoke all on function public.resolve_client_brand_key(jsonb, text) from public;
revoke all on function public.get_portal_brand_profile(text, text) from public;
grant execute on function public.get_portal_brand_profile(text, text) to service_role;
