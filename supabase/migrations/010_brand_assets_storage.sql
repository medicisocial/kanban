-- Store brand asset / menu PDFs in Supabase Storage instead of base64 inside the
-- clients workspace JSON. Base64 in a single JSON row hit hosting body limits
-- (~4.5 MB) so multi-page or multiple menu PDFs failed to save.
--
-- Files live at: {orgId}/{brand}/{folder}/{uuid}.{ext}
-- The bucket is public (menus are shared with clients; paths use random UUIDs).

insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do update set public = excluded.public;

-- Public read (also served via CDN for the public bucket).
drop policy if exists "brand_assets_read" on storage.objects;
create policy "brand_assets_read" on storage.objects
  for select to public
  using (bucket_id = 'brand-assets');

-- Staff (authenticated) may write only within their own organization's prefix.
drop policy if exists "brand_assets_insert" on storage.objects;
create policy "brand_assets_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] in (select public.user_org_ids())
  );

drop policy if exists "brand_assets_update" on storage.objects;
create policy "brand_assets_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] in (select public.user_org_ids())
  )
  with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] in (select public.user_org_ids())
  );

drop policy if exists "brand_assets_delete" on storage.objects;
create policy "brand_assets_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] in (select public.user_org_ids())
  );
