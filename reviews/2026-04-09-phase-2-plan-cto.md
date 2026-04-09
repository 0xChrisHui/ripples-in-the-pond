# CTO Review 2026-04-09 — Phase 2 Plan

**审查对象**：
- `playbook/phase-2/overview.md`
- `playbook/phase-2/step-0-spike.md`
- `playbook/phase-2/track-a-backend.md`
- `playbook/phase-2/track-b-frontend.md`
- `playbook/phase-2/track-c-integration.md`
- `src/types/jam.ts`

**一句话结论**：
这套 Phase 2 方案方向是对的，已经有“先 spike、再并行、最后集成”的成熟意识；但从 CTO 视角看，**它现在更像一份好用的开发提纲，还不是一份足够硬的执行计划**。  
最大问题不在功能点多少，而在于：**前置关口还不够硬、状态机还不够完整、真实风险还没有被完全写进计划。**

---

## 一、我认可的部分

### 1. 先做 Step 0 gate，再分 Track A/B/C

这是一个很好的方向。  
对这种“音频交互 + 录制 + 回放”的复杂体验，先做 spike 再分线，明显比“直接开写”成熟。

### 2. ownership 意识已经比 Phase 1 更强

`overview.md` 已经开始明确：

- A 管后端与 schema
- B 管 jam UI 与 hooks
- C 才碰首页入口与最终集成

这说明你们已经不再把“并行开发”理解成“大家一起写”，而是开始理解为“先切边界，再并行”。

### 3. `src/types/jam.ts` 作为共享契约是正确方向

把 API 名称和类型先冻结，是对的。  
Phase 2 这种跨前后端、跨录制与回放的数据流，没有共享契约很容易在 Track C 爆炸。

---

## 二、发现

### [P0] `pending_scores` 的状态机定义不完整，和项目规范直接冲突

位置：
- `playbook/phase-2/track-a-backend.md:36-39`
- `src/types/jam.ts:39-49`
- `docs/CONVENTIONS.md:63`

问题：
当前计划给 `pending_scores` 只定义了 `score_id / user_id / track_id / events_data / created_at / expires_at`，但项目规范明确写了：**禁止直接 DELETE `pending_scores`，必须 `UPDATE status='expired'`**。  
也就是说，这张表从计划阶段开始就缺了最关键的 `status` 字段。

为什么严重：
- 过期策略会立刻失去落地载体
- “草稿存在 / 过期 / 覆盖 / 预览中 / 已保存失败”这些状态无法建模
- 你们后面一旦要做倒计时、隐藏过期项、补偿或清理，就会发现表结构不够用

建议：
- 在 A0 就把 `pending_scores` 升级成明确的状态机表，而不是单纯 TTL 容器
- 至少增加：`status`、`updated_at`
- 如果你们预计“新的覆盖旧的”，最好再加 `replaced_by` 或显式 upsert 规则说明

---

### [P0] Step 0 的 spike 还不够像真正的 gate，可能会放行一个后面注定返工的方案

位置：
- `playbook/phase-2/step-0-spike.md:13-16`
- `playbook/phase-2/step-0-spike.md:32-36`
- `playbook/phase-2/track-b-frontend.md:123-138`
- `docs/ARCHITECTURE.md:22`

问题：
现在的 spike 只验证了：

- 键盘 A-Z
- OscillatorNode 发声
- CSS 圆圈动画

但真正决定 Phase 2 成败的风险还没被验证：

- 背景原曲 + 键盘音效能否稳定混音
- 用户手势后解锁 `AudioContext` 的流程是否稳
- 录制时间基准和回放时间基准是否一致
- 真正的音效文件加载后延迟是否仍然可接受
- 移动端 / 触控入口是否成立

而架构里用户主路已经写明是“键盘/触控 + 24h TTL 可视化”，不是纯桌面键盘 demo。

建议：
- 把 Step 0 的通过标准升级成“真实 jam 风险验证”，至少补 4 件事：
  - 真音频文件加载一次并播放
  - 背景 track + 按键音效叠加
  - 录制 10 秒后回放仍然对齐
  - 手机宽度下至少有可触发入口
- 如果这些没过，不要放行 Track A/B 并行

---

### [P1] Arweave 在这版计划里处于一个尴尬位置：既没有真正进入主链路，又已经进入关键路径

位置：
- `playbook/phase-2/overview.md:13-15`
- `playbook/phase-2/track-a-backend.md:16`
- `playbook/phase-2/track-a-backend.md:49-50`
- `playbook/phase-2/track-a-backend.md:64-79`
- `docs/ARCHITECTURE.md:367-371`

问题：
当前计划同时存在两套相互拉扯的策略：

1. `overview.md` 把 Arweave 写成 Phase 2 架构依据和关键能力
2. A1 又写“Phase 2 用本地 mp3，Phase 3 再换 Arweave URL”
3. A2 再单独装 `@ardrive/turbo-sdk` 并做测试上传

这会造成一个很典型的问题：

**Arweave 已经进入了开发复杂度，但还没真正进入用户价值。**

建议二选一，不要夹在中间：

- 方案 A：Phase 2 完全不把 Arweave 放进关键路径，只做本地/静态音频 + drafts，Arweave 彻底后移到 Phase 3
- 方案 B：既然架构上认定静态资源最终都要预上传，那就让 A1/A2 直接产出可长期复用的 `sounds` 正式 URL，不要中途再经历一次“本地 → Arweave”的迁移

从 CTO 视角，我更倾向：
**如果这轮的用户价值只是 jam + draft，Arweave 可以不阻塞 Phase 2 主线。**

---

### [P1] 共享契约还没有完全冻结，Track C 仍然承担了太多“补合同”的工作

位置：
- `playbook/phase-2/overview.md:37-47`
- `playbook/phase-2/track-b-frontend.md:27-36`
- `playbook/phase-2/track-c-integration.md:76`
- `src/types/jam.ts:5-10`

问题：
虽然 `src/types/jam.ts` 已经出现了，但目前还有几个关键契约没有真正冻结：

- `src/data/jam-source.ts` 只是伪代码约定，不是正式接口契约
- `/api/me/scores` 竟然允许“Track A 没做的话在 C 里做”
- `src/types/` 的 ownership 归 A，但 B 从 Day 1 就依赖它

这意味着 Track C 不只是“接线”，而还在承担“补协议、补 API、补边界”的职责。

建议：
- 在正式开工前，把 `src/types/jam.ts` 和 `src/data/jam-source.ts` 一起冻结
- `/api/me/scores` 必须明确归属 Track A，不要留给 C 兜底
- Track C 只做集成，不再新增后端接口

---

### [P1] 草稿保存 API 缺少明确的资源上限，Phase 2 一上线就会埋下数据滥用点

位置：
- `playbook/phase-2/track-a-backend.md:101-105`
- `playbook/phase-2/track-b-frontend.md:112-116`
- `src/types/jam.ts:29-37`

问题：
`eventsData` 现在只是一个开放数组，计划里没有写：

- 最长录制时长
- 最大事件数
- 单次 payload 大小上限
- 是否必须落在曲目长度内

对于 sponsored mint 系统，这虽然还没烧链上 gas，但已经开始烧数据库、带宽和后续处理复杂度。

建议：
- 在 A3 完成标准里直接写清楚约束
- 推荐至少冻结：
  - 最大录制时长：例如 60s 或 track duration
  - 最大事件数：例如 500 / 1000
  - body 大小限制
  - 非法 key / 负数 time / 超长 duration 直接 400

---

### [P1] 移动端 / 触控路径缺席，和架构里的核心体验承诺不一致

位置：
- `playbook/phase-2/overview.md:7`
- `playbook/phase-2/step-0-spike.md:13`
- `playbook/phase-2/track-b-frontend.md:43`
- `docs/ARCHITECTURE.md:22`

问题：
当前计划几乎把 Phase 2 定义成“桌面键盘 A-Z 演奏”。  
但架构里写的是“键盘/触控 + 24h TTL 可视化”，而且这个产品很大概率会先在手机上被看到。

如果手机用户点击“合奏”后只能看到一个基本不可用的键盘页，那 Phase 2 的第一印象会直接打折。

建议：
- 不一定要在 Phase 2 做完整移动端键盘，但至少要在 Step 0 或 B0 明确一个 mobile fallback：
  - 触控九宫格 / 12 键简化版
  - 或手机上先展示“预览 + 录制不可用提示”，但这是产品决定，不能留白
- 把“390px 宽度下可操作”写进完成标准

---

### [P2] 计划里还留着两个不该到执行阶段才决定的问题

位置：
- `playbook/phase-2/track-a-backend.md:58`
- `playbook/phase-2/track-a-backend.md:120`

问题：
这里有两个信号说明计划还没完全收口：

1. `GET /api/sounds` 被写成“顺手写”
2. 草稿预览权限写成“必须是本人的草稿（或公开预览，产品决定）”

这类问题不适合留到执行时现场拍脑袋。  
一个是基础接口，不该是顺手；另一个是产品权限边界，不该在写代码时才决定。

建议：
- 把 `GET /api/sounds` 提升成独立 step 或 A1 的正式完成标准
- 先冻结草稿预览策略：
  - 私有预览
  - 带 token 的分享预览
  - 完全公开  
  三者的后续数据模型和 UI 路径都不一样

---

## 三、整体判断

从宏观上看，这份计划的方向我认可，但我会把它定义成：

**“80 分的开发提纲，离 95 分的执行 playbook 还差一轮收口。”**

它现在已经具备：

- 阶段目标明确
- 分线边界初步合理
- 共享类型意识
- Track C 集成意识

但还缺少：

- 足够硬的 gate
- 足够完整的状态机
- 足够清晰的 Phase 2 / Phase 3 边界
- 足够明确的移动端与数据上限策略

---

## 四、我建议怎么改

### 1. 先把 Step 0 升级成真正的 Gate

推荐把 Step 0 的通过标准改成：

1. 真音效文件加载并播放成功
2. 背景原曲 + 按键音效同时播放稳定
3. 录制 10 秒并回放，节奏误差可接受
4. 390px 宽度下至少存在可操作入口

只要这 4 条没过，就不要分 Track A/B。

### 2. A0 先把 `pending_scores` 设计成状态机表

至少建议：

- `id`
- `user_id`
- `track_id`
- `events_data`
- `status`
- `created_at`
- `updated_at`
- `expires_at`

如果以后要覆盖旧稿，再决定是否补 `replaced_by`。

### 3. 把 Arweave 从“模糊关键路径”改成“明确前置”或“明确后置”

不要再保持现在的半吊子状态。  
我推荐更现实的版本：

- **Phase 2 主线**：本地 / 静态音频 + jam + draft + preview
- **Phase 2 sidecar**：`src/lib/arweave.ts` 做非阻塞准备
- **Phase 3 主线**：正式把静态资源与 metadata 迁入 Arweave

这样既不违背长期架构，也不会让 Phase 2 为一个还没产生用户价值的能力背太多复杂度。

### 4. 提前冻结 3 个契约

正式开始前，把这 3 个东西一次性冻结：

1. `src/types/jam.ts`
2. `src/data/jam-source.ts`
3. 草稿预览权限策略

冻结完再分线，Track C 会轻很多。

### 5. 把 Track C 收缩成“纯集成”

Track C 最好只做：

- merge
- mock → real
- 首页入口
- 草稿页接线
- e2e

不要让 C 再承担“补 API”或“补数据模型”的任务。

---

## 五、我会怎么重排这份 Phase 2

### Step 0（升级版）
- 音频真实 gate：样本加载 / 背景混音 / 录制回放 / mobile fallback

### Track A
- A0：`sounds` + `pending_scores(status)` + 过期策略
- A1：`GET /api/sounds` + 正式 seed
- A2：`POST /api/score/save` + 资源上限校验
- A3：`GET /api/scores/[id]/preview`
- A4：`GET /api/me/scores`
- A5：Arweave 适配层准备（若坚持 Phase 2 做）

### Track B
- B0：`/jam/[trackId]` 骨架 + 数据适配层
- B1：音效播放 + 背景混音
- B2：视觉反馈
- B3：录制与回放
- B4：保存流程 + mobile fallback + 完整状态

### Track C
- C0：merge
- C1：mock → real
- C2：首页合奏入口
- C3：个人页草稿列表 + 倒计时
- C4：e2e + 文档收口

---

## 六、最终判断

如果现在就照这版直接开工，我认为：

- **能做出来**：大概率可以
- **会不会中途返工**：也很大概率会

最容易返工的地方就是：

1. `pending_scores` 表结构
2. Step 0 验证深度不够
3. Arweave 在 Phase 2 的定位不清
4. 移动端 / 触控路径缺席

所以我最核心的建议只有一句：

**先把这份计划从“能开发”收口成“能稳定执行”，再开 Phase 2。**

如果你要把这份文档给 Claude，我建议直接让它做两件事：

1. 按这份 review 把 `phase-2` playbook 改成 v2
2. 单独输出一份“Step 0 Gate 清单”，把通过/不通过标准写死
