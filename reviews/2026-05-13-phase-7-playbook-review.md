# Phase 7 Playbook 三方 Review（2026-05-13）

## 范围

对 `playbook/phase-7/` 4 份文档（overview.md + track-a-bugs.md + track-b-semi.md + track-c-perf.md）做 review。

## 三方独立 review

1. **Claude 自审**（general-purpose agent）：覆盖完整性 / 执行可行性 / 隐藏依赖 / 风险盲点 / 决策一致性 / 工时估算 / AGENTS.md 协议合规 7 个维度
2. **Codex 全量 review**（gpt-5）：覆盖 8 个维度 + 摘要判断
3. **Codex 合约 / cron 深度 review**（gpt-5）：聚焦 9 个涉及合约 / cron / migration 的 step（A1/A2/A3/A5/A6/A12/A16/A17/A18）

---

## 高重合 finding（三方都抓到）

### P0-A · STATUS / TASKS / JOURNAL 与新 playbook 完全冲突

- **来源**：自审 F5.1+F5.2 / Codex 全量 决策一致性 / Codex 深度（默示）
- **问题**：
  - STATUS.md 当前 Phase 字段写"Phase 7 待用户启动（UI 翻修 + 体验细节）"
  - TASKS.md "之后" 段写 Phase 7/8/9 三段旧拆分（无 P10）
  - JOURNAL 2026-05-08 段记 Phase 7 = UI 翻修
  - 新 playbook 完全推翻：Phase 7 = 修 BUG + Semi + Perf，Phase 拆分变 P7/P8/P9/P10 四段
  - AGENTS.md §3 规定"STATUS 下一步是唯一权威，三处冲突信 STATUS"
- **修法**：playbook 启动前必须更新 STATUS / TASKS / JOURNAL（加 2026-05-13 段记录 Phase 重定决策 + 旧 5/8 拆分作废）

### P0-B · A11 / A18 已修但仍列为待修 step

- **来源**：自审 F1.2 / Codex 全量 范围合理性 / Codex 深度 A18
- **问题**：
  - A11（/api/me/score-nfts 35s）实际已在 commit `0d75a93` 5/8 修了（SELECT event_count generated column）
  - A18（score-queue failure_kind catch 默认值）实际已在 commit `0d75a93` 修了（isCritical 分流）
  - playbook 把这两项当待修 step，会浪费时间 + 推翻已通过测试的代码
- **修法**：A11 / A18 改"audit step ≤ 10 分钟"或删；调 Track A 工时

### P0-C · A5 + A6 playbook 事实错误，无法直接开工

- **来源**：Codex 深度 A5 ❌ + A6 ❌ + 自审 F3.3 工时低估
- **问题**：
  - **A5**：`scripts/arweave/generate-eth-wallet.ts` **当前不存在**（commit `be4e07a` git rm 删了）；脚本现状用 `TURBO_WALLET_PATH` 而 Vercel 用 `TURBO_WALLET_JWK` 不一致
  - **A6**：`public/tracks/` 当前**只有 6 个 mp3**（B6 demo 5 个 + 可能 1 个）；上链 108 首前必须先获得 102 首文件
- **修法**：
  - A5 拆 A5.0（恢复/重写 generate-eth-wallet.ts + 统一 TURBO_WALLET_JWK 字段）+ A5.1（生成新 wallet + 充值）
  - A6 改"先做资产盘点"step + 缺文件 fail-fast，工时改 1-1.5 天

---

## 高重合 P1 finding（两方+）

### P1-A · Track A 工时严重低估

- **来源**：自审 F6.1 / Codex 全量 工时估算
- **问题**：Phase 6 实际 14 天完成 22 项 step（4 track）。Track A 单 track 18 项 + migration + 合约重部署 + e2e + verify.sh，按 Phase 6 节奏应 12-16 天而非 8.5 天
- **修法**：overview 总工时 9-12 天 → 14-18 天；Track A 8.5 天 → 12-16 天

### P1-B · A3 "等 receipt"实施细节有误

- **来源**：Codex 全量 执行可行性 P0 + Codex 深度 A3 ⚠️
- **问题**：playbook 写"第 1 步成功后 sigkill，第二次 cron 看到 attempted_at 在 X 分钟内则等待 receipt"——但**没 tx_hash 时无法等 receipt**（getTransactionReceipt 需要 tx_hash 参数）
- **修法**：改"5 分钟内不重发；超时进入 manual_review，由人工按 operator nonce / 链上记录核查"，不要承诺自动等 receipt

### P1-C · A8 Resend "占位实现"违反 AGENTS 禁止占位

- **来源**：自审 F3.4 + F7.3 / Codex 全量 执行可行性
- **问题**：
  - AGENTS.md §2 明写"禁止占位：禁止 TODO / mock / 空函数"
  - `resend` SDK 也不在 STACK.md 白名单
  - 5 个 trigger 函数无 call site = 占位
  - .env.example 加占位 RESEND_API_KEY = 5/6 Bug C 同款 typo 风险
- **修法**：要么删 A8（挪 P10）；要么用 `fetch` 调 Resend API（避新依赖）+ P7 至少接一条 cron 触发点（如 A3 manual_review 分支）做端到端最小冒烟

### P1-D · A3 / A12 都改 process-score-queue 但依赖未声明

- **来源**：Codex 全量 依赖关系
- **问题**：A3（sigkill 双 mint 防御）和 A12（lease 25min 根因）都改 `process-score-queue/route.ts` + step 状态机。"依赖：无"但实际需要顺序合并
- **修法**：合并成"score queue 状态机修复包"，先 A12 后 A3，避免同一核心流程二次手术

### P1-E · C3 拆 /api/me/scores 影响 A14 / A15

- **来源**：Codex 全量 依赖关系
- **问题**：C3 改 /me/scores 返回结构 → A14（5s 假成功 polling）+ A15（useMintScore 失败回滚 polling）都要更新调用契约。"依赖：无"
- **修法**：顺序 C3 → A15 → A14，或在 C3 step 内同步更新 A15/A14 契约

### P1-F · Track B 暗依赖 Track A1

- **来源**：自审 F3.2
- **问题**：B4 端到端铸造 MaterialNFT → 经 operator-wallet.ts。A1 改 chain 配置期间 Track B 接 e2e 会撞到半成品
- **修法**：overview track 矩阵加"B 与 A1 串行"或"B 仅在 A1 完结后开始"

### P1-G · A1 NEXT_PUBLIC_CHAIN_ID 双来源

- **来源**：Codex 深度 A1 ⚠️
- **问题**：playbook 新增 `CHAIN_ID`，但现有 .env.example / runbook 用 `NEXT_PUBLIC_CHAIN_ID`，会形成双来源
- **修法**：chain-config.ts 同时校验两者，若都存在且不一致直接 fail；导出 `explorerTxUrl/addressUrl` 区分 tx/address URL

### P1-H · A2 文件名 / env 名拼错

- **来源**：Codex 深度 A2 ⚠️
- **问题**：
  - playbook 写 `DeployAirdrop.s.sol`，实际是 `DeployAirdropNFT.s.sol`
  - playbook 范围段写 `NEXT_PUBLIC_AIRDROP_NFT_ADDRESS`，但与 strict review P1-24 提到的 module 顶层 getAddress 风险耦合
- **修法**：A2 范围段改正文件名 + env 名

### P1-I · A2 重新部署缺原子流程

- **来源**：自审 F3.1 / Codex 全量 风险盲点
- **问题**：playbook 没明确"部署 + 取地址 + Vercel env 更新 + redeploy"的顺序，race condition 可能让前端短暂指向旧地址
- **修法**：加冻结顺序：① 部署冻结 airdrop cron → ② 部署 → ③ 取新地址 → ④ Vercel env 全 environment 更新 → ⑤ redeploy → ⑥ health 验证 → ⑦ 才 push commit 归档旧地址

### P1-J · A16 心跳续期需 Lua 校验 holder

- **来源**：Codex 深度 A16 ⚠️
- **问题**：playbook 写"加心跳续期机制"但未指定实现细节。心跳必须用 Lua 校验 holder 后再 PEXPIRE，否则可能续别人的锁
- **修法**：A16 修法补 Lua 脚本伪代码（检查 GET key == myOwner 才 PEXPIRE）

### P1-K · Track B JWT payload / localStorage key 未冻结

- **来源**：Codex 全量 执行可行性
- **问题**：B2 / B3 登录入口位置"讨论时定"、JWT payload / localStorage key / 过期处理也未冻结，AI 不能直接开工
- **修法**：冻结入口为 Header 登录菜单；写明 `ripples_auth_jwt` payload / 过期判断 / logout 行为

### P1-L · Track B 风险描述过轻

- **来源**：Codex 全量 风险盲点
- **问题**：未经 Semi 授权 API / 手机号 PII / 限流 / localStorage JWT XSS 风险只轻描淡写
- **修法**：标 PoC-only；demo 前限定测试号；JWT 过期时间 / 清除策略 / 失败降级到 Privy 必须写入验收

### P1-M · Track A 范围未覆盖多项 strict review 仍 open 的 P1

- **来源**：自审 F1.1 / Codex 全量 范围合理性
- **问题**：strict review 24 项 P1 中，playbook 只覆盖 9 项 Day 1-3。未点名挪走的：P1-1 / P1-2 / P1-4 / P1-11 / P1-12 / P1-13 / P1-14 / P1-24
- **修法**：track-a 末尾加 strict review 映射表：每个 P0/P1 必须有归宿（fixed / P7 / P10 / accepted）

---

## P2 finding（一方抓到，可单独评估）

### P2-A · 验证标准多处用"耳听 / 用户实测"无量化判据

- 自审 F2.1
- A13 / A15 / C5 / C8 验证主观，新 AI 无法判定通过
- 建议补量化判据（如 console.log 对照时间戳）

### P2-B · C5 + A10 "复用组件"语义不清

- 自审 F4.2 / Codex 全量 跨 track 协调
- 建议改"复用 = LoadingSpinner + RetryButton 两个原子组件，不复用业务壳"

### P2-C · A9 vercel-env-sync 脚本设计可能不可行

- Codex 全量 风险盲点
- Vercel API 通常不能读回 secret 明文
- 建议只比较 key 集合 + NEXT_PUBLIC_* 单独允许明文比对

### P2-D · A12 修法不够落地

- Codex 深度 A12 ⚠️
- 建议：让 step 自己完成"状态 + 业务字段 + 释放 lease"的最终 CAS，route 只调度和兜底释放

### P2-E · 新增文件可能撞 8 文件硬线

- 自审 F7.2
- track-b 新增 SemiLogin / LoginEntry / client-jwt；track-c 新增 LoadingSpinner / RetryButton；track-a 新增 chain-config / FallbackShell / resend.ts
- 建议 overview 加"新建文件前先 ls 目标目录文件数"

### P2-F · STATUS 悬空 TODO 多项漏挪 P7 / P10

- 自审 F1.5
- 漏：score_nft_queue.token_id partial unique index / /score 返回链接改 /me / .env.local 重复 CRON_SECRET / OwnedScoreNFT.id 双语义 / pre-existing lint 2 处
- 建议 track-a 末尾加"小石头打包"段

### P2-G · A3 manual_review 无 alert 通道

- 自审 F4.3
- A3 标 manual_review 后没人通知（A8 Resend 仅基础设施），用户铸造卡草稿状态无 alert
- 建议 A3 验证加 /api/health manualReviewCount 字段暴露

### P2-H · A1 启动 guard 行为未约定 dev/prod 分支

- 自审 F2.2
- build time / runtime guard 时机未约定，可能让本地 dev 直接挂
- 建议明确 guard 跑在 runtime + 错误信息给修复指令

### P2-I · A5 换钱包后旧地址 grep audit

- 自审 F4.1
- 建议 A5 验证加"全仓库 grep 旧地址 0xdE78... 零结果"

### P2-J · 测试网 / 主网边界未在每个 step 标注

- Codex 全量 测试网 / 主网边界
- 建议每个 step 增加"触碰环境"字段：本地 / Vercel Preview / OP Sepolia / OP Mainnet / Base / Arweave / Semi production

---

## 摘要判断（三方一致）

**playbook 不可直接开工**。

### 必修清单（P0 / P1，三方共识必须修）

按工作量从小到大排：

1. **P0-A**：同步 STATUS / TASKS / JOURNAL（30 分）
2. **P0-B**：A11 / A18 改 audit step（10 分）
3. **P0-C**：A5 / A6 修事实错误 + 工时调整（30 分）
4. **P1-A**：工时调整（10 分）
5. **P1-B**：A3 "等 receipt"改"防重发 + manual_review"（10 分）
6. **P1-C**：A8 Resend 改真接通 / 删 / 挪 P10（用户决策 + 实施 30 分）
7. **P1-D**：A3 / A12 合并 score queue 状态机修复包（10 分）
8. **P1-E**：C3 → A15 → A14 顺序声明（5 分）
9. **P1-F**：Track B 与 A1 串行声明（5 分）
10. **P1-G**：A1 双来源 CHAIN_ID 校验（10 分）
11. **P1-H**：A2 文件名修正（5 分）
12. **P1-I**：A2 重新部署原子流程冻结（15 分）
13. **P1-J**：A16 Lua 心跳脚本伪代码（10 分）
14. **P1-K**：Track B JWT key / payload 冻结（15 分）
15. **P1-L**：Track B 风险描述补强 PoC-only / PII / XSS（10 分）
16. **P1-M**：strict review P0/P1 映射表（30 分）

**总计**：约 3-4 小时迭代

修完后可启动"开始 Track A → A1 第一刀"或"开始 Track B → B1 / B2"。

### 后续 P2 finding 可在每个 step 进入前 slow mode 简报时逐项再核，不阻塞整体启动。
