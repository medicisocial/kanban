-- Durable safeguard: card pipeline stage (data.columnId) cannot move backward
-- unless the write carries _allowPipelineRegression (explicit user action).
-- Mirrors app-level mergeCardPipelineFields; blocks stale tabs, direct upserts,
-- and any future code path that replays an older board status.

create or replace function public.card_pipeline_rank(p_column_id text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case coalesce(p_column_id, '')
    when 'shoot' then 0
    when 'editing' then 1
    when 'in-review' then 2
    when 'not-approved' then 3
    when 'approved' then 4
    when 'scheduled' then 5
    when 'finished' then 6
    else -1
  end;
$$;

create or replace function public.protect_card_pipeline()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  old_rank int;
  new_rank int;
  allow_regression boolean;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  allow_regression := coalesce((new.data->>'_allowPipelineRegression')::boolean, false);
  new.data := new.data - '_allowPipelineRegression';

  old_rank := public.card_pipeline_rank(old.data->>'columnId');
  new_rank := public.card_pipeline_rank(new.data->>'columnId');

  if old_rank >= 0
     and new_rank >= 0
     and new_rank < old_rank
     and not allow_regression then
    new.data := new.data || jsonb_build_object(
      'columnId', old.data->>'columnId',
      'status', coalesce(old.data->'status', new.data->'status')
    );
    if old.data ? 'postedAt' then
      new.data := new.data || jsonb_build_object('postedAt', old.data->'postedAt');
    end if;
    if old.data ? 'editorCompletedAt' then
      new.data := new.data || jsonb_build_object('editorCompletedAt', old.data->'editorCompletedAt');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_card_pipeline on public.cards;
create trigger trg_protect_card_pipeline
  before update on public.cards
  for each row
  execute function public.protect_card_pipeline();
