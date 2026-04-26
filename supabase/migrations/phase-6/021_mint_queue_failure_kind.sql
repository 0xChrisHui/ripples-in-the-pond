-- Phase 6 A2 — mint_queue 失败分类
--
-- safe_retry  = tx 未上链 / 链上 revert / retry 耗尽 → API 可自动 reset 重试
-- manual_review = 链上可能已发但 DB 未落 / stuck / 数据缺失 → ops 必须人工介入
--
-- API (POST /api/mint/material) 只允许 safe_retry 自动重试，manual_review 返 409 needsReview。
-- 历史 failed 行 (NULL failure_kind) 视同 manual_review（保守策略）。

alter table mint_queue
  add column failure_kind text check (failure_kind in ('safe_retry', 'manual_review'));

-- 部分索引，只索引 failed 行，节省空间
create index idx_mint_queue_failure_kind on mint_queue (failure_kind)
  where failure_kind is not null;
