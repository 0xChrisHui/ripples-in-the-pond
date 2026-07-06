-- P10-B P1-4 + P1-5: airdrop_recipients 补 failure_kind + retry_count
-- review: reviews/2026-07-05-backend-review.md P1-4 / P1-5
--
-- P1-4：有 tx_hash 但 receipt 超时 / 卡死 → 转终局需要 failure_kind 标注（对齐
--       mint_queue / score_nft_queue 的 manual_review 语义）。
-- P1-5：airdrop 原本无 retry 上限，链上 revert 会无限 resetToPending → 加 retry_count
--       + MAX_RETRY(代码侧=3)，超限转 failed + failure_kind=manual_review。
--
-- 幂等：add column if not exists，可重复执行。

alter table airdrop_recipients
  add column if not exists failure_kind text,
  add column if not exists retry_count integer not null default 0;

comment on column airdrop_recipients.failure_kind is
  'P10-B P1-4：转 failed 时的失败类别（manual_review = 链上状态未知/需人工核查）。对齐 mint_queue.failure_kind。';
comment on column airdrop_recipients.retry_count is
  'P10-B P1-5：链上 revert 重试计数，超 MAX_RETRY 转 failed + manual_review。';
