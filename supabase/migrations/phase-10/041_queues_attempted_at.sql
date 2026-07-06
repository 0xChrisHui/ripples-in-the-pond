-- P10-B P1-3: 广播歧义防双铸 — mint_queue / airdrop_recipients 加 mint_attempted_at
-- review: reviews/2026-07-05-backend-review.md P1-3
--
-- 背景：老队列在 writeContract 抛异常时一律 resetToPending → 重发。但 RPC 超时
-- 时 tx 可能已进 mempool，重发 = 双铸/双空投。对齐 score_nft_queue(032) 已验证
-- 的时间窗方案：发 tx 前盖 mint_attempted_at 戳，捕获异常不 reset，留在
-- minting(_onchain) + tx_hash=NULL，由 confirm 路径按时间窗判定 manual_review。
--
-- 幂等：add column if not exists，可重复执行。

alter table mint_queue
  add column if not exists mint_attempted_at timestamptz;

alter table airdrop_recipients
  add column if not exists mint_attempted_at timestamptz;

comment on column mint_queue.mint_attempted_at is
  'P10-B P1-3 双发防御：trySendNew 发 mint tx 前盖戳；窗口内 tx_hash 仍 NULL → 不重发，超窗 → manual_review。对齐 score_nft_queue.mint_attempted_at。';
comment on column airdrop_recipients.mint_attempted_at is
  'P10-B P1-3 双发防御：trySendNew 发 airdrop tx 前盖戳；语义同 mint_queue.mint_attempted_at。';
