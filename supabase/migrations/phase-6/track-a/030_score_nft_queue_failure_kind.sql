-- Phase 6 P1-8 修复（2026-05-08 strict CTO review）— score_nft_queue 失败分类
--
-- 与 mint_queue (021) 对称：catch 路径必须给 failure_kind 默认值，否则 score_nft_queue
-- 失败行 failure_kind 永远是 NULL，运维只能手工 SQL 判断 last_error 文本。
--
-- safe_retry  = 普通 retry 耗尽 → API 可自动 reset 重试
-- manual_review = CRITICAL 错误（chain 已发但 DB 失败 / 状态未知）→ ops 必须人工介入
-- 历史 failed 行 (NULL failure_kind) 视同 manual_review（保守策略）。

alter table score_nft_queue
  add column failure_kind text check (failure_kind in ('safe_retry', 'manual_review'));

create index idx_score_nft_queue_failure_kind on score_nft_queue (failure_kind)
  where failure_kind is not null;
