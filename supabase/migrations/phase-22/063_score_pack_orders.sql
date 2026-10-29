-- P22-C：Score 资产包（ERC-6551 TBA）订单与勾选意图。
-- 链上 opened(scoreTokenId) 是唯一真值，本表只记进度与对账线索。

create table public.score_pack_intents (
  pending_score_id uuid primary key references public.pending_scores(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.score_pack_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  chain_id bigint not null check (chain_id in (1, 10, 11155111, 11155420)),
  score_contract text not null check (score_contract ~ '^0x[0-9a-f]{40}$'),
  token_id bigint not null check (token_id > 0),
  holder_address text not null check (holder_address ~ '^0x[0-9a-f]{40}$'),
  mode text not null check (mode in ('op_sponsored', 'eth_self_paid')),
  status text not null default 'queued' check (status in (
    'queued', 'awaiting_wallet', 'unsent', 'submitted_unknown', 'confirming',
    'opened', 'reverted', 'abandoned')),
  track_token_id numeric(78, 0),
  sound_ids text[],
  voucher_digest text check (voucher_digest is null or voucher_digest ~ '^0x[0-9a-f]{64}$'),
  voucher_deadline bigint,
  signer_address text,
  tx_hash text check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  block_number bigint,
  account_address text,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  failure_code text,
  last_error text check (last_error is null or length(last_error) <= 2000),
  locked_by text,
  lease_expires_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint score_pack_mode_matches_chain check (
    (mode = 'op_sponsored' and chain_id in (10, 11155420))
    or (mode = 'eth_self_paid' and chain_id in (1, 11155111)))
);

-- 同一枚 Score 同时只有一个进行中订单
create unique index score_pack_one_active
  on public.score_pack_orders (chain_id, score_contract, token_id)
  where status in ('queued', 'awaiting_wallet', 'unsent', 'submitted_unknown', 'confirming');
create index score_pack_orders_status_idx on public.score_pack_orders (status, next_attempt_at);
create index score_pack_orders_user_day_idx on public.score_pack_orders (user_id, created_at);

alter table public.score_pack_intents enable row level security;
alter table public.score_pack_orders enable row level security;

-- 原子预占：唯一订单 + OP 每日额度（UTC 自然日，失败订单同样计数）。
create or replace function public.reserve_score_pack_order(
  p_user_id uuid, p_chain_id bigint, p_contract text, p_token_id bigint,
  p_holder text, p_mode text, p_global_limit integer, p_user_limit integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_existing public.score_pack_orders;
  v_day timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_row public.score_pack_orders;
begin
  if p_contract !~ '^0x[0-9a-f]{40}$' or p_holder !~ '^0x[0-9a-f]{40}$'
    or p_mode not in ('op_sponsored', 'eth_self_paid') then raise exception 'INVALID_PACK_ORDER'; end if;
  perform pg_advisory_xact_lock(hashtextextended('score-pack:' || p_chain_id || ':' || p_contract || ':' || p_token_id, 0));

  select * into v_existing from public.score_pack_orders
    where chain_id = p_chain_id and score_contract = p_contract and token_id = p_token_id
      and status in ('queued', 'awaiting_wallet', 'unsent', 'submitted_unknown', 'confirming');
  if found then
    if v_existing.holder_address = p_holder and v_existing.user_id = p_user_id then
      return to_jsonb(v_existing);
    end if;
    -- 旧持有人未发送的订单不得阻塞新持有人；已广播的交易先按链上结果收口
    if v_existing.status in ('queued', 'awaiting_wallet', 'unsent') then
      update public.score_pack_orders set status = 'abandoned', failure_code = 'HOLDER_CHANGED',
        locked_by = null, lease_expires_at = null, updated_at = now() where id = v_existing.id;
    else
      raise exception 'ACTIVE_ORDER_EXISTS';
    end if;
  end if;

  if p_mode = 'op_sponsored' then
    if (select count(*) from public.score_pack_orders where mode = 'op_sponsored' and created_at >= v_day) >= p_global_limit
      then raise exception 'GLOBAL_LIMIT'; end if;
    if (select count(*) from public.score_pack_orders where mode = 'op_sponsored'
        and user_id = p_user_id and created_at >= v_day) >= p_user_limit
      then raise exception 'USER_LIMIT'; end if;
  end if;

  insert into public.score_pack_orders (user_id, chain_id, score_contract, token_id, holder_address, mode, status)
    values (p_user_id, p_chain_id, p_contract, p_token_id, p_holder, p_mode,
      case when p_mode = 'op_sponsored' then 'queued' else 'awaiting_wallet' end)
    returning * into v_row;
  return to_jsonb(v_row);
end $$;
revoke all on function public.reserve_score_pack_order(uuid, bigint, text, bigint, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_score_pack_order(uuid, bigint, text, bigint, text, text, integer, integer)
  to service_role;
