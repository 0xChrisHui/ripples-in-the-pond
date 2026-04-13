-- Phase 4 S1：多源身份表
-- 一个 user 可以有多个登录源（privy / semi），通过 auth_identities 关联

create table auth_identities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id),
  provider         text not null,   -- 'privy' | 'semi'
  provider_user_id text not null,
  created_at       timestamptz not null default now(),
  unique (provider, provider_user_id)
);

-- 迁移现有 Privy 用户：把 users.privy_user_id 写入 auth_identities
insert into auth_identities (user_id, provider, provider_user_id)
select id, 'privy', privy_user_id
from users
where privy_user_id is not null;
