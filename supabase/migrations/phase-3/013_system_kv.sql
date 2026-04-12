-- Phase 3B: 系统键值对表
-- 存储 last_synced_block 等全局状态，保证链上事件同步的幂等性

create table system_kv (
  key   text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- 初始值：从 ScoreNFT 部署前的区块开始同步
-- ScoreNFT 部署 + tokenId 1 mint 在 42050000 附近，S5 mint tokenId 2 在 42059952
insert into system_kv (key, value)
values ('last_synced_block', '42050000');
