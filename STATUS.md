# STATUS — 项目当前状态

> 给"人 + AI"共用的状态面板。每完成一个小闭环都要更新。

---

## 当前阶段

**Phase**: Phase 4 — 社区钱包 + 空投
**进度**: **6/7 step 完成**（S0-S2+S4-S6 ✅ / S3 挂起 / S7 ⏳）
**playbook**: `playbook/phase-4-community.md`

## 当前进度

**做到哪**: Phase 4 S6 完成 — AirdropNFT 合约 + 空投系统
**下一步**: **S7** — 收口验证（10 项清单）
**剩余**: S7 → S3(挂起)

### 续做指南（下次会话第一件事读这段）

**Phase 3 链上产物（OP Sepolia）**：
- ScoreNFT `0xA65C9308635C8dd068A314c189e8d77941A7e99c`
- Orchestrator `0xcBE4Ce6a9344e04f30D3f874098E8858d7184336`
- 已铸造 2 张：tokenId 1（S3 部署测试）+ tokenId 2（"晨雾" 29 events，S5 端到端实测）
- 实测 mint tx: `0x596b723038108ea58a051fb9450c917c4df394914dc9b6d1a86d9b09b4ac4f73`

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

- 验证: Phase 4 S6 空投系统 — verify.sh 全绿 + forge test 6/6 ✅
- 时间: 2026-04-13
- commit: （待 commit）

## 当前阻塞

- 无

## 备注

- 仓库/代号 `ripples-in-the-pond`（本地文件夹仍是 `nft-music`）
- 链：OP Mainnet（生产）/ OP Sepolia（测试）；Arweave credits 走 Base L2
- Next.js 16.1.6 + React 19；Windows + PowerShell 主 + Git Bash 辅（Claude 用）
- 学习模式 slow mode；用户自称小白，命令必须给完整路径
- 文件硬线 220 行 / 目录 8 文件
- 决策日志 `docs/JOURNAL.md` / 文档地图 `docs/INDEX.md`
- memory 系统: `C:\Users\Hui\.claude\projects\E--Projects-nft-music\memory\` 已积累 7 条长期偏好/约束
