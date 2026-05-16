# Phase 7 Track A — Codex 独立审查报告

> 审查日期：2026-05-16  
> 审查人：Codex（独立，未参考自审报告）  
> 总体评分：**P0: 0 | P1: 3 | P2: 3**

---

## 逐 Step 评审

**A1 chain-config 单一来源** ✅ 通过  
`CHAIN_ID_NUM` 模块顶层解析 + 严格白名单（10/11155420）+ `'server-only'` 保护。无问题。

**A2 AirdropNFT v2** ✅ 通过（存档审查）  
合约层逻辑正确，依赖 A3 `uri_attempted_at` 防御，两者配合完整。

**A3+A12+A8 score queue 状态机** ✅ 通过，附 P2 观察  
migration 032 列定义和 partial unique index 正确。  
⚠️ **P2**：migration 本身无内置 `token_id` 重复行前置检查，依赖人工手动确认。若接入 CI 自动迁移会有风险。建议加 `RAISE EXCEPTION` 防护块。

**A4 MAINNET-RUNBOOK** ✅ 通过（文档层）

**A5 暂挂** — 不审查（用户决策）

**A6 migration 033** ⚠️ P2  
ON CONFLICT 幂等设计正确，但冲突更新分支 `arweave_url = NULL` 若重跑 migration 会清除已上链 URL。  
→ **本次已修复**：改为 `COALESCE(tracks.arweave_url, EXCLUDED.arweave_url)` 保留现有值。

**A9 vercel-env-sync** ⚠️ P1 × 2  
差异分类逻辑总体正确，`_env.ts` 解析风格一致。  
⚠️ **P1-a**：`?limit=100` 无分页，超 100 条 env 时静默截断，A/C 类可能漏报。→ **本次已加注释标注已知限制**。  
⚠️ **P1-b**：`vercelVal` 为空字符串（encrypted secret）时静默跳过 C 类比对，符合 API 限制但缺文档说明，维护者易误判。→ 已在注释中标注。

**A10 /score FallbackShell** ✅ 通过  
DB miss 渲染 FallbackShell，`← 我的收藏` 指向 `/me`，OG image 已有独立 `fallbackImage()`。完整。

**A13 decode 时序** ✅ 通过  
`idle → decoding → decoded` 三段状态机防并发重入；`setDecodeReady(true)` 在 decoded 后触发；`useEventsPlayback` proactive `triggerDecode` + 独立 `useEffect` 等 `decodeReady` 才启 RAF；`cancelAnimationFrame` cleanup 正确。

**A14 ScoreCard + useScoreNftPolling** ✅ 通过  
`tokenRef.current` 规避 getAccessToken 引用不稳（与 B3 同款方案）；`hasPending` 无待上链时停止轮询，无泄漏；`onRefresh` 排除 deps 有注释说明。

**A15 useMintScore 60s 回滚** ⚠️ P1  
整体逻辑正确。  
⚠️ **P1**：`mintScore` 请求快速失败时 `timerRef` 仍触发 `setState('success')` —— 这是有意为之的乐观模式，但 catch 块缺注释，维护者可能误以为 bug 并加 `clearTimeout` 破坏回滚兜底。→ **本次已在 catch 块加注释说明**。  
P2 附注：组件卸载时 `pollRef` 由 useEffect cleanup 的 `clearInterval` 正确处理，无泄漏。

**A16 operator-lock TTL + Lua + fail-closed** ✅ 通过  
三个 Lua 脚本均正确：`SET NX PX`（原子）/ `GET-then-DEL`（只删自己锁）/ `GET-then-PEXPIRE`（只续自己锁）；`LEASE_MS` 以毫秒传给 `PEXPIRE` 与 `px:` 语义一致；fail-closed/fail-open 分支符合注释说明。

**A17 steps-set-uri upsert error 检查** ✅ 通过，附 P2 观察  
`{ error: upsertErr }` 解构 + throw 正确，onConflict 与 index 一致。  
⚠️ **P2**：`mint_queue_id: null` 硬编码无注释，建议注明"ScoreNFT upsert 无 MaterialNFT 关联，故 null"。

---

## 关键风险汇总

| 优先级 | Finding | 位置 | 修复状态 |
|---|---|---|---|
| P1 | vercel-env-sync 分页限制（100 条截断） | `scripts/vercel-env-sync.ts` | ✅ 已加注释 |
| P1 | vercel-env-sync C 类 encrypted secret 静默跳过未说明 | 同上 | ✅ 已加注释 |
| P1 | useMintScore catch 乐观竞态语义未注释 | `src/hooks/score/useMintScore.ts` | ✅ 已加注释 |
| P2 | migration 032 无内置重复行防护 | `supabase/migrations/.../032_...sql` | 挂 Phase 8 migration 周期 |
| P2 | migration 033 ON CONFLICT 覆盖 arweave_url | `supabase/migrations/.../033_...sql` | ✅ 已修复为 COALESCE |
| P2 | steps-set-uri mint_queue_id null 无注释 | `steps-set-uri.ts` | 低优先级，可 Phase 8 顺手 |

---

## 完结建议

**can ship** — Track A 逻辑正确，P1 均已修复（注释），P2 不影响上线。
