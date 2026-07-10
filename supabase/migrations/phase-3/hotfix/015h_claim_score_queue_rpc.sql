-- Phase 3.1 F1: 原子抢单 RPC
-- 解决并发 cron 重复处理同一条任务的问题
-- FOR UPDATE SKIP LOCKED 保证同一时刻只有一个 worker 拿到任务

create or replace function claim_score_queue_job()
returns setof score_nft_queue
language sql
as $$
  update score_nft_queue
  set updated_at = now()
  where id = (
    select id from score_nft_queue
    where status in (
      'pending', 'uploading_events', 'minting_onchain',
      'uploading_metadata', 'setting_uri'
    )
    and retry_count < 3
    order by created_at asc
    limit 1
    for update skip locked
  )
  returning *;
$$;
