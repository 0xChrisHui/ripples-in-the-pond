# STATUS — 项目当前状态

> 给"人 + AI"共用的状态面板。每完成一个小闭环都要更新。

---

## 当前阶段

**Phase**: **Phase 6 v2 已完结**（2026-05-08）→ **Phase 7 范围重定 @ 2026-05-13**：修严重 BUG + Semi 社区钱包前端接入 + 全站提速（14-18 天）
**Phase 拆分（2026-05-13 决策，旧 5/8 三段作废）**：
  - **Phase 7**（当前）= 修严重 BUG + Semi + 提速
  - **Phase 8** = UI 大升级（艺术家反馈 5 条 + Claude Design 接入）
  - **Phase 9** = 按键动画 + 音效系统扩展 26 → 50
  - **Phase 10** = 性能深度优化 + 上线检查 + OP Mainnet 部署 + 首周救火
**playbook 7**: `playbook/phase-7/overview.md` + 3 个 track 子文档（track-a-bugs / track-b-semi / track-c-perf），三方 review 整合后版本（commit 待 push）
**P7 三方 review**：`reviews/2026-05-13-phase-7-playbook-review.md`（Claude 自审 + 2 个 Codex review，16 项必修已全部落地）
**Phase 6 Completion**: `reviews/2026-05-08-phase-6-completion-review.md`（含旧 10 项硬阻塞清单，已在 P7 Track A 里重新拆分归宿）
**P6 Smoke Test**: `reviews/2026-05-08-phase-6-completion-smoke-test.md`（16/19 通过 + 0 P0 + 0 P1）
**stakeholder 反馈**：艺术家 5 条反馈已收到（→ Phase 8）；投资人催 Semi demo（→ P7 Track B PoC-only）

## 当前进度

**做到哪**：Phase 6 v2 完结 + Phase 7 启动准备 commit `346d526` 完成。**2026-05-14 A1 已提交 `e0084db`**：chain 配置单一来源完成。**B1-local 已提交 `65516d0`**：`.env.local` + `.env.example` 已加 `SEMI_API_URL=https://semi-production.fly.dev`；B1-vercel 待用户在 Vercel 三环境线下添加。**C1 Lighthouse baseline 已产出**：`reviews/2026-05-14-phase-7-perf-baseline.md`。**2026-05-15 C3 已完成本地验证**：`/api/me/scores?light=1` 不再拉 `events_data`，DraftCard 点击播放时按需拉 events endpoint。**C5 已完成本地验证**：首页空数据/慢网态改为 spinner + 慢网提示 + 手动重试。**C6 已完成本地验证**：5 个 next/font 都显式 `display: "swap"` + `preload: true`，未做激进字体裁剪。**C7 已完成本地验证**：`/me`、`/artist`、`/score/[id]` 增加 loading.tsx 骨架；verify 通过。**C8 已产出对比报告**：`reviews/2026-05-15-phase-7-perf-completion.md`，Track C 按 downgraded-accepted 收口。**2026-05-15 C9a 已完成本地实测**：`/me` 三个 fetch（score-nfts / nfts / scores）改并行触发；唱片区/草稿区独立 skeleton + error 态，单 section 失败不阻塞其他。**C9b 已完成本地实测**：`getScoreById` 加 React `cache()` per-request dedupe；首屏不再 SELECT `events_data`，改用 `pending_scores.event_count`；新增公开 endpoint `/api/scores/[id]/events` + ScorePlayer 改为挂载时 fetch events（loading / error / ready 三态）。Track C 全套（C1-C9）收口。**2026-05-15 A2 已上链 + Vercel + 归档**：AirdropNFT v2 部署 OP Sepolia `0xC5923BEc5C79a203b0cf4ab7c82567c8E20eEF65`（加 `_uriSet` 防 MINTER 私钥泄露后改 metadata），forge 7/7 + Vercel 三环境同步 + pond-ripple.xyz 验证通过；v1 `0xa6Aa896b...e56B` 永久弃用。

**下一步**（A2 后继续 Track A）—— 建议第一刀：
  1. **A3+A12 score queue 状态机修复包**（双 mint 防御 + lease 25min 根因，合并避免二次手术；含 migration 032 + 测试网 cron 验证）
  2. **B2 SemiLogin 组件 + LoginModal 两 tab**（Track B 下一步，等 B1-local 即可开工；B4a 仍等 B1-vercel）

**Track 依赖图（修订）**：
- A3+A12 → 阻塞 A14/A15（cron 状态机改完才能稳定 polling）；不再阻塞 C1
- C3 → 必须先于 A14/A15（polling 契约）
- C1 baseline → 已完成；C8 修后对照必须复用同样 4 页 × desktop/mobile × 2 次口径
- B4a 不再硬等 A1（接受临时硬编码 chain 配置做冒烟，A1 完成后重测 10 分钟）

**A6 范围缩水（2026-05-13）**：A6 = "20 曲 arweave_url 全量上链"（不是 108）。含 B6.1 子任务（A 组 5 球→20 球 / B+C 36 球 21-36 循环 1-16 / SphereNode badge 双位数）。剩余 88 曲挪 Phase 10 / 运营长期。

**用户说"开始 A1"** → AI 进 A1 概念简报 → slow mode 实施。

**Phase 8 / 9 / 10 计划**（已锁，不 P7 期间动）:
  - Phase 8 = UI 大升级（艺术家反馈 5 条 + Claude Design + /me /score /artist 深度重设计）
  - Phase 9 = 按键动画 + 音效系统扩展 26 → 50（含 P1-21 useEventsPlayback decode 时序）
  - Phase 10 = 性能深度优化 + 上线检查 + 换 CRON_SECRET + OP Mainnet 部署 + 9 项 P1 挂 P10 清单 + 首周救火

**已实质完成的步骤**：
- Phase 7 Track A：A1 chain-config 抽单一来源 ✅（commit `e0084db`）/ A2 AirdropNFT v2 加 `_uriSet` + 重新部署 ✅（2026-05-15）
- Phase 6 Track A：A0 operator 锁 ✅ / A1 ScoreNFT cron durable lease ✅ / A2 failure_kind ✅ / A3 sync cursor 事务性 ✅ / A4 草稿原子化 ✅ / A5 P7 / A6 决策冻结
- Track B：B1 cache 隔离 ✅ / B2 Bug A/B 由 B8 数据流重设实质收口 + Bug C 5/6 修 ✅ / B3 草稿铸造 + 5/8 实测 ✅ / B5 #7 ✅ #9 ✅ #8 废弃（HomeJam 已 dead-code）/ B6 ✅ / B7 待 / B4 删
- Phase 7 Track C：C1 Lighthouse baseline ✅（修前）/ C2 四个体感目标 + ROI 准则 ✅ / C3 split ✅ / C5 loading UI ✅ / C6 font swap/preload ✅ / C7 loading.tsx ✅ / C8 对比报告 ✅（downgraded-accepted）/ C9a /me 并行 + section error ✅ / C9b /score events 按需 fetch + cache() ✅
- Track C（Phase 6 历史）：C1/C2/C3/C4 ✅
- Track D：D1 决策不做 / D2 admin Bearer ✅ / D3-D5 挂起（D1=不做）
- Track E：E1 health mintQueue ✅ / E2 Semi P7 / E3 依赖 E2 P7 / E4 废弃（B8 P3 删 decoder iframe）/ E5 本次 ✅

**剩余**: Phase 6 v2（B7 冒烟半天 + completion review 半天 = **1 天**）→ Phase 7（OP 主网 + UI 深度重设计 + 音阶系统 + 监控 + 退出准备）

### Pre-tester gate 完成清单（2026-04-26）

- ✅ **G0** 运营就绪 — /api/ping + /api/health + cron 5/5 + Vercel env 14 项 + 真实账号收藏 smoke
- ✅ **B1** NFT localStorage 按 userId 隔离（commit `c749b67`）
- ✅ **E1** /api/health 暴露 mintQueue 失败/卡住聚合（commit `f0725df`）
- ✅ **A2** mint_queue failure_kind 分类重试（commit `8074d18`，migration 021）
- ✅ **G0 阻塞修复** useFavorite 改回乐观 UI（commit `931f45f`，部分反转 Phase 5 严格 review 1019dcb）
- ✅ memory/ 拆 feedback/ + project/ 子目录（root 9 → 3 entries 解 8 文件硬线）

### 主网承诺边界（Phase 6 D5 → Phase 7 用）

**主网首版包含**：Privy 邮箱登录 / 浏览 + 播放 108 曲 / 素材收藏 → MaterialNFT / 合奏录制 + 草稿 / 草稿 → ScoreNFT（B3 接通后）/ 已铸造乐谱回放 + 分享卡 / 个人页（"我铸造的"语义）/ 艺术家页

**主网首版不包含**：空投（D1 = 不做）/ Semi 社区钱包登录（E2 挂 Phase 7）

**主网首版不允许**：airdrop cron 定时运行 / airdrop trigger 端点对外暴露

### Phase 5 交付物（2026-04-25 收口）

- 域名：`pond-ripple.xyz`（Vercel 代管）
- 部署：Vercel Hobby（免费）+ cron-job.org（免费外部触发，5 个 job）
- API：/api/ping 公开 / /api/health 鉴权 / 404 + error 页 / cron 鉴权迁移到 Authorization header
- Arweave：Turbo 钱包环境变量化（TURBO_WALLET_JWK）
- 限流：middleware + Upstash Redis ✅ 线上验证 20/30 并发 → 20 次 429（2026-04-25 确认正常工作）
- Review 修复 commit `1bb1b05`：post-send rollback × 2 + markSuccess 改序 + 并发 CAS + 日志观测 + LoginButton + check-balance 状态枚举
- 第二轮严格 CTO review 修复（本次 commit）：material mint 稳定 idempotencyKey 防并发 + useFavorite 改悲观回退 UI
- 冒烟测试文档：`reviews/2026-04-24-phase-5-s5-smoke-test.md`（bug #6 部分已修订为误判）
- 完成 review：`reviews/2026-04-24-phase-5-completion-review.md`（Codex 出）
- 严格 CTO review：`reviews/2026-04-25-phase-5-strict-cto-review.md`（Codex 第二轮，含 Phase 6 前置 bug 清单）
- Phase 1-4 回看 CTO review：`reviews/2026-04-25-phase-1-4-strict-cto-review.md`（新增 tester 前 P1 风险 + Phase 6 前置 P0 清单）

### 续做指南（下次会话第一件事读这段）

**Phase 3 链上产物（OP Sepolia，Phase 6 Track C 重部署后 v2）**：
- ScoreNFT v2 `0x1C478F9F5b66302A35a0178e07df67BA343c832F`（setTokenURI 仅首写一次，2026-04-25 部署）
- Orchestrator v2 `0x8A6Dd0Ecf108797358CC369bC6F263D2C89BC3a8`（删 TBA 开关，2026-04-25 部署）
- v1 旧合约归档：`reviews/phase-6-deprecated-contracts.md`（前端不展示 v1 上的 tokenId 1/2）
- v1 历史实测 mint tx 仍永久可查：`0x596b723038108ea58a051fb9450c917c4df394914dc9b6d1a86d9b09b4ac4f73`

**Arweave 静态产物（上链一次永不变）**：
- decoder (S4): `FWy1XA-B8MvRAgsNgMfDSUBiXXjHNpK1A_fHWjsUAXg`
- sounds map (S5.b): `fVpKvspVhusgUdn1FQr8j61jreFRZGKmiK3CyR0WO_8`
- 26 音效索引: `data/sounds-ar-map.json`
- 100 封面索引: `data/cover-arweave-map.json`
- decoder record: `data/decoder-ar.json`

**实测 Ripples #2 的完整 metadata** （S6 可以参考）：
- metadata JSON: `https://ario.permagate.io/pXWRtrzzJeYdAXeMVVPm_X0GstBe_NPQIErwwlzrs60`
- image（封面 001）: `https://ario.permagate.io/K0NAVlE00l6RhefjO7lZKqrG_HTSM9DglDhCC7UnhIo`
- animation_url（decoder + events）格式验证通过

**.env.local Phase 3 新增字段（5 个，已配，注释见文件内）**：
`NEXT_PUBLIC_SCORE_NFT_ADDRESS` / `NEXT_PUBLIC_ORCHESTRATOR_ADDRESS` /
`SCORE_DECODER_AR_TX_ID` / `SOUNDS_MAP_AR_TX_ID` / `TURBO_WALLET_PATH`
（可选：`ADMIN_TOKEN` 用于 `/api/cron/queue-status`，未来测观测性端点时加）

**Turbo 钱包**: `0xdE788249e747FB54c19e7B7F9baE85B631B9Fba8`（Base），余额约 3.3T winc。
补 credits 流程见 `.env.local` 里 `TURBO_WALLET_PATH` 上方的注释。

**DB schema**: `supabase/migrations/phase-0-2/` (001-006) + `supabase/migrations/phase-3/` (007-011) 全部在 Supabase 执行完毕。migrations 按 Phase 子目录组织，执行顺序见 `supabase/migrations/README.md`。

**Phase 3B 产物**：
- `system_kv` 表：存 `last_synced_block`，当前 cursor ≈ 42091300
- `chain_events` 表：已同步 tokenId 2 的 Transfer
- `sync-chain-events` cron：Alchemy Free 限 10 区块/请求，分批循环（50 批 × 10 = 500 区块/次）

**Phase 3.1 稳定性修复（Codex Review 驱动）**：
- F1: 原子 claim（RPC `claim_score_queue_job` + FOR UPDATE SKIP LOCKED + CAS 推进）
- F2: mint_events 幂等（UNIQUE score_queue_id + upsert）
- F3: metadata external_url 用 `NEXT_PUBLIC_APP_URL` 环境变量
- F4: 底曲缺失 fail fast（去掉 demo fallback）
- F5-F7: promise catch + topics 防御检查 + UUID 校验
- **延后项**：F8 不需要（/me = "我铸造的"）、F9 链上灾备延后到主网前

**Phase 4A 认证底座（S0-S2 已完成，S3 挂起）**：
- `src/lib/auth/jwt.ts` — signJwt / verifyJwt / revokeJwt（RS256 自签 JWT）
- `src/lib/auth/middleware.ts` — authenticateRequest（先 Privy 后 JWT 双通道）
- `src/lib/semi-client.ts` — Semi API 客户端（发短信/验证/拿用户），等 OAuth 方案后可能要改
- `app/api/auth/community/route.ts` — 验证码 → JWT 交换 + evm_address 合并
- `app/api/auth/community/send-code/route.ts` — 转发短信请求
- `supabase/migrations/phase-4/` — 015 jwt_blacklist + 016 auth_identities + 017 privy_nullable
- 6 个 API 已全部迁移到统一中间件（Privy 用户体验不变）
- **.env.local 已配**：`JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`
- **.env.local 待配**：`SEMI_API_URL`（等 Semi OAuth 方案）

**Phase 4C 空投产物（OP Sepolia）**：
- AirdropNFT `0xa6Aa896b222bB522bA5c8fcC6bD8e59e3f5de56B`
  - name: `"Ripples in the Pond Airdrop (Testnet)"`，symbol: `RIPA`
  - 部署 tx: `0xc8a0a0ad52ba7e3bbda24f22b8a5e6e12f5b14fdae24e8eca89e0e4e90188b3c`
  - minter = operator `0x40d36fd4A855D5D23E0F04b7fD89285F2eDe116b`
- DB 表：`airdrop_rounds` + `airdrop_recipients`（018-019 已执行）
- **S3 挂起原因**：Semi 团队在设计 OAuth 开放登录，现有 API 不确定是否对外开放。等他们方案出来后续做 S3（前端登录按钮 + useAuth 兼容）。续做时只需改 `semi-client.ts` + 新建前端组件。

**长期生效的决策补丁（别忘）**：
- ARWEAVE_GATEWAYS 缩到 2 个：`arweave.net` + `ario.permagate.io`
- Tailwind v4 `globals.css` 用 `@source not` 显式排除非源码目录（contracts / data / scripts / ...）
- ESET 拦部分 Web3 域名，本机 CORS 测试只是 smoke，真验证延到 S7
- **OpenSea 已永久停 testnet**，硬门槛改用 Etherscan + 直接 fetch Arweave 替代方案
- 用户默认 **PowerShell**，命令优先"加进 `.env.local` + 直接跑"模式
- `app/api/` 硬线豁免缺失：hook 只认 `src/app/api/`，当前 app/api/ 接近 8 上限，新 route 考虑复用现有子目录（见 S5.c 放 `cron/queue-status/`）

## 上次成功验证

- 验证: **Phase 7 Track A A2 AirdropNFT v2 重部署**（加 `_uriSet` 防 MINTER 私钥泄露后改 metadata）
- 时间: 2026-05-15
- 改动:
  - **合约层**：`contracts/src/AirdropNFT.sol` 加 7 行 `_uriSet` mapping + setTokenURI `require(!_uriSet[tokenId])` + 标 `_uriSet[tokenId]=true`（与 ScoreNFT v2 对齐）；`contracts/test/AirdropNFT.t.sol` 加 `testSetTokenURIOnlyOnce`（首次成功 → 二次 revert `"AirdropNFT: URI already set"` → URI 保持首次值）
  - **链上部署**：OP Sepolia 新 v2 `0xC5923BEc5C79a203b0cf4ab7c82567c8E20eEF65`，部署 tx `0xe05fafc3ccd3c9df4301f16fc4fa1d2cdf32d96d89e68bd59b49d1b674c37f06`，broadcast 记录在 `contracts/broadcast/DeployAirdropNFT.s.sol/11155420/run-latest.json`；v1 `0xa6Aa896b222bB522bA5c8fcC6bD8e59e3f5de56B` 永久弃用
  - **Vercel env**：`NEXT_PUBLIC_AIRDROP_NFT_ADDRESS` Production / Preview / Development 三环境同步新地址 + manual redeploy（不带 Build Cache）
  - **本地 `.env.local`**：替换为新 v2（顺手清理一个未文档化的谜地址 `0xf8e269818A...`，详 JOURNAL 2026-05-15 A2 段）
  - **归档**：`reviews/phase-6-deprecated-contracts.md` 加 2026-05-15 段（v1→v2 对照表 + 原子流程证明）
- 验证证据: forge test --match-contract AirdropNFTTest 7/7 通过（原 6 + 新 1）/ bash scripts/verify.sh 全绿（TS / ESLint / 行数 / build 28 路由）/ Vercel build 通过 / pond-ripple.xyz 正常打开
- 待办（用户线下做）:
  - cron-job.org `process-airdrop` 保持 Inactive（D1 决策主网首版不上空投）
  - 主网部署日：AIRDROP_ENABLED 仍保持 unset

### 上一轮成功验证（保留）

- 验证: **Phase 7 Track C C9a + C9b 落地**（`/me` 内容区 + `/score/[id]` 详情页首屏轻量化）
- 时间: 2026-05-15
- 改动:
  - **C9a `/me` 内容区**：`app/me/page.tsx` 三个 fetch（`fetchMyScoreNFTs` / `fetchMyNFTs` / `fetchMyScores`）改并行触发（之前 scores 串在 saveScore loop 后 await，最坏 N×saveScore 叠加）；每个 fetch catch + finally，单失败不阻塞其他；ScoreNftSection / DraftSection 加 `error?: boolean` prop，失败显示红色错误条；EmptyState 在错误态下不显示
  - **C9b R1** `src/data/score-source.ts` `getScoreById` 加 React `cache()` 包装：metadata + page 同 request 内只跑一次 DB 链路（8 → 4 个 roundtrip）
  - **C9b R2** `score-source.ts` `pending_scores` 改 SELECT `event_count`（migration 031 generated column）替代 `events_data.length`；删 `ScorePageData.events` 字段，首屏 HTML 不再阻塞大 JSON
  - **C9b R3** 新建 `src/data/score-events-source.ts`（双兼容路由解析 + 拉 events_data）+ 公开 endpoint `app/api/scores/[id]/events/route.ts`（middleware 已注释 `/api/scores/*` 公开只读）；`ScorePlayer.tsx` 改为挂载时 fetch events，三态：loading（按钮 disabled + "加载中…"）/ error（红条 + "请稍后刷新"）/ ready
- 验证证据: TS 0 errors / ESLint 通过（仅 3 项 pre-existing warning）/ npm run build 全 28 路由生成完成（新增 `/api/scores/[id]/events`）；用户本地浏览器实测 `/me` 进入体感 + `/score/[id]` 首屏速度 + ScorePlayer 三态切换 + 双兼容路由（数字 tokenId / queue.id UUID）通过

### 上上轮成功验证（保留）

- 验证: **strict CTO review "现在就修" 6 项落地**（测试网立即修补，避免等 Phase 7）
- 时间: 2026-05-08
- 改动:
  - **P0-3** AirdropNFT cron 入口加 `AIRDROP_ENABLED` env 硬开关（`process-airdrop/route.ts`）— 主网 Vercel 不设此 env，CRON_SECRET 即使泄露也只返 disabled
  - **P1-3** OwnedScoreNFT 加 `queueId: string` 字段（`src/types/jam.ts` + `score-nfts/route.ts` + `ScoreNftSection.tsx`）— React key 用 queueId 永不冲突
  - **P1-8** score_nft_queue catch 路径补 `failure_kind`（migration 030 加列 + `process-score-queue/route.ts` failed 时按 isCritical 分流 manual_review / safe_retry，与 mint_queue 对称）
  - **P1-9** /api/health oldestAgeSeconds 改用 `created_at`（`health/route.ts`）— 入队时刻不被 cron retry 重写，告警可信
  - **P1-10** /api/cron/queue-status 改 Bearer-only（`queue-status/route.ts` 复用 `verifyAdminToken`）— query token 进浏览器历史风险消除，runbook / 运维脚本需同步改 curl -H 'Authorization: Bearer …'
  - **P1-19** /api/me/score-nfts 35s → ms 级（migration 031 pending_scores 加 `event_count` generated column + `score-nfts/route.ts` SELECT 改用 event_count，不再拉整个 jsonb 算 length）
- 验证证据: TS 0 errors / ESLint 通过（仅 3 项 pre-existing warning）/ npm run build 全 27 路由生成完成（含 process-airdrop / queue-status / score-nfts / health 4 个改动 endpoint）
- 待办（用户线下做）:
  - 在 Supabase Dashboard 执行 migration 030 + 031（顺序执行，建表 + 加列）
  - 测试网 Vercel 加环境变量 `AIRDROP_ENABLED=true`（保持现有空投行为）；主网部署时**不设**此 env
  - 运维脚本 / runbook 把 `/api/cron/queue-status?token=…` 改成 `curl -H 'Authorization: Bearer $ADMIN_TOKEN'`

### 上上上轮成功验证（保留）

- 验证: **B8 P3 端到端实测 + B6 demo 5 球 arweave_url 上链回写**（草稿铸造主链路全通）
- 时间: 2026-05-08
- 改动:
  - **B8 P3** 路由 `[tokenId]` → `[id]` 双兼容（数字按 token_id / UUID 按 queue.id）+ ScorePlayer 改前端 inline（PlayerProvider.toggle + useEventsPlayback 替代 Arweave decoder iframe）+ score-fallback.ts 删除（noop 残留）+ score-source.ts allSettled / cover try-catch / token_id .order().limit(1) 防御
  - **B6 demo arweave_url** 跑 `scripts/arweave/upload-tracks.ts` 上 5 个 mp3 到 Arweave + 回写 tracks.arweave_url（解锁草稿铸造，原 P7 task 提前消化）
  - **B4 删除** PlayerProvider loadingRef 早已实施（commit 38f7f37 前），playbook + STATUS + TASKS 同步清掉
- 验证证据: queue 778a2904 走完 5 步状态机 → token_id=12 上链 + tx_hash 0xea5b... + uri_tx_hash 0x5ddb... + metadata Arweave bJeCGDtZ... + ScoreNFT 详情页前端 inline 播放正常（底曲 + events 时序触发音效）
- 副产品 / 待办:
  - cron lease 5 分钟 × 5 步 = 25 分钟问题（线上 cron 实际节奏 vs STATUS 文案不一致）
  - /score/[id] 返回链接应回 /me 而非 /（用户提需求）
  - Resend 邮件告警 P3 commit 提了未做 → 主网前必做
  - Agent review 13 finding：5 项本次合入修，8 项挂 P7

### 上上上上轮成功验证（保留）

- 验证: B2 Bug C 主链路双根因修复（cron 4-28~5-6 全 fail 修通到 minting_onchain 上链）
- 时间: 2026-05-06
- 改动: 本地 turbo-wallet.json 删 purpose 中文行（编码错误致 JSON.parse 崩 position 256）/ Vercel 加 NEXT_PUBLIC_SCORE_NFT_ADDRESS 删拼错版 / DELETE 8 条 failed row
- 验证证据: 新铸造 row 走完前 3 步 token_id=2 上链（events_ar_tx_id + tx_hash 都有），第 4 步业务 throw（D 组无 arweave_url 是独立 P7 问题，**已在 5/8 解锁**）

## 当前阻塞

- 无（Phase 4A S3 Semi 前端挂起不算阻塞，Phase 5 走 Privy-only 已绕过）
- tester 邀请文案 + 反馈收集渠道（微信群 / 表单）由用户主导准备，不算代码阻塞

## 🎯 主网承诺边界（Phase 6 产品决策冻结 @ 2026-04-25）

**主网首版包含**：
- Privy 邮箱登录（Phase 0-1 就绪）
- 浏览 + 播放 108 首曲目（Phase 1）
- 素材收藏 → MaterialNFT 铸造（Phase 0-1）
- 合奏录制 + 草稿保存（Phase 2）
- 草稿 → ScoreNFT 铸造（Phase 6 B3 接通）
- 已铸造乐谱公开回放 + 分享卡（Phase 3）
- 个人页（"我铸造的"语义，Phase 6 A6 冻结）
- 艺术家页（Phase 4B）

**主网首版不包含**（Phase 6 D1/E2 决策）：
- **空投 NFT**（D1=不做）— cron-job.org 停用 process-airdrop 定时，合约保留不触发
- **Semi 社区钱包登录**（E2=挂 Phase 7）— Phase 4A S0-S2 后端可复用，前端未接

**主网首版不允许**：
- airdrop cron 定时运行（代码保留，调度器不配置）
- airdrop trigger 管理端点对外暴露（`/api/airdrop/trigger` 只接受 Bearer token）

**前端关闭的入口**：
- /artist 页不显示空投进度标记（或显示为"运营内部"）
- /me 无草稿上链按钮之前路径关闭（Phase 6 B3 接通前）

## 🚀 Phase 7 当前执行范围（2026-05-13 重定）

Phase 7 不再是 UI 翻修候选清单，而是三 Track 并行：
- **Track A**：修严重 BUG（A1 起点，含 A6 20 曲 arweave_url 全量上链）
- **Track B**：Semi 社区钱包前端接入 PoC-only（B1 起点）
- **Track C**：全站提速（C1 Lighthouse baseline 起点）

旧 Phase 7 UI 翻修候选已分流：艺术家反馈 5 条 + Claude Design + /me /score /artist 深度重设计 → Phase 8；按键动画 + 音效系统扩展 26→50 → Phase 9；主网部署 / Resend / CRON_SECRET / operator 主网 ETH → Phase 10。

## 📌 悬空 TODO（不在 step 内但要追踪）

- **5 首正式曲名上架**（艺术家未给）
  - B6 已用纯数字 `1~5` 占位（Modak 气球字 badge 内嵌右下角）
  - 等艺术家给正式曲名后跑 `UPDATE tracks SET title='<正式名>' WHERE week=N`（每首一行 SQL）
  - 注意：链上已铸造的 NFT metadata 不可改，正式曲名只影响 UPDATE 之后新铸的
  - 来源：033 log 用户原话 "曲名的话，我要找艺术家的强化一下"
- **Vercel ISR 缓存等待**：生产部署后 /api/tracks 仍返旧数据最多 5 分钟（revalidate=300），等自然刷新或手动 redeploy
- **B7 Q3 答案**（启动 B7 时回答）：smoke test 清单来源（沿用 P5 / 新建 P6）
- **Pre-existing lint 错误 2 处**（`comet-system.tsx:40` + `use-layer-wave.ts:37` ref-during-render）
  - 来源 commit `cd882aa` v82 archipelago refactor，与 B6 无关
  - verify.sh 会失败但 build 通过；视后续工作中是否顺手修
- **/score/[id] 返回链接改 /me**（2026-05-08 B8 实测发现）
  - 现状：`app/score/[id]/page.tsx` 的 ← Ripples in the Pond 链接到 `/`
  - 期望：从唱片详情页返回应回到 /me（用户的"我的唱片"列表）
  - 一行修改，B7 端到端冒烟前顺手改
- **/api/me/scores 仍联 events_data**（2026-05-08 B8 实测，约 35s 慢；/api/me/score-nfts 已在本轮 P1-19 修）
  - 现状：/api/me/scores 联 `events_data` 给草稿前端 inline 播放用（DraftCard ▶ 按钮按 events.time 触发音效）
  - events_data 是必要数据不可省，但首屏可拆：先返主信息（id / track / seq / event_count）+ 草稿播放时单独 fetch events
  - 影响：草稿数 100+ 时 /me 首屏慢；P7 优化（仿 B8 P2 split）
- **.env.local 有重复 CRON_SECRET 定义**（2026-05-08 B8 实测发现）
  - 第二行 `CRON_SECRET=RIPStheworld` 覆盖第一行 hex value
  - 顺手清理（保留第二行或选其一），不影响线上 vercel
- **cron lease 5 分钟 × 5 步 = 25 分钟问题**（2026-05-08 B8 实测发现）
  - 设计：Phase 6 A1 durable lease 防 cron timeout race
  - 副作用：每条 row 走完 5 步 ≈ 25 分钟（远超 STATUS.md 文案"约 5 分钟"）
  - 选项：① 终态外推进步骤时一并清 lease ② cron 频率 1min → 30s ③ 保留设计但更新文档
  - B7 端到端冒烟前需决策（影响实测耗时）
- **score_nft_queue.token_id 缺 unique index**（2026-05-08 B8 P3 review 发现）
  - 根因：B8 后 token_id 路径成为兼容入口（getScoreByTokenId），但表没 partial unique index
  - 已加代码侧防御：`.order().limit(1)` 取最新行（避免双行命中 PGRST116 静默 404）
  - 主网前补 migration：`CREATE UNIQUE INDEX uq_score_queue_token_id ON score_nft_queue(token_id) WHERE token_id IS NOT NULL`
  - 前置：先确认现有数据无 token_id 重复
- **OwnedScoreNFT.id 仍是双语义路由 ID**（P7 brand type 候选）
  - 现状：本轮 P1-3 已加 `queueId: string` 给 React key 用；但 `id` 字段仍承担"路由用"职责（已上链=token 数字字符串，未上链=queue UUID）
  - 余下风险：caller 把 `id` 当 UUID 传 RPC 会 invalid uuid（已上链时）；语义判断 `id === '123'` 不可靠
  - P7 拆法：brand type `ScoreRouteId` 或拆 `route: { kind: 'token', tokenId } | { kind: 'queue', queueId }`
- **Resend 邮件告警延后 → 主网前必做**（2026-05-08 B8 P3 commit message 提了但未实施）
  - 测试网 + 当前用户量靠人工巡查 supabase 队列 + /api/health mintQueue 字段兜底
  - 主网前必做（生产环境失败必须有 alert 通道）
  - 触发场景：cron 失败 retry 耗尽 / Turbo 钱包余额低 / queue stuck > 阈值
- **score-source events 大 JSON 加载体验**（2026-05-08 B8 P3 review 发现）
  - 现状：/score/[id] SSR 拉完整 events_data（几十/几百音符 × 大 JSON），首屏慢
  - 远期：events 拆 client fetch（page.tsx 先出基础信息，events 单独 endpoint），仿 B8 P2 split
  - 当前 ScorePlayer 已用 Promise.allSettled + cover 降级保护，单页崩溃概率低

## 备注

- 仓库/代号 `ripples-in-the-pond`（本地文件夹仍是 `nft-music`）
- 链：OP Mainnet（生产）/ OP Sepolia（测试）；Arweave credits 走 Base L2
- Next.js 16.1.6 + React 19；Windows + PowerShell 主 + Git Bash 辅（Claude 用）
- 学习模式 slow mode；用户自称小白，命令必须给完整路径
- 文件硬线 220 行 / 目录 8 文件
- 决策日志 `docs/JOURNAL.md` / 文档地图 `docs/INDEX.md`
- memory 系统: `C:\Users\Hui\.claude\projects\E--Projects-nft-music\memory\` 已积累 7 条长期偏好/约束
