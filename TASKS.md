# TASKS — 任务看板

> Now / Next / Later / Done / Blocked
> 一次只允许 1 件事在 Now，AI 完成一件就移到 Done 并提拔下一件到 Now。

---

## 🎯 Now（最多 1 件，AI 正在做的）

- **待用户线下实测 B4a**（B2 + B3 代码已合并 2026-05-15）。走 `docs/SEMI-DEMO-SCRIPT.md §一` 的 7 步流程后告诉我结果，包括边界场景（错码 / 60s 重发 / JWT 过期 / 双源切换）。Track A 下一步建议 A3+A12 score queue 状态机修复包（与 B4a 实测可并行，不互相阻塞）。

---

## ⏭ Phase 7 启动序列（2026-05-13 重定）

Phase 7 playbook：`playbook/phase-7/overview.md` + 3 个 track 子文档（覆盖重写，三方 review 整合）

### Track A — 修严重 BUG（10-11 天 / 14 有效 step）
- [x] A1 chain 配置抽单一来源（🔥 MEGA P0，Track A 起点）
- [x] A2 AirdropNFT v2 加 `_uriSet` + 重新部署 OP Sepolia `0xC5923BEc...EF65`（2026-05-15）
- [ ] A3+A12 score queue 状态机修复包（双 mint 防御 + lease 25min 根因；A14/A15 前置）
- [ ] A4 MAINNET-RUNBOOK grantRole 验收命令
- [ ] A5 换 Turbo wallet（恢复 generate-eth-wallet.ts + 新 EOA + 充值）
- [ ] A6 **20 曲** arweave_url 全量上链（含 B6.1 子任务，等艺术家给 15 首新 mp3）
  - A6.0 资产盘点（audit-tracks.ts，确认缺哪几首）
  - A6.1 B6.1 数据扩容（migration 030 + sphere-config A=20 + SphereNode badge 双位数）
  - A6.2 上传 15 首新 mp3 到 Arweave + UPDATE tracks.arweave_url
- [ ] A9 vercel-env-sync 脚本（仅 key + NEXT_PUBLIC_* 比对）
- [ ] A10 /score 链上灾备 UI 降级壳
- [ ] A13 useEventsPlayback 首播 decode 时序
- [ ] A14 5s 乐观成功诚实文案 + auto-polling（C3 后做）
- [ ] A15 useMintScore 失败回滚（C3 后做）
- [ ] A16 operator-lock TTL + Lua 心跳 + fail-closed
- [ ] A17 mint_events upsert 失败检查
- [audit] A11 ✅ 已修 commit `0d75a93`（仅 curl audit）
- [audit] A18 ✅ 已修 commit `0d75a93`（仅 grep audit）
- [挂 P10] A7 operator wallet 主网 ETH 充值
- [挂 P10] A8 Resend 告警（避占位）
- [挂 P10 / 运营] A6 剩余 88 曲（艺术家长期补曲，不阻塞 P7）

### Track B — Semi 社区钱包前端接入（2-3 天 / 5 step，PoC-only）
- [x] B1 SEMI_API_URL env 同步（local + .env.example commit `65516d0`；Vercel 三环境 2026-05-15 已添加）
- [x] B2 SemiLogin 组件 + LoginModal 两 tab（2026-05-15）
- [x] B3 useAuth hook 双源化（Privy / JWT）+ 4 caller 改 openLoginModal + Providers 挂 modal（2026-05-15）
- [ ] B4a 端到端技术冒烟（待用户线下实测；按 `docs/SEMI-DEMO-SCRIPT.md §一` 走 7 步；A1 完结后只需重跑步骤 5-6 = 10 分钟回归）
- [ ] B4b 投资人 demo 协调（演示话术 + 现场踩坑预案见 `docs/SEMI-DEMO-SCRIPT.md §二/三`）

### Track C — 全站提速（约 3-4 天 / 7 step）
- [x] C1 Lighthouse baseline（修前 baseline 已产出：`reviews/2026-05-14-phase-7-perf-baseline.md`）
- [x] C2 四个体感目标 + ROI 准则（2026-05-15 已吸收进 playbook，不再单独阻塞）
- [x] C3 /api/me/scores 拆 split（A14/A15 前置；`light=1` 首屏不拉 events_data，DraftCard 播放按需拉 events）
- [x] C5 首页慢网占位 + spinner + 重试（LoadingState + RetryButton；命中 / 0.8s 反馈）
- [x] C6 字体加载温和优化（5 个 next/font 显式 display swap + preload；不做激进字体裁剪）
- [x] C7 路由 transition + loading.tsx 骨架（/me、/artist、/score/[id]，命中唱片 1s 反馈）
- [x] C8 Lighthouse + 手动体感对比报告 + 重测 buffer（2026-05-15 报告：`reviews/2026-05-15-phase-7-perf-completion.md`；未达标项 downgraded-accepted，后续归 A10/P8/P10）
- [x] C9a `/me` 内容区首屏轻量化（三 fetch 并行；ScoreNftSection + DraftSection 加 error 态；单 section 失败不阻塞其他；本地实测通过）
- [x] C9b `/score/[id]` 详情页首屏轻量化（`getScoreById` 加 React `cache()` dedupe；首屏 SELECT `event_count` 替代 `events_data`；新增公开 endpoint `/api/scores/[id]/events` + ScorePlayer 改挂载时 fetch；本地实测通过）

### Track 依赖图（2026-05-13 修订）

```
A1 ─────────────► (Track A 内部 A2 / A3+A12 / A4 / A5 / A6 / ...)
A3+A12 ─────────► A14 ─► A15
B1 ─► B2 ─► B3 ─► B4a ─► B4b
                  ↑
                  └─ 临时硬编码 chain，A1 完结后重测 10 分钟
C3 ─────────────► A14 ─► A15（polling 契约）
C1（修前 baseline）─► C2（四个体感目标 + ROI，已完成）─► C3-C7 ─► C8（修后对照）
```

**A1 / B1 / C1 是 3 个 Track 起点，完全独立可并行**。C1 跑两次（修前 baseline + 修后对照报告），不再卡 A3+A12。B4a 接受临时硬编码 chain 做冒烟，A1 完成后重测一次。

---

## ✅ Phase 6 v2 历史归档（已完结，2026-05-08）

Phase 6 v2 playbook：`playbook/phase-6/overview.md`（已完结，仅保留追溯；当前执行权威见上方 Phase 7 启动序列）

### 步骤 0：v2 缩减 doc 改写 ✅ 完成（2026-05-03）

- [x] track-b-ui-redesign.md 重写（13→7 step，删 B2.0-B2.5 流水线，加 B6+B7）
- [x] overview.md 时间线 5-6 周→3-5 天 + 完结标准加 B7 / P7 候选
- [x] STATUS.md 当前阶段 + 进度 + Phase 7 候选清单 + 悬空 TODO
- [x] JOURNAL.md 加 2026-05-03 段（v2 缩减决策 + 艺术家反馈 5 条）
- [x] ARCHITECTURE.md §11 Phase 6/7 描述同步

### 步骤 1：B6 实施 ✅ 完成（2026-05-04）

- [x] migration 027（tracks 加 published）+ migration 028（5 行循环 + 安全 DELETE 加 score_queue_id IS NULL 过滤）
- [x] 用户复制 5 个 mp3 → `public/tracks/No.1.mp3 ~ No.5.mp3`
- [x] Modak 气球字引入 layout.tsx + body className
- [x] SphereNode 删下方 label，加内嵌数字 badge（位置 0.55r,0.55r / 字号 1.26r / fill rgba 白 0.32→hover 0.55）
- [x] sphere-config 加 getGroupTargetCount 抽象（A=5 / B=C=36），SphereCanvas + Archipelago + nav 都用
- [x] mock-tracks 5 行补 published（TS 类型完整性）
- [x] /api/tracks + /api/tracks/[id] SELECT 加 published
- [x] 浏览器验证：5 球 / 36 球 + 数字 badge 稳定显示

### 步骤 2：B2 修 /me /score /artist ✅ 实质收口（2026-05-08）

Bug A/B 由 B8 数据流重设解决（不是单点修补，是整体重设）：
- [x] **Bug A** "录制铸造不更新" → B8 P1 5s 乐观成功 + P2 唱片对齐 DB（commit 63c807a / 38f7f37）
- [x] **Bug B** "录制上传中卡住" → B8 P1 mint_score_enqueue RPC 不再标 expired + P2 草稿入队即消失（commit 397defe / 63c807a）
- [x] **Bug C** 主链路 5/6 双根因修复（wallet purpose 中文 / Vercel env typo）
- [x] **B8 P3** 路由双兼容 + ScorePlayer 前端 inline + 端到端实测 token_id=12（2026-05-08）

剩余在 B7 端到端冒烟时若发现新 bug 再起新 step。

### 步骤 3：B5 前端韧性 ✅ 实质完成（2026-05-08 audit 发现）

- [x] **#7** tracks ISR + degraded header + Archipelago 占位（`app/api/tracks/route.ts:15` + `Archipelago.tsx:133`）
- [x] **#9** localStorage 损坏自愈（`src/lib/draft-store.ts` isValidDraft + try/catch）
- [废弃] **#8** 移动端首帧 — HomeJam 已 dead-code（references/dead-code/jam/HomeJam.tsx），主页改用 Archipelago，原 step 失效；移动端体验挂 P7 UI 重设计

### 步骤 4：B3 草稿铸造 ✅ 实质完成（2026-05-08 audit + 5/8 实测验证）

- [x] `src/data/jam-source.ts` mintScore 函数已实施
- [x] `src/hooks/useMintScore.ts` hook 已实施
- [x] `src/components/me/DraftCard.tsx` 铸造按钮 + 4 态显示（idle/queued/success/上传中）
- [x] 端到端实测：queue 778a2904 → token_id=12（commit `40cf61d` JOURNAL 5/8 段）

### 步骤 5：Track A 剩余 + D2 + E4 + E5 ✅ 实质完成（2026-05-08 audit）

- [x] **A0** operator 锁（`src/lib/chain/operator-lock.ts`，3 个 cron 入口都包装）
- [x] **A1** ScoreNFT cron durable lease + uri_tx_hash 拆步（migration 024 + steps-set-uri.ts）
- [x] **A3** sync-chain-events cursor 事务性（`sync-chain-events/route.ts:55+`，注释明确"Phase 6 A3"）
- [x] **A4** 草稿保存原子化（migration 025 `save_score_atomic` RPC + score/save/route.ts:101）
- [挂 P7] **A5** /score/[id] 链上灾备 — B8 P3 删 score-fallback.ts noop 残留，灾备方案待 P7 重新设计
- [x] **D2** admin Bearer 鉴权（`/api/airdrop/trigger` `verifyAdminToken`，注释"Phase 6 D2 改"）
- [废弃] **E4** Decoder 多网关 fallback — B8 P3 删 decoder iframe，详情页改前端 inline 播放，E4 设计目标已不存在；OpenSea 端单网关风险接受（主网用 ario.permagate.io）
- [x] **E5** 文档口径对齐（本次 commit）

### 步骤 6：B7 端到端冒烟 ✅ 完成（2026-05-08）

- [x] 19 项 smoke 清单 16/19 通过 + 0 P0 + 0 P1
- [x] 产出 `reviews/2026-05-08-phase-6-completion-smoke-test.md`
- [x] 产出 `reviews/2026-05-08-phase-6-completion-review.md`
- [x] Phase 6 v2 完结，进入 Phase 7 范围重定

### 历史完成（v1 阶段，保留追溯）

#### 历史步骤 0：产品决策冻结 ✅ 完成（2026-04-25）

- [x] **A6** — `/me` 语义 = **"我铸造的"（保持现状）**
- [x] **D1** — 主网**不做空投**（D2 admin header 仍做，D3-D5 挂起）
- [x] **E2** — Semi 登录**挂 Phase 7**（主网首版 Privy-only）

决策详情：`docs/JOURNAL.md` 2026-04-25 收尾段落
findings 状态更新：`reviews/phase-6-findings-tracker.md`（7 项 deferred-justified/downgraded-accepted）

#### 历史步骤 1：Track C 合约重部署 ✅ 完成（2026-04-25）

- [x] C1 ScoreNFT setTokenURI 防覆盖 + 重部署 → ScoreNFT v2 `0x1C47...832F`
- [x] C2 Deploy 脚本参数化 admin/minter + `docs/MAINNET-RUNBOOK.md`
- [x] C3 DeployOrchestrator 去测试 mint + 新建 `TestMintOrchestrator.s.sol`
- [x] C4 TBA 开关删除 + 重部署 Orchestrator → Orchestrator v2 `0x8A6D...C3a8`
- 代码 commit `086167d` + 链上 broadcast 记录 + 归档 `reviews/phase-6-deprecated-contracts.md`
- **待办**：Vercel env 同步 + Redeploy + cron-job.org 5/5 在 v2 下 ≥ 5 分钟全绿（task #7）

#### 历史步骤 2：Pre-tester Gate ✅ 完成（2026-04-26）

- [x] **G0** 运营就绪检查 — /api/ping + /api/health + cron 5/5 + 14 项 env + 真实 smoke
- [x] **A2** material failed 分类重试（`failure_kind: safe_retry / manual_review`，commit `8074d18` + migration 021）
- [x] **B1** NFT localStorage 按 userId 隔离（commit `c749b67`）
- [x] **E1** `/api/health` 暴露 mintQueue { failed / stuck / oldestAgeSeconds }（commit `f0725df`）
- 附加修复：useFavorite 改回乐观 UI（commit `931f45f`，G0 第 5 项暴露的体验问题）
- 附加：memory 拆 feedback/ + project/ 子目录（解 8 文件硬线）

✅ 限定范围 tester 可以放人

---

## ✅ Phase 6 并行 tracks 历史归档

2026-05-08 audit + B7 冒烟 + completion review 后，Phase 6 v2 已完结。Phase 6 的 A/B/C/D/E track 仅作追溯，不再作为当前 Next。

---

## ⏭⏭⏭ 之后（2026-05-13 重定，四段拆分）

- **Phase 7（当前）** — 修严重 BUG + Semi 社区钱包 + 全站提速（详上面 Phase 7 启动序列）
- **Phase 8** — UI 大升级（艺术家反馈 5 条 + Claude Design 接入 + /me /score /artist 深度重设计）
- **Phase 9** — 按键动画 + 音效系统扩展 26 → 50（含 P1-21 useEventsPlayback decode 时序）
- **Phase 10** — 性能深度优化 + 上线检查 + OP Mainnet 部署 + 首周救火

延后项清单：`reviews/phase-0-deferred.md` + `reviews/phase-1-deferred.md` + `reviews/2026-04-24-phase-5-s5-smoke-test.md`

**主网前必做**（统一进 Phase 10 起点清单）：
- Deploy 脚本 admin/minter 分离 + save draft 事务化（见 `reviews/2026-04-10-phase-2.5-completion-review.md`）
- **Turbo credits 监控的阈值告警**
- AirdropNFT metadata 补完（Phase 4 Review P1）
- 换 CRON_SECRET（5/8 strict review 调试时在聊天泄露）
- A7 operator wallet 主网 ETH 充值
- A8 Resend 告警真接 cron + 基础设施
- 9 项 strict review P1（详 `reviews/2026-05-13-phase-7-playbook-review.md` 末尾"不在 P7 范围"段）
- A3 长期方案：idempotency key + simulateContract（替换 P7 短期防重发方案）

---

## 🚧 Blocked

- **Phase 4A S3** — 前端登录按钮 + useAuth 兼容 + 端到端验证
  - **阻塞原因**：Semi 团队在设计 OAuth 开放登录，现有 API 不确定对外开放
  - **已完成的前置**：S0 JWT 基础设施 ✅ / S1 双验证中间件 ✅ / S2 后端登录端点 ✅
  - **续做时要改的**：`src/lib/semi-client.ts`（适配 OAuth 流程）+ 新建前端登录组件
  - **解除条件**：Semi 团队提供 OAuth 文档或确认现有 API 可用

---

## ✅ Done

- **[Phase 7 Track A A2]** ✅ 完成（2026-05-15）— AirdropNFT v2 加 `_uriSet` 防 MINTER 私钥泄露后改 metadata：
  - **合约改动**：`contracts/src/AirdropNFT.sol` 复制 ScoreNFT v2 那 7 行 `_uriSet` mapping + setTokenURI `require(!_uriSet[tokenId])` + 标 `_uriSet[tokenId]=true`
  - **测试**：`contracts/test/AirdropNFT.t.sol` 加 `testSetTokenURIOnlyOnce` — 首次 setTokenURI 成功 → 二次同 tokenId revert `"AirdropNFT: URI already set"` → URI 保持首次值；forge test 7/7（原 6 + 新 1）
  - **链上部署**：OP Sepolia 简化模式（deployer = admin = minter `0x306D3A...1633`），新 v2 `0xC5923BEc5C79a203b0cf4ab7c82567c8E20eEF65`，部署 tx `0xe05fafc3ccd3c9df4301f16fc4fa1d2cdf32d96d89e68bd59b49d1b674c37f06`
  - **原子流程**（严格按 D-A2）：cron-job.org `process-airdrop` Inactive → forge 部署 → Vercel env 三环境同步 → manual redeploy（不带 Build Cache）→ `pond-ripple.xyz` 验证 → 才 commit 归档
  - **归档**：`reviews/phase-6-deprecated-contracts.md` 加 2026-05-15 段（v1 `0xa6Aa896b...e56B` → v2 对照表）；本地 `.env.local` 替换 + 顺手清理一个未文档化的本地谜地址 `0xf8e269818A...`
  - **验证**：forge 7/7 / scripts/verify.sh 全绿（TS / ESLint / 行数 / build 28 路由）/ Vercel build 通过 / pond-ripple.xyz 正常打开
  - **回滚不可行**：v1 因有漏洞**不能回退使用**，即使本次发现新问题正确路径是再部署 v3；AIRDROP_ENABLED 在主网保持 unset 阻断所有 cron
  - **playbook 偏差 flag**：原 D-A2 写"等 /api/health airdrop 字段返新地址"实际不返，改用 Vercel UI + 浏览器源码验证；下次 playbook 修订时去掉这一行或加 health endpoint 字段

- **[Phase 7 Track C C9a + C9b]** ✅ 完成（2026-05-15）— `/me` + `/score/[id]` 首屏内容轻量化：
  - **C9a `/me` 内容区**：`app/me/page.tsx` 三 fetch（score-nfts / nfts / scores）改并行；之前 scores 串在 saveScore loop 后 await，最坏 N×saveScore 叠加
  - **C9a section error 态**：`ScoreNftSection` + `DraftSection` 加 `error?: boolean` prop，单 section 失败显示红条不阻塞其他；EmptyState 错误态下不显示
  - **C9b R1 cache()**：`getScoreById` 加 React `cache()` 包装，metadata + page 同 request 内只跑一次 DB 链路（8 → 4 个 roundtrip）
  - **C9b R2 不拉 events_data**：pending_scores 改 SELECT `event_count`（migration 031 generated column）；删 `ScorePageData.events` 字段，首屏 HTML 不再阻塞大 JSON
  - **C9b R3 公开 events endpoint**：新建 `src/data/score-events-source.ts`（双兼容路由）+ `app/api/scores/[id]/events/route.ts`（公开 GET，middleware 已注释 `/api/scores/*` 公开只读）；`ScorePlayer.tsx` 改为挂载时 fetch events，三态 loading（按钮 disabled）/ error（红条）/ ready
  - **验证**：TS 0 errors / ESLint 通过 / build 28 路由（新增 `/api/scores/[id]/events`）/ 用户本地浏览器实测 `/me` + `/score/[id]` 首屏体感 + ScorePlayer 三态 + 双兼容路由（tokenId 数字 / queue.id UUID）全过
  - Track C 全套（C1-C9）收口

- **[Phase 6 B8 /me 数据流重设]** ✅ 完成（2026-05-07 → 2026-05-08，3 个阶段 + 实测 + agent review 13 finding）：
  - **Phase 1**（commit `397defe` + `63c807a`）：5s 乐观成功 + 草稿入队即消失 + mint_score_enqueue RPC 不再标 pending_score expired
  - **Phase 2**（commit `38f7f37`）：草稿可播放（▶ 按钮 + useEventsPlayback hook）+ 唱片对齐 DB（删 mint_events 依赖 / queue 单一数据源）
  - **Phase 3**（本次 commit）：路由 `[tokenId]` → `[id]` 双兼容（数字 token_id / UUID queue.id）+ ScorePlayer 改前端 inline（PlayerProvider.toggle + useEventsPlayback 替代 Arweave decoder iframe）+ score-fallback.ts 删除（noop 残留）+ score-source.ts 多项防御（isSafeInteger / order().limit() / Promise.allSettled / cover try-catch / pendingRes error log）+ ScorePlayer 文案 "无事件数据" + useEventsPlayback seek 假设注释
  - **副产品**：B6 demo 5 球 arweave_url 上链回写（5 个 mp3 上 Arweave + UPDATE tracks，原 P7 task 提前消化）+ B4 删除（PlayerProvider loadingRef 早已实施）
  - **端到端验证**：queue 778a2904 走完 5 步状态机 → token_id=12 上链（tx_hash 0xea5b... + uri_tx_hash 0x5ddb... + metadata Arweave bJeCGDtZ...）+ 详情页前端 inline 播放正常
  - **Agent review 13 finding**：5 项本次合入修（P0×3 + P1×2）+ 8 项挂 P7（已加 STATUS 悬空 TODO）

- **[Phase 6 B6 实施]** ✅ 完成（2026-05-04）— A 组 5 球 + B/C 36 球 demo 上线：
  - migration `027_tracks_add_published.sql`（tracks 加 published BOOLEAN + 部分索引）
  - migration `028_b6_seed_data.sql`（week 1-5 标 published / 36 行循环 audio_url 到 No.1-5 / 安全清旧 mint 加 score_queue_id IS NULL 过滤避免误伤 ScoreNFT）
  - Modak 气球字（next/font/google）引入 layout.tsx + body className 挂 --font-modak variable
  - SphereNode：删球下方原 azeret label / 加内嵌 SVG text 数字 badge（位置 0.55r,0.55r 偏右下九宫格中心向球心收 30% / 字号 1.26r / fill #ffffff fillOpacity hover 0.32→0.55 / pointerEvents none / transition fill-opacity 0.25s）
  - sphere-config 抽 `getGroupTargetCount(gid)` 函数（A=5/B=C=36），SphereCanvas 删 TARGET_NODE_COUNT 常量 / Archipelago 预热 + nav badge 都用 getGroupTargetCount
  - mock-tracks 5 行补 published: false（TS 类型完整性）
  - /api/tracks + /api/tracks/[id] SELECT 加 published
  - 验证：TS 0 errors / npm run build 通过 / 浏览器实测 5 球 36 球数字稳定显示
  - 调试历史：先字号 0.42r 太小 → *3 改 1.26r → radius >= 14 阈值导致 20-30% 球随机分到深层时数字消失 → 移除阈值

- **[Phase 6 Pre-tester gate 收口]** ✅ 完成（2026-04-26，4 commits）— 4/4 全绿 + 1 项体验回滚 + memory 重组：
  - **G0** 运营就绪验证全过（health 返 db=ok / wallet=low-but-ok / cron 5/5 / env 14 项齐 / 收藏 smoke 通）
  - **B1** `c749b67` — NFT localStorage 按 userId 隔离（nft-cache 5 函数全加 userId 参数 + useAuth.logout 清当前用户 cache + Archipelago/me 监听 userId 变化重读，queueMicrotask 避 React 19 set-state-in-effect lint）
  - **E1** `f0725df` — `/api/health` 加 mintQueue { failed / stuck / oldestAgeSeconds }（3 query Promise.all 并行，无 migration）
  - **A2** `8074d18` — mint_queue failure_kind 字段 + 4 处 markFailed 分类（migration 021）+ /api/mint/material 23505 按 status/failure_kind 分流 + useFavorite 处理 409 needsReview
  - **附加** `931f45f` — useFavorite 改回乐观 UI（部分反转 Phase 5 严格 review 1019dcb）：用户在 G0 验证暴露 3-10 秒等待，确认 Phase 2 原始要求"乐观 + 失败 ops 兜底"，存 memory `feedback/optimistic_ui_with_rollback`
  - **附加** memory/ 9 文件超 8 硬线 → 拆 feedback/ + project/ 子目录（root 减到 3 entries）

- **[Phase 6 Track C 收口]** ✅ 完成（2026-04-25，commit `086167d`）— 合约 & 部署硬化：
  - C1 ScoreNFT `_uriSet` mapping + setTokenURI 仅首写一次（防 MINTER_ROLE 私钥被盗后改 metadata）
  - C2 4 个 Deploy 脚本参数化 ADMIN/MINTER/DEPLOYER（`vm.envOr` 测试网零配置回退）
  - C3 DeployOrchestrator 删测试 mint，新建 `TestMintOrchestrator.s.sol`
  - C4 MintOrchestrator 删 `tbaEnabled` + `_maybeCreateTba` 空钩子（D-C3 决策）
  - ARCH 决策 6 / 7 / MintOrchestrator 描述 / 决策表 4 处 TBA 语义同步
  - 新建 `docs/MAINNET-RUNBOOK.md` + `scripts/load-env.ps1`（PowerShell 加载 `.env.local` for forge）
  - 重部署：ScoreNFT v2 `0x1C478F9F5b66302A35a0178e07df67BA343c832F` + Orchestrator v2 `0x8A6Dd0Ecf108797358CC369bC6F263D2C89BC3a8`
  - 23/23 forge test + verify.sh 全绿
  - 归档 `reviews/phase-6-deprecated-contracts.md`

- **[Phase 5 收口]** ✅ 完成（2026-04-25）— 测试网公开版部署 + 两轮 review 修复：
  - commits: `1bb1b05`（第一轮 review P0 修复）/ `ddda82c`（bug #6 文档修订）/ `1019dcb`（严格 CTO review 修复）
  - 线上地址：`https://pond-ripple.xyz`（Vercel Hobby + cron-job.org 5 个 job）
  - 代码侧所有 tester 前 blocker 已修（11 项 bug）
  - 三份 review：`reviews/2026-04-24-phase-5-s5-smoke-test.md` + `reviews/2026-04-24-phase-5-completion-review.md` + `reviews/2026-04-25-phase-5-strict-cto-review.md`
  - 决策日志：`docs/JOURNAL.md` 2026-04-25 段落
  - 限定 tester 范围：素材收藏 + 个人页 + artist + 已铸造乐谱回放（不含草稿铸造 + 空投）
- **[Phase 5 S5]** ✅ 完成（2026-04-24）— 冒烟测试 10/12：
  - 12 项清单：基础可达 A1-A4 全绿 / 核心业务 B5-B8+B10 全绿（B9 乐谱铸造 UI 按钮未实现，延后 Phase 6）/ 安全 C11 全绿（C12 rate limit 失效，bug #6 待修）
  - 详细 review：`reviews/2026-04-24-phase-5-s5-smoke-test.md`
  - 6 个 bug 已分类：3 个测试前必修（#2 #3 #6）+ 2 个 Phase 6 一起做（#1 #5）+ 1 个忽略（#4）
- **[Phase 5 S4]** ✅ 完成（2026-04-15 → 2026-04-24）— 域名 + Vercel + cron-job.org：
  - 域名 `pond-ripple.xyz` 已绑（Vercel 代管）
  - Vercel 部署 `4d35e80` + `daf73c1`（middleware Upstash 初始化容错修复）
  - cron-job.org 5 个 job 运行中：process-mint-queue / process-score-queue（1min）/ process-airdrop（2min）/ sync-chain-events（5min）/ check-balance（1hour）
  - 5/5 cron 绿灯（process-score-queue 曾 308 被用户发现并自行修正 URL）
  - 环境变量全量迁移到 Vercel（含 TURBO_WALLET_JWK / UPSTASH_*）
- **[Phase 5 S0-S3]** ✅ 完成（2026-04-15）— 代码准备（commit `4d35e80`）：
  - S0 Cron 鉴权迁移（query param → Authorization header，`src/lib/auth/cron-auth.ts` 新建 + 6 个 cron 路由迁移）
  - S1 Cron 拆步（process-mint-queue + process-airdrop 两步状态机，每步 < 5 秒）
  - S2 Turbo 钱包环境变量化（TURBO_WALLET_PATH → TURBO_WALLET_JWK，修 `src/lib/arweave/core.ts`）
  - S3 公开 ping + Upstash rate limit + 404/error 页（`app/api/ping/route.ts` + `middleware.ts` + `app/not-found.tsx` + `app/error.tsx`）
  - src/lib 目录重组：contracts.ts / operator-wallet.ts → chain/ 子目录，privy.ts / semi-client.ts → auth/ 子目录
- **[Phase 4C S6]** ✅ 完成（2026-04-13）— AirdropNFT + 空投系统：
  - `contracts/src/AirdropNFT.sol`（ERC-721，独立部署，symbol RIPA）
  - `contracts/test/AirdropNFT.t.sol`（6/6 测试通过）
  - `supabase/migrations/phase-4/018_airdrop_rounds.sql` + `019_airdrop_recipients.sql`
  - `src/types/airdrop.ts`（类型定义）
  - `src/lib/contracts.ts`（新增 AIRDROP_NFT ABI）
  - `app/api/airdrop/trigger/route.ts`（管理员触发 + chain_events owner 快照）
  - `app/api/cron/process-airdrop/route.ts`（逐个铸造 + 幂等 + 超时回退）
  - verify.sh 全绿
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
