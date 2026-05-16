-- Phase 7 A6.1 fix — tracks 表补 INSERT week 6-15
-- 背景：tracks 表只有 week 1-5 共 5 行（B+C 组 36 球靠前端 padTracksToTarget 循环填充）
--       030_b61_tracks_seed_15.sql 只做了 UPDATE，week 6-15 行不存在故全是空操作
-- 本 migration：INSERT 10 行 week 6-15（published=true，arweave_url=NULL 等 upload-tracks 回写）
-- cover 颜色按 GROUP_PALETTES[0] [(week-1)%8] 派生，与前端 computeNodeAttrs 一致
-- 跑完后必须用 npx tsx scripts/arweave/upload-tracks.ts 回写 arweave_url

INSERT INTO tracks (week, title, audio_url, cover, island, published)
VALUES
  (6,  '6',  '/tracks/No.6.mp3',  '#382828', 'default', true),
  (7,  '7',  '/tracks/No.7.mp3',  '#B8A8C8', 'default', true),
  (8,  '8',  '/tracks/No.8.mp3',  '#9AA878', 'default', true),
  (9,  '9',  '/tracks/No.9.mp3',  '#D8A878', 'default', true),
  (10, '10', '/tracks/No.10.mp3', '#7EA898', 'default', true),
  (11, '11', '/tracks/No.11.mp3', '#A83A3A', 'default', true),
  (12, '12', '/tracks/No.12.mp3', '#6A7898', 'default', true),
  (13, '13', '/tracks/No.13.mp3', '#E8D8B8', 'default', true),
  (14, '14', '/tracks/No.14.mp3', '#382828', 'default', true),
  (15, '15', '/tracks/No.15.mp3', '#B8A8C8', 'default', true)
ON CONFLICT (week) DO UPDATE
  SET title      = EXCLUDED.title,
      audio_url  = EXCLUDED.audio_url,
      cover      = EXCLUDED.cover,
      published  = EXCLUDED.published,
      arweave_url = NULL;
