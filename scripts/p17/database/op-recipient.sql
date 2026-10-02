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
