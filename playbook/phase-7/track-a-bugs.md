# Track A — 修严重 BUG

> **范围**：strict CTO review (`reviews/2026-05-08-phase-6-strict-cto-review.md`) 抓到的
> 9 项 Day 0 必修 + 9 项 Day 1-3 必修，共 18 项 step。
>
> **前置**：无（独立 track，可并行）。仅 A2 + A5 + A6 涉及链上操作，需要 operator wallet。
>
> **核心交付物**：所有 Day 0 必修项 status ∈ {fixed, downgraded-accepted}；剩余项明确挪 Phase 10。

---

## 冻结决策

### D-A1 — chain 配置复用现有 NEXT_PUBLIC_CHAIN_ID 而非新增 CHAIN_ID

.env.example 已有 `NEXT_PUBLIC_CHAIN_ID=11155420`。A1 **复用此 env**，不新建 `CHAIN_ID`。`chain-config.ts` 从 `process.env.NEXT_PUBLIC_CHAIN_ID` 读，前后端共用一个来源。

A1 必须**同时**覆盖（避免半成品）：
- 新建 `src/lib/chain/chain-config.ts`（CURRENT_CHAIN / explorerTxUrl(hash) / explorerAddressUrl(addr) / CHAIN_ID_NUM）
- 改 `src/lib/chain/operator-wallet.ts`（删 import optimismSepolia）
- 改 `src/data/score-source.ts`（删 ETHERSCAN_BASE 常量）
- 改 `app/score/[id]/page.tsx`（删硬编码 sepolia URL）
- guard 跑在 **runtime 第一次调用**（不是 boot time，避免 Vercel build 期间 env 缺失整体崩）；不在 [10, 11155420] 直接 throw + 错误信息附修复指令

### D-A2 — AirdropNFT 重新部署是 P7 唯一上链 op + 原子流程

A2 重新部署 AirdropNFT 是 P7 期间**唯一**触碰合约层的操作。ScoreNFT / Orchestrator / MaterialNFT 都不动。

**原子流程**（破坏顺序会让前端短暂指向旧地址）：
1. 部署前：cron-job.org 关 `process-airdrop`（保险，本来就不调度但确保 race-free）
2. forge 部署到 OP Sepolia + 取新地址
3. Vercel env 全 environment（Production + Preview + Development）更新 `NEXT_PUBLIC_AIRDROP_NFT_ADDRESS`
4. Vercel redeploy（手动 trigger 或 push 无关 commit 触发）
5. 等 Vercel build 通过 + /api/health airdrop 字段返新地址
6. 才 push commit 归档旧地址到 `phase-6-deprecated-contracts.md`
7. 旧地址永久弃用（DB 同步、不再调用、`AIRDROP_ENABLED` 保持 unset）

### D-A3 — stepMintOnchain 防重发 + manual_review，不承诺"等 receipt"

strict review P0-2 写"sigkill 后等 receipt"是有误的——没 tx_hash 时无法等 receipt。**修订实施方案**：

- migration 加 `attempted_at TIMESTAMPTZ` 列
- step 入口检查：`attempted_at` 在 5 分钟内 且 `tx_hash IS NULL` → **不重发**，retry_count 不增，等下次 cron（仍可能撞同样窗口）
- step 入口检查：`attempted_at` 超过 5 分钟仍无 `tx_hash` → 标 `failure_kind='manual_review'`，人工按 operator nonce / 链上记录核查（**没有自动等 receipt**）
- 长期方案（idempotency key + simulateContract）挪 Phase 10 主网部署前评估

### D-A3+A12 合并修复包

A3（sigkill 双 mint）和 A12（lease 25min 根因）都改 `process-score-queue/route.ts` + step 状态机。同一文件二次手术风险高 → **合并为"score queue 状态机修复包"**：

- 顺序：**先 A12 后 A3**（先收敛状态推进逻辑，再加 sigkill 防御）
- 一次 migration（032 同时加 `attempted_at` 列 + 可选清 lease 字段）
- 一次 forge / TS mock 测试覆盖两个改动

### D-A4 — Resend 默认挪 P10（覆盖原 D-A4）

**原计划**：P7 搭 `lib/alerts/resend.ts` 基础设施 + 不接 cron 触发。
**问题**：违反 AGENTS.md "禁止占位"（5 个 trigger 函数无 call site）+ resend SDK 不在 STACK 白名单。

**新决策**（默认）：**A8 整体挪 P10**。Phase 10 主网部署日同时做基础设施 + 真接 cron 触发，避免占位。

**例外开关**：若用户在 P7 期间要求至少有一条告警通道，则 A8 实施时：
- 用 `fetch` 调 Resend REST API（不新增依赖）
- 至少接一条 cron 触发点（A3 manual_review 分支）做端到端最小冒烟
- .env.example 加 `RESEND_API_KEY` + `ALERT_TO_EMAIL` 占位 + 说明"未配时静默 log"

### D-A5 — A5 必须先恢复 generate-eth-wallet.ts

`scripts/arweave/generate-eth-wallet.ts` 在 commit `be4e07a` 被 git rm。A5 实施时**先恢复脚本**（或重写），并统一 wallet 输出字段 `TURBO_WALLET_JWK`（删除 `TURBO_WALLET_PATH` 二来源）。

### D-A6 — A6 范围缩到 20 曲（2026-05-13 用户决策）

**变更前**：A6 = "108 曲 arweave_url 全量上链"，假设 5/108 待上 102 首（错的）+ 阻塞 Track A 完结。

**变更后**：A6 = "**20 曲** arweave_url 全量上链"。艺术家承诺先给 20 首，剩 88 曲挪 Phase 10 / 长期运营补曲。**Track A 完结不再被艺术家进度阻塞**。

A6 含 B6.1 数据扩容（A 组 5 球→20 球 / B+C 36 球 21-36 循环到 1-16）：

**A6.0 — 资产盘点**（fail-fast）：
1. AI 跑 `audit-tracks.ts` 输出三类清单：
   - 已有 mp3 + DB 有 arweave_url（不动，预期 No.1-5 + 001）
   - 已有 mp3 + DB 无 arweave_url（待上链）
   - 缺 mp3（用户必须先补曲，预期 No.6-20 共 15 首）

**A6.1 — B6.1 数据扩容**（不等艺术家，可先做）：
2. 新建 migration `030_b61_tracks_seed_20.sql`：
   - `UPDATE tracks SET published = TRUE WHERE week BETWEEN 1 AND 20;`
   - week 1-20 → audio_url=`/tracks/No.${week}.mp3` + title=`'${week}'`（不再 (week-1)%5 循环）
   - week 21-36 → 按 `((week-21) % 16) + 1` 循环到 No.1-16（即 21→1 / 22→2 / ... / 36→16）
   - cover 调色板复用 GROUP_PALETTES[0]，按 week 派生（前端 computeNodeAttrs 已处理）
3. `src/components/archipelago/sphere-config.ts:118`：`'A' ? 5 : 36` → `'A' ? 20 : 36`
4. `src/components/archipelago/SphereNode.tsx`：badge 字号 / 居中处理双位数（10-20），单位数视觉权重 vs 两位数会差，需要实测调字号 + tracking
5. `src/components/jam/HomeJam.tsx` / mock-tracks（如有）published 行同步加到 1-20

**A6.2 — 上传新 mp3**（等艺术家）：
6. 用户补齐 15 个 mp3（No.6.mp3 - No.20.mp3）→ `public/tracks/`
7. 跑 `upload-tracks.ts`（已存在）批量上 15 首到 Arweave
8. UPDATE tracks.arweave_url 后抽样 5 首验证（fetch HEAD 返 audio/mpeg）

**A6 完结标准**：`SELECT COUNT(*) FROM tracks WHERE week BETWEEN 1 AND 20 AND arweave_url IS NULL` = 0。剩 88 曲（week 21-108）arweave_url=NULL 不阻塞 P7（前端 B+C 组用 audio_url 循环路径播放，不走 ScoreNFT 草稿铸造）。

---

## 📋 Step 总览

### 5/8 已修不重复（commit `0d75a93`，不在 P7 范围）

strict review 6 P0 中 P0-3（AirdropNFT hard kill）+ 5 项 P1（P1-3 / P1-8 / P1-9 / P1-10 / P1-19）已在 5/8 落地，**不进 Track A**：

- P0-3 AirdropNFT `AIRDROP_ENABLED` env 硬开关 ✅
- P1-3 OwnedScoreNFT.queueId 字段 ✅
- P1-8 score_nft_queue.failure_kind catch 分流 ✅（**修正**：原 playbook 列为 A18，实际已修）
- P1-9 /api/health oldestAgeSeconds 用 created_at ✅
- P1-10 /api/cron/queue-status Bearer-only ✅
- P1-19 /api/me/score-nfts event_count generated column ✅（**修正**：原 playbook 列为 A11，实际已修）

### Day 0 必修（7 项，4.5-5 天，触碰环境 = 测试网 + Arweave + Base + Vercel）

| Step | 严重 | 内容 | 工时 | 依赖 | 环境 | 来源 |
|---|---|---|---|---|---|---|
| [A1](#step-a1--chain-配置抽单一来源) | 🔥 MEGA P0 | 抽 `chain-config.ts` + 删 3 处硬编码 sepolia | 0.5 天 | 无 | 本地 | P0-0 |
| [A2](#step-a2--airdropnft-加-_uriset-防覆盖--重新部署) | P0 | 加 `_uriSet` 7 行 + forge test + 重新部署 + DB 同步（原子流程见冻结决策）| 1 天 | A1 | OP Sepolia + Vercel | P0-1 |
| [A3+A12](#step-a3a12--score-queue-状态机修复包cron-合并) | P0 + P1 | 双 mint 防御（防重发 + manual_review）+ lease 25min 根因（合并避免二次手术）| 2 天 | 无 | 测试网 cron | P0-2 + P1-22 |
| [A4](#step-a4--mainnet-runbook-grantrole-验收) | P0 | runbook 加 `cast call hasRole` 验收命令 | 0.2 天 | 无 | 仅文档 | P0-4 |
| [A5](#step-a5--换-turbo-wallet) | P0 | 恢复 generate-eth-wallet.ts + 生成新 EOA + 充 Base ETH + 充 Turbo credits + 更新 env | 1 天 | 无 | Base | 硬阻塞 #1 |
| [A6](#step-a6--20-曲-arweave_url-全量上链含-b61-数据扩容) | P0 | **20 曲全量上链**（含 B6.1 数据扩容）；A6.0 盘点 + A6.1 扩容（不等艺术家可先做）+ A6.2 上传（等 15 首 mp3）| 1-1.5 天 | A5 | Arweave + Base + DB migration | 硬阻塞 #2 |
| [A9](#step-a9--vercel-env-sync-脚本) | P1 | `scripts/vercel-env-sync.ts` 对比 .env.local 与 Vercel API（仅 key 集合 + NEXT_PUBLIC_*）| 0.5 天 | 无 | Vercel API | P1-16 |

**Day 0 小计**：6.2-6.7 天

### Day 1-3 必修（7 项，3.5 天，多数纯前端 / 本地）

| Step | 严重 | 内容 | 工时 | 依赖 | 环境 | 来源 |
|---|---|---|---|---|---|---|
| [A10](#step-a10--score-链上灾备-ui-降级壳) | P1 | /score/[id] DB miss 时显示灾备占位 + Phase 9 数据路径预留接口 | 1 天 | A1 | 本地 + Vercel | P1-5 |
| [A13](#step-a13--useeventsplayback-首播-decode-时序) | P1 | 拆 audioReady / decodeReady 双状态 | 0.5 天 | 无 | 本地 | P1-21 |
| [A14](#step-a14--5s-乐观成功诚实文案--polling) | P1 | ScoreCard 灰卡显示"上链中（5-30 分钟）"+ 已等待时长 + auto-polling | 0.5 天 | C3（调用契约）| 本地 | P1-17 |
| [A15](#step-a15--usemintscore-失败回滚) | P1 | 草稿不消失 + 错误 toast + 重试按钮 + polling 验证 | 0.5 天 | C3（调用契约）| 本地 | P1-18 |
| [A16](#step-a16--operator-lock-ttl-续期--fail-closed) | P1 | TTL 30s → 120s + **Lua 心跳脚本（holder 校验）**+ 生产 fail-closed | 0.5 天 | 无 | 测试网 cron | P1-6 + P1-7 |
| [A17](#step-a17--mint_events-upsert-失败检查) | P1 | steps-set-uri.ts 补 error 检查 + manual_review 路径 | 0.3 天 | 无 | 测试网 cron | P1-23 |
| **A8** | P1 | **决策延后**：用 fetch 调 Resend API（避新依赖）+ 接 A3 manual_review 触发点；或挪 P10。**当前默认挪 P10** | 0.5 天（如做）| A3 | 测试网 | P1-15 |

**Day 1-3 小计**：3.3 天（不含 A8）

**Track A 总工时**：约 **10-11 天**（去 A11/A18 audit + 合并 A3/A12 + 真实工时调整）

### 不在 P7 范围（明确挪走，每项有归宿）

| ID | 严重 | 描述 | 归宿 |
|---|---|---|---|
| P1-1 | P1 | save_score_atomic exception 回退可能返 null | **P10**（主网部署前补 null check）|
| P1-2 | P1 | mint_score_enqueue v_already_enqueued check 与 unique_violation 双层防御不一致 | **P10**（错误信息友好度，不影响功能）|
| P1-4 | P1 | 4 个 B2 视觉文件接近 220 行硬线 | **Phase 8**（UI 翻修必碰，趁势拆）|
| P1-11 | P1 | airdrop_recipients.resetToPending 无 CAS | **P10**（D1=空投不做，不阻塞）|
| P1-12 | P1 | Deploy 脚本 vm.envOr 在主网无强制 fail-fast | **P10 主网部署日 runbook**|
| P1-13 | P1 | MAINNET-RUNBOOK 缺 forge verify-contract 步骤 | **P10 主网部署日 runbook**|
| P1-14 | P1 | load-env.ps1 转义 / 多行 value 处理薄弱 | **P10**（5/6 Bug C 同款 env 风险）|
| P1-24 | P1 | airdrop module 顶层 getAddress 拖垮无关 cron | **P10**（D1=空投不做，不阻塞）|
| P2-11 | P2 | score_nft_queue.token_id 缺 partial unique index | **A3+A12 顺手**（同一 DB migration） |
| 悬空 TODO | — | /score/[id] 返回链接改 /me 而非 / | **A10 顺手**（同文件） |
| 悬空 TODO | — | .env.local 重复 CRON_SECRET 定义 | **A5 顺手**（同 env 清理） |
| 悬空 TODO | — | OwnedScoreNFT.id 双语义 brand type | **Phase 8** UI 翻修一起拆 |
| 悬空 TODO | — | pre-existing lint 2 处（comet-system + use-layer-wave）| **Phase 8** B2 视觉文件拆时顺手 |
| 悬空 TODO | — | Vercel ISR 缓存等待 | 不修（用户已知，自然刷新）|
| **A7** | 运营 | Operator wallet 主网 ETH 充值 | **P10 主网部署日**（不进 P7） |

---

## Step A1 — chain 配置抽单一来源

### 概念简报

`src/lib/chain/operator-wallet.ts:6` 写死 `import { optimismSepolia }`。viem 的 `chain` 参数控制 tx envelope 的 chainId 字段。主网部署时即使 RPC URL 切到 Mainnet，tx envelope 仍标 Sepolia → 主网 RPC 拒收。最坏情况：RPC URL 漏改还指向测试网 → 主网部署后**tx 真的发到测试网**，DB 记主网合约 + 链上 tx 在测试网 → **数据/链分裂灾难**。

### 📦 范围（环境：本地 only，无链上 op）
- `src/lib/chain/chain-config.ts`（新建）
- `src/lib/chain/operator-wallet.ts`（删 import + 派生）
- `src/data/score-source.ts:37`（删 ETHERSCAN_BASE 常量）
- `app/score/[id]/page.tsx:109`（删硬编码 sepolia URL）
- 不动 .env.example（`NEXT_PUBLIC_CHAIN_ID=11155420` 已存在）

### 做什么

1. 新建 `chain-config.ts` 导出：
   ```ts
   import 'server-only';
   import { optimism, optimismSepolia, type Chain } from 'viem/chains';

   function readChainId(): number {
     const raw = process.env.NEXT_PUBLIC_CHAIN_ID;
     if (!raw) throw new Error(
       'NEXT_PUBLIC_CHAIN_ID 未设置。本地 dev：.env.local 加 NEXT_PUBLIC_CHAIN_ID=11155420（OP Sepolia）。主网部署：=10。'
     );
     const n = Number(raw);
     if (n !== 10 && n !== 11155420) throw new Error(
       `不支持的 NEXT_PUBLIC_CHAIN_ID=${raw}，仅允许 10（主网）或 11155420（OP Sepolia）`
     );
     return n;
   }

   export const CHAIN_ID_NUM = readChainId();        // runtime 第一次 import 时校验
   export const CURRENT_CHAIN: Chain = CHAIN_ID_NUM === 10 ? optimism : optimismSepolia;
   const baseHost = CHAIN_ID_NUM === 10 ? 'https://optimistic.etherscan.io' : 'https://sepolia-optimism.etherscan.io';
   export const explorerTxUrl = (hash: string) => `${baseHost}/tx/${hash}`;
   export const explorerAddressUrl = (addr: string) => `${baseHost}/address/${addr}`;
   ```
2. operator-wallet 改用 `CURRENT_CHAIN`
3. score-source.ts 改 `explorerTxUrl(tx)`
4. score/[id]/page.tsx 改 `explorerAddressUrl(addr)`

### 验证标准

- [ ] `bash scripts/verify.sh` 全绿
- [ ] `grep -r "optimismSepolia" src/ app/ --include='*.ts' --include='*.tsx'` 只在 `chain-config.ts` 出现一次
- [ ] `grep -r "sepolia-optimism.etherscan.io" src/ app/ --include='*.ts' --include='*.tsx'` 零结果
- [ ] dev server 启动 + /score/12 页面合约链接仍指向 sepolia-optimism.etherscan.io
- [ ] 临时把 .env.local 改 `NEXT_PUBLIC_CHAIN_ID=99`，启动后任意路由触发，报错信息含"不支持"+ 修复指令

---

## Step A2 — AirdropNFT 加 `_uriSet` 防覆盖 + 重新部署

### 概念简报

ScoreNFT v2 (commit `086167d`) 加了 `_uriSet` mapping 保证 metadata 只能写一次；但 AirdropNFT 漏了。MINTER_ROLE 私钥泄露后，坏人可调 `setTokenURI(已发 tokenId, 钓鱼 URL)` 把空投改成钓鱼。

### 📦 范围（环境：OP Sepolia + Vercel + 仓库）
- `contracts/src/AirdropNFT.sol`
- `contracts/test/AirdropNFT.t.sol`（补"二次写 setTokenURI revert + 首 URI 保持不变"测试）
- `contracts/script/DeployAirdropNFT.s.sol`（**正确文件名**，原 playbook 写错为 DeployAirdrop）
- 不动 .env.local 直接（按 D-A2 原子流程走 Vercel env 先）
- Vercel env（`NEXT_PUBLIC_AIRDROP_NFT_ADDRESS` 全环境更新）
- `reviews/phase-6-deprecated-contracts.md`（旧地址归档）

### 做什么（**严格按 D-A2 原子流程**）

1. 改合约：复制 ScoreNFT 的 7 行 `_uriSet` 逻辑到 AirdropNFT.sol
2. 加 forge 测试用例："首次 setTokenURI 成功 → 第二次 setTokenURI(同 tokenId) revert → 首 URI 内容保持不变"
3. `forge test --match-contract AirdropNFTTest` 全绿
4. **关 cron-job.org 的 `process-airdrop`**（防 race，本来不调度也确保关）
5. forge 部署 OP Sepolia → 取新地址
6. Vercel env 全环境（Production / Preview / Development）更新 `NEXT_PUBLIC_AIRDROP_NFT_ADDRESS`
7. Vercel manual redeploy（不要先 push 改动）
8. 等 Vercel build 完成 + curl `/api/health` 返新地址
9. **才** push commit + 改 `phase-6-deprecated-contracts.md` 归档旧地址
10. .env.local 同步更新（本地 dev）

### 验证标准

- [ ] `forge test --match-contract AirdropNFTTest` 7/7 通过（原 6/6 + 新增 1）
- [ ] OP Sepolia 部署 broadcast 记录在 `contracts/broadcast/`
- [ ] Vercel env 三环境都已更新 + 任一环境 redeploy 通过
- [ ] `/api/health` airdrop 字段返新地址
- [ ] 旧地址 `0xa6Aa896b222bB522bA5c8fcC6bD8e59e3f5de56B` 进归档文档
- [ ] **回滚预案**：若部署后发现问题，旧地址因有漏洞**不能回滚使用**，只能保持 `AIRDROP_ENABLED` unset 阻断 cron 直到下一次修补

---

## Step A3+A12 — score queue 状态机修复包（cron 合并）

> **合并理由**（见 D-A3+A12）：A3 防双 mint 和 A12 lease 25min 根因都改同一组文件。同时做避免二次手术。

### 概念简报

**A12（lease 25min 根因）**：`steps-upload.ts:31` 在 step 内把 status 从 pending 改 uploading_events，但 route.ts CAS 用原始 `row.status='pending'` → CAS 失败 → row 保持 uploading_events + lease 不清 → 5 分钟后下次 cron 才推进 → 5 步 × 5 分钟 = 25 分钟。

**A3（sigkill 双 mint）**：`writeContract` 广播后、`UPDATE tx_hash` 前如果 Vercel sigkill，下次 cron 看到 `tx_hash=null` 会再 mint 一次，用户拿到两个 token。

合并后核心思路：**让 step 自己完成"状态推进 + 业务字段 + lease 释放"的最终 CAS**，route 只负责调度和兜底释放。

### 📦 范围（环境：测试网 cron + DB migration）
- `supabase/migrations/phase-7/track-a/032_score_queue_state_machine.sql`（新建，加 `attempted_at` + 可选 `last_tx_hash` 字段 + P2-11 partial unique index on token_id）
- `app/api/cron/process-score-queue/route.ts`（CAS 收敛，不再 update status）
- `app/api/cron/process-score-queue/steps-upload.ts`（自己做 final CAS）
- `app/api/cron/process-score-queue/steps-mint.ts`（拆双 mint 防御 + 自己做 final CAS）
- `app/api/cron/process-score-queue/steps-set-uri.ts`（自己做 final CAS）
- `supabase/migrations/README.md`（更新 phase-7 子目录说明）

### 做什么

**A12 部分**（先做）：
1. route.ts 不再做 `update status`，仅做 lease 调度
2. 每个 step 内部用 CAS：`WHERE id=:row AND locked_by=:owner AND status=:expected_status`
3. step 成功 → 自己 UPDATE 推进到下一状态 + 释放 lease（或保留 lease 给下一个 step 同 cron 继续）
4. step 失败 → 自己 UPDATE failed + failure_kind + 释放 lease

**A3 部分**（叠加在 A12 之上）：
1. migration 加 `attempted_at TIMESTAMPTZ`
2. steps-mint.ts 入口检查：
   - `attempted_at` 在 5 分钟内 且 `tx_hash IS NULL` → **不重发**，retry_count 不增，本次 cron 跳过等下次（按 D-A3）
   - `attempted_at` 超过 5 分钟仍无 `tx_hash` → 标 `failure_kind='manual_review'`，**不自动等 receipt**（按 D-A3）
3. mint 路径：
   - UPDATE 标记 `attempted_at=now()`（CAS）
   - `writeContract`
   - UPDATE `tx_hash`（CAS）
   - 如果第 3 步失败 → step 抛错，但 `attempted_at` 已写 → 下次 cron 走"5min 内不重发"分支

**A8 协同**（按 D-A4 默认挪 P10）：本步骤标 manual_review 后**测试网无 alert 通道**，靠 /api/health 人工巡查。Phase 10 接 Resend 时一并接入。

### 验证标准

- [ ] migration 032 在 Supabase Dashboard 跑成功
- [ ] verify.sh 全绿
- [ ] TS mock 测试覆盖：
  - 正常完成（所有 step 一次 cron 走完）
  - A12 路径：单 cron 内推进 ≥ 2 步
  - A3 路径：mint 后 sigkill → 5min 内不重发
  - A3 路径：超时 → manual_review
- [ ] 端到端：草稿入队 → 1-5 分钟走完所有 step（远低于原 25 分钟）
- [ ] **/api/health 暴露 `manualReviewCount` 字段**（供巡查 + Phase 10 接 alert 用）
- [ ] 故意删一行 mint_events 模拟 sigkill 后状态 → 下次 cron 不重 mint

---

## Step A4 — MAINNET-RUNBOOK grantRole 验收

### 📦 范围
- `docs/MAINNET-RUNBOOK.md` § 3.3.1 后补一段

### 做什么

加 `cast call hasRole(bytes32,address)` 验收命令模板 + 期望输出 `true`。

### 验证标准

- [ ] markdown 渲染正常
- [ ] 命令在 OP Sepolia 测试可执行（验证模板正确）

---

## Step A5 — 换 Turbo wallet

### 概念简报

旧 Turbo wallet `0xdE788249e747FB54c19e7B7F9baE85B631B9Fba8` 私钥 5/6 调试时在 Claude Code jsonl 泄露。链上数据不可篡改但钱包不可信。P7 期间必须换新 wallet。

**⚠️ playbook 假设修正**：`scripts/arweave/generate-eth-wallet.ts` 已在 commit `be4e07a` 删除（一次性脚本 git rm 过）。A5 第一步必须**恢复/重写脚本**。

### 📦 范围（环境：Base + 本地 + Vercel）
- `scripts/arweave/generate-eth-wallet.ts`（**新建/恢复**）
- `scripts/arweave/topup-turbo.ts`（已存在）
- `.env.local`（更新 `TURBO_WALLET_JWK`；删除残留 `TURBO_WALLET_PATH` 字段统一一个来源；顺手清"重复 CRON_SECRET 定义"悬空 TODO）
- Vercel env（同步）
- 旧 wallet 不动（链上已上传内容仍永久有效）

### 做什么

1. **新建 generate-eth-wallet.ts**：使用 `viem` `generatePrivateKey` + `privateKeyToAccount`，输出 JSON 含 `{ address, privateKey }`。脚本完跑后**用户手动备份私钥**（不写入 .env 直到 Turbo SDK 生成 JWK）
2. 用户充入约 0.005 Base ETH（手动）
3. 跑 `topup-turbo.ts` 用新 wallet 充值 Turbo credits + 生成 JWK
4. 更新 .env.local `TURBO_WALLET_JWK`（删 `TURBO_WALLET_PATH`）
5. Vercel env 同步 `TURBO_WALLET_JWK`
6. **不**重新上传 26 音效 + 100 封面 + decoder（已在 Arweave 上永久有效，URI 不变）

### 验证标准

- [ ] 新 wallet 地址 ≠ 旧地址 `0xdE78...9Fba8`
- [ ] Turbo dashboard 余额 ≥ 3T winc
- [ ] 跑一次 A6 测试上传（1 首曲）验证新 wallet 可用
- [ ] **`grep -ri "0xdE788249e747FB54c19e7B7F9baE85B631B9Fba8" .` 全仓库零结果**（grep audit）
- [ ] 旧 wallet 弃用记录写进 JOURNAL：未来如发现新上传 = 抢注，不可信
- [ ] .env.local 的 `TURBO_WALLET_PATH` 删除（统一一个来源）+ 重复 CRON_SECRET 行清理

---

## Step A6 — 20 曲 arweave_url 全量上链（含 B6.1 数据扩容）

### 概念简报

`tracks.arweave_url=NULL` 的曲目无法走草稿铸造（stepUploadMetadata 必崩）。Phase 6 B6 只做了 A 组 5 球 demo；P7 把 A 组扩到 20 球（艺术家承诺先给 20 首）+ B/C 组 36 球前 20 个用真曲、21-36 个循环 No.1-16。

**剩 88 曲（week 21-108）arweave_url=NULL 在 P7 完结时仍允许为 NULL**（前端 B+C 组用 audio_url 路径播放，不走 ScoreNFT 草稿铸造）。88 曲挪 Phase 10 / 艺术家长期补曲。

按 D-A6，A6 拆 A6.0 / A6.1 / A6.2 三子步骤。

### 📦 范围（环境：本地代码 + Arweave + Base credits + DB）

**A6.0 + A6.1（不等艺术家）**：
- `scripts/arweave/audit-tracks.ts`（**新建**，20 vs 实际文件对照报告）
- `supabase/migrations/phase-7/track-a/030_b61_tracks_seed_20.sql`（**新建**，published 1-20 + audio_url 重新映射）
- `src/components/archipelago/sphere-config.ts:118`（`'A' ? 5 : 36` → `'A' ? 20 : 36`）
- `src/components/archipelago/SphereNode.tsx`（badge 双位数字号 / 居中调整）
- `src/components/jam/HomeJam.tsx` mock-tracks fixture（如有，published 同步加到 1-20）
- `public/tracks/`（用户复制 15 个新 mp3 进来：No.6.mp3 - No.20.mp3）

**A6.2（等艺术家给 mp3 后做）**：
- `scripts/arweave/upload-tracks.ts`（已存在，加 fail-fast 缺文件检查）
- DB 操作：`UPDATE tracks SET arweave_url = ... WHERE week BETWEEN 6 AND 20`

### 做什么

**A6.0 — 资产盘点**（10 分钟）：
1. AI 跑 `audit-tracks.ts` 输出三类清单（按 D-A6 三类）
2. 第 3 类（缺 mp3）不为零 → 不阻塞 A6.1（A6.1 是纯代码改动可以先做）；只阻塞 A6.2

**A6.1 — B6.1 数据扩容**（60 分钟，不等艺术家）：
3. 写 migration 030：
   - `UPDATE tracks SET published = TRUE WHERE week BETWEEN 1 AND 20;`
   - week 1-20：`audio_url='/tracks/No.${week}.mp3'`, `title='${week}'`, `arweave_url=NULL`（待 A6.2 回写）
   - week 21-36：按 `((week-21) % 16) + 1` 循环映射到 No.1-16（如 week=21→No.1，week=36→No.16）
   - 清旧 mint：参考 028 模式，DELETE 时 score_queue_id IS NULL 过滤（避免误伤 ScoreNFT）
4. sphere-config 改 5 → 20（一行）
5. SphereNode badge：测试 10-20 双位数视觉。可能需要：
   - 字号 1.26r → 1.0r-1.1r（双位数占用空间大）
   - text-anchor / dominant-baseline 微调（避免视觉偏移）
6. mock-tracks fixture published 行扩到 1-20（如适用）
7. 浏览器实测：A 组 20 球数字稳定显示 / B+C 组第 21 球点击播 No.1.mp3 / 第 36 球点击播 No.16.mp3

**A6.2 — 上传新 mp3**（等艺术家给 15 首）：
8. 用户把 No.6.mp3 - No.20.mp3 复制进 `public/tracks/`
9. 改 upload-tracks.ts：批量上传 week BETWEEN 6 AND 20 的曲（带缺文件 fail-fast + 失败列表续传幂等）
10. 跑脚本收集 txid → UPDATE tracks.arweave_url
11. 抽样 5 首验证（fetch HEAD 返 audio/mpeg）+ 跑一次端到端草稿铸造确认 stepUploadMetadata 不崩

### 验证标准

- [ ] `audit-tracks.ts` 报告（A6.0）三类清单产出
- [ ] migration 030 在 Supabase 跑成功（A6.1）
- [ ] 浏览器实测：A 组 20 球数字稳定 + B+C 组 21-36 球数字 1-16 稳定（A6.1）
- [ ] `SELECT COUNT(*) FROM tracks WHERE week BETWEEN 1 AND 20 AND arweave_url IS NULL` = 0（A6.2）
- [ ] 抽样 5 首 fetch HEAD（A6.2）
- [ ] 端到端草稿铸造（任意 week 6-20 的曲）确认 stepUploadMetadata 不崩（A6.2）
- [ ] **剩 88 曲 arweave_url=NULL 允许**（前端 B+C 组用 audio_url 循环播放路径，不走草稿铸造）

---

## ~~Step A7~~ → 挂 P10 主网部署日

P7 期间**不动**。挪到 Phase 10 起点清单（"测试网首版不充值，主网部署日同时做"）。STATUS.md 同步时一并加这一行。

---

## Step A8 — Resend 告警（**默认挪 P10**）

按 D-A4 决策：**A8 默认整体挪 Phase 10 主网部署日**，避免占位违反 AGENTS.md。

**仅当用户在 P7 期间明确要求至少一条告警通道时启用**：

### 概念简报

主网生产环境必须有 alert 通道。如果 P7 期间真接，必须**真接到至少一个 trigger 点**，不允许占位。

### 📦 范围（环境：测试网 + 邮箱）
- `src/lib/alerts/resend.ts`（新建，**用 fetch 调 Resend REST API，不引 SDK 避新依赖**）
- `app/api/cron/process-score-queue/route.ts`（接入：A3 标 manual_review 时发邮件）
- `app/api/health/route.ts`（manualReviewCount 字段已在 A3+A12 加，复用）
- `.env.local`（加 `RESEND_API_KEY` + `ALERT_TO_EMAIL`）
- Vercel env（同步）
- `.env.example`（加占位 + 注释"未配时静默 log"）

### 做什么

`sendAlert(subject, body)` 单函数（不做 5 个 trigger 占位）：
- 用 `fetch('https://api.resend.com/emails', { headers: { Authorization: Bearer RESEND_API_KEY } })`
- 未配 `RESEND_API_KEY` → console.log 警告但不 throw
- 调用点：A3+A12 修复包里 manual_review 转移时调一次（端到端冒烟）

### 验证标准

- [ ] verify.sh 全绿
- [ ] 故意触发 A3 manual_review 分支 → 收到测试邮件（用 `ALERT_TO_EMAIL=<你的邮箱>`）
- [ ] 删 RESEND_API_KEY → cron 走原路径不崩，仅 console.log 警告

---

## Step A9 — vercel-env-sync 脚本

### 概念简报

5/6 Bug C 第二层根因 = `NEXT_PUBLIC_SCORE_NFT_ADDRES` 少一个 S。需要脚本对比 .env.local 与 Vercel API 的 key 差集。

**⚠️ 设计修正**（Codex review）：Vercel API 通常**不能读回 secret 明文**。所以脚本只能做 **key 集合差异 + NEXT_PUBLIC_* 明文比对**，不能比对全部 value。

### 📦 范围（环境：Vercel Management API）
- `scripts/vercel-env-sync.ts`（新建）
- `package.json`（加 npm script `env-sync`）
- `docs/MAINNET-RUNBOOK.md`（部署前必跑）

### 做什么

读 `.env.local` key list → 调 Vercel Management API (`/v9/projects/:id/env`) → diff 输出：
- **A 类**：仅在本地（Vercel 待加）— 列 key 名
- **B 类**：仅在 Vercel（本地待加 / Vercel 多余）— 列 key 名
- **C 类**：两边都有 + NEXT_PUBLIC_* 值不一致（仅 NEXT_PUBLIC_* 因 Vercel API 返明文）

非 NEXT_PUBLIC_* secret 仅看 key 是否存在，不比 value。脚本输出退出码：A/C 类不空 → exit 1（CI fail）。

### 验证标准

- [ ] `npm run env-sync` 输出 diff 报告
- [ ] 故意把 .env.local 改一个 typo `NEXT_PUBLIC_SCORE_NFT_ADDRES` → 脚本 exit 1 + 列出 A 类差异
- [ ] NEXT_PUBLIC_CHAIN_ID 两边值不一致 → 脚本捕获 C 类差异

---

## Step A10 — /score 链上灾备 UI 降级壳

### 概念简报

B8 P3 删 score-fallback.ts noop 残留后，/score/[id] 完全依赖 Supabase 查 4 个表。Supabase 抖动 → 所有分享链接 404。P7 先做 UI 降级壳（DB miss 时显示"乐谱临时不可用，请稍后刷新"+ Phase 9 数据路径预留接口）。Phase 9 / Phase 10 做真正的链上 tokenURI fallback。

### 📦 范围
- `app/score/[id]/page.tsx`（DB miss 不直接 notFound，渲染降级壳）
- `app/score/[id]/FallbackShell.tsx`（新建 client component）

### 验证标准

- [ ] 强行 throw Supabase 错误 → 页面显示降级壳不崩
- [ ] OG image 仍能 fallback 渲染（即使无封面用品牌色）
- [ ] verify.sh 通过

---

## ~~Step A11~~ → audit only（已修）

**audit 结论**：commit `0d75a93` 已修。`app/api/me/score-nfts/route.ts:31` SELECT 已用 `pending_scores(event_count)`，migration 031 generated column 已建。

**仅需 audit 步骤**（10 分钟）：
- [ ] curl `/api/me/score-nfts` (已登录) → p95 < 1s
- [ ] 实测返回 eventCount 与浏览器实际播放音符数一致

如果实测仍慢 → 升级 step 投入（不应该发生，但 audit 即是保险）。

---

## ~~Step A12~~ → 已合并到 A3+A12 修复包

见上文 [Step A3+A12](#step-a3a12--score-queue-状态机修复包cron-合并)。

---

## Step A13 — useEventsPlayback 首播 decode 时序

### 概念简报

`useJam.ready` 仅代表 mp3 ArrayBuffer fetch 完成，不代表 AudioBuffer decode 完成。首次播放 events 进 queue，decode 完成后一次性爆发播放，慢网/低端机上前几秒事件错位。

### 📦 范围
- `src/hooks/useJam.ts`
- `src/hooks/useEventsPlayback.ts`

### 做什么

拆 `audioReady`（fetch 完成）+ `decodeReady`（decode 完成）。`useEventsPlayback` 等 `decodeReady` 才启动事件时钟。

### 验证标准

- [ ] DevTools Slow 3G 模拟 → 草稿播放前几秒事件时序与底曲对齐（耳听）
- [ ] verify.sh 通过

---

## Step A14 — 5s 乐观成功诚实文案 + polling

### 📦 范围
- `src/components/me/ScoreCard.tsx`
- `app/score/[id]/page.tsx`（标题文案）

### 做什么

- 灰卡显示"上链中（通常 5-30 分钟）"+ 已等待时长（基于 created_at）
- 加 useInterval polling /api/me/score-nfts 每 2 分钟 1 次
- token_id 出现时视觉成功动画（淡入 + 渐变）

### 验证标准

- [ ] 草稿铸造后 → 灰卡显示时长 + auto-refresh
- [ ] verify.sh 通过

---

## Step A15 — useMintScore 失败回滚

### 📦 范围
- `src/hooks/useMintScore.ts`
- `src/components/me/DraftCard.tsx`

### 做什么

`clientState=success` 后 30-60s 内 polling `/api/me/scores`，确认草稿确实从 drafts 数组消失（说明真入队）。polling 超时仍未消失 → toast "铸造提交失败，请重试" + 恢复 DraftCard。

### 验证标准

- [ ] 故意让 `mint_score_enqueue` RPC fail（如 manually 改 supabase 触发 limit） → 60s 后看到回滚 toast
- [ ] 正常路径无回归（5s 后草稿消失，不弹错误）

---

## Step A16 — operator-lock TTL 续期 + fail-closed

### 概念简报

当前 LEASE_MS = 30s，但 setTokenURI 在 OP Sepolia gas spike 时 receipt 等待可能 > 30s → 锁过期 → 下一个 cron 拿同锁 → nonce race。需要 TTL 加长 + 心跳续期 + 生产 fail-closed。

### 📦 范围（环境：测试网 cron + Upstash）
- `src/lib/chain/operator-lock.ts`
- `app/api/health/route.ts`（暴露 lockProvider 字段）

### 做什么

1. `LEASE_MS` 30s → 120s
2. **加心跳续期函数**，必须用 Lua 脚本校验 holder 后再 PEXPIRE（否则续到别人的锁）：
   ```lua
   if redis.call('GET', KEYS[1]) == ARGV[1] then
     return redis.call('PEXPIRE', KEYS[1], ARGV[2])
   else
     return 0
   end
   ```
   暴露 `heartbeatOpLock(myOwner)` 函数，长 step（writeContract / setTokenURI）期间每 30s 调一次
3. **生产环境 fail-closed**：
   ```ts
   if (!r) {
     if (process.env.NODE_ENV === 'production') return false;  // fail-closed
     return true;  // dev fail-open，但日志警告
   }
   ```
4. `/api/health` 加 `lockProvider: 'upstash' | 'fallback'`（fallback 表示 Upstash 未配）

### 验证标准

- [ ] verify.sh 全绿
- [ ] /api/health 暴露 lockProvider
- [ ] 故意删 .env.local 的 UPSTASH_* → dev 启动 acquireOpLock 仍 true（fail-open）+ console.warn
- [ ] 模拟 production 环境 → fail-closed（return false）
- [ ] Lua 心跳测试：另一个 owner 调 heartbeat 返 0，不影响真 holder

---

## Step A17 — mint_events upsert 失败检查

### 📦 范围
- `app/api/cron/process-score-queue/steps-set-uri.ts:99-112`

### 做什么

upsert 后补 `.error` 检查，失败时 throw（保持 setting_uri 可重试），或进入 manual_review。

### 验证标准

- [ ] 故意 mock supabase 返 error → step 失败而不是静默 success

---

## ~~Step A18~~ → audit only（已修）

**audit 结论**：commit `0d75a93` 已修。`app/api/cron/process-score-queue/route.ts` catch 块已按 isCritical 设 `failure_kind: 'manual_review' | 'safe_retry'`，migration 030 add column 已落地。

**仅需 audit 步骤**（10 分钟）：
- [ ] grep route.ts 确认 catch 块有 failure_kind 分流
- [ ] 测试网现有 failed row 抽样 → failure_kind 非 NULL

---

## Track A 完结标准

- [ ] 14 个有效 step 状态 ∈ {fixed, downgraded-accepted, audit-confirmed}（A7/A8/A11/A18 不计修复工时）
- [ ] `bash scripts/verify.sh` 全绿
- [ ] `forge test` 全绿（A2 涉及）
- [ ] migration 032 已在 Supabase 跑（A3+A12 修复包）
- [ ] A6 20/20 曲（week 1-20）arweave_url 齐全；剩 88 曲（week 21-108）arweave_url=NULL 允许（挪 P10 / 长期）
- [ ] STATUS.md "Track A 完结" + Phase 10 主网起点清单已更新（A7 充值 / A8 真接 alert / 长期 idempotency 方案 / 8 项 P1 挂 P10 清单）
- [ ] JOURNAL 决策记录连续（每个 P0 + 关键 P1 单独段）
- [ ] 触碰环境后的状态在 STATUS.md 反映：OP Sepolia 新 AirdropNFT 地址 / 新 Turbo wallet 地址 / 108 曲 Arweave 上链统计
