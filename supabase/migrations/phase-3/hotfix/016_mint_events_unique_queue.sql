-- Phase 3.1 F2: mint_events 幂等写入
-- 防止 stepSetTokenUri 重试时重复插入 mint_events
-- score_queue_id 为 NULL 的是 MaterialNFT，不受约束

create unique index idx_mint_events_score_queue
  on mint_events (score_queue_id)
  where score_queue_id is not null;
