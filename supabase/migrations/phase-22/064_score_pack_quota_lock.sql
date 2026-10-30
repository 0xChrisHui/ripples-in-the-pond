-- P22 审查修复（Codex P1-1）：每日额度检查此前只按单枚 Score 加锁，不同 Score 并发会各自读到旧计数而超额。
-- 改为对 OP 代付额外取一把全局事务锁，让"数额度 + 插入订单"串行；额度上限在函数内封顶，不信任调用方参数。

create or replace function public.reserve_score_pack_order(
  p_user_id uuid, p_chain_id bigint, p_contract text, p_token_id bigint,
  p_holder text, p_mode text, p_global_limit integer, p_user_limit integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_existing public.score_pack_orders;
  v_day timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_row public.score_pack_orders;
  v_global_cap constant integer := 200;
  v_user_cap constant integer := 3;
begin
  if p_contract !~ '^0x[0-9a-f]{40}$' or p_holder !~ '^0x[0-9a-f]{40}$'
    or p_mode not in ('op_sponsored', 'eth_self_paid') then raise exception 'INVALID_PACK_ORDER'; end if;
  perform pg_advisory_xact_lock(hashtextextended('score-pack:' || p_chain_id || ':' || p_contract || ':' || p_token_id, 0));
  if p_mode = 'op_sponsored' then
    perform pg_advisory_xact_lock(hashtextextended('score-pack:quota:op', 0));
  end if;

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
    if (select count(*) from public.score_pack_orders where mode = 'op_sponsored' and created_at >= v_day)
      >= least(p_global_limit, v_global_cap) then raise exception 'GLOBAL_LIMIT'; end if;
    if (select count(*) from public.score_pack_orders where mode = 'op_sponsored'
        and user_id = p_user_id and created_at >= v_day) >= least(p_user_limit, v_user_cap)
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
