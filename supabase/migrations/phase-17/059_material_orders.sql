-- P17生产迁移候选；最高已执行版本058，源SQL已通过本机真实事务/并发/RLS验证。
-- 原曲订单草案；总控分配056后执行，当前不连接或写入任何数据库。
create table if not exists public.material_issuance_policy (
  singleton boolean primary key default true check (singleton),
  status text not null default 'pending' check (status in ('pending','approved')),
  approval_reference text,
  policy jsonb,
  check (status <> 'approved' or (approval_reference is not null and policy is not null))
);
insert into public.material_issuance_policy(singleton) values(true) on conflict do nothing;

create table if not exists public.material_mint_orders (
  order_id text primary key check (order_id ~ '^0x[0-9a-f]{64}$'),
  user_id uuid not null references public.users(id),
  request_key text not null check (length(request_key) between 1 and 128),
  track_id uuid not null references public.tracks(id),
  chain_id bigint not null check (chain_id in (1,11155111)),
  contract_address text not null check (contract_address ~ '^0x[0-9a-f]{40}$' and contract_address <> '0x0000000000000000000000000000000000000000'),
  token_id text not null check (token_id ~ '^[1-9][0-9]*$' and token_id::numeric < power(2::numeric,256)),
  recipient_address text not null check (recipient_address ~ '^0x[0-9a-f]{40}$' and recipient_address <> '0x0000000000000000000000000000000000000000'),
  amount integer not null default 1 check (amount=1),
  catalog_revision text not null check (catalog_revision ~ '^[0-9a-f]{64}$'),
  metadata_uri text not null check (metadata_uri ~ '^ar://[a-zA-Z0-9_-]{43}$'),
  uri_hash text not null check (uri_hash ~ '^0x[0-9a-f]{64}$'),
  status text not null default 'prepared' check (status in
    ('prepared','authorized','sending','unknown','submitted','confirming','success','reverted','cancelled')),
  version integer not null default 0,
  current_digest text,
  tx_hash text check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  confirmed_block text,
  confirmed_block_hash text,
  confirmed_log_index integer,
  confirmed_at timestamptz,
  error_kind text,
  lease_owner text,
  lease_until timestamptz,
  scan_cursor numeric(78,0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, request_key)
);
-- 在途/unknown互斥保留；2026-10-03获批后增加包括成功历史的钱包每曲一次。
create unique index if not exists material_active_coordinate on public.material_mint_orders
  (chain_id,contract_address,recipient_address,token_id)
  where status not in ('success','reverted','cancelled');
create unique index if not exists material_wallet_token_once on public.material_mint_orders
  (chain_id,contract_address,recipient_address,token_id)
  where status not in ('reverted','cancelled');
create table if not exists public.material_mint_attempts (
  digest text primary key check (digest ~ '^0x[0-9a-f]{64}$'),
  order_id text not null references public.material_mint_orders(order_id),
  deadline bigint not null,
  authorizer text not null check (authorizer ~ '^0x[0-9a-f]{40}$'),
  send_attempted_at timestamptz,
  outcome text check (outcome in ('rejected','unknown','submitted')),
  tx_hashes text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.material_mint_orders enable row level security;
alter table public.material_mint_attempts enable row level security;
alter table public.material_issuance_policy enable row level security;
revoke all on public.material_mint_orders, public.material_mint_attempts, public.material_issuance_policy from public, anon, authenticated;
grant select on public.material_mint_orders, public.material_mint_attempts, public.material_issuance_policy to service_role;
