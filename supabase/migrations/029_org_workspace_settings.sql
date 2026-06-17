-- Org-level workspace settings (replaces slim clients blob in cloud mode).

create table if not exists public.org_workspace_settings (
  org_id text primary key references public.organizations (id) on delete cascade,
  removed_names jsonb not null default '{}'::jsonb,
  restored_names jsonb not null default '{}'::jsonb,
  content_type_colors jsonb not null default '{}'::jsonb,
  custom_color_palette jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Backfill from legacy clients workspace blob.
insert into public.org_workspace_settings (
  org_id,
  removed_names,
  restored_names,
  content_type_colors,
  custom_color_palette,
  updated_at
)
select
  c.org_id,
  coalesce(c.data->'removedNames', '{}'::jsonb),
  coalesce(c.data->'restoredNames', '{}'::jsonb),
  coalesce(c.data->'contentTypeColors', '{}'::jsonb),
  coalesce(c.data->'customColorPalette', '[]'::jsonb),
  c.updated_at
from public.clients c
where c.id = 'workspace'
on conflict (org_id) do update
  set
    removed_names = excluded.removed_names,
    restored_names = excluded.restored_names,
    content_type_colors = excluded.content_type_colors,
    custom_color_palette = excluded.custom_color_palette,
    updated_at = excluded.updated_at;

alter table public.org_workspace_settings enable row level security;

drop policy if exists org_workspace_settings_tenant on public.org_workspace_settings;
create policy org_workspace_settings_tenant on public.org_workspace_settings
  for all to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

drop policy if exists org_workspace_settings_anon_legacy_read on public.org_workspace_settings;
create policy org_workspace_settings_anon_legacy_read on public.org_workspace_settings
  for select to anon
  using (org_id = 'medici');

do $$
begin
  alter publication supabase_realtime add table public.org_workspace_settings;
exception when duplicate_object then null;
end $$;
