# TASKS — 任务看板

> Now / Next / Later / Done / Blocked
> 一次只允许 1 件事在 Now，AI 完成一件就移到 Done 并提拔下一件到 Now。

---

## 🎯 Now（最多 1 件，AI 正在做的）

- （空，等用户发起 Phase 4 S6）

---

## ⏭ Next

- **Phase 4C S6** — AirdropNFT 合约 + 空投系统
- **Phase 4C S7** — 收口验证（10 项）

延后项清单：`reviews/phase-0-deferred.md` + `reviews/phase-1-deferred.md`

**主网前必做**：
- Deploy 脚本 admin/minter 分离 + save draft 事务化（见 `reviews/2026-04-10-phase-2.5-completion-review.md`）
- **Turbo credits 监控的阈值告警**：S5 已交付最小观测性端点 `/api/cron/queue-status`，但 Turbo winc 余额监控还没接入。上线前改成"低于 10% 自动邮件告警"——Phase 3B 一起做
- **Phase 3B — sync-chain-events cron**（playbook 要求的紧接步骤）：每 5 分钟从 last_synced_block 拉 ScoreNFT Transfer 事件，解决 OpenSea 转手后 DB 不知道的问题；需要 system_kv 表 + chain_events 表 + UNIQUE(tx_hash, log_index) 防重

---

## 🚧 Blocked

- **Phase 4A S3** — 前端登录按钮 + useAuth 兼容 + 端到端验证
  - **阻塞原因**：Semi 团队在设计 OAuth 开放登录，现有 API 不确定对外开放
  - **已完成的前置**：S0 JWT 基础设施 ✅ / S1 双验证中间件 ✅ / S2 后端登录端点 ✅
  - **续做时要改的**：`src/lib/semi-client.ts`（适配 OAuth 流程）+ 新建前端登录组件
  - **解除条件**：Semi 团队提供 OAuth 文档或确认现有 API 可用

---

## ✅ Done

- **[Phase 4B S5]** ✅ 完成（2026-04-13）— 艺术家页面：
  - `app/artist/page.tsx`（Server Component，统计 + 108 首进度条 + 空投标记点）
  - `app/api/artist/stats/route.ts`（公开统计 API）
  - verify.sh 全绿
- **[Phase 4B S4]** ✅ 完成（2026-04-13）— 余额告警 + 健康检查增强：
  - `app/api/cron/check-balance/route.ts`（钱包余额 + 双队列积压 + system_kv 告警）
  - `app/api/health/route.ts`（增强：score_nft_queue 状态分布 + jwt_blacklist 大小 + 最近告警）
  - `src/types/tracks.ts`（HealthResponse 扩展字段）
  - verify.sh 全绿
- **[Phase 4A S2]** ✅ 完成（2026-04-13）— Semi 登录对接：
  - `src/lib/semi-client.ts`（Semi API 客户端：发短信/验证码登录/拿用户）
  - `app/api/auth/community/route.ts`（验证码 → JWT 交换）
  - `app/api/auth/community/send-code/route.ts`（转发短信请求）
  - evm_address 合并逻辑：Privy/Semi 同地址 → 同 user
  - verify.sh 全绿
- **[Phase 4A S1]** ✅ 完成（2026-04-13）— 身份模型 + 双验证中间件 + 6 API 迁移：
  - `supabase/migrations/phase-4/016_auth_identities.sql`（多源身份表 + 现有用户迁移）
  - `supabase/migrations/phase-4/017_users_privy_nullable.sql`（privy_user_id 改可空）
  - `src/lib/auth/middleware.ts`（authenticateRequest：先 Privy 后 JWT）
  - `src/lib/auth/jwt.ts`（从 src/lib/ 重组到 auth/ 子目录）
  - 6 个 API 全部迁移：me/scores、me/score-nfts、me/nfts、mint/score、mint/material、score/save
  - verify.sh 全绿
- **[Phase 4A S0]** ✅ 完成（2026-04-13）— 自签 JWT 基础设施：
  - `jose` 安装 + STACK.md 白名单登记
  - `scripts/generate-jwt-keys.ts`（密钥生成脚本）
  - `src/lib/jwt.ts`（signJwt / verifyJwt / revokeJwt + server-only）
  - `supabase/migrations/phase-4/015_jwt_blacklist.sql`（撤销黑名单表）
  - `tsconfig.json` 排除 references/ 目录
  - verify.sh 全绿（TypeScript + ESLint + Build）
- **[Phase 3.1]** ✅ 完成（2026-04-12）— 稳定性修复 Sprint 1+2（7 项）：
  - F1 原子 claim + F2 幂等写入 + F3 external_url 环境变量 + F4 底曲 fail fast
  - F5 promise catch + F6 防御性检查 + F7 UUID 校验
  - F8 不需要（/me = "我铸造的"）、F9 延后
  - 来源：Codex CTO Review + Claude Code 自检 → `reviews/2026-04-12-phase-3.1-fix-plan.md`
- **[Phase 3B]** ✅ 完成（2026-04-12）— 链上事件同步 cron：
  - `supabase/migrations/phase-3/013_system_kv.sql` — 系统 KV 表，存 last_synced_block
  - `supabase/migrations/phase-3/014_chain_events.sql` — 链上事件表，UNIQUE(tx_hash, log_index)
  - `app/api/cron/sync-chain-events/route.ts` — 分批循环拉 Transfer 事件（Alchemy Free 10 区块限制）
  - `src/lib/contracts.ts` — ScoreNFT 加 Transfer 事件 ABI
  - 实测：tokenId 2 Transfer 事件成功同步
- **[Phase 3 Step S7]** ✅ 完成（2026-04-12）— 个人页升级 + 端到端验证 8/8：
  - `src/components/me/ScoreCard.tsx`（新建）— 乐谱 NFT 卡片（封面 + 标题 + 回放链接）
  - `app/api/me/score-nfts/route.ts`（新建）— 返回用户已铸造的 ScoreNFT
  - `app/me/page.tsx`（修改）— 三区排列：乐谱 → 素材 → 草稿
  - 端到端验证：8/8 全通过（1-4 手动验证 + 5-6 S5 已实测 + 7-8 手动验证）
  - Phase 3A 标记完成
- **[Phase 3 Step S6]** ✅ 完成（2026-04-12）— 公开回放页 + OG 分享卡：
  - `app/score/[tokenId]/page.tsx`（Server Component，封面 + 标题 + 链上信息 + iframe 播放器）
  - `app/score/[tokenId]/ScorePlayer.tsx`（Client Component，点击展开 iframe 嵌入 Arweave Decoder）
  - `app/score/[tokenId]/opengraph-image.tsx`（动态 OG 图，预取封面 + 降级色块）
  - `src/data/score-source.ts`（数据源，DB 主路径查 mint_events → queue → track → user）
  - `supabase/migrations/phase-3/012_mint_events_nullable_queue_id.sql`（mint_queue_id 改可空）
  - verify.sh 全绿（TypeScript + ESLint + Build）
- **[Phase 3 Step S5]** ✅ 完成（2026-04-12）— 铸造 API + cron 5 步状态机 + 最小观测性：
  - S5.a commit `7af6c39`：3 个 migrations（score_nft_queue + mint_score_enqueue RPC + extend mint_events）+ `POST /api/mint/score` + jam.ts 扩展类型
  - S5.bc commit `8dc66c9`：cron 拆 3 文件（route / steps-upload / steps-chain）+ upload-sounds.ts 末尾追加 sounds map 上传 + `/api/cron/queue-status` 观测端点（放 cron/ 子目录避开 app/api/ 8 硬线）
  - Migrations 按 Phase 重组到 `supabase/migrations/phase-0-2/` + `supabase/migrations/phase-3/` 子目录
  - 端到端实测：pending_score "晨雾" (29 events) → RPC 入队 → 4 次 cron → 链上 ScoreNFT tokenId 2 → metadata Arweave `pXWRtrzz...s60`
  - 硬门槛 4 条：CORS smoke ✓ / minting_onchain 幂等 ✓ / 观测端点 ✓ / OpenSea testnet 替代方案 ✓（Etherscan + 直接 fetch Arweave）
  - OpenSea 已永久停 testnet 发现 + memory 记录
- **[Phase 3 Step S4]** ✅ 完成（2026-04-11）— Score Decoder "网页唱片机"：
  - commit `1713b5f`：`src/score-decoder/index.html`（12.63 KB，零依赖 vanilla JS + Web Audio）+ `scripts/arweave/upload-decoder.ts`
  - decoder txId `FWy1XA-B8MvRAgsNgMfDSUBiXXjHNpK1A_fHWjsUAXg`（所有 ScoreNFT 共用一份）
  - 本地双击 file:// 测试 1-2s 加载 + 播放 OK
- **[Phase 3 Step S3]** ✅ 完成（2026-04-11）— MintOrchestrator + 权限授权 + 端到端 mint：
  - commit `f018343`：`contracts/src/MintOrchestrator.sol` + test (12/12 pass) + deploy script 三步一 broadcast
  - 部署地址 `0xcBE4Ce6a9344e04f30D3f874098E8858d7184336`
  - 部署时 ScoreNFT.grantRole(MINTER_ROLE, orchestrator) + mintScore(deployer) → tokenId 1
  - TBA 极薄开关保留（tbaEnabled 默认 false + 空 `_maybeCreateTba` 钩子）
- **[Phase 3 Step S2]** ✅ 完成（2026-04-11）— ScoreNFT 合约 + Tailwind v4 根治：
  - commit `a9a4847`：`contracts/src/ScoreNFT.sol`（ERC721URIStorage + AccessControl）+ test (10/10 pass) + deploy script
  - 部署地址 `0xA65C9308635C8dd068A314c189e8d77941A7e99c`，name `"Ripples in the Pond Score (Testnet)"`，symbol `RIPS`
  - tokenId 从 1 自增，mint / setTokenURI 两步分离（playbook D2 冻结决策）
  - Tailwind v4 根治：`globals.css` 用 `@source not` 显式排除非源码目录，解决 `Invalid code point` bug（历史踩过 2 次）
- **[Phase 3 Step S1]** ✅ 完成（2026-04-11）— 封面系统：
  - commit `627fb9d`：`scripts/arweave/generate-covers.ts` seed 化 SVG 生成器 + `upload-covers.ts` 批量上链 + migration 008_score_covers
  - 100 张 SVG 封面（1000x1000 深色渐变 + 6 条 sine 波形 + 编号），`data/covers/` 走 gitignore
  - `data/cover-arweave-map.json` commit（100 个 Arweave txid）
  - `score_covers` 表 100 条记录，支撑 S5 FOR UPDATE SKIP LOCKED 最少使用优先复用池
- **[Phase 3 Step S0]** ✅ 完成（2026-04-11）— Arweave 工具链上线：
  - S0.a 骨架 commit `35aca7d`：`src/lib/arweave/` 子目录（index + core）+ CORS 实测脚本 + upload 骨架 + migration 007 + @ardrive/turbo-sdk 装包
  - S0.b 实产 commit `60c96ec`：激活 Turbo 上传 + 26 音效全部上链 + 5 tracks 回写 `arweave_url` + ARWEAVE_GATEWAYS 4→2 缩减 + scripts 重组进 arweave/ 子目录 + `_env.ts` helper + 充值工具链（generate-eth-wallet / wait-for-base-eth / topup-turbo）
  - S0.b 退役 commit `be4e07a`：`git rm` 一次性 generate-eth-wallet.ts
  - Turbo 钱包 `0xdE788249...9Fba8`（Base），充值 0.00396 ETH → 3.3T winc
  - 硬门槛 CORS smoke 2/2 通过（真验证推迟到 S6）
- **[Phase 2.5]** ✅ 完成（2026-04-10）— Flow Hardening Sprint：DB 唯一索引 + server-only + TTL 统一 + AudioContext 延迟加载 + 录制时钟统一 + verify.sh 纳入 build + completion review 修复（useJam 状态机 + startedAt 清理）
- **[Phase 2]** ✅ 完成（2026-04-10）— 首页合奏 + 草稿系统 + 爱心收藏，merged 回 main。Track A（后端 API）+ Track B（前端 Codex）+ Track C（集成+验证+CTO review 修复）
- **[Day 1]** 文档骨架首版：13 markdown（含 1 个 phase-0 playbook）+ 3 hooks + 3 scripts
- **[Day 1 续]** 学习机制补丁：SessionStart hook + Stop hook + QUICKSTART.md + check-folder-size 加项目根例外
- **[Day 1 续 2]** 决策日志机制：新建 docs/JOURNAL.md + AGENTS §4 第 4 步追加规则
- **[Day 2 大整修]**（commit `e6da1b1` / `0576d81` / `1f13aac`）
  - ARCH 从 782 行压缩到 410 行 + 12 条核心架构决策 + AI 编码约定安全网
  - 新增决策 13：Score Decoder 是 Phase 3 核心组件（用户原话"网页唱片机"已抄进 ARCH）
  - **全面切到 Optimism**：链 11155111 (Sepolia) → 11155420 (OP Sepolia)，单笔成本 ~$0.78 → < $0.01（用户实测），$500 预算从 ~577 张提升到 50000+ 张
  - 删 daily mint limit + gas price guard（OP 上不需要），保留 allowlist + balance alert
  - playbook 从 768 行压缩到 496 行 + Step 5 改用 OZ 现成合约 + 中场休息点
  - hook 修 grep 误判 + ESLint 隐藏地雷 + 220 行硬线 + route.ts 270 + api/** 子树豁免
  - AGENTS 加 3 名映射 + 越界停 + 复述代码规则
  - 新增 INDEX.md / PROMPT-TEMPLATE.md / learn.sh
- **[Phase 0 Step 0]** ✅ 完成（2026-04-09）— 项目改名 Ripples in the Pond + GitHub rename + 3 外部账号注册 + .env.local 10 key 填齐 + 测试钱包生成并领 OP Sepolia faucet + doctor.sh 26 ✅ / 2 ⚠（Foundry）/ 0 ❌ + checkpoint `checkpoint/2026-04-09-1226`
- **[Phase 0 Step 1]** ✅ 完成（2026-04-09）— 全屏黑底 + 中央白字 "Ripples in the Pond"，commit `6523c60`
- **[Phase 0 Step 2]** ✅ 完成（2026-04-09）— 呼吸圆 Island + useAudioPlayer hook + 点击播放/停止 mp3，commit `eb1d7fb`
- **[Phase 0 Step 3]** ✅ 完成（2026-04-09）— Privy 邮箱登录 + LoginButton + console 打印 evm_address，commit `8ac1eaf`
- **[Phase 0 Step 4]** ✅ 完成（2026-04-09）— Supabase 建 users + mint_queue 两张表，commit `e0105f5`
- **[Phase 0 Step 5]** ✅ 完成（2026-04-09）— MaterialNFT 部署 OP Sepolia `0xdeC99da...1f02A`，commit `0a3ee93`
- **[Phase 0 Step 6]** ✅ 完成（2026-04-09）— POST /api/mint/material 幂等写队列 + Supabase 确认，commit `b4fdc2a`
- **[Phase 0 Step 7]** ✅ 完成（2026-04-09）— cron 处理器上链成功，tx `0xe4ae06a...ec9b1d`，commit `3c93a1c`
- **[Phase 0 Step 8]** ✅ 完成（2026-04-09）— 全链路验证通过：登录 → API → 队列 → 链上 mint → Etherscan 确认
- **[Codex Review]** ✅ 完成（2026-04-09）— 两份 review 产出 + 延后清单
- **[Phase 0 Review Fix]** ✅ 完成（2026-04-09）— 原子抢单 / 失败补偿绑 job.id / 并发幂等 / 登出恢复，commit `3906f1f`
- **[Phase 1 Track A]** ✅ 完成（2026-04-09）— tracks + mint_events 表 / 自定义 MaterialNFT `0x99F808...b7C` / GET /api/tracks + [id] + /me/nfts + /health
- **[Phase 1 Track B]** ✅ 完成（2026-04-09）— 首页岛屿列表 / 底部播放条 / 个人页骨架
- **[Phase 1 Track C]** ✅ 完成（2026-04-09）— merge + 适配层切换 + 铸造按钮 + 个人页真实数据 + e2e
- **[Phase 1 CTO Review]** ✅ 完成（2026-04-09）— review 产出 + P0 修复（铸造唯一性 / mint_events 约束 / 配色对齐）
- **[Phase 2 Step 0]** ✅ 完成（2026-04-10）— Web Audio spike 4/4 标准通过 + Tailwind v4 白名单修复 + globals.css 回写根因定位（Cursor git checkout）

---

## 📝 任务格式说明

每个任务理想格式（参考 `playbook/phase-0-minimal.md` 里完整版）：

```
[Phase X Step N] 一句话目标
- 范围: 允许改的文件
- 禁止: 不能碰的文件
- 完成标准: 看到什么算成功
- 验证命令: 怎么验证
- 回滚点: 失败时回到哪
```

简短任务可以只写一行目标。
