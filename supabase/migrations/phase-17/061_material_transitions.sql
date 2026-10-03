-- P17生产迁移候选；最高已执行版本058，源SQL已通过本机真实事务/并发/RLS验证。
-- 行锁/CAS与独立历史attempt保护未知发送，任何客户端不得直接写状态。
create or replace function public.transition_material_order(p_user_id uuid,p_order_id text,p_version integer,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order material_mint_orders; v_attempt material_mint_attempts; v_digest text;
begin
  select * into v_order from material_mint_orders where order_id=p_order_id and user_id=p_user_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.version is distinct from p_version then raise exception 'VERSION_CONFLICT'; end if;
  v_digest:=p_payload->>'digest';
  if p_action='authorize' then
    if v_order.status not in ('prepared','authorized','reverted') then raise exception 'UNSAFE_AUTHORIZATION'; end if;
    perform enforce_material_issuance_policy(to_jsonb(v_order));
    if v_digest is null or v_digest !~ '^0x[0-9a-f]{64}$'
      or p_payload->>'authorizer' is null or p_payload->>'authorizer' !~ '^0x[0-9a-f]{40}$'
      or p_payload->>'deadline' is null or (p_payload->>'deadline')::bigint<=extract(epoch from now()) then raise exception 'INVALID_AUTHORIZATION'; end if;
    insert into material_mint_attempts(digest,order_id,deadline,authorizer)
      values(v_digest,p_order_id,(p_payload->>'deadline')::bigint,p_payload->>'authorizer') on conflict do nothing;
    if not exists(select 1 from material_mint_attempts where digest=v_digest and order_id=p_order_id) then raise exception 'DIGEST_CONFLICT'; end if;
    update material_mint_orders set status='authorized',current_digest=v_digest,version=version+1,updated_at=now()
      where order_id=p_order_id returning * into v_order;
    return to_jsonb(v_order);
  end if;
  select * into v_attempt from material_mint_attempts where digest=v_digest and order_id=p_order_id for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if p_action='send' then
    if v_order.status<>'authorized' or v_order.current_digest is distinct from v_digest or v_attempt.deadline<extract(epoch from now())
      or v_attempt.send_attempted_at is not null then raise exception 'UNSAFE_SEND'; end if;
    update material_mint_attempts set send_attempted_at=now() where digest=v_digest;
    update material_mint_orders set status='sending' where order_id=p_order_id;
  elsif p_action='rejected' then
    if v_order.status<>'sending' or v_order.current_digest is distinct from v_digest or cardinality(v_attempt.tx_hashes)>0 then raise exception 'UNSAFE_REJECTION'; end if;
    update material_mint_attempts set outcome='rejected' where digest=v_digest;
    update material_mint_orders set status='prepared',current_digest=null where order_id=p_order_id;
  elsif p_action='unknown' then
    if v_order.status not in ('sending','unknown') then raise exception 'INVALID_STATE'; end if;
    update material_mint_attempts set outcome='unknown' where digest=v_digest;
    update material_mint_orders set status='unknown',error_kind='broadcast_unknown' where order_id=p_order_id;
  elsif p_action='submission' then
    if p_payload->>'txHash' is null or p_payload->>'txHash' !~ '^0x[0-9a-f]{64}$' or v_attempt.send_attempted_at is null or v_attempt.outcome='rejected'
      or v_order.status not in ('sending','unknown','submitted','confirming','success') then raise exception 'INVALID_SUBMISSION'; end if;
    update material_mint_attempts set outcome='submitted',tx_hashes=(select array_agg(distinct hash)
      from unnest(tx_hashes||array[p_payload->>'txHash']) hash) where digest=v_digest;
    update material_mint_orders set tx_hash=coalesce(tx_hash,p_payload->>'txHash'),
      status=case when status in ('success','confirming') then status else 'submitted' end where order_id=p_order_id;
  else raise exception 'INVALID_ACTION'; end if;
  update material_mint_orders set version=version+1,updated_at=now() where order_id=p_order_id returning * into v_order;
  return to_jsonb(v_order);
end $$;
revoke all on function public.transition_material_order(uuid,text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.transition_material_order(uuid,text,integer,text,jsonb) to service_role;

create or replace function public.finalize_material_order(p_order_id text,p_version integer,p_worker text,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order material_mint_orders;
begin
  select * into v_order from material_mint_orders where order_id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status='success' and v_order.tx_hash=p_proof->>'txHash' and v_order.confirmed_block_hash=p_proof->>'blockHash'
    then return to_jsonb(v_order); end if;
  if v_order.version is distinct from p_version or v_order.lease_owner is distinct from p_worker
    or v_order.lease_until is null or v_order.lease_until<now() then raise exception 'LEASE_OR_VERSION_CONFLICT'; end if;
  if exists(select 1 from unnest(array['orderId','chainId','contract','recipient','tokenId','amount','uriHash',
    'txHash','blockHash','logIndex','blockNumber','canonicalConfirmed','digest']) k where p_proof->>k is null) then raise exception 'INCOMPLETE_PROOF'; end if;
  if p_proof->>'orderId'<>v_order.order_id or (p_proof->>'chainId')::bigint<>v_order.chain_id
    or p_proof->>'contract'<>v_order.contract_address or p_proof->>'recipient'<>v_order.recipient_address
    or p_proof->>'tokenId'<>v_order.token_id or (p_proof->>'amount')::integer<>1
    or p_proof->>'uriHash'<>v_order.uri_hash or p_proof->>'txHash' !~ '^0x[0-9a-f]{64}$'
    or p_proof->>'blockHash' !~ '^0x[0-9a-f]{64}$' or (p_proof->>'logIndex')::integer<0
    or (p_proof->>'blockNumber')::numeric<=0 or p_proof->>'canonicalConfirmed'<>'true' then raise exception 'PROOF_MISMATCH'; end if;
  -- 实际链上成功高于客户端拒签/未上报；所有历史已签digest都保留可恢复。
  if not exists(select 1 from material_mint_attempts where order_id=p_order_id and digest=p_proof->>'digest') then raise exception 'UNKNOWN_ATTEMPT'; end if;
  update material_mint_orders set status='success',tx_hash=p_proof->>'txHash',confirmed_block=p_proof->>'blockNumber',
    confirmed_block_hash=p_proof->>'blockHash',confirmed_log_index=(p_proof->>'logIndex')::integer,
    version=version+1,updated_at=now(),confirmed_at=coalesce(confirmed_at,now()),lease_owner=null,lease_until=null,error_kind=null
    where order_id=p_order_id returning * into v_order;
  return to_jsonb(v_order);
end $$;
revoke all on function public.finalize_material_order(text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_material_order(text,integer,text,jsonb) to service_role;
