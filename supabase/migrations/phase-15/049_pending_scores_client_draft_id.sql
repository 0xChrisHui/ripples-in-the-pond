-- P15-C3：让本机草稿后台同步在重进页面、跨标签和网络重试时保持幂等。

alter table pending_scores
  add column if not exists client_draft_id text;

alter table pending_scores
  drop constraint if exists pending_scores_client_draft_id_format;

alter table pending_scores
  add constraint pending_scores_client_draft_id_format
  check (client_draft_id is null or client_draft_id ~ '^[A-Za-z0-9_-]{8,80}$');

create unique index if not exists pending_scores_user_client_draft_unique
  on pending_scores (user_id, client_draft_id)
  where client_draft_id is not null;

create or replace function save_score_atomic(
  p_user_id uuid,
  p_client_draft_id text,
  p_track_id uuid,
  p_events_data jsonb,
  p_created_at timestamptz,
  p_expires_at timestamptz
) returns table (score_id uuid, score_expires_at timestamptz)
language plpgsql as $$
declare
  v_id uuid;
  v_expires_at timestamptz;
begin
  if p_client_draft_id !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'INVALID_CLIENT_DRAFT_ID';
  end if;

  -- 同一用户同一曲目的并发写串行化；不会把重复请求刚写好的草稿标成 expired。
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_track_id::text, 0));

  select ps.id, ps.expires_at into v_id, v_expires_at
  from pending_scores ps
  where ps.user_id = p_user_id
    and ps.client_draft_id = p_client_draft_id
  limit 1;

  if v_id is not null then
    return query select v_id, v_expires_at;
    return;
  end if;

  update pending_scores
    set status = 'expired', updated_at = now()
    where user_id = p_user_id
      and track_id = p_track_id
      and status = 'draft';

  insert into pending_scores (
    user_id, client_draft_id, track_id, events_data, status,
    created_at, expires_at
  ) values (
    p_user_id, p_client_draft_id, p_track_id, p_events_data, 'draft',
    p_created_at, p_expires_at
  )
  returning id, expires_at into v_id, v_expires_at;

  return query select v_id, v_expires_at;
end;
$$;

