-- Phase 1 新增表：tracks + mint_events
-- 在 Supabase Dashboard → SQL Editor 粘贴执行

-- ========== tracks ==========
-- 每首曲子的元数据，首页岛屿列表和播放都从这里读
create table tracks (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  week        integer not null unique,
  audio_url   text not null,
  cover       text not null default '#3b82f6',
  island      text not null default 'default',
  created_at  timestamptz not null default now()
);

-- 按 island 分组查询
create index idx_tracks_island on tracks (island);

-- ========== mint_events ==========
-- 铸造成功的永久记录，个人页"我的 NFT"从这里读
-- 与 mint_queue 的区别：queue 是临时任务，events 是永久资产记录
create table mint_events (
  id              uuid primary key default uuid_generate_v4(),
  mint_queue_id   uuid not null references mint_queue (id),
  user_id         uuid not null references users (id),
  track_id        uuid not null references tracks (id),
  token_id        integer not null,
  tx_hash         text not null,
  minted_at       timestamptz not null default now()
);

-- 查某用户的所有 NFT
create index idx_mint_events_user on mint_events (user_id);
-- 查某 track 的铸造记录
create index idx_mint_events_track on mint_events (track_id);
