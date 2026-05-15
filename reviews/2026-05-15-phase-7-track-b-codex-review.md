# Codex Review 2026-05-15 — Phase 7 Track B（Semi 钱包前端接入）

**触发命令**：`codex review --base c3c65f6 --title "Phase 7 Track B B2+B3+fix（Semi 钱包前端接入）"`
**审查范围**：`c3c65f6..HEAD` = `1c38349`（B2+B3）+ `da9ccab`（fix 死循环）
**审查者**：Codex CLI 0.130.0（独立 AI 第二审）
**整合归档**：Claude 已在 `reviews/2026-05-15-phase-7-track-b-review.md` §"二审差异" 段汇入 + 已落地修复

---

## 摘要（codex 原文）

The Semi login implementation is mostly coherent, but the readiness value still depends solely on Privy and can hide valid Semi sessions. The new demo script also contains an address-verification step that the current UI cannot satisfy.

## Full review comments（codex 原文）

### [P2 → Claude 升 P1] Decouple Semi readiness from Privy

**位置**：`src/hooks/useAuth.ts:31`

> When a returning Semi user already has a valid `ripples_auth_jwt`, `semiAuth` is available synchronously, but the hook still returns `ready` directly from `usePrivy()`. Components such as `LoginButton` and `/me` render nothing while `ready` is false, so if Privy initialization is slow or blocked the Semi session appears blank even though `authenticated` is true; derive the returned readiness from `privyReady || semiAuth` instead.

**Claude 整合判定**：升 P1，真 bug。已修：`useAuth.ts:38 const ready = privyReady || semiAuth`。

### [P2 → Claude 升 P1] Align demo address check with the actual UI

**位置**：`docs/SEMI-DEMO-SCRIPT.md:26`

> This B4a step asks testers to verify a top-right address on `/me`, but the current `/me` page only renders the title and home link, and the shared login button shows `我的音乐` rather than an EVM address. Following the script will produce a false failure during Semi demo validation unless the UI is changed to display `evmAddress` or the step is rewritten to verify the address via the mint tx/Semi app.

**Claude 整合判定**：升 P1，文档误导。已修脚本第 6 步：改用 DevTools localStorage JWT payload `evm` 字段或 Etherscan mint tx 的 `to` 地址校验，不改 UI（Phase 5 决策保留 LoginButton "我的音乐 / 登出" 当前文案）。
