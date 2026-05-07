-- Phase 6 A1 cleanup — 移除旧无参 claim_score_queue_job
--
-- phase-3/hotfix/015 的旧版 claim_score_queue_job() 没有 lease 参数。
-- 024 在 create or replace 了带参数的新版（p_owner, p_lease_minutes），
-- 但 PostgreSQL 函数重载特性使新旧两个签名共存：
--   - claim_score_queue_job()                          ← 旧版，无 lease
--   - claim_score_queue_job(uuid, int)                 ← 新版，带 lease
--
-- 新版被代码 supabaseAdmin.rpc 按参数匹配选中，但旧版留着 = 任何无参 rpc
-- 调用会回到旧版（破坏 lease 安全约束）。drop 旧版确保单一来源。

drop function if exists claim_score_queue_job();
