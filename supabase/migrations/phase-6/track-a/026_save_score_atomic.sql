-- Phase 6 A4 — 草稿保存原子化 RPC
--
-- POST /api/score/save 当前是"先 update 标 expired，再 insert"两步非事务。
-- insert 失败 = 用户丢旧草稿（旧的已被标 expired，新的没插入）。
--
-- save_score_atomic：plpgsql 函数体天然事务，update + insert 一起 commit/rollback。
-- unique violation 走 EXCEPTION 回退查现有 draft 返回（并发并保持调用方语义）。

create or replace function save_score_atomic(
  p_user_id uuid,
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
  -- 旧 draft 标 expired
  update pending_scores
    set status = 'expired', updated_at = now()
    where user_id = p_user_id
      and track_id = p_track_id
      and status = 'draft';

  -- 插入新 draft，并发 unique violation 时回退查现有
  begin
    insert into pending_scores (
      user_id, track_id, events_data, status,
      created_at, expires_at
    )
    values (
      p_user_id, p_track_id, p_events_data, 'draft',
      p_created_at, p_expires_at
    )
    returning id, expires_at into v_id, v_expires_at;
  exception when unique_violation then
    select id, expires_at into v_id, v_expires_at
    from pending_scores
    where user_id = p_user_id
      and track_id = p_track_id
      and status = 'draft'
    limit 1;
  end;

  return query select v_id, v_expires_at;
end;
$$;
