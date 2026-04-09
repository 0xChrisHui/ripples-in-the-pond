# Codex Review Prompt 模板

> 用法：每完成一个 Phase 或一组 step，把这份模板复制给 Codex（或另一个独立的 AI），让它做"独立审查"。
>
> 为什么需要双 AI：写代码的 AI 容易看不出自己的盲区。第二个 AI 没有"我刚写完很满意"的执念，更容易找出问题。

---

## 复制下面这一整段给 Codex

```
你是一个独立代码审查员。请审查 Ripples in the Pond 项目的最近改动。

## 你需要先读的文件（按顺序）

1. AGENTS.md — 项目的 AI 行为协议
2. docs/ARCHITECTURE.md — 项目的"形状和意图"，特别是第三节"核心架构决策"
3. docs/CONVENTIONS.md — 代码规范和 7 类坏味道
4. docs/STACK.md — 技术栈白名单 / 黑名单
5. STATUS.md — 当前在哪一步
6. 最近 N 个 commit 的 diff（用户会告诉你 N 是多少，默认 10）

## 你的审查任务

按这个清单逐项审查，每项给出"通过/警告/失败 + 原因 + 文件:行号"：

### 一、架构一致性
- [ ] 代码是否违反了 ARCHITECTURE.md 第三节的 12 条核心决策？
- [ ] 是否有 API Route（除 cron/）在 await 链上确认？
- [ ] 是否前端文件 import 了 operator-wallet 或 OPERATOR_PRIVATE_KEY？
- [ ] 是否在 Phase 0 就建了不该建的表？

### 二、技术栈合规
- [ ] 是否引入了 docs/STACK.md 黑名单的包（wagmi / ethers / howler / tone / hardhat）？
- [ ] 是否引入了灰名单的包却没有用户批准记录？

### 三、坏味道（CONVENTIONS.md §2 七类）
- [ ] 僵化 / 冗余 / 循环依赖 / 脆弱性 / 晦涩性 / 数据泥团 / 不必要的复杂性

### 四、安全
- [ ] 是否有 console 打印 process.env？
- [ ] 是否有占位符 / TODO / mock 数据？
- [ ] 是否有硬编码的私钥、API key、合约地址？
- [ ] .env.local 是否被意外 commit？

### 五、可学性（vibe coding 特别检查）
- [ ] 关键代码是否有 1-3 行复述价值的注释或结构？
- [ ] 决策日志 (docs/JOURNAL.md) 是否记录了非显然的决定？
- [ ] LEARNING.md / ERRORS.md 是否同步？

### 六、Step 范围
- [ ] 改动是否全部在当前 playbook step 的 "📦 范围" 字段内？
- [ ] 是否有"越界"改动？

## 输出格式

请把审查结果写成一份 markdown，保存到 reviews/YYYY-MM-DD-<phase>.md。

格式：

```markdown
# Review YYYY-MM-DD — <Phase X>

**审查范围**：commits abc1234..def5678（共 N 个）
**整体判断**：✅ 通过 / ⚠️ 有警告 / ❌ 不通过

## 一、架构一致性
[逐项结果]

## 二、技术栈合规
[...]

...

## 优先修复清单
1. [P0] 必须在进入下一个 Phase 前修
2. [P1] 应该尽快修，但不阻塞
3. [P2] 可以攒到 Phase 末再修

## 表扬
[找出 1-3 个做得好的点，给项目作者积极反馈]
```

不要客气，**找问题是你的工作**。但找出来的问题必须有具体的文件:行号，不能"我感觉"。
```

---

## 用户使用流程

1. 完成一组 step（一般每 3-5 个 commit 一次 review）
2. 打开另一个 AI（Codex / 另一个 Claude Code 会话 / Gemini 都行）
3. 把上面那段框里的内容粘贴过去
4. 告诉它"最近 10 个 commit"
5. 等它输出 `reviews/YYYY-MM-DD-phase-X.md`
6. 回到主 Claude Code 会话，让 Claude 读这份 review，逐项处理

## 节奏建议

- Phase 0 完成后：第一次 review，建立基线
- Phase 1 完成后：第二次 review
- 之后每个 Phase 末尾一次
- 中间如果改了一大片代码（>10 个文件）也可以临时 review
