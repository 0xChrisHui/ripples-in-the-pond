# Phase 10-B/C 后端修复记录（2026-07-11）

> 对应 `reviews/2026-07-05-backend-review.md` 的落地记录。每条附验证方式。
> ⚠ 代码层已 `bash scripts/verify.sh` 全绿（TS/ESLint/build）；标 **[需生产验证]** 的
> curl/SQL 由用户在生产/测试网跑（本环境无 prod 凭据 + forge 不在 PATH）。

## Wave 1 — P0/P1（安全关键）

| 编号 | 修复 | commit | 验证 |
|---|---|---|---|
| P0-1 | mint/material 入队前查 tracks.week 存在性，封越权铸造 | ✅ | [需生产验证] `curl -X POST /api/mint/material -H 'Authorization: Bearer <jwt>' -d '{"tokenId":99999}'` → 400；正常收藏回归 |
| P1-1 | 全库开 RLS 不加 policy（migration 040）+ env 注释对齐 | ✅ | [需生产验证] anon key `curl .../rest/v1/users` → []/401；已执行 ✅ |
| P1-3 | mint/airdrop 发 tx 前盖 mint_attempted_at 戳，抛异常不 reset（防 RPC 超时双铸）；migration 041 | ✅ | [需生产验证] SQL 造"有 attempted 无 hash"行 + 触发 cron，观察不重发 |
| P1-4 | 三队列 has-tx_hash 超 15min → manual_review；mint/airdrop touch updated_at 防队首阻塞；migration 042 | ✅ | [需生产验证] SQL 造"有 hash、attempted 20min 前"行 → cron → 转 manual_review |
| P1-5 | airdrop retry 上限=3，超限转 manual_review | ✅ | [需生产验证] SQL 造 retry_count=3 行 → cron 不再捞 |

> 附：两个贴 220 硬线的 cron 文件按用户批准拆分（`steps-helpers.ts` / airdrop `steps.ts`），纯移动零逻辑改动。

## Wave 3 — P2

| 编号 | 修复 | 验证 |
|---|---|---|
| P2-1 | send-code 按手机号限流(3/10min) + E.164 + fail-closed | [需生产验证] 同号连打 4 次 → 429；断 Upstash → 503 |
| P2-2 | score 队列 operator-lock 60s 心跳续期(A16) | [需生产验证] TTL 临时调小 + 长任务观测锁不丢 |
| P2-3 | check-balance 低余额/积压接 sendAlert | [需生产验证] 触发阈值看邮件 |
| P2-4 | mint/airdrop manual_review 统一发邮件（对齐 score） | 同上 |
| P2-5 | score 队列非终态即清 lease（吞吐 25→5min） | [需生产验证] 一枚 NFT 全流水线计时 |
| P2-6 | migration 043 mint_queue status CHECK | [需生产验证] 先 `select distinct status` 清脏再执行 |
| P2-7 | migration 044 sounds 反推建表（if not exists 幂等）+ 补 RLS | 生产已存在 → no-op |
| P2-8 | migration 撞号补后缀(015h/016h/030b) + README 口径 | 纯 git mv，零 SQL 改动 |

## Wave 3 — P3

| 编号 | 修复 | 备注 |
|---|---|---|
| P3-1 | JWT 绑定并校验 audience | ⚠ 现有无 aud token 失效需重登 |
| P3-2 | cron-auth 常量时间比较 + 生产禁 query secret | 🔧 **改完须去 cron-job.org 确认五个 job 全走 Bearer** |
| P3-3 | .env.example 补 8 缺失键 | 文档 |
| P3-4 | verify.sh 加 forge test 节（有 forge 才跑） | 工具 |
| P3-6 | mint/airdrop 崩溃-发送前用 mint_attempted_at 空判安全重试 | op-lock 已串行，durable lease 冗余，用空判精准解 |
| P3-7 | sync-chain-events 加 Upstash 锁 + batch upsert | [需生产验证] |
| P3-8/9 | migration 045 补 7 FK 索引 + 删冗余 idx_users_evm_address | |
| P3-10 | migration 046 mint_score_enqueue advisory lock 消限流竞态 | |
| P3-11/12/13/14 | UUID 断言 / log.address 校验 / tokenId≡week 注释 / check-balance 复用 wallet client | 小卫生 |

## Wave 3 — C-now

| 项 | 状态 |
|---|---|
| A16 heartbeat | ✅ = P2-2 |
| 401 自动 logout wrapper | ✅ `src/lib/fetch-with-auth.ts` + 4 caller。[需生产验证] JWT 加黑名单 → 调 /me API → 自动登出 |
| /score 链上灾备 | 📄 **方案定稿** `playbook/phase-10/50-score-fallback-design.md`（推荐方案 a iframe 降级），归停点 3 决定是否本 Phase 落地 |
| SR-P1-11 airdrop CAS | ✅ 并入 P1-4/P1-5 |
| SR-P2-11 score token_id partial unique | ✅ 早在 migration 032 已做（本次核对确认） |
| SR-P1-24 airdrop 顶层 env → lazy | ✅ contracts.ts getAddress 改惰性 |

## 🚧 阻塞 / 未做

| 项 | 原因 / 去向 |
|---|---|
| **CT-1/2/3/5 合约脚本类** | **forge 不在本机 PATH，无法 `forge test` 验证** → 需 Foundry 环境跑（不盲改不可编译验证的合约代码） |
| CT-6~9 决策 gate | 🛑 停点 4（ERC2981/供应上限/可升级性/URI 空串） |
| SR-P1-1/P1-2/P1-14 | 边际小项（save_score null check / enqueue 错误友好度 / load-env.ps1 多行）— 未做，低优 |
| P3-5 DB 备份预案 | → P12 runbook |

## 待用户执行（生产）

1. 🔧 **cron-job.org 五个 job 全走 Bearer**（P3-2 已禁生产 query secret，否则 401）— **部署上线日做**
2. ~~生产库执行 migration 043/044/045/046~~ ✅ **已执行（2026-07-11）**；041/042 更早已执行 ✅
