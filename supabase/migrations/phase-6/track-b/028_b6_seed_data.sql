-- Phase 6 B6 — A 组 5 球 demo 数据替换
-- 前置：先跑 027_tracks_add_published.sql
--
-- 改动：
--   1. week 1-5 标 published=true（A tab 只显这 5 球）
--   2. week 1-36 按 (week-1)%5 循环替换 audio_url + title 到 No.1-5
--      title 用单数字 '1'~'5'（艺术家反馈"用数字代号"+ B6 决策气球字 badge 单数字最优）
--      cover 用 GROUP_PALETTES[0] 前 5 色，球颜色由前端 computeNodeAttrs 派生（这里只是回写一致）
--   3. 一次性清旧 mint 数据：抹掉所有用户在 token_id 1-36 上的素材铸造记录
--      副作用已和用户多轮确认：测试网 demo 阶段所有 tester /me "我铸造的"会丢这部分

-- ───── A 组：5 首正式发布 ─────
UPDATE tracks SET published = TRUE WHERE week BETWEEN 1 AND 5;

-- ───── 36 球循环到 No.1-5（按 (week-1)%5 公式）─────
UPDATE tracks SET title='1', audio_url='/tracks/No.1.mp3', cover='#D8A878', arweave_url=NULL WHERE week IN (1, 6, 11, 16, 21, 26, 31, 36);
UPDATE tracks SET title='2', audio_url='/tracks/No.2.mp3', cover='#7EA898', arweave_url=NULL WHERE week IN (2, 7, 12, 17, 22, 27, 32);
UPDATE tracks SET title='3', audio_url='/tracks/No.3.mp3', cover='#A83A3A', arweave_url=NULL WHERE week IN (3, 8, 13, 18, 23, 28, 33);
UPDATE tracks SET title='4', audio_url='/tracks/No.4.mp3', cover='#6A7898', arweave_url=NULL WHERE week IN (4, 9, 14, 19, 24, 29, 34);
UPDATE tracks SET title='5', audio_url='/tracks/No.5.mp3', cover='#E8D8B8', arweave_url=NULL WHERE week IN (5, 10, 15, 20, 25, 30, 35);

-- ───── 一次性清旧 mint 数据（已与用户确认接受副作用）─────
-- mint_events 同时存 Material / Score 两类，用 score_queue_id IS NULL 圈出 material 行
-- 不过滤的话会误伤 ScoreNFT (Phase 3 已铸的 tokenId 1/2)
DELETE FROM mint_events WHERE token_id BETWEEN 1 AND 36 AND score_queue_id IS NULL;
DELETE FROM mint_queue WHERE mint_type='material' AND token_id BETWEEN 1 AND 36;
