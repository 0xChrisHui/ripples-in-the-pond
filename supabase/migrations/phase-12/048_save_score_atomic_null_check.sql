-- P12 C9 (SR-P1-1): save_score_atomic 异常回退空值防御
--
-- 背景：026 的 unique_violation 回退 SELECT 若查不到行（并发方事务回滚 /
-- 草稿恰好被标 expired），v_id 保持 NULL → 函数静默返回 (null, null) →
-- 调用方误以为保存成功但拿不到 id。改为显式 raise，让 API 层报 500 而非假成功。
--
-- 除新增 null 防御外，函数体与 026 完全一致（create or replace 幂等）。

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

    -- SR-P1-1：回退也查不到 = 状态窗口异常，宁可失败不假成功
    if v_id is null then
      raise exception 'SAVE_CONFLICT: draft vanished during unique_violation fallback (user=%, track=%)',
        p_user_id, p_track_id;
    end if;
  end;

  return query select v_id, v_expires_at;
end;
$$;
