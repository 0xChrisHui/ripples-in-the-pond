# Phase 6 严格 CTO Review（第二轮）

**日期**：2026-05-08
**审查范围**：Phase 6 v2 全量（基线 1019dcb → HEAD b418ade，~50 commits / 22,262 行）
**立场**：不复述 `2026-05-08-phase-6-completion-review.md`（那份太乐观）；专挑代码细节、并发、UX 一致性中没看见的尖锐问题
**方法论**：4 个并行 Explore agent 独立深扒不同模块（B2 视觉支线 / B8 数据流 / cron 状态机+锁 / 合约+部署），主审人手工读关键文件验证每条 P0/P1，**剔除误报、修订误评、保留已确认 finding**

---

## 摘要

**能进 Phase 7 主网吗？** 不能直接推。Phase 6 完成度足够进入"主网部署 runbook 准备阶段"，但 **3 个真实 P0 + 一个 P0 流程债**必须在 OP Mainnet 部署日 (Phase 7 Day 0) 之前清掉，否则现有 completion review 列的"硬阻塞清单 5 项"只覆盖了一半风险。

**最尖锐的四件事**（已有 review 漏看）：

1. **`operator-wallet.ts` 服务端链固定为 OP Sepolia 硬编码 ⚠️ MEGA P0**（codex 找到，4 个 agent + 我都漏看了）— `import { optimismSepolia } from 'viem/chains'` + `chain: optimismSepolia` 在 walletClient + publicClient 两处。主网部署后**即使 `NEXT_PUBLIC_CHAIN_ID=10` + 主网合约地址都同步了，cron 实际仍把 tx 发到 OP Sepolia**。配套问题：`score-source.ts:37` ETHERSCAN_BASE 硬编码 sepolia / `score/[id]/page.tsx:109` 合约链接硬编码 sepolia / DB 记主网合约地址 + 链上 tx 在测试网 → 灾难性数据/链分裂。
2. **`AirdropNFT.sol` 缺 `_uriSet` 防覆盖** — C1 防覆盖只加在 ScoreNFT，**AirdropNFT 完全没加**。MINTER_ROLE 私钥泄露 → 已发空投 NFT metadata 可被任意改成钓鱼链接。即使 D1 决策"主网不调度"，合约保留部署 = 攻击面保留。
3. **`stepMintOnchain` 有真实 in-flight 重 mint 风险** — `writeContract` 已广播到 mempool 后、`UPDATE tx_hash` 之前如果 Vercel sigkill（cron 超时被杀，非 throw 路径），下次 cron 看到 `tx_hash=null` 会**再发一次 mint**，用户拿到两个 ScoreNFT。设计仅在"DB write 失败 throw CRITICAL"路径下安全，没覆盖"进程被外部杀"路径。
4. **AirdropNFT 没有代码层 hard kill switch** — D1 主网"不调度"承诺只靠"cron-job.org 不配置 + admin trigger Bearer 不暴露"两层文档约束。任何人 supabase console 改一条 `airdrop_rounds.status='ready'` + 通过任一渠道触发 `/api/cron/process-airdrop` GET 就批量空投。代码层无 `if (!process.env.AIRDROP_ENABLED) return idle` 兜底。

**Phase 7 Day 0 必修（追加到现有硬阻塞 5 项）**：
- ✅ #1-5（已列）：换 Turbo wallet / 108 曲 arweave_url 全量 / Operator ETH / Resend / vercel-env-sync
- 🆕 **#6 MEGA P0**：抽 `src/lib/chain/chain-config.ts` 单一来源（从 `process.env.CHAIN_ID` 读取，仅允许 `10` 或 `11155420`），operator-wallet / public client / etherscan url / 前端 contracts.ts 都派生。生产环境 `CHAIN_ID !== '10'` 时启动 fail。删 3 处硬编码 sepolia 字符串 + 1 处 viem chain import。
- ➕ **#7**：AirdropNFT 加 `_uriSet`（7 行代码 + 重新部署）
- ➕ **#8**：stepMintOnchain 拆三步 / 加 idempotency 防 sigkill 双 mint
- ➕ **#9**：process-airdrop 入口加 `AIRDROP_ENABLED` env 硬开关
- ➕ **#10**：Deploy 脚本 4 个加 chainId == 10 时 `vm.envOr` fallback 转为 `revert`

剩下 24 项 P1（含 codex 补充的）建议 Phase 7 Day 1-3 完成，再启动主网部署。

---

## 验证方法论

### 4 个 Explore agent 独立深扒
- Agent A：`src/components/archipelago/`（sphere/effects/render/animations-svg）
- Agent B：`src/data/`、`app/api/me/*`、`app/score/[id]/*`、`src/hooks/use*`、`src/components/me/*`、`src/components/player/*`
- Agent C：`src/lib/chain/operator-lock.ts`、`app/api/cron/*`（含 steps-*）、`src/lib/auth/*`、migrations 021-029
- Agent D：`contracts/src/*`、`contracts/script/*`、`docs/MAINNET-RUNBOOK.md`、`scripts/arweave/*`、`scripts/load-env.ps1`

### 主审人手工验证（关键 finding）
- ✅ `AirdropNFT.sol:36-42` vs `ScoreNFT.sol:28,54-55` —— `_uriSet` 缺失确认
- ✅ `operator-lock.ts:39-47` —— fail-open（无 Upstash env 时 return true）确认
- ✅ `process-score-queue/steps-mint.ts:37-58` —— in-flight 双 mint 路径确认（throw CRITICAL 仅覆盖 DB write fail，不覆盖 sigkill）
- ✅ `process-airdrop/route.ts:38-46` —— 缺代码层 hard kill 确认
- ✅ `archipelago/render/render-helpers.ts:40-55` —— `initActivityTracking` 有模块级 `activityTrackingInited` 单例 flag，listener 只装一次（**Agent A P0 内存泄露误报**，降为 P3）
- ✅ `archipelago/hooks/use-sphere-sim.ts:212-213` —— ESLint disable 后所有依赖都是 ref 或 effectsRef 化（**Agent A P1 依赖数组缺失误报**，删除）
- ✅ `data/score-source.ts:41-49` —— 边界 `id="0"` → tokenId 1 自增 → 自然 404，不是 bug（**Agent B P0 边界误报**，删除）
- ✅ `migrations/track-a/026_save_score_atomic.sql:39-45` —— exception 回退 `WHERE status='draft'` 确实可能 null（**Agent B P1 真实**）
- ✅ `migrations/track-b/029_mint_score_enqueue_keep_draft.sql:74-83` —— `SELECT exists` + `INSERT` 之间的 race 仅靠唯一索引兜底，违反时报 SQL `unique_violation` 而非业务 `INVALID_SCORE` exception（**Agent B P1 真实**，但仅影响错误信息）
- ✅ `cron/sync-chain-events/route.ts:70-113` —— upsert 用 `onConflict ignoreDuplicates` 保证幂等，已成功 logs 重做无副作用（**Agent C P0.5 误评**，降为 P3 - 仅 I/O 浪费）

### Codex 独立第二意见
（codex CLI 在后台跑，本报告完成时尚未回来。codex 报告输出至 `reviews/2026-05-08-phase-6-codex-cto-review.md`，回来后增补到 §X）

---

## 维度 1：代码正确性与边界条件

### P0-0 · `operator-wallet.ts` 服务端链 OP Sepolia 硬编码 (Codex 找到，4 个 agent + 主审都漏看)
**文件**：
- `src/lib/chain/operator-wallet.ts:6,14,19` — `import { optimismSepolia }` + `chain: optimismSepolia` ×2
- `src/data/score-source.ts:37` — `const ETHERSCAN_BASE = 'https://sepolia-optimism.etherscan.io/tx'`
- `app/score/[id]/page.tsx:109` — `https://sepolia-optimism.etherscan.io/address/...` 硬编码

**问题**：viem 的 `chain` 参数决定 RPC 端点的 chainId 校验。即使 `ALCHEMY_RPC_URL` 在主网部署时改成 `https://opt-mainnet.g.alchemy.com/...`，因为 `chain: optimismSepolia` 写死，viem 调用 `eth_chainId` 会发现链不匹配 → tx 直接 revert（最佳情况）；或 RPC provider 路由到任一可用链 → tx 发到测试网（最坏情况）。

更严重的是 OPERATOR_PRIVATE_KEY 在两个网都是有效签名 → 即使 RPC URL 主网正确，但 `chain: optimismSepolia` 让 viem 发的 tx envelope 是 Sepolia 格式（chain id 11155420 in EIP-1559 fields） → 主网 RPC 会拒绝。但如果用户 RPC URL 漏改还指向测试网 → tx **真的就发到测试网**，DB 记主网合约地址 + 链上 tx 在测试网 → 数据/链分裂。

**修法**：抽 `src/lib/chain/chain-config.ts`：
```ts
import 'server-only';
import { optimism, optimismSepolia, type Chain } from 'viem/chains';

const id = process.env.CHAIN_ID ?? '11155420';
if (id !== '10' && id !== '11155420') {
  throw new Error(`Unsupported CHAIN_ID: ${id}`);
}
export const CURRENT_CHAIN: Chain = id === '10' ? optimism : optimismSepolia;
export const ETHERSCAN_BASE = id === '10'
  ? 'https://optimistic.etherscan.io'
  : 'https://sepolia-optimism.etherscan.io';
```
operator-wallet / score-source / page.tsx 全部从这个模块派生。生产环境 `CHAIN_ID !== '10'` 时启动 fail。

**严重度**：**P0**（**MEGA**，主网部署最大风险，比 P0-1 更严重）

### P0-1 · `AirdropNFT.sol` 缺 `_uriSet` 防覆盖
**文件**：`contracts/src/AirdropNFT.sol:36-42`（对比 `ScoreNFT.sol:28,54-55`）
**问题**：ScoreNFT v2 在 Phase 6 C1 加了 `mapping(uint256 => bool) private _uriSet` + `require(!_uriSet[tokenId])`，但 AirdropNFT.setTokenURI 完全没有这层保护。MINTER_ROLE 私钥泄露后已发出的 AirdropNFT metadata 可被任意改写（钓鱼链接 / 替换图片）。
**场景**：Phase 7 主网保留 AirdropNFT 部署但不调度（D1 决策）。如果 operator wallet 私钥泄露（Phase 6 已发生过 Turbo wallet 私钥泄露事件），坏人 `setTokenURI(任意tokenId, 钓鱼URL)` 把已发空投改成钓鱼链接。
**修法**：复制 ScoreNFT 的 `_uriSet` 逻辑（7 行）到 AirdropNFT，重新部署 + DB 同步地址。即使 D1=不做，合约保留部署就有暴露风险。
**严重度**：**P0**（主网阻塞）

### P0-2 · stepMintOnchain 在 sigkill 路径下双 mint 风险
**文件**：`app/api/cron/process-score-queue/steps-mint.ts:37-58`
**问题**：执行序列 `writeContract` (line 37-42) → `UPDATE tx_hash` (line 46-53) 之间，如果 Vercel cron 进程被外部杀掉（5min 硬限超时 / 部署期间 redeploy / Lambda OOM）：
- tx 已广播到 mempool 但 DB 未记 `tx_hash`
- 下次 cron 看到 `row.tx_hash=null && status='minting_onchain'`，进入 line 34 if 分支
- **再次发送 mint tx**，用户拿到两个不同 tokenId 的 ScoreNFT

线 55-58 的 `throw CRITICAL` **只覆盖 DB write 失败路径**（`dbOk` falsy），不覆盖进程被杀路径。
**修法**：
- 短期：拆三步 — ① UPDATE 标记 `attempted_at=now()` ② writeContract ③ UPDATE tx_hash。第 1 步成功后 sigkill，第二次 cron 看到 `attempted_at` 在 X 分钟内则等待 receipt；超时 X 分钟仍无 tx_hash 标 `manual_review`。
- 长期：用 idempotency key（基于 score_queue_id + chainId 的稳定哈希），viem 不直接支持但可用 `nonce` 固定 + `simulateContract` 预检
**严重度**：**P0**（主网阻塞，gas 拥堵时被放大）

### P0-3 · AirdropNFT 缺代码层 hard kill switch
**文件**：`app/api/cron/process-airdrop/route.ts:38-46`
**问题**：D1 决策"主网不做空投"只靠两层文档约束：① cron-job.org 不配置 ② `/api/airdrop/trigger` admin Bearer 不暴露。但 `process-airdrop` cron endpoint 仍会响应任何带正确 `CRON_SECRET` 的 GET 请求（line 38-46 仅做 `airdrop_rounds.status='ready'/'distributing'` 软检查）。
**场景**：CRON_SECRET 通过任意渠道泄露（cron-job.org 配置截图 / Vercel env dump）+ 任何人在 Supabase Console 改一条 `airdrop_rounds.status='ready'` + 任意 GET `/api/cron/process-airdrop?secret=xxx` 触发 → 批量空投。
**修法**：function 入口加：
```ts
if (process.env.AIRDROP_ENABLED !== 'true') {
  return NextResponse.json({ result: 'disabled' });
}
```
主网 Vercel 不设此 env，强制硬关闭。
**严重度**：**P0**（主网阻塞）

### P1-1 · `save_score_atomic` exception 回退可能返回 null
**文件**：`supabase/migrations/phase-6/track-a/026_save_score_atomic.sql:29-46`
**问题**：unique_violation 处理路径下 `SELECT id, expires_at WHERE status='draft' LIMIT 1`。但若 race 场景中"另一个并发请求恰好把这条 draft 也 update 成 expired 了"，`v_id` 仍 null，函数 `RETURN QUERY` 一行 (null, null)，前端调用方拿到无效 id，可能 crash 或写 supabase 时报 invalid uuid。
**修法**：补 null 检查：
```sql
if v_id is null then
  raise exception 'SAVE_FAILED: cannot recover draft after unique violation';
end if;
```
或扩展 SELECT 范围 `status in ('draft','expired') ORDER BY created_at DESC LIMIT 1`。
**严重度**：**P1**

### P1-2 · `mint_score_enqueue` v_already_enqueued check 与 unique_violation 双层防御不一致
**文件**：`supabase/migrations/phase-6/track-b/029_mint_score_enqueue_keep_draft.sql:74-83 + 102-117`
**问题**：T1/T2 并发：
- T1 SELECT exists → false / T2 SELECT exists → false
- T1 INSERT 成功 / T2 INSERT 触发 `uq_score_queue_pending_score` 唯一索引违反 → SQL `unique_violation` 异常（不是业务 `INVALID_SCORE` exception）
- API 调用方收到 `23505` 错误码而非可读 `INVALID_SCORE: pending_score already enqueued`，前端按 23505 错误处理可能误归类
**修法**：用 `INSERT ... ON CONFLICT (pending_score_id) DO NOTHING RETURNING id`，再检查返回行数 = 0 时 raise `INVALID_SCORE`。
**严重度**：**P1**（功能正确，错误信息不友好；并发量低时罕见）

### P1-3 · `OwnedScoreNFT.id` 双语义引发 React key 冲突
**文件**：`app/api/me/score-nfts/route.ts:43`、`src/components/me/ScoreNftSection.tsx`
**问题**：`id: r.token_id != null ? String(r.token_id) : r.id` —— 已上链 = 数字字符串，未上链 = UUID。如果用户同时有多个未上链的草稿（5s 乐观铸造连续触发多个 queue row），且 token_id 都还没回写 → ScoreCard 列表里多张 key=undefined → React 警告 + DOM diff 错乱。
**修法**：B8 P3 的 STATUS 已记为"P7 候选拆 brand type"，但目前列表渲染前应该 fallback `key = s.tokenId ?? s.queueId`（拆字段而非复用 id）。
**严重度**：**P1**

### P2-1 · 路由 `/score/[id]` 无 tokenId 范围 1..2^31-1 显式校验
**文件**：`src/data/score-source.ts:41-49`
**问题**：正则 `/^\d+$/` + `Number.isSafeInteger`，确实防住超大数字，但未拒绝 0（虽然 ScoreNFT 自增从 1 开始 → DB miss 自然 404，无 bug）；未拒绝 `Number.MAX_SAFE_INTEGER` (~9e15) — Postgres int4 上限 2147483647，传入会被 PG cast 失败抛错（被 `console.error` 捕获返 null）。
**修法**：补充：`if (n < 1 || n > 2147483647) return null;` —— 显式 fail-fast，避免 DB 层报错日志噪声。
**严重度**：**P2**

### P2-2 · `score-source.ts` events 静默降级到 `[]` 误导用户
**文件**：`src/data/score-source.ts:139-146`、`app/score/[id]/ScorePlayer.tsx`
**问题**：`pending_scores` 查询失败 → `console.error` + `events=[]`。`ScorePlayer` 看到 `events.length===0` 显示"无事件数据"。**用户实际录了演奏，但因为 DB 短暂故障/网络抖动/数据被误删 → 看到"无事件数据"以为是空草稿**。
**修法**：拆 `pendingError` 标志位，传给 ScorePlayer 区分"真空"vs"加载失败"，显示"演奏数据加载失败，请刷新重试"。
**严重度**：**P2**

### P1-21 · `useEventsPlayback` 首播音效 decode 队列压扁时序 (Codex 找到)
**文件**：`src/hooks/useEventsPlayback.ts:34`、`src/hooks/useJam.ts:56,76,94`
**问题**：`useEventsPlayback` 在 `ready` 为 true 后按 `performance.now()` 触发事件。但 `useJam.ready` 仅代表 mp3 ArrayBuffer 已 fetch 完成 —— **不代表 AudioBuffer 已 decode**。首次播放时 `useJam.ts:76` 才创建 AudioContext 并 decodeAudioData，期间所有 events 调用 `playSound` 进 queue；decode 完成后 line 94 一次性播放 queue 全部音效。慢网/低端手机上，乐谱前几秒事件**集中爆发**与底轨完全错位。
**修法**：分离 ready 状态：`audioReady`（fetch 完成）+ `decodeReady`（decode 完成）。`useEventsPlayback` 等到 `decodeReady` 才启动事件时钟。或改用 AudioContext.currentTime 调度（标准做法）。
**严重度**：**P1**（首播体验关键时刻）

### P3-1 · `initActivityTracking` 模块级 listener 跨路由生命周期不卸载
**文件**：`src/components/archipelago/render/render-helpers.ts:46-55`
**问题**：模块级 `activityTrackingInited` flag 保证 listener 只装一次（**不是内存泄露**），但用户离开 `/` 后 listener 仍在跑（无业务影响，仅微弱 idle 模式更新 lastActivityTime，CPU 几乎为 0）。
**修法**：可选。如果 SPA 内有大量切换路由场景，未来可改为 ref-counted（首次 mount 装 / 全部 unmount 清）。
**严重度**：**P3**（Agent A 误报为 P0；修订降级）

---

## 维度 2：架构一致性

### P1-4 · 4 个 B2 视觉文件接近 220 行硬线
**文件**：
- `src/components/archipelago/hooks/use-sphere-sim.ts` 214 行
- `src/components/archipelago/hooks/use-sphere-zoom.ts` 213 行
- `src/components/archipelago/Archipelago.tsx` 207 行
- `src/components/archipelago/render/comet-system.tsx` 204 行
- `src/components/archipelago/sphere-config.ts` 203 行

**问题**：CONVENTIONS 200 行硬线（已放宽到 220）下任何 effect 增功能（focus 进阶 / cull 优化 / eclipse 动画）都会突破。Phase 7 UI 重设计若复用现有 sim → 一定踩线。
**修法**：现在拆，趁记忆清晰 — `use-sphere-sim` 拆出 filter/cull 子 hook；`comet-system` 拆出 head 渲染。
**严重度**：**P1**（架构防御）

### P1-5 · A5 链上灾备删除后 `/score/[id]` 无任何 fallback
**文件**：`src/data/score-source.ts:13-14`（注释）
**问题**：B8 P3 删 score-fallback.ts noop 残留 + decoder iframe 后，`/score/[id]` 完全依赖 Supabase 查 4 个表（score_nft_queue / pending_scores / tracks / users）。Supabase 宕机或 Free tier 用量上限 → 所有分享链接 404。Arweave 上有 metadata 但页面无法读取。
**修法**：Phase 7 第 1 周内必须重设。短期方案：`/score/[id]` 加 catch-all → 直接渲染从合约 `tokenURI()` 拿到的 metadata（即使没有 events 数据也能展示封面+标题+创作者）。长期方案：events_data 也上 Arweave（合约 metadata 加字段）。
**严重度**：**P1**（主网风险，Phase 7 Day 1 必修）

### P2-3 · `/test` 沙箱页 vs 主页 80% 代码重复
**文件**：`app/test/page.tsx` vs `app/page.tsx`
**问题**：B2 25 轮迭代沉淀的 `/test` 沙箱页和主页都用 Archipelago + SvgAnimationLayer + PerfHUD，仅差一个 EffectsPanel 浮层。Phase 6 已结束，沙箱使命完成。
**修法**：要么删 /test，要么提取共享 layout，/test 仅注入 EffectsPanel。
**严重度**：**P2**（dead code 卫生）

### P2-4 · `score-source.ts` 单文件承担太多职责
**文件**：`src/data/score-source.ts`（176 行）
**问题**：路由判断 + tokenId→queue 转发 + queue 查询 + 三路 allSettled fetch + cover 解析 + 错误日志全在一个文件。Phase 7 加灾备后必然爆 220 行。
**修法**：现在拆 `resolveScoreId(id)` 路由层 + `fetchScoreData(queueId)` 业务层。
**严重度**：**P2**

### P2-13 · `contracts.ts` 前端 ABI 仍保留 TBA 函数（Codex 找到）
**文件**：`src/lib/chain/contracts.ts:111`（推测行号）
**问题**：MintOrchestrator C4 已删 TBA 实现，但前端 ABI 仍暴露 `tbaEnabled`、`setTbaEnabled`。新人看到 ABI 写出运行时必 revert 的代码。
**修法**：删 dead ABI 项 + grep 检查无 TBA 调用进入生产路径。
**严重度**：**P2**

### P3-2 · MintOrchestrator `_maybeCreateTba` 空钩子保留
**文件**：`contracts/src/MintOrchestrator.sol:20-23`（注释）
**问题**：C4 删 TBA 但保留空钩子注释。Phase 7 若加回 TBA 必须新部署 OrchestratorV2（TokenId 范围 / proxy 路由都要重新设计）。当前状态对未来 upgrade path 没有任何技术准备。
**修法**：runbook 加章节 "Future TBA Expansion Strategy"；或在 ARCHITECTURE 决策表更新到第 13 条。
**严重度**：**P3**（长期债，不影响主网功能）

---

## 维度 3：幂等性、事务性、并发安全、恢复语义

### P1-22 · step 内状态跳转 vs route CAS 冲突（Codex 找到）
**文件**：`app/api/cron/process-score-queue/route.ts:86-100` + `steps-upload.ts:31`
**问题**：`steps-upload.ts:31` 在 step 内部把 status 从 `pending` update 到 `uploading_events`（第一段执行）；但 route.ts:97 的 CAS 用**原始 `row.status`**（即 'pending'）做 `.eq('status', row.status)` —— 当 step 已经推进过 status 后，CAS **必然失败**，结果 row 保持 `uploading_events` 状态但 lease 没清。下一轮 cron 要等 5 分钟 lease 过期才能 claim → **每个中间状态至少等一次 lease 过期** → "约 5 分钟"实际变 "5 步 × 5 分钟 = 25 分钟"。
**修法**：把状态推进收敛到 step 内（step 直接做 final update，route 不再 update 状态），或非 final step 主动释放 lease。
**严重度**：**P1**（lease 25 分钟问题的真正根因）

### P1-23 · `mint_events` upsert 失败被忽略（Codex 找到）
**文件**：`app/api/cron/process-score-queue/steps-set-uri.ts:99-112`
**问题**：upsert 调用没有 `.error` 检查，step 仍返回 success → route 标 row `completed`。链上 mint 成功，但运营审计 / Owner 投影 / 展示依赖的 mint_events 记录可能永久缺失。material 流程同位置有 error 检查 → 不一致。
**修法**：补 error 检查，失败时 throw（保持 setting_uri 可重试），或进入 manual_review。
**严重度**：**P1**

### P1-6 · `operator-lock.ts` 在无 Upstash env 时 fail-open
**文件**：`src/lib/chain/operator-lock.ts:39-47`
**问题**：line 41-44 `if (!r) return true;`。生产 Vercel 一般有 env，但 typo / 未同步 / token expired 时 `getRedis()` 静默 return null → 整个 acquireOpLock fail-open，3 个 cron 同时跑 → nonce race。Phase 6 修过的 5/6 Bug C 同款"env var typo"问题在这里又开了一扇窗。
**修法**：
- 生产环境 fail-closed：`if (!r && process.env.NODE_ENV === 'production') return false;`
- 加 health check 字段暴露 `lockProvider: 'upstash' | 'fallback'`
**严重度**：**P1**

### P1-7 · 锁 TTL 30s vs setTokenURI 链上 receipt 等待时间
**文件**：`src/lib/chain/operator-lock.ts:17`、`steps-set-uri.ts`
**问题**：`LEASE_MS = 30_000`。设计假设单次 cron 执行 < 5 秒，但 setTokenURI 在 OP Sepolia gas spike 时等 receipt 可能 >30 秒 → Upstash 锁过期 → 下一个 cron 拿到锁同时跑 → nonce race（虽然 score-queue durable lease 已防住同一行被双 process，但 mint-queue / airdrop 跑别的行不受 durable lease 保护）。
**修法**：锁 TTL → 120s（覆盖最坏 receipt 等待 + 网络抖动 + buffer）；或加心跳续期机制。
**严重度**：**P1**

### P1-8 · `failure_kind` 在 catch 路径没有默认值
**文件**：`app/api/cron/process-score-queue/route.ts:113-134`
**问题**：catch 块 line 121-134 仅在 `shouldFail` 为 true 时设 `status='failed'`，**完全没设 `failure_kind`**。结果：score_nft_queue 失败行的 failure_kind 永远是 NULL，无法区分 safe_retry vs manual_review。运维只能手工 SQL 判断 last_error 文本。
**修法**：补：
```ts
failure_kind: shouldFail ? (isCritical ? 'manual_review' : 'safe_retry') : undefined,
```
**严重度**：**P1**

### P1-9 · `/api/health` `oldestAgeSeconds` 用 updated_at 而非 created_at
**文件**：`app/api/health/route.ts:94-107`
**问题**：cron 每次尝试都会刷 updated_at（即使没推进状态）→ oldestAgeSeconds 永远 < 60s（cron 频率）→ 告警系统无法区分"队列堆积"vs"cron 在循环重试同一行"。监控形同虚设。
**修法**：改用 created_at（"入队时刻"）或新增 first_attempt_at 字段。
**严重度**：**P1**

### P1-10 · `/api/cron/queue-status` 接受 query string token
**文件**：`app/api/cron/queue-status/route.ts:32-44`
**问题**：D2 决策 admin 端点 Bearer only，但 queue-status 仍接受 `?token=`。运维浏览器粘贴链接 → token 进浏览器历史。
**修法**：统一改 Bearer，删 query 兼容（破坏性改动，需通知 ops）。
**严重度**：**P1**

### P1-11 · `airdrop_recipients.resetToPending` 无 CAS
**文件**：`app/api/cron/process-airdrop/route.ts:190-195`
**问题**：函数无 `.eq('status', 'minting')` CAS 校验。两个 cron 同时调（虽然 operator-lock 防住了，但 lock fail-open 时可能并发）→ 互相覆盖 tx_hash。
**修法**：加 `.eq('status', 'minting').select('id')` 做幂等保护。
**严重度**：**P1**

### P3-3 · sync-chain-events 单 batch 内单 log 失败仍写前面成功的 log
**文件**：`app/api/cron/sync-chain-events/route.ts:70-113`
**问题**：内层 for 循环每条 log 单独 upsert（无 transaction 包裹），第 N 条失败时前 N-1 条已写入 DB。但有 `onConflict: 'tx_hash,log_index', ignoreDuplicates: true` —— 下次 cron 重做整批，前 N-1 条幂等跳过。**功能正确**，仅多花 N-1 条 SELECT UNIQUE I/O。
**修法**：可选，如果 chain_events 量大未来优化为 batch upsert RPC。
**严重度**：**P3**（Agent C 误评 P0；修订降级）

---

## 维度 4：上线风险与可运营性

### P0-4 · MAINNET-RUNBOOK 缺权限授权验收步骤
**文件**：`docs/MAINNET-RUNBOOK.md:77-106`
**问题**：步骤 3.3 部署 Orchestrator 后说"admin 手动调 grantRole"（3.3.1），但**没有任何"验收步骤"**。如果 ops 漏做 grantRole，部署成功，但所有 mintScore 调用 revert（"AccessControl: account is missing role MINTER_ROLE"）。靠错误日志反查需要时间。
**修法**：3.3.1 后加：
```bash
cast call $SCORE_NFT_ADDR 'hasRole(bytes32,address)' \
  $(cast keccak 'MINTER_ROLE') $ORCHESTRATOR_ADDR \
  --rpc-url $OP_MAINNET_RPC
# 期望：true
```
没有这一步的合约视为部署未完成。
**严重度**：**P0**（主网部署流程债）

### P1-12 · Deploy 脚本 vm.envOr 在主网无强制 fail-fast
**文件**：4 个 Deploy*.s.sol — `DeployScore.s.sol:29-30` / `DeployOrchestrator.s.sol:30-31` 等
**问题**：`vm.envOr("ADMIN_ADDRESS", deployer)` 测试网零配置回退合理，但主网部署时若环境变量 unset / typo / shell 没 export → **静默降级 admin=minter=deployer** → 整套权限模型失效（应该冷钱包持有 admin / 热钱包持有 minter）。
**修法**：脚本入口加：
```solidity
if (block.chainid == 10) {
  // OP Mainnet 必须显式三元组
  require(bytes(vm.envString("ADMIN_ADDRESS")).length > 0, "MAINNET_ADMIN_REQUIRED");
}
```
或环境变量 `DEPLOY_MODE=mainnet` 时强制。
**严重度**：**P1**（部署陷阱）

### P1-13 · MAINNET-RUNBOOK 缺 forge verify-contract 步骤
**文件**：`docs/MAINNET-RUNBOOK.md`
**问题**：runbook 没有 source verify 步骤。OP Mainnet 用 Blockscout（Etherscan 子项目），需要 `--verifier blockscout --verifier-url https://api-optimistic.etherscan.io/api`。无源码 verify → 用户在 Blockscout 看合约只有 bytecode → 信任降低。
**修法**：runbook §3.5 新增 verify 命令模板 + ENV 变量 `OPSCAN_API_KEY`。
**严重度**：**P1**

### P1-14 · `load-env.ps1` 转义/多行 value 处理薄弱
**文件**：`scripts/load-env.ps1:17-29`
**问题**：用 `IndexOf('=')` + `Set-Item -Path "Env:$key"` 简单赋值。三个边界 case：① 多行 JWK（部分钱包导出）会断裂 ② value 含 `$` PowerShell 解析转义 ③ 空 value 赋空字符串而非 skip。
**问题已知前科**：5/6 Bug C 第一层根因 = turbo-wallet.json purpose 中文行解析崩。
**修法**：用 `[System.IO.File]::ReadAllText($path)` 读全文 + regex 解析 KEY=VALUE 形式（支持引号包裹的多行）。
**严重度**：**P1**

### P1-24 · airdrop 地址在模块顶层 `getAddress` 会拖垮无关 cron（Codex 找到）
**文件**：`src/lib/chain/contracts.ts:149`
**问题**：`AIRDROP_NFT_ADDRESS` 用 `getAddress(process.env.NEXT_PUBLIC_AIRDROP_NFT_ADDRESS)` 在模块顶层执行。如果主网部署时按 D1 决策"不部署 AirdropNFT"或环境变量名 typo（`AIRDROP_NFT_ADDRESS` vs `NEXT_PUBLIC_AIRDROP_NFT_ADDRESS`），任何 import `contracts.ts` 的服务端路径都启动即 throw —— **包括完全无关的 score / material cron**。
**修法**：合约地址 lazy validate（封成 getter / 仅在使用前校验）。score cron 不应该因为 airdrop env 缺失启动失败。
**严重度**：**P1**（部署陷阱）

### P1-15 · Resend 邮件告警未做（已知）
**文件**：B8 P3 commit message 提到
**问题**：当前完全靠 `/api/health` 人工巡查。主网生产环境 cron 失败 / Turbo 钱包余额低 / queue stuck > 阈值时无主动 alert。
**修法**：起一个 `lib/alerts/resend.ts`，5 个触发条件接 health endpoint cron。
**严重度**：**P1**（已列硬阻塞 #4）

### P1-16 · vercel-env-sync 脚本未做（已知）
**问题**：5/6 Bug C 第二层根因 = `NEXT_PUBLIC_SCORE_NFT_ADDRES` 少 S。当前防 typo 完全靠人眼。
**修法**：脚本对比 `.env.local` 与 Vercel API 的 key 集合差异。
**严重度**：**P1**（已列硬阻塞 #5）

### P2-5 · `cron-job.org` 单点依赖无备份调度器
**问题**：5 个 cron job 全在 cron-job.org（免费）。该服务宕机 = 整个铸造链路停。
**修法**：Phase 7 加 GitHub Actions 备份触发（每 5min 调一次 cron endpoint），双活。
**严重度**：**P2**

### P2-6 · 旧 Turbo wallet 私钥泄露后产物所有权处理不清楚
**问题**：旧地址 `0xdE788249e747FB54c19e7B7F9baE85B631B9Fba8` 已上传 26 音效 + 100 封面 + decoder + sounds map。Arweave 内容寻址，泄露的是钱包不是数据，**已上链 tx 不可篡改**。但旧钱包仍可继续用同名 tag 发新 tx 制造混淆（覆盖语义，虽然 Arweave 实际是 append-only，但 GraphQL gateway 会优先返回最新 tag 匹配）。
**修法**：runbook §5 新增"钱包轮换"章节，明确说"换新 wallet 重新上传所有 assets + 旧 tx 仍永久有效但不再可信"。
**严重度**：**P2**（已列硬阻塞 #1）

### P3-4 · `PerfHUD` 在生产可见
**文件**：`app/page.tsx:61` 之类
**问题**：实时 FPS / maxMs 暴露给用户。无业务数据但暴露内部性能 + 可能用于逆向竞品。
**修法**：`if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_PERF_HUD === '1') { ... }`
**严重度**：**P3**

---

## 维度 5：用户体验与产品语义

### P1-17 · 5s 乐观成功 vs 25min 真上链的"假成功"窗口文案不诚实
**文件**：`app/score/[id]/page.tsx`、`src/components/me/ScoreCard.tsx`
**问题**：用户点"铸造" → 5s 后看"铸造成功 ✓"，但实际 25 分钟（cron lease 5min × 5 步）后 token_id 才上链。**这 25min 内 F5 看到"上链中"灰卡 → 反复刷新 → 5min 后开始怀疑产品坏了**。文案 "Ripples · 上链中" 没有时间预期。Phase 7 主网 gas 拥堵时这个窗口可能 1 小时+。
**修法**：
- ScoreCard 灰卡显示 "上链中（通常 5-30 分钟）"
- 加已等待时长显示（基于 created_at）
- 加自动 polling（每 2min 重新 fetch /api/me/score-nfts）+ 视觉成功动画
**严重度**：**P1**（信任建设）

### P1-18 · `/me` 草稿铸造失败用户无回滚提示
**文件**：`src/hooks/useMintScore.ts:37-61`
**问题**：5s setTimeout 强制设 `success`，后端 fetch 失败仅 console.error。如果 mint_score_enqueue RPC 失败（COVER_POOL_EMPTY / 限流 / DB 崩）→ 5s 后 UI 显示"铸造成功 ✓"但实际未入队 → DraftCard 消失（草稿被前端过滤）→ 用户以为成功了，下次刷新发现没出现 → **不知道哪里出错**。
**修法**：
- DraftCard 在 `clientState=success` 后 30-60s 内 polling `/api/me/scores` 验证草稿确实从 drafts 数组消失（说明真入队）
- polling 超时仍未消失 → 显示 toast "铸造提交失败，请重试" + 恢复 DraftCard
**严重度**：**P1**

### P2-7 · 路由双兼容造成分享链接两种格式 SEO 重复
**文件**：`src/data/score-source.ts:39-49`
**问题**：旧链接 `/score/12`（数字 token_id）和新链接 `/score/<UUID>` 都返回同样内容 → 微信/Twitter 缓存两套 OG → Google 索引重复。
**修法**：`page.tsx` 加 `<link rel="canonical" href={canonicalUrl} />`，canonical 永远用已上链的 `/score/<tokenId>`（未上链时 noindex）。
**严重度**：**P2**

### P2-8 · 灰卡（未上链）vs 正常卡（已上链）的 opacity 70% 区分对 a11y 不友好
**文件**：`src/components/me/ScoreCard.tsx:20`
**问题**：仅靠 `opacity-70` 区分 → 屏幕阅读器 / 黑白屏看不出。
**修法**：加显式徽章 "上链中" / "已上链" + `aria-label`。
**严重度**：**P2**

### P2-9 · `useFavorite` 乐观 UI 失败回滚的 race
**文件**：`src/hooks/useFavorite.ts:30-94`
**问题**：用户连点 5 次同一个 ❤️ → 5 个并发请求 → 返回顺序乱 → 某个 409 (needsReview) 被后续 200 覆盖。`pendingRef` 在文件中存在但只用于登录 flow，未用于 dedupe。
**修法**：在 doFavorite 入口加 `if (pendingRef.current) return;` dedupe。
**严重度**：**P2**

### P2-10 · `/me` 的"我的创作" vs "我的唱片"语义对普通用户不直观
**问题**：A6 决策"我的乐谱 = 我铸造的"语义清晰但 UI 文案"创作"（草稿）vs"唱片"（已铸造）需要用户理解"草稿"概念。
**修法**：改为"我的演奏（铸造中）"vs"我的演奏（已发行）"。
**严重度**：**P2**（产品文案债）

### P3-5 · B6 占位曲名 1-5 vs 艺术家未给会让 metadata 永久带数字
**问题**：链上已铸造的 NFT metadata 不可改 — 现在用 1-5 占位铸出去的 NFT 永远叫"1"/"2"/...。艺术家给名后只影响后续新铸。
**修法**：暂停 B6 曲目的草稿铸造接口（前端按钮 disable 或后端 RPC reject），等艺术家给名再 re-enable。或文档里明确"1-5 是占位 demo，正式发行前不要铸造"。
**严重度**：**P3**（已知，挂悬空 TODO）

---

## 维度 6：下一阶段债务（Phase 7 返工风险）

### P0-5 · 108 曲 arweave_url 仅 5/108 已上链
**问题**：B6 demo 5 球已上 Arweave。剩 103 曲 `tracks.arweave_url=NULL` → cron stepUploadMetadata 必崩 → 草稿铸造完全无法走通。
**修法**：换新 Turbo wallet 后跑 `scripts/arweave/upload-tracks.ts` 一次性补 + UPDATE 103 行。**主网部署日 Day 0 任务**。
**严重度**：**P0**（已列硬阻塞 #2）

### P1-19 · `/api/me/score-nfts` 35 秒慢，主网用户量增长会先崩
**文件**：`app/api/me/score-nfts/route.ts:26-34`
**问题**：联表 `pending_scores(events_data)` 取大 JSON 数组算 eventCount。100 张唱片 = 100 次 N+1 查询。已记 P7 候选，但主网用户量增长会先于优化崩。
**修法**：现在就改 `jsonb_array_length(pending_scores.events_data) AS event_count`（一行 SQL 改动），或拆 client-side fetch（先返主信息，eventCount 单独 endpoint）。
**严重度**：**P1**（不修，主网 Day 1 投诉风险）

### P1-20 · `cron lease 5 分钟 × 5 步 = 25 分钟`问题（已知）
**问题**：每条 row 5 步状态机理论 25 分钟才能从 pending 走到 success。STATUS 文案"约 5 分钟"不准。Phase 7 主网用户量增长会被放大。
**修法**：选项：① 终态时清 lease + 提前推进 ② cron 频率 1min → 30s ③ 文档对齐真实节奏。**B7 端到端冒烟前需决策**。
**严重度**：**P1**

### P2-11 · `score_nft_queue.token_id` 缺 partial unique index（已知）
**修法**：`CREATE UNIQUE INDEX uq_score_queue_token_id ON score_nft_queue(token_id) WHERE token_id IS NOT NULL`。前置检查现有数据无重复。
**严重度**：**P2**

### P2-12 · TBA 空钩子保留无 upgrade path（同 P3-2）
**修法**：runbook 加 "Future TBA Expansion Strategy" 章节。
**严重度**：**P2**（重复条目）

---

## 综合判定

### 能进 Phase 7 主网吗？

**否，不能直接推**。Phase 6 完成度足以进入 "Phase 7 Day 0 主网部署 runbook 准备"，但需要 9 项硬阻塞清完才能真上：

| # | 项目 | 来源 | 工时估 |
|---|---|---|---|
| 1 | 换 Turbo wallet | 已列 P7 硬阻塞 | 0.5 天 |
| 2 | 108 曲 arweave_url 全量 | 已列 P7 硬阻塞 + P0-5 | 0.5 天 |
| 3 | Operator wallet 主网 ETH | 已列 P7 硬阻塞 | 0.1 天 |
| 4 | Resend 邮件告警 | 已列 P7 硬阻塞 + P1-15 | 1 天 |
| 5 | vercel-env-sync 脚本 | 已列 P7 硬阻塞 + P1-16 | 0.5 天 |
| 6 | **新增**：AirdropNFT 加 `_uriSet` | P0-1 | 0.3 天 |
| 7 | **新增**：stepMintOnchain 双 mint 防御 | P0-2 | 1 天 |
| 8 | **新增**：AirdropNFT hard kill switch | P0-3 | 0.1 天 |
| 9 | **新增**：MAINNET-RUNBOOK grantRole 验收 | P0-4 | 0.2 天 |

合计 4.2 天工作量。

### Finding 总数

| 严重度 | 数量 | 备注 |
|---|---|---|
| P0 | 6 | 主网阻塞，部署日前必修（含 codex 找到的 P0-0 chain 硬编码）|
| P1 | 24 | 主网首周内必修（含 codex 找到的 4 项：P1-21/22/23/24）|
| P2 | 13 | 一周内修，不阻塞主网（含 codex 找到的 P2-13）|
| P3 | 5 | 跟踪，长期债 |
| 合计 | 48 | 实际 finding 数：4 agent 报告 61 项 - 13 项误报删除/降级 = 48 项 |

### Phase 7 启动建议

**Day 0**（主网部署日）：清 10 项硬阻塞（5-6 天工作量）
- 5 项已知（换 wallet / 108 曲 / Operator ETH / Resend / vercel-env-sync）
- 5 项本 review 新增（chain config 重构 / AirdropNFT _uriSet / stepMintOnchain 拆步 / AirdropNFT hard kill / Deploy 脚本主网强制）

**Day 1-3**：修 24 项 P1（重点：P1-5 链上灾备 / P1-17 假成功窗口文案 / P1-19 API 性能 / P1-22 lease 25 分钟根因 / P1-24 airdrop env lazy validate）

**Day 4+**：UI 重设计深度版 / Semi OAuth / 监控告警 / 退出准备 / 艺术家反馈 5 条

### 已有 completion review 漏看的 6 条（最重要）

1. **🔥 chain 服务端硬编码 sepolia**（P0-0，Codex 找到）— 主网部署后 cron 实际发到测试网，DB/链分裂
2. **AirdropNFT 缺 `_uriSet`**（P0-1）— C1 防覆盖只覆盖 ScoreNFT
3. **stepMintOnchain sigkill 双 mint**（P0-2）— throw CRITICAL 仅覆盖 DB write 失败路径
4. **AirdropNFT 没代码层 hard kill**（P0-3）— D1 决策只靠文档约束
5. **lease 25 分钟根因 = step 内状态跳转 vs route CAS 冲突**（P1-22，Codex 找到）— 不是设计意图，是 bug
6. **operator-lock fail-open + Deploy 脚本主网静默降级**（P1-6 + P1-12）— 5/6 Bug C 同款 env var 风险

### Codex 独立第二意见

Codex 用 default 模型（gpt-5）独立 review，输出 237 行报告 → `reviews/2026-05-08-phase-6-codex-cto-review.md`。

**Codex 找到的关键 P0/P1 已增补到本报告**：
- P0-0 服务端链 OP Sepolia 硬编码（4 个 agent + 主审都漏看的最严重 P0）
- P1-21 useEventsPlayback decode 时序首播音效压扁
- P1-22 step 内状态跳转 vs route CAS 冲突（lease 25 分钟根因）
- P1-23 mint_events upsert 错误被忽略
- P1-24 airdrop 地址 module 顶层校验拖垮无关 cron
- P2-13 contracts.ts TBA dead ABI 残留

**Codex 综合判定**：能进 Phase 7 整理 + 主网准备阶段，但不能直接公开测试或主网；P0 阻塞 1 项（chain 硬编码）+ P1 必修 12 项 + P2/P3 跟踪 14 项。

**与本报告（主审）交叉验证一致**：P0-0 (chain 硬编码)、P1-5 (A5 灾备)、P1-7 (锁 TTL)、P1-17 (5s 乐观失败)、P1-19 (events_data 性能) 等核心 finding 双方独立得出相同结论；codex 视角更偏向"架构承诺 vs 实现脱节"和"运营兜底"，本报告 4 个 agent 视角更偏向"代码细节并发漏洞"，互补。

---

## 决策记录

本报告 finding 修订自 4 个 Explore agent 报告 + 1 份 Codex 独立 review：
- Agent A（B2 视觉）11 项 → 修订 7 项保留 + 4 项误报删除（initActivityTracking P0 / cfgRef P1 / use-sphere-sim 依赖 P1 等）
- Agent B（B8 数据流）18 项 → 修订 14 项保留 + 4 项降级或删除（id="0" 边界 / events 静默 P1→P2 等）
- Agent C（cron 状态机）16 项 → 修订 12 项保留 + 4 项降级（sync-cursor 事务性 P0→P3 等）
- Agent D（合约部署）16 项 → 修订 13 项保留 + 3 项降级
- **Codex 独立 review** 18 项 → 6 项交叉验证已在本报告 + 6 项新增（含 MEGA P0-0 chain 硬编码）+ 6 项与已列重叠

**最终 finding 数量：6 P0 + 24 P1 + 13 P2 + 5 P3 = 48 项**

### 关键修订决策

**误报删除（5 项）**：
1. Agent A：`initActivityTracking` P0 内存泄露 → 误报。模块级 `activityTrackingInited` flag 已确保 listener 只装一次。降级 P3。
2. Agent A：`cfgRef = useRef({...})` ref-during-render P0 → 误报。`useRef(initialValue)` 是合法 React 模式。删除。
3. Agent A：`use-sphere-sim.ts:212-213` ESLint disable 缺依赖 P1 → 误报。所有引用均为 ref 或 effectsRef 化，是有意设计。删除。
4. Agent B：`/score/[id="0"]` 边界 P0 → 误报。tokenId 自增从 1，0 lookup 自然 404。降级 P2 仅文档化。
5. Agent C：sync-cursor 事务性 P0 → 误报。`onConflict ignoreDuplicates` 保证幂等，仅多花 I/O。降级 P3。

**Codex 找到 4 个 agent + 主审都漏看的 MEGA P0**：
`operator-wallet.ts` 服务端链 `optimismSepolia` 硬编码 + 配套 etherscan url 硬编码 → 主网部署后 cron 实际仍发到测试网。这是 Phase 6 → Phase 7 主网最大的隐性风险。
