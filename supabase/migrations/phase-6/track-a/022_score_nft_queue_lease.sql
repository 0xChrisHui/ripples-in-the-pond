-- Phase 6 A1 — score_nft_queue durable lease 字段
--
-- claim 时写 locked_by + lease_expires_at；
-- 所有状态推进必须 CAS 校验"我还是 owner 且 lease 没过期"，否则放弃写入；
-- 终态（success / failed）清空 lease。
--
-- 防 stale worker 在 lease 过期后还在写：避免覆盖已被新 worker 推进的状态。

alter table score_nft_queue
  add column locked_by uuid,
  add column lease_expires_at timestamptz;

-- 部分索引：查询"哪些 job 的 lease 过期了"
create index idx_score_nft_queue_lease on score_nft_queue (lease_expires_at)
  where lease_expires_at is not null;
