# STATUS — 项目当前状态

> 给"人 + AI"共用的状态面板。每完成一个小闭环都要更新。

---

## 当前阶段

**Phase**: Phase 6 v2 — 稳定性收口 + 端到端跑通（**v2 缩减：UI 重设计深度版迁 P7**，2026-05-03 决策）
**进度**: Track C 收口 + Pre-tester gate 4/4 + B6 demo + B2 Bug C 主链路修复 + **B8 /me 数据流重设完整 3 阶段**（Phase 1+2 已 commit / Phase 3 本次 commit + 端到端实测 token_id=12 上链）+ **B4 删除**（`PlayerProvider.tsx:86-114` loadingRef 早已实施）
**playbook**: `playbook/phase-6/overview.md`（+ 5 个 track 子文档；Track B 7→6 step，B4 删）
**决策日志**：`docs/JOURNAL.md` 2026-04-25 段（Phase 5/6 kickoff/Track C/Pre-tester）+ 2026-05-03 段（v2 缩减 + 艺术家反馈）+ 2026-05-08 段（B8 P3 + arweave_url 上链 + B4 删 + agent review 13 finding）
**stakeholder 反馈**（取代原 tester 反馈窗口）：艺术家 5 条反馈已收到（视觉 / 动态 / 音阶 / 名字 / 按键动画）；投资人只看链上技术不看 UI

## 当前进度

**做到哪**: Phase 5 完全收口 + Track C v2 合约上链 + **Pre-tester gate 4/4** + **Phase 6 playbook v2 缩减**（2026-05-03）+ **B6 实施完成**（2026-05-04，migration 027/028 + Modak 字体 + SphereNode 数字 badge）+ **B2 Bug C 主链路修复**（2026-05-06，wallet purpose 中文乱码 + Vercel env var typo 双根因）+ **B8 /me 数据流重设 3 阶段全完**（2026-05-07 P1+P2 / 2026-05-08 P3）+ **B6 demo 5 球 arweave_url 上链回写**（P7 task 提前消化）+ **B4 删除**
**下一步**（B7 改放最后，2026-05-04 调整 / B4 删 2026-05-08 调整）:
  1. **B5 前端韧性三件套**（独立可做：tracks ISR + 移动端首帧 + localStorage 恢复）
  2. **B3 草稿铸造** — 前置 A0+A1 完成（B8 P3 已接通核心铸造 + 实测，B3 步骤剩余文档对齐）
  3. **Track A 剩余**（A0/A1/A3/A4/A5）+ D2 + E4 / E5 收口
  4. **B7 端到端冒烟**（最后一次性覆盖所有功能 + 产 bug 清单 → 直接进 completion review）
  5. **Phase 6 completion review** → Phase 7 OP 主网

**B2 状态**：Bug C 主网链路已修（5/6） + Bug A/B 由 B8 数据流重设实质收口（B8 P1 5s 乐观 / P2 唱片对齐 DB / P3 路由双兼容 + 前端 inline 播放）；剩余只剩 B7 冒烟可能产出的小 bug。

**剩余**: Phase 6 v2（2-3 天）→ Phase 7（OP 主网 + UI 深度重设计 + 音阶系统 + 监控 + 退出准备）

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

- 验证: **B8 P3 端到端实测 + B6 demo 5 球 arweave_url 上链回写**（草稿铸造主链路全通）
- 时间: 2026-05-08
- 改动:
  - **B8 P3** 路由 `[tokenId]` → `[id]` 双兼容（数字按 token_id / UUID 按 queue.id）+ ScorePlayer 改前端 inline（PlayerProvider.toggle + useEventsPlayback 替代 Arweave decoder iframe）+ score-fallback.ts 删除（noop 残留）+ score-source.ts allSettled / cover try-catch / token_id .order().limit(1) 防御
  - **B6 demo arweave_url** 跑 `scripts/arweave/upload-tracks.ts` 上 5 个 mp3 到 Arweave + 回写 tracks.arweave_url（解锁草稿铸造，原 P7 task 提前消化）
  - **B4 删除** PlayerProvider loadingRef 早已实施（commit 38f7f37 前），playbook + STATUS + TASKS 同步清掉
- 验证证据: queue 778a2904 走完 5 步状态机 → token_id=12 上链 + tx_hash 0xea5b... + uri_tx_hash 0x5ddb... + metadata Arweave bJeCGDtZ... + ScoreNFT 详情页前端 inline 播放正常（底曲 + events 时序触发音效）
- 副产品 / 待办:
  - cron lease 5 分钟 × 5 步 = 25 分钟问题（线上 cron 实际节奏 vs STATUS 文案不一致）
  - /api/me/score-nfts 35s 慢（events_data 联表）→ 悬空 TODO
  - /score/[id] 返回链接应回 /me 而非 /（用户提需求）
  - Resend 邮件告警 P3 commit 提了未做 → 主网前必做
  - Agent review 13 finding：5 项本次合入修，8 项挂 P7

### 上一轮成功验证（保留）

- 验证: B2 Bug C 主链路双根因修复（cron 4-28~5-6 全 fail 修通到 minting_onchain 上链）
- 时间: 2026-05-06
- 改动: 本地 turbo-wallet.json 删 purpose 中文行（编码错误致 JSON.parse 崩 position 256）/ Vercel 加 NEXT_PUBLIC_SCORE_NFT_ADDRESS 删拼错版 / DELETE 8 条 failed row
- 验证证据: 新铸造 row 走完前 3 步 token_id=2 上链（events_ar_tx_id + tx_hash 都有），第 4 步业务 throw（D 组无 arweave_url 是独立 P7 问题，**已在 5/8 解锁**）

### 上上轮成功验证（保留）

- 验证: B6 实施完成（A 组 5 球 + B/C 36 球 demo 上线）
- 时间: 2026-05-04
- 改动: migration 027/028（tracks 加 published + 5 行循环到 No.1-5 + 安全清旧 mint）/ Modak 字体引入 / SphereNode 删下方 label 加内嵌数字 badge / getGroupTargetCount 抽象 / mock-tracks 5 行补 published
- 验证证据: TS 0 errors / npm run build 通过 / 浏览器实测 5 球 36 球数字稳定显示
- 决策推翻: B7 改放最后（避免"测-修-重测"循环）

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

## 🚀 Phase 7 候选清单（v2 缩减时迁出，2026-05-03）

来源：Phase 6 v2 playbook 缩减时挂起的工作 + 艺术家 5 条反馈。Phase 6 完结时这份清单进 Phase 7 plan。

### 来自艺术家反馈

| # | 反馈 | P7 step 候选 |
|---|---|---|
| 1 | 视觉：漂浮液态感（不要"星球"要"液态细胞"，调透明度）| P7 主页视觉重做 |
| 2 | 动态：流动 + 更多随机扰动事件 | P7 主页动态扩展 |
| 3 | 音阶：键盘触发音阶（A=钢琴 1-0 / Q=提琴）| P7 键盘音阶系统（**新功能**，非重设计）|
| 4 | 音乐圆圈不需要名字，数字代号 | **P6 B6 处理**（不进 P7）|
| 5 | 按键动画自定义 + 与岛屿/日食原生组件交互 | P7 自定义动画层 |

### 来自 v2 缩减

- **/me /score /artist 深度重设计**（v2 决策 1）
- **Claude Design 接入**（原 B2.0.7，条件评估）
- **跨浏览器截图验收**（原 B2.5）
- **24 张跨浏览器 / 断点截图归档**（原 B2.5）

### 来自 5/6 B2 Bug C 修复副产品

- **换 Turbo wallet**（旧钱包私钥 5/6 调试时泄露在聊天 jsonl，余额极小；P7 主网前必须换）
  - 流程：`scripts/arweave/generate-eth-wallet.ts` → 充 Base ETH → `topup-turbo.ts` → 替换 .env.local + Vercel TURBO_WALLET_JWK
  - 旧地址 `0xdE788249e747FB54c19e7B7F9baE85B631B9Fba8` 弃用 + Turbo credits 重新购买
- **D 组 No.1~No.5 上传 Arweave**（解锁草稿铸造）
  - 现状：`tracks.arweave_url=NULL` 导致 cron stepUploadMetadata 必崩 → D 组（含 B/C 前 5 球）完全无法铸造 ScoreNFT
  - 跑 `scripts/arweave/upload-tracks.ts`（已存在）+ UPDATE 5 行 arweave_url = ar://xxx
- **加 vercel-env-sync 脚本**（防 NEXT_PUBLIC_ env var typo）
  - 起因：5/6 Bug C 第二层根因 = `NEXT_PUBLIC_SCORE_NFT_ADDRES` 少一个 S
  - 脚本对比 `.env.local` 与 Vercel API（vercel CLI 或 Management API）的 key 差集，CI/手动跑都能

### 投资人 demo 范围（不变）

投资人只看链上技术 → P7 demo 重点：
- 主网部署（OP Mainnet）
- 端到端铸造 / 录制 / 回放跑通
- 监控 + 告警就绪

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
- **/api/me/score-nfts 性能问题**（2026-05-08 B8 实测发现，35 秒）
  - 根因：B8 Phase 2 联表 `pending_scores(events_data)` 算 eventCount，events_data 是大 JSON 数组
  - 优化：改 SELECT `jsonb_array_length(events_data)` 而不是 select 整个 events_data
  - 同样问题应用到 /api/me/scores（也联了 events_data 给草稿播放用，但那个是必要的）
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
- **OwnedScoreNFT.id 双语义可考虑拆 brand type**（P7 候选，2026-05-08 B8 P3 review 发现）
  - 现状：id 字段已上链 = `String(tokenId)`，未上链 = queue.id UUID
  - 风险：caller 误用（当 DB 主键传入 RPC 会 invalid uuid 错；语义判断 `id === '123'` 不可靠）
  - 拆法：`tokenId?: number` + `queueId: string`（永远 UUID）；或 brand type `ScoreRouteId`
  - 当前 caller 仅 ScoreCard 一处，影响小，可观察后再拆
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
