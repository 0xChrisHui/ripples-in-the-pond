-- P10-B P2-7: sounds 表补建表 migration
-- review: reviews/2026-07-05-backend-review.md P2-7
--
-- 背景：sounds 表在生产已存在但从无 create migration（schema 漂移）。本 migration
-- 从代码模型（src/types/jam.ts Sound + GET /api/sounds 的 select）反推 schema，
-- 用 `create table if not exists` 对现库幂等（生产已有 → 完全 no-op），仅为新环境/
-- 本地复现提供可用表。⚠ 未必与生产 byte 级一致，真实 schema 以生产 pg_dump 为准。
--
-- 同时补 enable RLS：migration 040 遍历时若 sounds 尚不存在会跳过，新环境下 044 建表后
-- 需自行开 RLS 才不漏网（生产已由 040 开过 → 此处幂等 no-op）。

create table if not exists sounds (
  id            uuid primary key default gen_random_uuid(),
  token_id      integer not null unique,   -- tokenId 109-134
  name          text not null,             -- "Kick" / "Snare" / "Bell" ...
  audio_url     text not null,             -- 本地路径或 Arweave URL
  duration_ms   integer not null,
  category      text not null check (category in ('percussion', 'melody', 'effect')),
  key           text not null,             -- 对应键盘键 a-z
  created_at    timestamptz not null default now()
);

alter table sounds enable row level security;
