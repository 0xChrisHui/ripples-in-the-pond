# STATUS — 项目当前状态

> 给"人 + AI"共用的状态面板。每完成一个小闭环都要更新。

---

## 当前阶段

**Phase**: Phase 6 — 稳定性收口 + UI 重设计（Track C 已收口，Pre-tester gate 待开工）
**进度**: Track C 4 step 完结 + ScoreNFT/Orchestrator v2 已重部署 OP Sepolia；下一步 Pre-tester gate 的 4 项
**playbook**: `playbook/phase-6/overview.md`（+ 5 个 track 子文档）
**决策日志**：`docs/JOURNAL.md` 2026-04-25 段落（Phase 5 收口 + Phase 6 kickoff + Track C 收口）
**tester 范围**（Phase 5 定）：素材收藏 + 个人页 + artist 页 + 已铸造乐谱回放；**不含草稿铸造**（bug #5，Phase 6 Track B3）**不含空投**（Phase 6 Track D1 决策）

## 当前进度

**做到哪**: Phase 5 完全收口（`b0474f1`）+ Phase 6 playbook 就绪 + **Track C 合约 & 部署硬化收口**（commit `086167d` + ScoreNFT/Orchestrator v2 已上链）
**下一步**:
  1. **完成 Track C 收尾** — Vercel env 同步 + Redeploy + cron-job.org 5/5 在 v2 合约下 ≥ 5 分钟全绿
  2. **Pre-tester gate** — G0 运营就绪检查 + A2 material failed 重试 + B1 NFT cache 用户隔离 + E1 health 暴露 mint_queue 状态 → 限定范围 tester 放人
  3. **并行开工** — 5 tracks 各自推进（B2 UI 重设计等 tester 反馈 1-2 周后再开工）
  4. **Phase 6 完结** — 5 tracks 全绿 + completion review → Phase 7 OP 主网
**剩余**: Phase 6（5-6 周）→ Phase 7（OP 主网 + 监控 + 退出准备）

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

- 验证: Phase 6 Track C 收口 — ScoreNFT/Orchestrator v2 部署 + grantRole 链上成功
- 时间: 2026-04-25
- commit: `086167d` — feat(contracts): Track C 合约 & 部署硬化（C1-C4）
- 链上记录: `contracts/broadcast/DeployScore.s.sol/11155420/run-latest.json` + `contracts/broadcast/DeployOrchestrator.s.sol/11155420/run-latest.json`
- 23/23 forge test + verify.sh 全绿；归档 `reviews/phase-6-deprecated-contracts.md`

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

## 备注

- 仓库/代号 `ripples-in-the-pond`（本地文件夹仍是 `nft-music`）
- 链：OP Mainnet（生产）/ OP Sepolia（测试）；Arweave credits 走 Base L2
- Next.js 16.1.6 + React 19；Windows + PowerShell 主 + Git Bash 辅（Claude 用）
- 学习模式 slow mode；用户自称小白，命令必须给完整路径
- 文件硬线 220 行 / 目录 8 文件
- 决策日志 `docs/JOURNAL.md` / 文档地图 `docs/INDEX.md`
- memory 系统: `C:\Users\Hui\.claude\projects\E--Projects-nft-music\memory\` 已积累 7 条长期偏好/约束
