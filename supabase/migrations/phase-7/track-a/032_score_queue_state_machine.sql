-- Phase 7 Track A · A3+A12 — score_nft_queue 状态机修复包
--
-- 改动：
--   1. 加两列 attempted_at 时间戳（A3 双 mint 防御）
--      mint_attempted_at：steps-mint.ts 发 tx 前盖戳；10min 内 tx_hash 仍 NULL → 不重发
--      uri_attempted_at ：steps-set-uri.ts 发 tx 前盖戳；同款窗口
--      两列分开避免 mint/setURI 共用一列导致"一列两义"
--   2. 加 token_id partial unique index（P2-11，B8 P3 review 发现的悬空 TODO）
--
-- 前置：执行前必须确认 token_id 无重复，否则建索引会失败：
--   select token_id, count(*) from score_nft_queue
--   where token_id is not null group by token_id having count(*) > 1;
--   -- 应返回 0 行。如有重复行，先按 created_at 选最新一行保留，其余 DELETE 或挪到归档表。

alter table score_nft_queue
  add column if not exists mint_attempted_at timestamptz,
  add column if not exists uri_attempted_at  timestamptz;

comment on column score_nft_queue.mint_attempted_at is
  'A3 双 mint 防御：writeContract 前盖的时间戳。窗口（10 分钟）内 tx_hash 仍 NULL → 不重发，等下次 cron；窗口外仍 NULL → manual_review。';

comment on column score_nft_queue.uri_attempted_at is
  'A3 双发防御：setTokenURI 前盖戳。同 mint_attempted_at 语义，对应 uri_tx_hash。';

create unique index if not exists uq_score_queue_token_id
  on score_nft_queue (token_id)
  where token_id is not null;
