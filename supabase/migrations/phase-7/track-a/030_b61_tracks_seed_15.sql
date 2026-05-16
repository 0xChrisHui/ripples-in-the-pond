-- Phase 7 A6.1 — A 组 5 球 → 15 球数据扩容（10 首新曲就位版本）
-- 前置：028_b6_seed_data.sql 已跑（week 1-36 循环到 No.1-5，week 1-5 published）
-- 用户须知：本 migration 跑完后必须先把 No.6.mp3 ~ No.15.mp3 放进 public/tracks/，
--           再跑 npx tsx scripts/arweave/upload-tracks.ts 回写 arweave_url。
--
-- 改动：
--   1. week 6-15 标 published=true（A tab 现在显 15 球）
--   2. week 6-15 audio_url 从循环路径（No.1-5）改成 /tracks/No.${week}.mp3
--      title 改单/双位数字符串（前端 SphereNode badge 双位数会做字号适配）
--      arweave_url 设 NULL，等待 upload-tracks 脚本回写
--   3. week 16-36 不动（保持 028 的 (week-1)%5 循环到 No.1-5；B/C tab 36 球行为不变）
--   4. 不动 mint_events / mint_queue（028 已清过 token_id 1-36 的旧 material mint）

-- ───── A 组：6-15 共 10 首新发布 ─────
UPDATE tracks SET published = TRUE WHERE week BETWEEN 6 AND 15;

-- ───── week 6-15 改 audio_url + title + 清 arweave_url ─────
UPDATE tracks SET title='6',  audio_url='/tracks/No.6.mp3',  arweave_url=NULL WHERE week = 6;
UPDATE tracks SET title='7',  audio_url='/tracks/No.7.mp3',  arweave_url=NULL WHERE week = 7;
UPDATE tracks SET title='8',  audio_url='/tracks/No.8.mp3',  arweave_url=NULL WHERE week = 8;
UPDATE tracks SET title='9',  audio_url='/tracks/No.9.mp3',  arweave_url=NULL WHERE week = 9;
UPDATE tracks SET title='10', audio_url='/tracks/No.10.mp3', arweave_url=NULL WHERE week = 10;
UPDATE tracks SET title='11', audio_url='/tracks/No.11.mp3', arweave_url=NULL WHERE week = 11;
UPDATE tracks SET title='12', audio_url='/tracks/No.12.mp3', arweave_url=NULL WHERE week = 12;
UPDATE tracks SET title='13', audio_url='/tracks/No.13.mp3', arweave_url=NULL WHERE week = 13;
UPDATE tracks SET title='14', audio_url='/tracks/No.14.mp3', arweave_url=NULL WHERE week = 14;
UPDATE tracks SET title='15', audio_url='/tracks/No.15.mp3', arweave_url=NULL WHERE week = 15;
