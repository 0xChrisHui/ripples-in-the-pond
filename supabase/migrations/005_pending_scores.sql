-- Phase 2 新增表：pending_scores（合奏草稿）
-- 在 Supabase Dashboard → SQL Editor 粘贴执行

create table pending_scores (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users (id),
  track_id    uuid not null references tracks (id),
  events_data jsonb not null,
  status      text not null default 'draft' check (status in ('draft', 'expired')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- 查某用户的未过期草稿
create index idx_pending_scores_user_status on pending_scores (user_id, status);
-- 按过期时间清理
create index idx_pending_scores_expires on pending_scores (expires_at);
