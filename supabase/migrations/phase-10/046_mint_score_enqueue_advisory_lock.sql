-- P10-B P3-10: mint_score_enqueue 限流竞态修复
-- review: reviews/2026-07-05-backend-review.md P3-10
--
-- 背景：限流用 count-then-insert（先 count 过去 1h、再 insert），两个并发调用可能都
-- 数到 4 都通过校验都 insert → 突破 5 次/时上限。修法：入口对同一用户加事务级
-- advisory lock，串行化同用户的入队，count 与 insert 之间不再有并发窗口。
--
-- create or replace 是幂等的；函数体与 029 完全一致，仅在 begin 后加一行 advisory lock。

create or replace function mint_score_enqueue(
  p_user_id uuid,
  p_pending_score_id uuid
)
returns table (
  queue_id uuid,
  cover_ar_tx_id text
)
language plpgsql
as $$
declare
  v_rate_count integer;
  v_track_id uuid;
  v_draft_status text;
  v_draft_user_id uuid;
  v_already_enqueued boolean;
  v_cover_id uuid;
  v_cover_ar_tx_id text;
  v_queue_id uuid;
begin
  -- 0. P3-10：同一用户串行化，消除下面 count-then-insert 的竞态（并发绕过 5/时上限）。
  --    事务级锁，函数返回（事务结束）自动释放。
  perform pg_advisory_xact_lock(hashtext('mint_score_enqueue'), hashtext(p_user_id::text));

  -- 1. 限流：过去 1 小时同一用户 ≤ 5 条
  select count(*) into v_rate_count
  from score_nft_queue
  where user_id = p_user_id
    and created_at > now() - interval '1 hour';

  if v_rate_count >= 5 then
    raise exception 'RATE_LIMITED: max 5 score mints per hour (current=%)', v_rate_count;
  end if;

  -- 2. 验证 pending_score 存在 + 是 draft + 属于用户
  select track_id, status, user_id
  into v_track_id, v_draft_status, v_draft_user_id
  from pending_scores
  where id = p_pending_score_id;

  if v_track_id is null then
    raise exception 'INVALID_SCORE: pending_score not found (id=%)', p_pending_score_id;
  end if;

  if v_draft_user_id != p_user_id then
    raise exception 'INVALID_SCORE: pending_score does not belong to user';
  end if;

  if v_draft_status != 'draft' then
    raise exception 'INVALID_SCORE: pending_score status=% (expected draft)', v_draft_status;
  end if;

  -- 2.5. 防重铸（查 queue 里有没有这条）
  select exists (
    select 1 from score_nft_queue
    where pending_score_id = p_pending_score_id
  ) into v_already_enqueued;

  if v_already_enqueued then
    raise exception 'INVALID_SCORE: pending_score already enqueued (id=%)', p_pending_score_id;
  end if;

  -- 3. 分配封面：最少使用优先 + SKIP LOCKED（复用池语义）
  select id, ar_tx_id
  into v_cover_id, v_cover_ar_tx_id
  from score_covers
  order by usage_count asc, created_at asc
  limit 1
  for update skip locked;

  if v_cover_id is null then
    raise exception 'COVER_POOL_EMPTY: no available cover (check score_covers table)';
  end if;

  -- 4. 封面 usage_count + 1
  update score_covers
  set usage_count = usage_count + 1
  where id = v_cover_id;

  -- 5. 写 score_nft_queue
  insert into score_nft_queue (
    user_id,
    pending_score_id,
    track_id,
    cover_ar_tx_id,
    status
  )
  values (
    p_user_id,
    p_pending_score_id,
    v_track_id,
    v_cover_ar_tx_id,
    'pending'
  )
  returning id into v_queue_id;

  -- 6. 保留 pending_scores.status='draft'（029 起不再标 expired）

  -- 7. 返回
  return query select v_queue_id, v_cover_ar_tx_id;
end;
$$;
