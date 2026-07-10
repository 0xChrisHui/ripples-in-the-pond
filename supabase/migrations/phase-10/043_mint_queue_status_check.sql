-- P10-B P2-6: mint_queue.status 加 CHECK 约束
-- review: reviews/2026-07-05-backend-review.md P2-6
--
-- ⚠ 执行前先在生产跑一次 `select distinct status from mint_queue;` 确认无脏值，
--   否则 add constraint 会因存量脏数据失败（这是期望行为——先清脏再加约束）。
--
-- 幂等：约束不存在才加，可重复执行。

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mint_queue_status_check'
  ) then
    alter table mint_queue
      add constraint mint_queue_status_check
      check (status in ('pending', 'minting_onchain', 'success', 'failed'));
  end if;
end $$;
