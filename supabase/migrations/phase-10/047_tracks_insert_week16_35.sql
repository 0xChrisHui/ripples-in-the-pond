-- 内容更新 — tracks 表补 INSERT week 16-35（艺术家新交付 20 首）
-- 背景：tracks 表现有 week 1-15（15 首 published）。本次艺术家新交付 20 首，
--       文件已改名 public/tracks/No.16.mp3 ~ No.35.mp3
--       （原名为「第X个 <中文曲名> MSTR.mp3」，为避免 audio_url 的 URL 编码隐患统一改成 No.X.mp3）
-- 本 migration：INSERT 20 行 week 16-35（published=true，arweave_url=NULL 等 upload-tracks 回写）
-- cover 按 GROUP_PALETTES[0][(week-1)%8] 派生，与前端 computeNodeAttrs 一致
--   （前端实际自算颜色，这里回写只为保持数据一致）
-- title 延续数字代号（'16'..'35'），与现有 1-15 一致
--
-- ⚠️ 配套代码改动（必须同时上线，否则首页 A tab 只显前 15 球、看不到新歌）：
--    src/components/archipelago/sphere-config.ts → getGroupTargetCount A 组 15 → 35
-- ⚠️ 跑完后需用 `npx tsx scripts/arweave/upload-tracks.ts` 回写 arweave_url（需钱包环境，等确认再跑）
--
-- 原始曲名对照（留档；title 用数字代号，原名不进系统。「…」表示原文件名已被截断）：
--   16 = （无副名，仅母带 MSTR）        17 = 我们和战争的距离是什么样的？
--   18 = 集体底下的呼唤                 19 = 最简单的回信
--   20 = “我”                          21 = 阳光漏出来的时间
--   22 = 今天它让我回去看2022年9月2日   23 = 第22的孪生是和记忆拧在一起的现在的
--   24 = 身体的哀悼                     25 = 我们刚来的时候，什么都不知道，也不…
--   26 = 我和你之间出现分别，我们认出彼此的…  27 = 牙的祭歌
--   28 = 拔牙后记                       29 = 圣诞老人会在梦里出现。
--   30 = 生病想起小时候的旋律，也意识到这里…  31 = 不能对齐的回信
--   32 = 勺子今天生病了 勺子是爱的语言 是我…   33 = 在机场等待的过程中有一个自己的空间
--   34 = 海南的第一个曲子               35 = 一些新的东西出现了 而我也想出了想…

INSERT INTO tracks (week, title, audio_url, cover, island, published)
VALUES
  (16, '16', '/tracks/No.16.mp3', '#9AA878', 'default', true),
  (17, '17', '/tracks/No.17.mp3', '#D8A878', 'default', true),
  (18, '18', '/tracks/No.18.mp3', '#7EA898', 'default', true),
  (19, '19', '/tracks/No.19.mp3', '#A83A3A', 'default', true),
  (20, '20', '/tracks/No.20.mp3', '#6A7898', 'default', true),
  (21, '21', '/tracks/No.21.mp3', '#E8D8B8', 'default', true),
  (22, '22', '/tracks/No.22.mp3', '#382828', 'default', true),
  (23, '23', '/tracks/No.23.mp3', '#B8A8C8', 'default', true),
  (24, '24', '/tracks/No.24.mp3', '#9AA878', 'default', true),
  (25, '25', '/tracks/No.25.mp3', '#D8A878', 'default', true),
  (26, '26', '/tracks/No.26.mp3', '#7EA898', 'default', true),
  (27, '27', '/tracks/No.27.mp3', '#A83A3A', 'default', true),
  (28, '28', '/tracks/No.28.mp3', '#6A7898', 'default', true),
  (29, '29', '/tracks/No.29.mp3', '#E8D8B8', 'default', true),
  (30, '30', '/tracks/No.30.mp3', '#382828', 'default', true),
  (31, '31', '/tracks/No.31.mp3', '#B8A8C8', 'default', true),
  (32, '32', '/tracks/No.32.mp3', '#9AA878', 'default', true),
  (33, '33', '/tracks/No.33.mp3', '#D8A878', 'default', true),
  (34, '34', '/tracks/No.34.mp3', '#7EA898', 'default', true),
  (35, '35', '/tracks/No.35.mp3', '#A83A3A', 'default', true)
ON CONFLICT (week) DO UPDATE
  SET title      = EXCLUDED.title,
      audio_url  = EXCLUDED.audio_url,
      cover      = EXCLUDED.cover,
      published  = EXCLUDED.published,
      -- 保留已上链的 arweave_url，防止 migration 重跑清除已写入的 Arweave URL
      arweave_url = COALESCE(tracks.arweave_url, EXCLUDED.arweave_url);
