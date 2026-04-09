-- 修复 1: mint_events 唯一约束 — 同一个 mint_queue 记录不会产生两条 event
create unique index if not exists idx_mint_events_queue_unique
  on mint_events (mint_queue_id);

-- 修复 2: 配色契约对齐 — 把十六进制色值改成前端 Island 组件期待的设计 token
update tracks set cover = 'blue'    where week = 1;
update tracks set cover = 'violet'  where week = 2;
update tracks set cover = 'rose'    where week = 3;
update tracks set cover = 'emerald' where week = 4;
update tracks set cover = 'amber'   where week = 5;
