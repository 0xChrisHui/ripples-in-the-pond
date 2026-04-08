# INDEX — 文档地图

> 这份文件回答一个问题：**"我现在想做 X，应该看哪个文件？"**
>
> 文档不是越多越好，**找得到才有用**。这是项目的"目录大堂"。

---

## 🎯 按需求快速导航

### 我想知道**现在该做什么**
→ `STATUS.md`（"下一步"字段是真理来源）+ `TASKS.md`（看板）

### 我想跟着做下一步
→ `playbook/phase-0-minimal.md`（当前 Phase）

### 我看不懂某个概念
→ `docs/LEARNING.md`（按出现顺序的概念词典）
→ 或 `bash scripts/learn.sh <关键词>` 跨文件搜

### 我遇到了报错
→ `docs/ERRORS.md`（错误博物馆，先搜有没有同款）
→ `bash scripts/learn.sh <报错关键词>`

### 我不知道命令怎么敲
→ `docs/COMMANDS.md`

### 我想知道项目要去哪里
→ `docs/ARCHITECTURE.md`（第三节"核心架构决策"是 12 条铁律）

### 我想装一个新包
→ `docs/STACK.md`（白名单 / 黑名单 / 灰名单）

### 我想知道哪些代码模式是被禁的
→ `docs/CONVENTIONS.md` §2-3

### 我想知道 AI 应该怎么跟我协作
→ `AGENTS.md`

### 我想回看"为什么当时这么决定"
→ `docs/JOURNAL.md`（决策日志）+ git log

### 我想做安全加固
→ `docs/HARDENING.md`（按里程碑分级，不要在 Phase 1 就做）

### 我想做代码审查
→ `reviews/PROMPT-TEMPLATE.md`（用第二个 AI 做独立审查）

### 我想在项目根快速上手
→ `QUICKSTART.md`（5 分钟跑起来）+ `README.md`

---

## 📂 写入路径（哪里该往哪里写）

| 写什么 | 写到哪 |
|---|---|
| 当前进度 | `STATUS.md`（每完成一个小闭环更新） |
| 任务流转 | `TASKS.md`（Now/Next/Later/Done） |
| 学到的新概念 | `docs/LEARNING.md`（每次 AI 自动追加） |
| 报错 + 修复 | `docs/ERRORS.md`（每次 AI 自动追加） |
| 决策原因 | `docs/JOURNAL.md`（非显然决定才写） |
| 代码 review 结果 | `reviews/YYYY-MM-DD-*.md` |
| 单 step 的 walkthrough | `docs/walkthroughs/step-N.md`（Phase 0 跑通后启用） |

---

## 🚫 不要写在哪里

- ❌ 不要在 `ARCHITECTURE.md` 里写实现细节（字段名、函数签名、SQL 列）。它只放"形状和意图"。
- ❌ 不要在 `CONVENTIONS.md` / `STACK.md` 里写决策原因。原因放 `JOURNAL.md` 或 commit message。
- ❌ 不要在 `STATUS.md` 里写完整历史。历史在 git log。
- ❌ 不要在 `playbook/` 里写未来 Phase 的具体实现。playbook 只写当前 Phase 的可执行 step。

---

## 🔄 文档之间的关系

```
ARCHITECTURE.md ──"形状和意图"──┐
                                ├──> 决定 ──> CONVENTIONS.md (代码规范)
                                │                STACK.md (技术栈)
                                │
                                └──> 拆解 ──> playbook/phase-N/*.md (可执行 step)
                                                    │
                                                    └──> 执行 ──> 代码 + git commit
                                                                    │
                                                                    └──> 沉淀 ──> LEARNING.md
                                                                                  ERRORS.md
                                                                                  JOURNAL.md

STATUS.md / TASKS.md ── 状态面板，随时更新

AGENTS.md ── AI 行为协议（贯穿全部）
```
