# Phase 6 — 稳定性收口 + UI 重设计

> **目标**：把 Phase 1-5 三轮严格 CTO review 发现的 29+ 项 findings 全部收口 +
> 基于 tester 反馈做 UI 重设计，让产品达到 Phase 7 OP 主网的完成标准。
>
> **前置**：Phase 5 收口完成（commit `b0474f1`）+ 两轮 Phase 1-4/5 严格 review 已出
> + Phase 6 playbook CTO review（`reviews/2026-04-25-phase-6-playbook-cto-review.md`）已出
>
> **原则**：多 track 并行；每 track 有独立验证标准；只有 Track B2 UI 重设计依赖
> tester 反馈，其他 track 可和 tester 反馈轮并行推进。
>
> **核心交付物**：
> - 5 tracks 全部 steps ✅ → 代码层满足主网部署要求
> - 所有产品语义决策（A6 / D1 / E2）在 kickoff 冻结并写入 JOURNAL
> - findings tracker 29+ 项全部闭环
> - Tester 反馈反哺 UI 重设计
> - 进 Phase 7 时的"主网承诺边界"明确

---

## 冻结决策

### D1 — 多 track 并行，非线性推进

29+ 项 findings 按域切到 5 track。Track 之间硬依赖只有 2 条：
- **Track A0**（operator 全局锁）是所有涉及 operator 钱包 cron 的前置 → 阻塞 B3、任何 airdrop cron 启用
- **Track A1**（ScoreNFT cron 四连）是 Track B3（草稿铸造按钮）的前置

其余 track 可独立开工。

### D2 — Pre-tester gate（4 项，进入并行开工前全部必做）

| # | 所属 | 内容 | 预估 |
|---|---|---|---|
| **G0** | 跨 track | 运营就绪检查（balance + cron + env + health + smoke） | 15 分钟 |
| **A2** | Track A | material failed 分类重试（带 failure_kind，不一律 reset） | 1-2 小时 |
| **B1** | Track B | NFT localStorage 按 user_id 隔离 | 30 分钟 |
| **E1** | Track E | /api/health 暴露 mint_queue failed / stuck / retry / oldest age | 30-60 分钟 |

**G0 清单**（每项有可验证结果）：
- [ ] operator OP Sepolia 钱包余额 ≥ 0.01 ETH（/api/health walletBalance）
- [ ] cron-job.org 5/5 cron 绿 ≥ 5 分钟
- [ ] Vercel env vars 与 `.env.local` 一致性 check（人工对比清单）
- [ ] `/api/ping` 返回 200 + `{ok:true}`
- [ ] `/api/health?secret=xxx` 返回 DB=ok + wallet ∈ {ok, low}（不是 error）+ 新增 mintQueue 字段
- [ ] 真实账号跑一次素材收藏 smoke（登录 → 收藏 → 1 分钟内 /me 显示 success）

### D3 — Track A 硬依赖规则

- A0（operator 锁）必须在 A1 开工前完成
- A1（ScoreNFT cron 四连 + full durable lease）必须在 B3（草稿铸造按钮）接通前完成
- **Track C 合约重部署必须在 Pre-tester gate 之前一次性完成**（避免 tester 窗口切合约）

### D4 — 产品决策 kickoff 冻结（不能执行中飘移）

3 个产品语义问题必须在 Phase 6 开工阶段显式决策并写进 JOURNAL：

| 决策 | 选项 | 影响 |
|---|---|---|
| **A6**：`/me` 语义 | 我铸造的 / 我持有的 / 双分区 | Track A6 实现范围 0 ~ 1 天 |
| **D1**：主网是否做空投 | 做 / 不做 | Track D 工作量 0.5 ~ 5 天 |
| **E2**：Semi 登录是否 Phase 6 接入 | 接（待 Semi OAuth）/ 挂到 Phase 7 | Track E2 存在或挂起 |

决策后果对齐：
- 若 **D1 = 不做** → 停用 cron-job.org 的 `process-airdrop` + STATUS/ARCH 明确 "空投代码挂起，主网不对外承诺"
- 若 **E2 = 挂 Phase 7** → 主网首版明确 Privy-only，不把登录债带到 Phase 7
- 若 **A6 = 选项 1 保持现状** → 无代码改动，只更新 JOURNAL 说明
- 若 **A6 = 选项 2/3** → Track A6 按决策实现

### D5 — 条件性挂起项的"主网承诺边界"

Phase 6 完结进 Phase 7 时，STATUS.md 必须包含 **主网承诺边界** 段落，明确：

- 主网首版**包含**什么能力（素材收藏 / 乐谱铸造 / ...）
- 主网首版**不包含**什么（空投 / Semi 登录 / 等，按决策）
- 主网首版**不允许**什么 cron 运行（按决策）
- 哪些入口在前端关闭

这段用于 Phase 7 部署 runbook 和对外沟通。

### D6 — 所有 migrations 走 `supabase/migrations/phase-6/`

本 Phase 新增 DB 变更统一进 phase-6 子目录，从 `021_*.sql` 开始编号。编号由 Track A 的 ownership 统一分配（见 ownership 表）。

### D7 — Phase 6 不触碰主网

Phase 6 完结 = 所有合约有"可主网部署"版本 + 所有后端 cron 恢复语义闭环 + UI 重设计上线。主网真部署放 Phase 7。

---

## 共享资源 Ownership 表

多 track 并行会触碰共享文件，必须指定 ownership 避免互相踩：

| 共享资源 | Owner | 规则 |
|---|---|---|
| `app/api/health/route.ts` + `HealthResponse` 类型 | **Track E** | 所有其他 track 只提字段**需求**，Track E 统一合并 |
| `src/lib/chain/operator-lock.ts` | **Track A0** | 其他 track 只 import，不改 |
| `supabase/migrations/phase-6/` 编号分配 | **Track A** | 每 track 需要 migration 时去 A 登记编号 |
| 合约地址 / Vercel env vars 更新 | **Track C**（合约类）+ **release owner** | 单 PR / 单人窗口更新，避免竞态 |
| `docs/ARCHITECTURE.md` | **release owner** | 每 track 把自己的改动提 PR，由 release owner 批量合 |
| `STATUS.md` / `TASKS.md` / `docs/JOURNAL.md` | **release owner** | 同上 |
| `.env.local` / `.env.example` | **release owner** | 同上 |
| `reviews/phase-6-findings-tracker.md` | **release owner** | 每 step 完成后由 step owner 在 tracker 标状态 |

**release owner** = Phase 6 主协调人（默认 = 项目发起人或指定的 AI 窗口）。任何多 track 同时动的共享资源都收到 release owner 审批。

---

## 5 Tracks 总览

| Track | 主题 | Step 数 | 对应 findings | 依赖 |
|---|---|---|---|---|
| **[A](./track-a-mint-stability.md)** | 铸造链路稳定性（含 operator 全局锁）| 7 | #1 #3 #5 #17 #18 #19 #21 #22 | 无 |
| **[B](./track-b-ui-redesign.md)** | UI 收口 + 端到端验证（v2 缩减，UI 重设计深度版迁 P7）| 7 | #2 #7 #8 #9 #23 #29 | B3 依赖 A0+A1；B6/B7 无前置 |
| **[C](./track-c-contracts.md)** | 合约 & 部署硬化 | 4 | #6 #13 #14 #16 #20 | **必须 Pre-tester 前完成** |
| **[D](./track-d-airdrop.md)** | 空投闭环（条件） | 5 | #4 #10 #11 #12 #25 | D1 产品决策 |
| **[E](./track-e-auth-observability.md)** | 认证 & 观测收口 | 5 | #15 #24 #26 #27 #28 | E2 依赖 Semi OAuth |

详细 findings 对照：`reviews/phase-6-findings-tracker.md`

---

## 推荐时间线（v2 缩减后）

```
已完成（2026-04-25 / 26 / 05-03 / 05-04）：
  ├─ 产品决策冻结（D1 / E2 / A6）→ JOURNAL 写入
  ├─ Track C 合约重部署（C1-C4）→ v2 上链 + env 切换
  ├─ Pre-tester gate（G0 + A2 + B1 + E1）
  ├─ Playbook v2 doc 改写（2026-05-03，不动代码）
  └─ B6 A 组 5 球 + B/C 36 球 demo 实施完成（2026-05-04）

—— B7 改放最后（2026-05-04，避免"测-修-重测"循环）——

Day 1
  ├─ ❶ B2 修 /me /score /artist 紧急 bug（含已知 2 个 /me bug）
  └─ ❷ B5 前端韧性（独立可做）

Day 2
  ├─ ❸ B3 草稿铸造按钮（依赖 A0+A1 完成）
  └─ ❹ Track A 收剩余（A0 / A1 / A3 / A4 / A5）+ D2 + E4 / E5 收口

Day 3-4
  ├─ ❺ B7 端到端冒烟（最后一次性覆盖所有功能 + 产出 bug 清单 → 直接进 completion review）
  └─ ❻ Phase 6 completion review

Day 4-5
  └─ 进 Phase 7（写 P7 候选清单：UI 深度重设计 + 音阶系统 + 按键动画）
```

**总工作量粗估**：3-5 天（v2 缩减后，从原 3-6 周大幅减少；移除整条 UI 重设计流水线）

---

## Phase 6 完结标准（进 Phase 7 的 gate，v2）

- [ ] 5 tracks 全部 steps ✅（按各 track 完结标准）
- [ ] **B7 端到端冒烟通过**（核心场景 10+ 条全勾，bug 清单全部闭环）
- [ ] `bash scripts/verify.sh` 全绿
- [ ] `forge test` 全绿（合约层）
- [ ] `reviews/phase-6-findings-tracker.md` 29+ 项全部闭环（状态 ∈ {fixed, deferred-justified, downgraded-accepted}）
- [ ] A6 / D1 / E2 产品决策在 JOURNAL 有冻结记录
- [ ] **主网承诺边界** 段落写进 STATUS.md
- [ ] **P7 候选清单**写进 STATUS.md（含艺术家反馈 5 条 + UI 重设计深度版）
- [ ] `reviews/phase-6-completion-review.md`（由独立 review agent 出）通过
- [ ] `STATUS.md / TASKS.md / docs/JOURNAL.md` 同步
- [ ] `docs/MAINNET-RUNBOOK.md` 就绪（Phase 7 用）
- [ ] `reviews/phase-6-deprecated-contracts.md` 归档旧合约地址

---

## 参考文档

- [Phase 5 收口 review](../../reviews/2026-04-24-phase-5-completion-review.md)
- [Phase 5 严格 CTO review](../../reviews/2026-04-25-phase-5-strict-cto-review.md)
- [Phase 1-4 严格 CTO review](../../reviews/2026-04-25-phase-1-4-strict-cto-review.md)
- [**Phase 6 Playbook CTO review**](../../reviews/2026-04-25-phase-6-playbook-cto-review.md)（本 playbook 重写来源）
- [Phase 6 findings tracker](../../reviews/phase-6-findings-tracker.md)
- [S5 冒烟测试](../../reviews/2026-04-24-phase-5-s5-smoke-test.md)
- [决策日志 2026-04-25 段](../../docs/JOURNAL.md)
