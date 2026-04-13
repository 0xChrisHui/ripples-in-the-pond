-- Phase 4 S0：JWT 黑名单表
-- 用于撤销已签发的 JWT（logout 时写入 jti）
-- 过期记录可定期清理（expires_at < now()）

create table jwt_blacklist (
  jti        text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- 按过期时间索引，方便定期清理
create index idx_jwt_blacklist_expires on jwt_blacklist (expires_at);
