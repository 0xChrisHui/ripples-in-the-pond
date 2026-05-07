-- Phase 6 A1 — claim_score_queue_job 重写（durable lease 版）
--
-- 替换 phase-3/hotfix/015 的旧实现。新实现：
-- 1. 入参 p_owner（uuid）+ p_lease_minutes（默认 5 分钟）
-- 2. 只 claim 没被锁住的 job（lease_expires_at IS NULL 或已过期）
-- 3. claim 时同时写入 locked_by + lease_expires_at
-- 4. 后续业务代码所有 update 必须 CAS 校验 owner + 未过期
--
-- FOR UPDATE SKIP LOCKED 仍保留（DB 行锁防同 SQL 事务并发）；
-- lease 是逻辑层的"长租"，跨多个 cron 调用共享所有权。

create or replace function claim_score_queue_job(
  p_owner uuid,
  p_lease_minutes int default 5
) returns setof score_nft_queue
language sql as $$
  update score_nft_queue set
    locked_by = p_owner,
    lease_expires_at = now() + (p_lease_minutes || ' minutes')::interval,
    updated_at = now()
  where id = (
    select id from score_nft_queue
    where status not in ('success', 'failed')
      and retry_count < 3
      and (lease_expires_at is null or lease_expires_at < now())
    order by created_at asc
    limit 1
    for update skip locked
  )
  returning *;
$$;
