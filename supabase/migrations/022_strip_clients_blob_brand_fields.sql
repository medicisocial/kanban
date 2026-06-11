-- Stop dual-writing brand profile back into the clients workspace blob and
-- strip deprecated per-brand keys from existing workspace rows.

drop trigger if exists trg_sync_client_record_to_blob on public.client_records;

update public.clients
set data = jsonb_strip_nulls(
  jsonb_build_object(
    'names', coalesce(data->'names', '[]'::jsonb),
    'removedNames', coalesce(data->'removedNames', '{}'::jsonb),
    'restoredNames', coalesce(data->'restoredNames', '{}'::jsonb),
    'contentTypeColors', coalesce(data->'contentTypeColors', '{}'::jsonb),
    'customColorPalette', coalesce(data->'customColorPalette', '[]'::jsonb)
  )
)
where id = 'workspace';
