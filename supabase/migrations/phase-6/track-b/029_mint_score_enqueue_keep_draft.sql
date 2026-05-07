-- Phase 6 B2 P1 — 改 mint_score_enqueue：入队后**不再**把 pending_score 标 expired
--
-- 背景：
--   原 010_mint_score_rpc.sql 在入队的最后一步执行
--     update pending_scores set status = 'expired'
--   动机是"语义上草稿已被消费"。但 score_nft_queue.uq_score_queue_pending_score
--   唯一索引已经能防重铸，标 expired 这步是冗余防御。
--
--   副作用：UI 看"我的创作（含铸造中）"时，因为 GET /api/me/scores 过滤
--   status='draft'，已铸造的草稿在入队瞬间就从返回里消失，导致前端：
--     1. 离开 /me 重进 → "铸造中"卡片消失
--     2. Ctrl+F5 → 同上
--     3. polling 失效（草稿都不在 drafts 数组里，hasMintingInFlight=false）
--
-- 本 migration 的改动：
--   1. 删掉"update pending_scores set status='expired'"那一步
--   2. 新增"queue 里已存在该 pending_score → 抛 INVALID_SCORE"的兜底
--      （替代原靠"v_draft_status != 'draft'"间接拦截已铸造的逻辑）
--
-- 兼容性：
--   - 'expired' 状态在另外两处仍在用（006 + 026 save_score_atomic 的"被新草稿覆盖"），
--     与本改动正交，不影响。
--   - 已经在 queue 里的历史 row 不需要回填——RPC 用 unique 索引兜底，
--     status 字段不影响 queue 推进。

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

  -- 2.5. 新增：防重铸（替代原"入队即标 expired"的兜底）
  --      因为新设计下入队不再改 status，需要显式查 queue 里有没有这条
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

  -- 6. （删除！）原来的 update pending_scores set status='expired'
  --    新设计下保留 status='draft'，让 GET /api/me/scores 联表 queue
  --    就能恢复"铸造中"的草稿显示。

  -- 7. 返回
  return query select v_queue_id, v_cover_ar_tx_id;
end;
$$;
