-- Phase 6 B6 — tracks 加 published 字段
-- A 组 5 球 demo 用：A tab 只显 published=true 的（5 首正式音乐），B/C tab 仍 36 球
-- 部分索引只覆盖 published=true 行，体积小

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_tracks_published ON tracks(week) WHERE published = TRUE;
