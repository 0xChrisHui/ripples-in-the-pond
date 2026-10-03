-- P17生产迁移候选；最高已执行版本058，源SQL已通过本机真实事务/并发/RLS验证。
-- 兼容旧OP队列的必要快照；尚未执行，缺列时新原曲接口必须拒绝发送。
alter table public.mint_queue add column if not exists recipient_address text
  check (recipient_address is null or recipient_address ~ '^0x[0-9a-fA-F]{40}$');
-- 不回填历史记录，worker 对 NULL 沿用原用户地址；新任务必须保存服务端认证地址。

-- 原claim_pending_job固定返回4列，另建完整行RPC避免DROP旧函数和破坏历史调用。
create or replace function public.claim_pending_material_job()
returns setof public.mint_queue language sql security definer set search_path=public,pg_temp as $$
  update mint_queue set status='minting_onchain',updated_at=now()
  where mint_queue.id=(select mint_queue.id from mint_queue where status='pending'
    order by created_at limit 1 for update skip locked)
  returning mint_queue.*;
$$;
revoke all on function public.claim_pending_material_job() from public,anon,authenticated;
grant execute on function public.claim_pending_material_job() to service_role;

-- 本地可审阅草案，不执行生产迁移；旧NULL目标仍发送到旧MaterialNFT。
alter table public.mint_queue add column if not exists material_contract_address text
  check (material_contract_address is null or (material_contract_address ~ '^0x[0-9a-f]{40}$'
    and material_contract_address<>'0x0000000000000000000000000000000000000000'));
-- 必须先执行op-recipient.sql；已有行保持NULL，不回填或迁移旧藏品。
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.mint_queue'::regclass
    and conname='material_target_requires_recipient') then
    alter table public.mint_queue add constraint material_target_requires_recipient
      check (material_contract_address is null or recipient_address is not null);
  end if;
end $$;

create or replace function public.prepare_op_sbt_job(p_user_id uuid,p_key text,p_token_id integer,p_contract text,p_recipient text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_job public.mint_queue;
begin
  if p_user_id is null or p_key is null or length(p_key) not between 1 and 200
    or p_contract is null or p_contract !~ '^0x[0-9a-f]{40}$' or p_contract='0x0000000000000000000000000000000000000000'
    or p_recipient is null or p_recipient !~ '^0x[0-9a-f]{40}$' or p_recipient='0x0000000000000000000000000000000000000000'
    or p_token_id is null or not exists(select 1 from public.tracks where week=p_token_id)
    or p_key<>('op-sbt:'||p_user_id::text||':'||p_contract||':'||p_token_id::text) then raise exception 'INVALID_SBT_SNAPSHOT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_key,0));
  select * into v_job from public.mint_queue where idempotency_key=p_key;
  if found then
    if v_job.user_id<>p_user_id or v_job.token_id<>p_token_id
      or v_job.material_contract_address is distinct from p_contract then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    -- 登录地址改变不修改已经冻结的接收人，也不复用旧material幂等记录。
    return to_jsonb(v_job);
  end if;
  insert into public.mint_queue(idempotency_key,user_id,mint_type,token_id,status,recipient_address,material_contract_address)
    values(p_key,p_user_id,'material',p_token_id,'pending',p_recipient,p_contract) returning * into v_job;
  return to_jsonb(v_job);
end $$;
revoke all on function public.prepare_op_sbt_job(uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.prepare_op_sbt_job(uuid,text,integer,text,text) to service_role;
