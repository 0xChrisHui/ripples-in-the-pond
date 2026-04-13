# CONVENTIONS — 代码规范 & 坏味道清单

> AI 每次写代码前必须读这一份。
> hooks 会强制执行最关键的几条，违反时直接阻止 Edit/Write。

---

## 1. 文件 & 目录硬性指标

### 1.1 文件大小
- **每个代码文件 ≤ 220 行**（hard limit，由 `.claude/hooks/check-file-size.js` 强制）
- **API route handler（`src/app/api/**/route.ts`）放宽到 ≤ 270 行**：业务编排天然比组件长
- 例外：`docs/`、`playbook/`、`reviews/` 下的 markdown 不受限
- 超过时必须**先告诉用户拆分计划**，得到批准再拆
- 注释和空行算入总行数 — 但如果你接近上限只是因为注释多，先和用户讨论而不是删注释

### 1.2 目录规模
- **每层目录 ≤ 8 个文件**（由 `.claude/hooks/check-folder-size.js` 强制）
- 命名例外：`docs/`、`playbook/`、`reviews/`、`node_modules/`、`.next/`、`.git/`、`public/`、`contracts/`
- **`src/app/api/**` 整棵子树豁免**：Next.js API route 子树天然会超 8 个端点
- 项目根目录例外：含 `package.json` + `.git` 的那一层自动豁免（`next.config.ts`、`tsconfig.json`、`package.json`、`AGENTS.md` 等工具链/约定文件必须在根，搬不走）
- 超过时必须**先告诉用户子目录规划**，得到批准再建

### 1.3 命名
- 组件文件用 `PascalCase.tsx`（如 `Island.tsx`）
- hooks 用 `useXxx.ts`（如 `useAudioPlayer.ts`）
- API Route 用 `route.ts`（Next.js App Router 约定）
- 工具函数文件用 `kebab-case.ts`（如 `operator-wallet.ts`）
- 类型定义放 `src/types/`，文件名 `kebab-case.ts`

---

## 2. 7 类坏味道（必须主动监测）

发现任何一类，立刻按以下格式告警，**不要默默修复**：

```
⚠️ 代码坏味道：[类型]
位置：[文件名:行号]
问题：[描述]
建议：[修复方案]
是否需要我修复？
```

### 类型清单

1. **僵化**：改一处要连带改很多地方 → 抽取公共模块
2. **冗余**：同样的逻辑出现在多处 → 提取共享函数/组件
3. **循环依赖**：A→B 且 B→A → 重新组织模块边界
4. **脆弱性**：改 A 文件导致看似无关的 B 文件坏 → 解耦
5. **晦涩性**：代码意图不清楚 → 加注释或重命名
6. **数据泥团**：多个参数总是一起出现 → 组合成对象/类型
7. **不必要的复杂性**：用了复杂方案解决简单问题 → 简化

---

## 3. 必须避免的具体动作（hooks 强制 + AI 自觉）

### 3.1 后端 / 区块链相关
- ❌ 在 API Route 中 `await ...waitForTransactionReceipt`（除 `src/app/api/cron/` 外）
- ❌ 同时发两笔运营钱包交易（必须串行 + 队列）
- ❌ 用 `onlyOwner` 做 mint 权限（必须用 `allowlist`）
- ❌ 直接 `DELETE` `pending_scores`（必须 `UPDATE status='expired'`）
- ❌ 硬编码 Arweave 网关地址（必须用 `lib/arweave.ts` 的多网关 fallback）

### 3.2 前端
- ❌ 前端文件 import `operator-wallet.ts` 或 `OPERATOR_PRIVATE_KEY`（hook 强制）
- ❌ 前端调合约（所有合约调用走 API Route）
- ❌ 页面加载时 `new AudioContext()`（必须在用户手势后）

### 3.3 依赖
- ❌ 安装 `wagmi` / `ethers` / `howler` / `tone` / `hardhat`（hook 强制）
- ❌ 安装 `jsonwebtoken`（用 `jose` 替代，Phase 4 已引入）

### 3.4 文件 / 代码
- ❌ 留 TODO 或占位符不实现
- ❌ 写 `// implement later` / `// TODO: handle error`
- ❌ 单文件超过 220 行（hook 强制；route.ts 放宽到 270）
- ❌ 单层目录超过 8 个文件（hook 强制；`src/app/api/**` 整棵子树豁免）
- ❌ Phase 1 就建 12 张表（按 Phase 递增）
- ❌ 自建 JWT 系统绕过 `src/lib/jwt.ts`（Phase 4 起统一走 jwt.ts）

### 3.5 Git
- ❌ `git reset --hard`（用 `scripts/checkpoint.sh` 的 stash + branch 替代）
- ❌ `git push --force`（任何情况都先问用户）
- ❌ `git checkout .`（会丢工作）
- ❌ `--no-verify` 跳过 hook（除非用户明确要求）

---

## 4. 代码风格

### 4.1 TypeScript
- 严格模式：`tsconfig.json` 必须开 `strict: true`
- 不用 `any`，用 `unknown` + 类型守卫
- 复用类型放 `src/types/`，不要在组件里就地写 interface

### 4.2 React
- 函数组件 + hooks，不写 class component
- 副作用必须在 `useEffect` 里，不能在渲染期间
- 不用 `useMemo`/`useCallback` 做"预防性优化"，只在 profiler 证明必要时用

### 4.3 注释
- 注释用**中文**
- 解释 **why** 而不是 **what**（代码本身说明 what）
- API Route / 复杂函数顶部加 1-3 行用途说明

### 4.4 错误处理
- API Route 必须 try/catch + 返回结构化 error
- 前端 fetch 必须处理 error 状态，不能白屏
- 不吞错误：`catch (e) {}` 是禁止的，至少 `console.error`

---

## 5. 提交规范

### 5.1 commit message
```
<type>(<scope>): <summary>

[body 可选]

[concepts: tag1, tag2, tag3]
```

- type：`feat` / `fix` / `docs` / `refactor` / `test` / `chore`
- scope：`api` / `ui` / `contracts` / `db` / `hooks` 等
- summary：用中文，不超过 50 字
- **concepts 标签**：列出本次涉及的概念，方便用 `git log --grep="jwt"` 学习回看

### 5.2 commit 频率
- 每完成一个 playbook step 至少 1 个 commit
- 每 3-5 个 step 一个 Checkpoint commit（用 `scripts/checkpoint.sh`）
- 不要把 10 个文件的改动堆成 1 个 commit

---

## 6. 学习设计相关的代码层规范

### 6.1 LEARNING.md 维护（slow mode）
- 每当代码里第一次出现一个新概念（hook / JWT / idempotency / 状态机 / 等），AI 必须追加到 `docs/LEARNING.md`
- 格式：3 行（是什么 / 类比 / 第一次出现位置）

### 6.2 ERRORS.md 维护
- 每当遇到报错并修复，AI 必须追加到 `docs/ERRORS.md`
- 格式：报错原文 / 为什么 / 怎么修 / 学到了什么 / 相关文件

### 6.3 Diff 走读（Phase 0 跑通后启用）
- 每个 step 的 commit 之后，AI 写一份 `docs/walkthroughs/step-N.md`
- 用日常语言走读 diff，每段代码 3-5 句话解释

### 6.4 "为什么不 X" 脚注（Phase 1 启用）
- 任何**非显而易见**的设计决策，代码里加 1 行注释：`// 💭 为什么不用 X：...`

---

## 7. 例外申请

如果你（AI）认为某条规则在当前情境下不合适：

1. **不要默默违反**
2. **告诉用户**："这一步如果遵守 [规则名]，会导致 [问题]。建议例外，理由是 [理由]"
3. **等用户批准**，且在本次 commit 的 message 里注明例外
4. 如果是反复出现的例外，建议用户更新本文件
