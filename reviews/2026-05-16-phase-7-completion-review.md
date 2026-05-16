# Phase 7 Completion Review — 宏观收尾

> 日期：2026-05-16  
> 范围：Phase 7 全部 Track（A 修严重 BUG / B Semi PoC / C 全站提速 / D 登录 UI）  
> 结论：**可以收尾进入 Phase 8**，但以“complete with deferred items”口径收口。

---

## 1. 总体结论

Phase 7 的核心目标已经达成：

1. **严重 BUG 工程债清场**：Track A 核心修复已完成，ScoreNFT queue 状态机、AirdropNFT v2、链配置单一来源、/score 降级壳、polling、失败回滚、operator-lock 等主线已落地。
2. **Semi 社区钱包 PoC**：Track B + Track D 完成 Semi 登录、默认社区钱包入口、PinInput、/me 社区钱包外链，满足投资人 demo 需要。
3. **全站提速**：Track C 完成 C1-C9，高性价比优化已做；Lighthouse 指标未全面达标，但体感反馈优化与首屏轻量化已收口，按 downgraded-accepted 进入后续阶段。

**收尾判断**：无新的 P0；可以进入 Phase 8 UI 大升级。Phase 10 主网前仍有明确硬门槛，见第 5 节。

---

## 2. Track A — 修严重 BUG

### 状态

✅ **工程修复完结**，但不是“无条件全部完结”。准确口径是：

> Track A 主体 fixed；A5 / A7 / A16 heartbeat 接入 / A6 剩余曲目按用户决策挂 Phase 10 或运营长期。

### 已完成重点

- A1 chain 配置单一来源。
- A2 AirdropNFT v2 `_uriSet` + OP Sepolia 新地址：`0xC5923BEc5C79a203b0cf4ab7c82567c8E20eEF65`。
- A3+A12+A8 score queue 状态机修复包：防双 mint、修 lease 25min、manual_review alert。
- A4 MAINNET-RUNBOOK grantRole 验收命令。
- A6 15 曲 arweave_url 上链：week 1-15 就绪。
- A9 env sync、A10 /score fallback、A13 decode 时序、A14 polling、A15 失败回滚、A16 lock、A17 upsert error 检查。

### 已知偏差

| 项 | 原计划 | 实际 | 结论 |
|---|---|---|---|
| A5 Turbo wallet | P7 换新 | 用户接受测试网暂挂 | P10 主网前必做 |
| A6 曲目 | 20 曲 | 15 曲 | 用户批准，剩余长期补曲 |
| A16 heartbeat | 能力 + 接入 | TTL 120s + Lua 能力已实现，长 cron step 未接入 | P10 前补 |
| A7 operator 主网 ETH | P7 视情况 | 未做 | P10 主网部署日 |

### Track A 判断

✅ 可以收口。A5 / A16 / A6 剩余曲目必须进入 Phase 10 gate，不能在主网前遗忘。

---

## 3. Track B + D — Semi 钱包与登录 UI

### 状态

✅ Track B 完成，Track D 代码完成。

### 已完成重点

- B1 `SEMI_API_URL` 本地 + Vercel 三环境同步。
- B2 SemiLogin + LoginModal。
- B3 useAuth 双源化：Privy 优先，Semi JWT 作为第二通道。
- B4a / B4b 用户线下确认：Semi 技术冒烟 + 投资人 demo 协调。
- D1-D3：默认 Semi、邮箱直跳 Privy、6 格 PinInput、/me 社区钱包外链。
- Track B 自审 + Codex review 的 P1 已落地。

### 唯一口径点

D4 的“浏览器 7 步实测”在文档中有两种表述：

- Track B B4a 已写用户 2026-05-15 线下确认。
- Track D D4 仍写“待用户确认”。

本次收尾采用保守口径：

> D4 代码与 verify 已完成；用户若已按 D4 7 步做过则补确认，否则作为 Phase 8 前非代码验收项，不阻塞工程收尾。

---

## 4. Track C — 全站提速

### 状态

✅ Track C 按 **downgraded-accepted** 收口。

### 已完成重点

- C1 baseline。
- C3 `/api/me/scores` split。
- C5 首页慢网反馈。
- C6 字体温和优化。
- C7 route loading skeleton。
- C8 对比报告。
- C9a `/me` 内容区并行 + section error。
- C9b `/score/[id]` 首屏不再阻塞 events 大 JSON。

### 未全面达标原因

`reviews/2026-05-15-phase-7-perf-completion.md` 显示 Lighthouse 指标未全面改善，尤其 mobile LCP / TTI 仍高。继续优化需要 bundle splitting、资源策略、SSR/ISR/Edge 等更大范围改动，与 Phase 8 UI 重构和 Phase 10 深度性能优化耦合。

### Track C 判断

✅ P7 不再硬啃底层性能。Phase 8 处理 UI 结构性体验，Phase 10 再做深度性能。

---

## 5. Phase 10 前硬门槛

以下事项不阻塞 Phase 8，但**阻塞 OP Mainnet**：

1. **A5 换 Turbo wallet**：旧 Turbo wallet 私钥曾在调试记录中暴露，测试网接受，主网前必须换。
2. **A16 heartbeat 接入长 cron step**：当前只有 TTL 120s + Lua 能力，`steps-set-uri` receipt polling 期间仍需真正调用 heartbeat。
3. **A6 剩余曲目上链**：week 16-108 视艺术家交付节奏补齐；至少主网承诺范围内的曲目必须 arweave_url 齐全。
4. **A7 operator wallet 主网 ETH**：部署日充值与余额告警一起处理。
5. **CRON_SECRET 轮换**：历史调试中泄露过，主网前必须换。
6. **Semi 正式授权 / 主网策略**：P7 是 PoC-only；Phase 10 前确认继续用现有 API、切 OAuth，或切 SIWE fallback。
7. **401 自动 logout / fetch wrapper**：P7 已接受 PoC 减项，主网前统一处理 JWT 失效体验。

---

## 6. Phase 8 起点建议

Phase 8 应从 UI 大升级进入，不再继续扩 Phase 7：

1. 汇总艺术家 5 条反馈。
2. 引入 Claude Design / 视觉方案评审。
3. 重设计 `/me`、`/score/[id]`、`/artist` 三个核心页面。
4. 顺手处理 Phase 7 留下的 UI 型 P2：文件接近行数硬线、旧视觉组件拆分、移动端细节。

---

## 7. 最终判断

**Phase 7 = 可以关闭。**

关闭口径：

> Phase 7 completed with known deferred items. 关键工程风险已清，Semi PoC 可演示，全站体感优化已完成一轮；主网前硬门槛已明确挂 Phase 10。
