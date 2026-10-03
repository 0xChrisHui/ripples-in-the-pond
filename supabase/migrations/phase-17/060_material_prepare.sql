-- P17生产迁移候选；最高已执行版本058，源SQL已通过本机真实事务/并发/RLS验证。
-- 用户2026-10-03批准每钱包每首累计一次、可转让、总量无限；批准不自动迁移/启用数据库。
create or replace function public.enforce_material_issuance_policy(p_snapshot jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.material_issuance_policy where singleton and status='approved'
    and approval_reference is not null and length(trim(approval_reference))>0
    and policy = '{"id":"eth-original-wallet-once-v1","perWalletPerToken":1,"transferable":true,"reclaimAfterTransfer":false,"totalSupplyCap":null}'::jsonb) then
    raise exception 'ISSUANCE_POLICY_NOT_ACTIVATED';
  end if;
  if p_snapshot->>'chain_id' is null or p_snapshot->>'chain_id' not in ('1','11155111')
    or p_snapshot->>'contract_address' is null or p_snapshot->>'contract_address' !~ '^0x[0-9a-f]{40}$'
    or p_snapshot->>'recipient_address' is null or p_snapshot->>'recipient_address' !~ '^0x[0-9a-f]{40}$'
    or p_snapshot->>'token_id' is null or p_snapshot->>'token_id' !~ '^[1-9][0-9]*$'
    or p_snapshot->>'order_id' is null or p_snapshot->>'order_id' !~ '^0x[0-9a-f]{64}$'
    or (p_snapshot ? 'amount' and (p_snapshot->>'amount') is distinct from '1') then raise exception 'INVALID_POLICY_COORDINATE'; end if;
  perform pg_advisory_xact_lock(hashtextextended('material-coordinate:'||(p_snapshot->>'chain_id')||':'||
    (p_snapshot->>'contract_address')||':'||(p_snapshot->>'recipient_address')||':'||(p_snapshot->>'token_id'),0));
  -- 不按user_id限制：换登录账号不恢复同一个钱包的历史领取资格。
  if exists(select 1 from public.material_mint_orders where chain_id=(p_snapshot->>'chain_id')::bigint
    and contract_address=p_snapshot->>'contract_address' and recipient_address=p_snapshot->>'recipient_address'
    and token_id=p_snapshot->>'token_id' and order_id<>p_snapshot->>'order_id'
    and status not in ('reverted','cancelled')) then raise exception 'MATERIAL_WALLET_TOKEN_RESERVED'; end if;
end $$;
revoke all on function public.enforce_material_issuance_policy(jsonb) from public,anon,authenticated;
-- 服务端已经校验固定注册表；数据库再次确保政策明确批准与请求原子性。
create or replace function public.prepare_material_order(p_user_id uuid, p_request_key text, p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_order public.material_mint_orders;
  v_order_id text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_request_key,0));
  select * into v_order from material_mint_orders where user_id=p_user_id and request_key=p_request_key;
  if found then
    if v_order.track_id::text <> p_snapshot->>'track_id' or v_order.chain_id::text <> p_snapshot->>'chain_id'
      or v_order.recipient_address <> p_snapshot->>'recipient_address' then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return to_jsonb(v_order);
  end if;
  if not exists(select 1 from material_issuance_policy where status='approved') then
    raise exception 'ISSUANCE_POLICY_NOT_ACTIVATED';
  end if;
  perform enforce_material_issuance_policy(p_snapshot);
  v_order_id:=p_snapshot->>'order_id';
  insert into material_mint_orders(order_id,user_id,request_key,track_id,chain_id,contract_address,token_id,
    recipient_address,catalog_revision,metadata_uri,uri_hash)
  values(v_order_id,p_user_id,p_request_key,(p_snapshot->>'track_id')::uuid,(p_snapshot->>'chain_id')::bigint,
    p_snapshot->>'contract_address',p_snapshot->>'token_id',p_snapshot->>'recipient_address',
    p_snapshot->>'catalog_revision',p_snapshot->>'metadata_uri',p_snapshot->>'uri_hash') returning * into v_order;
  return to_jsonb(v_order);
end $$;
revoke all on function public.prepare_material_order(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_material_order(uuid,text,jsonb) to service_role;

-- 恢复仅处理已有冻结订单；关闭签发不停止在途对账。
create or replace function public.lease_material_orders(p_worker text, p_limit integer default 10)
returns setof public.material_mint_orders language sql security definer set search_path=public,pg_temp as $$
  with picked as (
    select order_id from material_mint_orders
    where (status in ('sending','unknown','submitted','confirming') or (status='success' and confirmed_at>now()-interval '24 hours'))
      and (lease_until is null or lease_until<now())
    order by updated_at for update skip locked limit least(greatest(p_limit,1),20)
  ) update material_mint_orders m set lease_owner=p_worker,lease_until=now()+interval '90 seconds'
  from picked where m.order_id=picked.order_id returning m.*;
$$;
revoke all on function public.lease_material_orders(text,integer) from public,anon,authenticated;
grant execute on function public.lease_material_orders(text,integer) to service_role;

create or replace function public.defer_material_reconcile(p_order_id text,p_worker text,p_version integer,p_cursor numeric,p_state text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_state not in ('pending','unknown','confirming') or p_cursor is null or p_cursor<0 then raise exception 'INVALID_INSPECTION'; end if;
  update material_mint_orders set scan_cursor=p_cursor,
    status=case when p_state in ('unknown','confirming') then p_state else status end,
    lease_owner=null,lease_until=null,updated_at=now(),version=version+1
    where order_id=p_order_id and lease_owner=p_worker and version=p_version and lease_until>now();
  if not found then raise exception 'LEASE_OR_VERSION_CONFLICT'; end if;
end $$;
revoke all on function public.defer_material_reconcile(text,text,integer,numeric,text) from public,anon,authenticated;
grant execute on function public.defer_material_reconcile(text,text,integer,numeric,text) to service_role;
