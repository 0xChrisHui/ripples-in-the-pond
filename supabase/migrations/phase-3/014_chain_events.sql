-- Phase 3B: 链上事件记录表
-- 存储 ScoreNFT Transfer 事件，用于追踪 NFT 所有权变更
-- UNIQUE(tx_hash, log_index) 防止 cron 重复写入

create table chain_events (
  id          uuid primary key default gen_random_uuid(),
  contract    text not null,
  event_name  text not null,
  tx_hash     text not null,
  log_index   integer not null,
  block_number bigint not null,
  from_addr   text not null,
  to_addr     text not null,
  token_id    integer not null,
  raw_data    jsonb,
  created_at  timestamptz not null default now(),

  unique (tx_hash, log_index)
);

-- 按区块号查询（cron 每次从 last_synced_block 开始）
create index idx_chain_events_block on chain_events (block_number);

-- 按 token_id 查询（查某个 NFT 的转移历史）
create index idx_chain_events_token on chain_events (token_id);
