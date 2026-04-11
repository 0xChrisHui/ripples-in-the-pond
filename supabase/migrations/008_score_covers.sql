-- Phase 3 S1：score_covers 表
-- 存储 100 张测试封面的 Arweave txid + 使用计数。S5 cron 分配封面时用
-- FOR UPDATE SKIP LOCKED + ORDER BY usage_count ASC 实现"最少使用优先复用"。
-- 在 Supabase Dashboard → SQL Editor 粘贴执行

create table if not exists score_covers (
  id          uuid primary key default uuid_generate_v4(),
  ar_tx_id    text not null unique,
  usage_count integer not null default 0,
  created_at  timestamptz not null default now()
);

-- S5 分配 RPC 的核心索引：让 ORDER BY usage_count ASC 走索引 + SKIP LOCKED 不全表扫
create index if not exists idx_score_covers_usage
  on score_covers (usage_count, created_at);
