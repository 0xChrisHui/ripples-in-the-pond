# P14-G0 生产事故止血与快照

> 时间：2026-09-12 11:35–11:43（Asia/Shanghai）
> 执行环境：`E:\Projects\nft-music-p14-off`，无 `.env.local`，Vercel Production 短生命周期环境注入
> 敏感信息：未输出、未写盘

## 生产身份

- chainId：`10`
- ScoreNFT：`0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA`
- Pond Echo：`0xd2E884FA06C9a9BDef2350956cc4216d3E2B476c`
- Supabase host：`uupobbgnhpattyxhxvmc.supabase.co`
- Vercel deployment：`dpl_GYDNR31mdiTLseWETzDzLJRaLX1N`
- Production alias：`https://pond-ripple.xyz`

## 止血结果

- Production `WALLET_RECIPE_MODE` 已更新为 `off`，重新部署后 `/api/health` read-back 为 `off/configured=true`。
- cron-job.org `7520772 sync-chain-events` 已 read-back `enabled=false`。
- cron-job.org `8394060 process-wallet-recipe` 已 read-back `enabled=false`。
- Codex heartbeat `p14-live-7` 已暂停；旧 24h/7d 窗口作废。
- 部署来自隔离的干净 detached worktree；未包含并行施工中的未完成代码。

## 故障快照

首次停止后读数（2026-09-12T03:42:21.695Z）：

- `last_synced_block=5500`，`updated_at=2026-09-12T03:35:06.410Z`
- P14 discovery cursor：`156746674:188`
- health safe head：`156792783`
- source-to-safe-head lag：`156787283`
- alerts：`source_index_lagging`

第二次读数（2026-09-12T03:43:16.419Z）：

- `last_synced_block` 仍为 `5500`，更新时间未变化。
- P14 discovery cursor 仍为 `156746674:188`，更新时间未变化。
- Pond Echo queue 仍为 `2 excluded_prelaunch / 1 success / 0 active / 0 failed`。
- Score queue 仍为 `2 success / 0 active / 0 failed`。

第三次读数（2026-09-12T03:55:13.306Z，已超过旧 lock TTL）：

- `last_synced_block` 仍为 `5500`，`updated_at` 仍为 `2026-09-12T03:35:06.410Z`。
- P14 discovery cursor 仍为 `156746674:188`，`updated_at` 未变化。
- Pond Echo queue 仍为 `2 excluded_prelaunch / 1 success`，三行 `updated_at` 均未变化。
- Score queue 仍为 `2 success`，两行 `updated_at` 均未变化。
- cron-job.org 两项任务再次 read-back 为 `enabled=false`。

## 生产集合

- `chain_events`：3 条，均为主网 ScoreNFT mint Transfer。
  - token #1：block `155937041`，log `71`
  - token #2：block `156213815`，log `80`
  - token #3：block `156746674`，log `188`
- `wallet_recipe_queue`：3 条；#1/#2 为上线前排除，Score #3 对应 ECHO #1 success。
- `mint_events`：5 条；2 条 Score，3 条 Material。

## 事故判断

`sync-chain-events` 将游标读取错误/缺行当作 `0`，随后按每次最多 500 blocks 扫描并用普通 update 覆盖高位游标。生产出现低位游标并按 500 整倍数前进，与该代码路径吻合。P14 discovery 自身保持 fail closed，因此没有错误资格、上传或链上交易。

## Gate

- [x] Production 身份三重断言
- [x] P14 mode off 并 read-back
- [x] 两项 cron disabled 并 read-back
- [x] 队列无 active/manual_review/upload_result_unknown
- [x] 已有 chain events 与 ECHO #1 记录保留
- [x] 旧 lock TTL 排空后第三次稳定性读回通过
