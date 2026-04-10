# Review 2026-04-10 — Phase 2 Patatap 方向调整

**审查对象**：
- commit `08fa882` `docs(phase2): v3 — Patatap 风格首页融合方案，全套重写`
- `docs/ARCHITECTURE.md`
- `docs/JOURNAL.md`
- `playbook/phase-2/overview.md`
- `playbook/phase-2/track-a-backend.md`
- `playbook/phase-2/track-b-frontend.md`
- `playbook/phase-2/track-c-integration.md`
- `src/types/jam.ts`

---

## 发现

### [P0] `24h` 限时语义被这次改动悄悄改掉了：现在服务端无法知道草稿真正是什么时候创作的

位置：
- `docs/ARCHITECTURE.md:218-223`
- `playbook/phase-2/track-a-backend.md:10`
- `playbook/phase-2/track-a-backend.md:62-72`
- `playbook/phase-2/track-b-frontend.md:94-98`
- `playbook/phase-2/track-c-integration.md:52-55`
- `src/types/jam.ts:60-63`

问题：
架构现在定义为：录制结束后草稿先落在 `localStorage`，用户点爱心并登录后，才调用 `POST /api/score/save` 上传后端。  
但 `SaveScoreRequest` 只有 `{ trackId, eventsData }`，没有 `createdAt` / `expiresAt` / 录制开始时间。也就是说，后端根本不知道这段草稿是什么时候创作的。

直接后果：
- `24h 可收藏` 会退化成 `24h 从登录/上传那一刻开始算`
- 用户完全可以隔几天后再点爱心，服务端仍会把它当成一条“新鲜”草稿
- `/me` 的草稿倒计时会和用户真实创作时间脱节

这不是文案问题，而是产品规则已经被实现策略悄悄改义了。

建议：
- 要么把 `createdAt` 明确写进上传协议，由服务端按“原始创作时间”计算 TTL
- 要么承认规则改变，把产品文案改成“登录后 24h 内可收藏”
- 二者必须选一个，不能保持现在这种暧昧状态

---

### [P0] “爱心收藏”现在同时承载了登录、草稿上传、铸造三件事，但计划里没有定义这个复合动作的状态机

位置：
- `docs/ARCHITECTURE.md:208-223`
- `playbook/phase-2/track-c-integration.md:44-55`
- `TASKS.md:37`
- `TASKS.md:71`

问题：
`C2` 现在定义的是：

1. 点爱心
2. 未登录则登录
3. 从 `localStorage` 取草稿上传后端
4. 触发铸造

但这里至少包含 3 个独立副作用：

- auth 成功/失败
- `POST /api/score/save` 成功/失败
- 现有 `POST /api/mint/material` 队列写入成功/失败

计划里没有写任何一致性规则：
- 如果登录成功、草稿上传成功，但铸造失败，爱心是什么状态？
- 如果铸造成功，但草稿上传失败，个人页还能不能看到这次创作？
- 如果用户根本没有草稿，但点了爱心，是否还允许收藏素材 NFT？

这会让“爱心”从一个简单按钮，变成一个没有明说补偿规则的多步事务。

建议：
- 在 playbook 里显式写一个 `favorite flow state machine`
- 至少冻结 4 个状态：`idle / auth_required / uploading_draft / minting / partial_failed`
- 明确“无草稿时点爱心”到底是允许纯收藏素材，还是必须先演奏

---

### [P1] `overview.md` 的 ownership 规则和 Track B 的实际写法直接冲突，按这份计划并行开发会立刻失效

位置：
- `playbook/phase-2/overview.md:36-39`
- `playbook/phase-2/track-b-frontend.md:32`
- `playbook/phase-2/track-b-frontend.md:56`
- `playbook/phase-2/track-b-frontend.md:76`
- `playbook/phase-2/track-b-frontend.md:91`
- `playbook/phase-2/track-b-frontend.md:105`

问题：
`overview.md` 明确写了 `app/page.tsx` 是 **只有 C 能碰**。  
但 Track B 的 B0 / B1 / B2 / B3 / B4 每一步都在修改 `app/page.tsx`。

这不是小瑕疵，而是执行层面的直接冲突：
- ownership 规则会失去权威
- 并行边界会变成口头约定
- 后续 Claude / Codex 接手时会不知道该信 overview 还是该信 step

建议：
- 要么把 `app/page.tsx` 正式划给 Track B
- 要么把首页融合拆成“B 先做 `src/components/home/HomeInstrument.tsx`，C 再接到 `app/page.tsx`”

现在这两份文档不能同时为真。

---

### [P1] 录制时间基准写成 `performance.now()`，这更像页面时钟，不像音频时钟；后面做回放和链上乐谱时容易漂

位置：
- `playbook/phase-2/track-b-frontend.md:79-83`

问题：
当前 B2 明确写了：录制的 `time` 基于 `performance.now()`。  
但这套系统真正关心的是“音频事件相对背景曲播放进度”的时间，而不是“页面渲染层当前已经跑了多少毫秒”。

风险：
- 回放对齐会受 tab 切换、掉帧、暂停恢复影响
- 后面如果这份数据要进入 `mint_events.score_data`，你会发现采样时钟和播放时钟不是同一件事
- 现在先用 `performance.now()` 看似简单，后面很可能要整体迁移

建议：
- 录制与回放统一以 `AudioContext.currentTime` 或等价的音频 transport 时钟为准
- 如果真的要用毫秒值，也应该由音频时钟推导，而不是直接依赖页面时钟

---

### [P1] “个人页草稿倒计时”这个承诺，目前只对“已经点过爱心并上传成功”的草稿成立，不对“真实创作过的草稿”成立

位置：
- `docs/ARCHITECTURE.md:24-26`
- `docs/ARCHITECTURE.md:304-305`
- `playbook/phase-2/track-a-backend.md:92-103`
- `playbook/phase-2/track-c-integration.md:59-70`

问题：
架构和 Track C 都在讲“个人页看到草稿倒计时”。  
但按当前设计，草稿默认只在浏览器本地，只有点爱心并登录之后才会上传到后端。

这意味着：
- 你明明已经创作过，但如果没点爱心，`/me` 不会有任何记录
- `/me` 展示的不是“我的草稿”，而是“我已经准备拿去收藏的草稿”

这是产品语义层面的错位。

建议：
- 要么把 `/me` 的文案和目标改成“已上传草稿”
- 要么在登录成功进入 `/me` 时，同步把本地草稿补上传
- 不然“个人页草稿倒计时”这个承诺会误导后续实现

---

### [P2] 这次方向调整把移动端从“简化可玩”降成了“提示不可玩”，这是可以接受的取舍，但应该被明确写成 trade-off，而不是藏在完成标准里

位置：
- `playbook/phase-2/track-b-frontend.md:108-112`
- `docs/ARCHITECTURE.md:414`

问题：
Phase 2 现在把首页定义成主舞台，但移动端完成标准只是：
`390px 宽度显示“请使用电脑键盘体验合奏”`

这并非一定错误，但它已经是一个明确的产品 trade-off：
- 主页可以看
- 主页不能真正参与核心共创

如果这是你们的有意取舍，应该在 `overview.md` 或 `ARCHITECTURE.md` 里明写出来，而不是只在 B4 的完成标准里轻描淡写。

建议：
- 明确写成“Phase 2 mobile = browse only, not playable”
- 或至少给手机用户一个 6-9 键触控简化版，而不是纯提示

---

## 整体判断

这次方向调整里，我**认可用户体验方向本身**：

- 首页即乐器，比单独 `/jam` 路由更像作品
- “收藏”比“铸造”更符合普通用户语言
- 录制无感化，确实更接近 Patatap 的打开即玩

但从执行层看，这次改动也带来了 3 个新的系统级风险：

1. `24h TTL` 规则被本地草稿策略改义
2. “爱心”从单一步骤变成多副作用事务，却没有状态机
3. 文档边界开始自相矛盾（ownership / 个人页语义）

所以我的结论是：

**方向是对的，但这次临时重写还没有收口到“可以放心开工”的程度。**

在我看来，至少要先补这 3 件事，才能让 Claude / Codex 后续稳定执行：

1. 冻结“24h 到底从什么时候开始算”
2. 冻结“无草稿点爱心到底允不允许收藏素材”
3. 修正 `overview` 和 `Track B` 的 ownership 冲突

如果这 3 件事不先写死，后面很容易一边做一边重新定义产品。
