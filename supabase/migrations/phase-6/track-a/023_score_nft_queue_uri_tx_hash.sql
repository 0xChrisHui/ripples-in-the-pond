-- Phase 6 A1 — score_nft_queue 加 uri_tx_hash 字段
--
-- 当前 stepSetTokenUri 用 waitForTransactionReceipt 在 cron 内等链上确认，
-- 违反 D2 拆步（每步 < 5 秒）+ 没有幂等恢复（崩溃重启会重发 setTokenURI tx）。
--
-- 新拆步：
--   无 uri_tx_hash → 发 setTokenURI tx → 立刻存 hash → 返回 setting_uri
--   有 uri_tx_hash → 查 receipt → success / 等下次

alter table score_nft_queue add column uri_tx_hash text;
