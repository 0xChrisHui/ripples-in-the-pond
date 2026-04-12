-- Phase 3 S6 fix: mint_queue_id 改为可空
-- 原因：Phase 1 mint_events 是为 MaterialNFT 设计的，mint_queue_id NOT NULL。
-- ScoreNFT 通过 score_nft_queue 铸造，没有 mint_queue_id，
-- 导致 S5 cron 的 insert 被 Postgres 拒绝（NOT NULL violation）。
-- 区分两种 NFT 用 score_queue_id IS NOT NULL（已有索引 011）。

alter table mint_events
  alter column mint_queue_id drop not null;
