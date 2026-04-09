-- 原子抢单函数：查一条 pending + 标记 minting_onchain，一步完成
-- 防止并发 cron 同时抢到同一条任务导致双 mint

create or replace function claim_pending_job()
returns table (
  id uuid,
  user_id uuid,
  token_id integer,
  retry_count integer
)
language sql
as $$
  update mint_queue
  set status = 'minting_onchain',
      updated_at = now()
  where mint_queue.id = (
    select mint_queue.id
    from mint_queue
    where status = 'pending'
    order by created_at asc
    limit 1
    for update skip locked
  )
  returning mint_queue.id, mint_queue.user_id, mint_queue.token_id, mint_queue.retry_count;
$$;
