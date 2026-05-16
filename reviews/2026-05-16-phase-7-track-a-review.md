# Phase 7 Track A — 完结审查报告（自审 + Codex 合并）

> 审查日期：2026-05-16  
> 审查人：Claude Code（自审）+ Codex（独立审查，见下方）  
> 审查范围：Phase 7 Track A 全部有效 step（A1-A17）

---

## 一、完结标准核查

| 标准项 | 状态 | 备注 |
|---|---|---|
| 14 有效 step ∈ {fixed / downgraded / audit-confirmed} | ✅ | 见下方逐 step 表 |
| `bash scripts/verify.sh` 全绿 | ✅ | commit `dbd398e`，TS 0 error / ESLint 0 error / build 30 路由 |
| `forge test --match-contract AirdropNFTTest` 7/7 | ✅ | 2026-05-16 本地验证，用时 64ms |
| migration 032 在 Supabase 跑完 | ✅ | 端到端验证：历史卡死 tokenId 21/22 cron 自动跑完 |
| migration 033（tracks INSERT week 6-15）在 Supabase 跑完 | ✅ | check-tracks 诊断脚本确认 15 行，arweave_url 全部写入 |
| A6 曲目 arweave_url 齐全 | ⚠️ | **15 曲（week 1-15）** 而非 playbook 写的 20 曲。用户批准：艺术家本次给 10 首（No.6-15），剩余延 P10 |
| STATUS.md 更新 Track A 完结 | ✅ | 已更新 |
| JOURNAL 决策记录连续 | ✅ | A3+A12+A8 / A6 tracks 表发现 / Vercel env 错配 各有详细段落 |
| OP Sepolia 新 AirdropNFT 地址在 STATUS | ✅ | `0xC5923BEc5C79a203b0cf4ab7c82567c8E20eEF65` 已记录 |
| Turbo wallet 更换 | ⚠️ | **A5 暂挂**：用户决策"旧钱包暂时安全"。旧 wallet 仅控制 Arweave credits（不控合约），主网前 P10 必换 |

---

## 二、逐 step 状态

| Step | 状态 | commit / 验证 |
|---|---|---|
| A1 chain-config 单一来源 | ✅ fixed | `e0084db` |
| A2 AirdropNFT v2 _uriSet + 重部署 | ✅ fixed | forge 7/7，链上 `0xC5923BEc...EF65` |
| A3+A12+A8 score queue 状态机修复包 | ✅ fixed | `a48f4de`，端到端 tokenId 21/22 验证 |
| A4 MAINNET-RUNBOOK §3.3.2 验收命令 | ✅ fixed | `d4c61ca` |
| A5 换 Turbo wallet | ⚠️ deferred | 用户决策暂挂，P10 主网前必做 |
| A6 15 曲 arweave_url 上链 | ✅ fixed（范围调整） | `c2afd15`，DB 15 行验证 |
| A7 operator wallet 主网 ETH | — | 明确挂 P10 |
| A8 Resend manual_review 告警 | ✅ fixed | 顺手接入 A3+A12 fire-and-forget |
| A9 vercel-env-sync 脚本 | ✅ fixed | `dbd398e`，`npm run env-sync` |
| A10 /score 链上灾备降级壳 | ✅ fixed | `dbd398e`，FallbackShell + 返回链接修复 |
| A11 | ✅ audit-confirmed | commit `0d75a93` 已修 |
| A13 decode 时序 | ✅ fixed | `dbd398e`，decodeReady + triggerDecode |
| A14 ScoreCard 时间 + 2min polling | ✅ fixed | `d4c61ca` |
| A15 useMintScore 60s 回滚 | ✅ fixed | `d4c61ca` |
| A16 operator-lock TTL 120s + Lua + fail-closed | ✅ fixed（部分） | `dbd398e`，⚠️ **heartbeat 未接入 cron step**（见 Finding #1）|
| A17 mint_events upsert error 检查 | ✅ fixed | `dbd398e` |
| A18 | ✅ audit-confirmed | commit `0d75a93` 已修 |

---

## 三、自审 Findings

### P1-1 — A16 heartbeat 定义但未接入 cron step（需 P10 前补）

**位置**：`src/lib/chain/operator-lock.ts:68` — `heartbeatOpLock` 已导出，但 `steps-mint.ts` / `steps-set-uri.ts` 均未调用。

**风险**：LEASE_MS 已从 30s 升至 120s，大幅降低 OP Sepolia gas spike 时锁过期的概率。但若 `writeContract` + `waitForTransactionReceipt`（steps-set-uri 有 receipt 查询）累计超过 120s，锁仍会过期，下一个 cron 可能拿锁发起重复操作。

**已有缓解**：A3 `uri_attempted_at` 窗口防重发（10min 内不重发）在锁过期后也能兜底。

**建议**：P10 主网前在 `steps-set-uri.ts` 的 receipt polling 循环内加心跳（每 30s 调一次 `heartbeatOpLock`）。

---

### P2-1 — A9 脚本需手动配 VERCEL_TOKEN + VERCEL_PROJECT_ID

**位置**：`scripts/vercel-env-sync.ts`

**现状**：`.env.example` 已加说明注释，但 `.env.local` 用户需手动填入两个新 env var 后才能用 `npm run env-sync`。文档已有提示，无代码风险。

**建议**：主网部署前跑一次 `npm run env-sync` 确认没有 env typo（这正是 A9 的目的）。

---

### P2-2 — A13 AudioContext 在 useEffect 中创建的浏览器兼容性

**位置**：`src/hooks/useEventsPlayback.ts:32` 调 `triggerDecode()`，内部创建 `AudioContext`

**现状**：`useEffect` 在 React 合成事件（play 按钮点击）后同步执行，实践中浏览器通常允许。但严格模式下部分浏览器（Safari 旧版）可能要求更直接的用户手势上下文。

**已有缓解**：原有 `useJam` 里 `ensureDecoded` 对 AudioContext 创建是懒触发（第一次 `playSound` 才创建），现在改为主动触发，行为等价，仅提前了时机。

**建议**：Phase 9 音效系统扩展时，考虑把 AudioContext 创建从 effect 移入 PlayerProvider 的 `toggle()` 手势处理器，彻底解决兼容性顾虑。

---

## 四、与 Playbook 的偏差

| 偏差项 | 类型 | 原因 | 状态 |
|---|---|---|---|
| A6：15 曲而非 20 曲 | 范围缩减 | 艺术家本次只给 10 首，A 组从 5→15（非 5→20）| 用户批准，剩余挂 P10 |
| A5：旧 Turbo wallet 继续使用 | 风险接受 | 用户决策"暂时安全"，私钥仅控 Arweave credits | 用户批准，P10 必换 |
| A16：heartbeat 实现但未接入 | 半完成 | TTL 加长已提供主要防护，heartbeat 属增强项 | P1，P10 前补 |
| tracks 表 B/C 组靠前端循环 | 发现（非 bug） | B/C 36 球实际无 DB 行，靠 padTracksToTarget 填充 | JOURNAL 已记录，P10 同步 88 曲时需 INSERT |

---

## 五、Codex 独立审查（摘要）

> 完整报告：`reviews/2026-05-16-phase-7-track-a-codex-review.md`  
> 总体评分：P0: 0 | P1: 3 | P2: 3 | 结论：**can ship**

Codex 审查结论与自审基本一致，新增以下 findings（已全部处理）：

| Finding | 处理方式 |
|---|---|
| P1 — A9 `limit=100` 分页缺失，100+ env 时漏报 | ✅ 已加注释标注已知限制 |
| P1 — A9 encrypted secret C 类静默跳过未说明 | ✅ 已加注释 |
| P1 — A15 catch 块乐观竞态语义未注释 | ✅ 已在 catch 加注释 |
| P2 — migration 033 ON CONFLICT 重跑清 arweave_url | ✅ 已改 COALESCE 保留现有值 |
| P2 — migration 032 无内置重复行防护 | 挂 Phase 8 migration 周期 |
| P2 — steps-set-uri `mint_queue_id: null` 无注释 | 低优先级，Phase 8 顺手 |

Codex 对 A16 Lua 脚本逻辑评审为 ✅（三个脚本原子性和 holder 校验均正确）；A16 heartbeat 未接入 cron step 是自审补充 finding，Codex 未标记。

---

## 六、综合评定

**Track A 状态**：✅ **可以发布**（complete with known deferred items）

**必须在 P10 主网前处理：**
1. A5 换 Turbo wallet（私钥泄露风险，虽非链上合约，但 credits 可被滥用）
2. A16 heartbeat 接入 cron step（steps-set-uri receipt polling 期间）
3. A6 剩余 88 曲（week 16-108）arweave_url 上链（艺术家交付后批量 INSERT + upload）

**Phase 8 解锁**：Track A 完结标准达成（允许 A5 暂挂 + 15 曲偏差，已有用户批准），可以进入 Phase 8 UI 大升级。
