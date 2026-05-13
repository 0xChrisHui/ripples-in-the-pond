# Phase 7 — 修严重 BUG + Semi 社区钱包 + 全站提速

> **2026-05-13 覆盖重写**：原 5/8 版"UI 翻修开放骨架"作废（git 可查 commit `e7030a8`）。
> Phase 7 重新定义为"上 P8 UI 大升级之前的工程清场 + 投资人 Semi demo 准备"。
>
> **决策来源**：2026-05-13 与用户对话整合 5/8 strict CTO review 发现的 6 P0 / 24 P1 +
> 投资人催 Semi 接入 + 用户提"全站启动提速"诉求。
>
> **前置**：Phase 6 v2 完结 (commit `0d75a93`) + strict review "现在就修"6 项已合
> + 24 commits 已 push 到 origin/main
>
> **核心交付物**：
> - 9 项 Day 0 必修 BUG 全部修完 → OP Mainnet 部署门槛工程债清零
> - Semi 社区钱包前端接入 → 投资人可看 demo
> - 首屏 / 切页 / 关键 API 性能优化 → 用户感知"打开就快"
> - Phase 7 进 Phase 8 时 STATUS 明确"主网门槛工程债已清"

---

## Phase 7 是什么 / 不是什么

### 是
- **修严重 BUG**：strict CTO review (`reviews/2026-05-08-phase-6-strict-cto-review.md`) 抓到的 9 项 Day 0 必修 + 9 项 Day 1-3 必修
- **接 Semi 社区钱包前端**：后端 (S0-S2) 100% 复用，前端两个 input + 一段 useAuth 兼容（约 1 天）
- **全站提速**：用户"打开一个新页面需要多久才能加载出来"诉求 → 首屏 LCP / 切页 transition / 关键 API（/me 35s）

### 不是
- ❌ UI 翻修 / 艺术家反馈 5 条（→ **Phase 8**）
- ❌ 按键动画 / 音效扩展到 50（→ **Phase 9**）
- ❌ 主网部署 / Resend 告警 / 换 CRON_SECRET / 换 Turbo wallet 等纯运营动作（→ **Phase 10**）

---

## Phase 拆分（2026-05-13 重定）

| Phase | 内容 | 工时估 |
|---|---|---|
| **Phase 7（当前）** | 修严重 BUG + Semi 社区钱包接入 + 全站提速 | 9-12 天 |
| **Phase 8** | UI 大升级（艺术家反馈 5 条 / Claude Design 接入 / /me /score /artist 深度重设计） | 2-4 周 |
| **Phase 9** | 按键动画 + 音效系统扩展 26 → 50 | 1-2 周 |
| **Phase 10** | 性能优化（深度）+ 上线检查 + OP Mainnet 部署 + 首周救火 | 1-2 周 |

---

## 三个 Track 并行（2026-05-13 用户决策 + 5/13 review 修订）

**用户原话**："P7.1 修 BUG + P7.2 Semi + P7.3 性能 三件事同时启动，实际你一次只推动一件，但不锁顺序，哪项准备好了做哪项。"

| Track | 主题 | Step 数 | 工时估 | 依赖 |
|---|---|---|---|---|
| **[A](./track-a-bugs.md)** | 修严重 BUG | 14 有效 step | 10-11 天 | 无 |
| **[B](./track-b-semi.md)** | Semi 社区钱包前端接入（PoC-only）| 5（B1/B2/B3/B4a/B4b）| 2-3 天 | B4a 临时硬编码 chain，A1 完成后重测 10min |
| **[C](./track-c-perf.md)** | 全站提速 | 7（C1/C2/C3/C5/C6/C7/C8）| 4-5 天 | C1 修前 baseline + C8 修后对照（不再卡 A3+A12）|

**总工时**：14-18 天（三 track 有依赖 + 部分串行；review 修订后比原 9-12 天乐观估更真实）

### 关键依赖图（2026-05-13 修订：起点改 A1 / B1 / C1）

- **A1 (chain 配置)** → Track A 内部起点。B4a 不再硬等 A1（接受临时硬编码）
- **A3+A12 (cron 修复包)** → 阻塞 A14 / A15（cron 状态机稳定后才能稳定 polling）；**不再阻塞 C1**
- **C3 (/api/me/scores 拆 split)** → 必须先于 A14 / A15（polling 契约依赖）
- **C1 跑两次**：修前作为 baseline（不等任何前置）+ C8 作为修后对照
- **A1 / B1 / C1 = 3 个 Track 各一个起点**，相互完全独立可并行（用户 2026-05-13 决策"起点简单清晰，不易出错"）

### A6 范围缩水（2026-05-13）

A6 从"108 曲全量上链"缩成"**20 曲全量上链**"（艺术家承诺先给 20 首）。A6 含 B6.1 子任务：
- A6.0 资产盘点 audit-tracks.ts
- A6.1 数据扩容 migration 030（A 组 published 扩到 1-20 + B+C 36 球后 16 个循环到 No.1-16）+ sphere-config `getGroupTargetCount` `'A' ? 5 : 36` → `'A' ? 20 : 36` + SphereNode badge 双位数视觉调试
- A6.2 上传 15 首新 mp3 到 Arweave + UPDATE tracks.arweave_url

剩余 88 曲挪 Phase 10 / 艺术家长期补曲，不阻塞 P7 完结。

### 并行执行规则（关键）

按 AGENTS.md 铁律"一次只做一件事"，并行**不是同时改三个文件**，而是：

1. 任一 step 进 in-progress 后必须做完小闭环再切下一个
2. 切下一刀时**用户决定**从哪个 track 抽下一步
3. 每个 track 独立维护自己的"剩余 step"看板
4. 三 track 各自有 completion 标准，但全部完成才能进 Phase 8

---

## Track A — 修严重 BUG（详见 `track-a-bugs.md`）

### Day 0 必修（9 项，上主网前必清）

| ID | 严重 | 内容 | 工时 |
|---|---|---|---|
| **A1** | 🔥 MEGA P0 | chain 配置硬编码 sepolia → 抽 `src/lib/chain/chain-config.ts` 单一来源 | 0.5 天 |
| **A2** | P0 | AirdropNFT 加 `_uriSet` 防覆盖 + 重新部署 | 0.3 天 |
| **A3** | P0 | stepMintOnchain sigkill 双 mint 防御（拆三步 + idempotency） | 1 天 |
| **A4** | P0 | MAINNET-RUNBOOK grantRole 验收命令补充 | 0.2 天 |
| **A5** | P0 | 换 Turbo wallet（旧私钥泄露过）| 0.5 天 |
| **A6** | P0 | **20 曲** arweave_url 全量上链（含 B6.1 数据扩容；当前 5/20，等艺术家给 15 首）| 1-1.5 天 |
| **A7** | 运营 | Operator wallet 主网 ETH 充值 → 挂 Phase 10 起点 | 0.1 天 |
| **A8** | P1 | Resend 邮件告警 → 挂 Phase 10 起点（**修订**：P7 只搭基础设施 + 不接 cron 触发） | 0.5 天 |
| **A9** | P1 | vercel-env-sync 脚本（防 NEXT_PUBLIC_ typo）| 0.5 天 |

**Day 0 小计**：4.1 天

### Day 1-3 必修（9 项，影响 UX / 主网首周）

| ID | 严重 | 内容 | 工时 |
|---|---|---|---|
| **A10** | P1 | A5 链上灾备 /score/[id] 无 fallback → Supabase 抖动就 404 | 1 天 |
| **A11** | P1 | /api/me/score-nfts 35s → ms 级（generated column 已加 migration 031，前端用上）| 0.3 天 |
| **A12** | P1 | cron lease 25min 根因（step 内状态推进 vs route CAS 冲突）| 0.5 天 |
| **A13** | P1 | useEventsPlayback 首播音效 decode 时序（前几秒事件爆发）| 0.5 天 |
| **A14** | P1 | 5s 乐观成功假成功窗口文案 + auto-polling（P1-17）| 0.5 天 |
| **A15** | P1 | useMintScore 失败回滚（草稿不消失 + 重试，P1-18）| 0.5 天 |
| **A16** | P1 | operator-lock TTL 30s → 120s + 续期 + 生产 fail-closed | 0.5 天 |
| **A17** | P1 | mint_events upsert 失败被忽略 → 补 error 检查 | 0.3 天 |
| **A18** | P1 | score-queue failure_kind catch 默认值 → 补分流逻辑 | 0.3 天 |

**Day 1-3 小计**：4.4 天

**Track A 工时**：8.5 天（含验证 + verify.sh 跑通）

### 不在 P7 范围（明确挪走）

- 6 个 P0/P1（chain 已硬编码外的合约 + RPC 主网级问题）→ **Phase 10 起点**
- 全部 P2 / P3 → Phase 10 主网前清扫一轮

---

## Track B — Semi 社区钱包前端接入（详见 `track-b-semi.md`）

### 投资人诉求边界

**做**：Semi 用户用手机号 + 验证码登录 → 后端拿 evm_address → 用户收到的所有 NFT 进入 Semi 钱包
**不做**：Semi OAuth（Semi 团队方案未出，等了 1 个月不能再等）
**不做**：用户主动签名授权（铸造仍是 operator 后台空投，与 Privy 路径一致）

### 后端复用情况（Phase 4A S0-S2 已就绪）

- ✅ `src/lib/auth/semi-client.ts`（sendSemiCode / verifySemiCode / getSemiUser）
- ✅ `app/api/auth/community/send-code/route.ts`（转发短信）
- ✅ `app/api/auth/community/route.ts`（验证码 → JWT 交换 + evm_address 合并）
- ✅ `src/lib/auth/jwt.ts`（RS256 自签 JWT）
- ✅ `src/lib/auth/middleware.ts`（Privy / JWT 双通道）
- ✅ `supabase/migrations/phase-4/`（015 jwt_blacklist + 016 auth_identities + 017 privy_nullable）

### Step 总览

| ID | 内容 | 工时 |
|---|---|---|
| **B1** | 配 `SEMI_API_URL=https://semi-production.fly.dev` 到 .env.local + Vercel + .env.example 加占位 | 30 分 |
| **B2** | 前端登录组件（手机号 input + 验证码 input + 60s 倒计时）| 半天 |
| **B3** | useAuth hook 兼容 Privy / JWT 双通道（已有中间件直接用）| 半天 |
| **B4** | 端到端实测：发码 → 验证 → 拿到 evm_address → 铸造一次 MaterialNFT 进 Semi 钱包确认 | 半天 |

**Track B 工时**：1.5-2 天

### 不在 P7 范围

- 主网 Semi 接入（测试网先跑通，主网 Semi 配置进 Phase 10）
- Semi 与 Privy 同地址合并 UX（已自动合并，无需 UI 提示）

---

## Track C — 全站提速（详见 `track-c-perf.md`）

### 用户原话拆解

> "主要是就打开一个新页面时，需要多久才能加载出来。我需要加载的快一些，具体怎么实现可以讨论，可以开放讨论。"

→ 用户在意 **"页面打开速度"**，对应工程指标：
- **首屏 LCP**（Largest Contentful Paint）：用户看到主要内容多久
- **TTI**（Time to Interactive）：用户能操作多久
- **关键 API p95 延迟**：/me 当前 35s 是 LCP 的主因之一

### Step 总览

| ID | 内容 | 工时 |
|---|---|---|
| **C1** | Lighthouse + Vercel Analytics baseline（首页 / /me / /score/N / /artist 四页）| 半天 |
| **C2** | 用户拍板目标值（建议：首页 LCP < 2.5s / /me LCP < 3s）| 讨论 30 分 |
| **C3** | /api/me/scores 拆 split（首屏只返 id/track/seq/event_count，events 单独 fetch）| 半天 |
| **C4** | /api/me/score-nfts 改用 generated event_count（重叠 A11，做完算重叠）| 共用 |
| **C5** | 首页 Archipelago 慢网占位加 spinner + 重试按钮 | 半天 |
| **C6** | next/font + 字体预加载（Modak / Azeret 重复检查）| 30 分 |
| **C7** | 路由 transition smooth（loading.tsx 分页骨架）| 1 天 |
| **C8** | 再跑 Lighthouse 对比 baseline 出报告 | 半天 |

**Track C 工时**：3-4 天

### 重叠工作（提前声明）

- **C4 = A11**（/api/me/score-nfts 改 event_count）→ 实施时算一次
- **C5 部分依赖 A10**（A5 链上灾备 UI 降级壳 = 慢网占位的失败态变种）→ A10 做完后 C5 复用同套占位组件
- **A12 cron lease 25min** → 影响"上链中"灰卡的等待时间，间接影响用户感知性能

---

## 工作流（Phase 7 进行时遵守）

### Track 优先级（默认，2026-05-13 修订）

3 个 Track 起点 **A1 / B1 / C1** 完全独立，用户裁决从哪个起手。如果用户没指定，AI 默认按这个顺序建议：

1. **A1（chain 配置硬编码）** 是 MEGA P0，建议**第一刀**（不做这个 Phase 10 主网部署直接灾难）
2. **B1（SEMI_API_URL env）** 30 分钟轻量收口，可以与 A1 同日做完（不同环境改 .env / Vercel）
3. **C1（Lighthouse baseline）** 半天独立工作，作为修前对照基准
4. 三起点收口后按用户裁决推进 Track 内部 step

### 触发停下问用户

按 AGENTS.md，以下情况立刻停：

- 改撞到 STACK.md 没有的依赖
- 改撞到 ARCHITECTURE.md 写过的决策（如 ARWEAVE_GATEWAYS 缩到 2 个 / 220 行硬线 / Tailwind v4 等）
- 单文件改超过 220 行
- 触发 phase 分流规则（如：发现 A 类改动需要修 migration → 评估是 P10 还是降级实现）
- 同一文件改超过 3 次还在改

### 测试网安全网

- 每个 step 完成后跑 `bash scripts/verify.sh`
- 涉及合约 / cron / DB 的改动必须有 forge test / 端到端 smoke 通过
- 部署前最后跑一次完整冒烟（仿 P6 B7 smoke test 体例）

---

## Phase 7 完结标准（进 Phase 8 的 gate）

- [ ] **Track A**：18 项 step 状态 ∈ {fixed, downgraded-accepted}；剩余 P0/P1 明确挪 Phase 10
- [ ] **Track B**：Semi 端到端 smoke 通过（发码 → 登录 → 拿 evm → 铸造 1 个 MaterialNFT 进 Semi 钱包）+ 投资人可看 demo
- [ ] **Track C**：4 个核心页面 LCP 达标（建议 < 3s）+ 对比 baseline 报告
- [ ] `bash scripts/verify.sh` 全绿
- [ ] `forge test` 全绿（涉及合约变更时）
- [ ] STATUS.md 更新："Phase 7 完结" + Phase 8 / 9 / 10 计划 + Phase 10 主网起点清单
- [ ] `reviews/2026-05-XX-phase-7-completion-review.md` 出（独立 review agent）
- [ ] JOURNAL 决策日志连续

---

## 启动前必做（Step 0 / Step 0.5）

**P0-A 修订**：AGENTS.md §3 规定 STATUS "下一步" 是唯一权威。当前 STATUS / TASKS / JOURNAL 仍写"P7=UI 翻修"老叙事，与本 playbook 冲突。**任何 Track step 启动前必须先做**：

### Step 0 — STATUS / TASKS 同步（10 分）
- STATUS.md "当前阶段"字段：Phase 7 = 修严重 BUG + Semi + 提速
- STATUS.md "Phase 拆分"：P7/P8/P9/P10 四段（P8=UI / P9=按键音效扩展 / P10=主网）
- STATUS.md "下一步"字段：3 个 Track 各一个起点（A1 / B1 / C1，2026-05-13 修订）
- TASKS.md "之后"段：Phase 7/8/9 改 Phase 7/8/9/10 四段

### Step 0.5 — JOURNAL 决策段（10 分）
- 加 2026-05-13 段：
  - Phase 重定决策（P7=BUG+Semi+Perf，旧 5/8 拆分作废）
  - Semi 现有 API 先用着决策（D-B1）
  - A3 修订（不承诺等 receipt，改防重发 + manual_review）
  - 9 项 P1 挂 P10 决策清单
  - 三方 review 整合（`reviews/2026-05-13-phase-7-playbook-review.md`）

### Step 0.9 — commit（5 分）
- 一次 commit 含 STATUS/TASKS/JOURNAL 更新 + playbook iteration

---

## 启动信号

用户说"开始 Track A"（或 B / C） → AI 做的第一件事：

1. **先确认 Step 0 / 0.5 / 0.9 已完成**（如未做先做）
2. 读对应 track 子文档（`track-a-bugs.md` / `track-b-semi.md` / `track-c-perf.md`）
3. 跟用户对齐"从哪个 step 起"
4. 进 Step 概念简报（slow mode）→ 实施 → verify.sh → 6 行汇报
5. 等用户"继续 / 下一步 / commit"

---

## 参考文档

- [Phase 6 完结 review](../../reviews/2026-05-08-phase-6-completion-review.md)
- [**Phase 6 strict CTO review**](../../reviews/2026-05-08-phase-6-strict-cto-review.md)（Track A 18 项来源）
- [Phase 6 codex CTO review](../../reviews/2026-05-08-phase-6-codex-cto-review.md)（独立第二意见）
- [JOURNAL 2026-05-08 段](../../docs/JOURNAL.md)
- [Phase 6 findings tracker](../../reviews/phase-6-findings-tracker.md)
- [MAINNET-RUNBOOK](../../docs/MAINNET-RUNBOOK.md)
