-- A write that omits sourceIdeaId must not sever the card→bank-idea link.
-- Losing the link makes the approved idea reappear in the idea bank even
-- though its card is mid-pipeline (the "cards came back to the bank" bug).

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

  -- Preserve the idea link on every update, regression or not.
  if coalesce(new.data->>'sourceIdeaId', '') = ''
     and coalesce(old.data->>'sourceIdeaId', '') <> '' then
    new.data := new.data || jsonb_build_object('sourceIdeaId', old.data->'sourceIdeaId');
  end if;

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
