-- Phase 6 P1-19 修复（2026-05-08 strict CTO review）— pending_scores 加 event_count generated column
--
-- 起因：/api/me/score-nfts 之前 SELECT pending_scores(events_data) 拉整个 jsonb 数组
--      仅为算 events.length，100 张唱片 = 100 次 N+1 大 JSON 拉取，实测 35 秒。
--
-- generated column 在 INSERT/UPDATE 时计算 jsonb_array_length(events_data) 落表，
-- 后续 SELECT 拉一个整数即可，PostgREST 也能直接 SELECT 这一列。
--
-- 安全性：jsonb_array_length 对非数组 jsonb 会抛错。events_data 业务上必为数组，
-- 但若历史脏数据存在非数组 jsonb 行，先用 CASE 兜底为 0（不报错）。

alter table pending_scores
  add column event_count integer generated always as (
    case
      when jsonb_typeof(events_data) = 'array' then jsonb_array_length(events_data)
      else 0
    end
  ) stored;
