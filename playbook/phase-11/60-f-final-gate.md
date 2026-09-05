# Track F — P11 最终验收与发布门

> **目标**：用真实路由、永久资源、设备能力与多输入方式证明 P11 可用。只修 P11 范围问题；不自动提交或部署。

---

## F0｜范围、架构与真值审计

1. 记录 `git status --short`，区分 P11 与用户原有改动。
2. 确认 `docs/ARCHITECTURE.md` 已获授权并与 v3 一致；仍冲突则停止发布。
3. 搜索旧 Decoder iframe、旧 ScorePlayer、假日期、假 0 值、当前环境资源替换和未批准 artist 文案。
4. 确认永久 Decoder、历史 metadata、合约、DB schema 与 P9 注册表没有被 P11 改写。
5. 检查代码硬线、目录 8 条目、禁用依赖、Canvas 数量与首页异步 bundle 边界。
6. 核对 STATUS、TASKS、JOURNAL、LEARNING 与生产行为一致。

失败立即停；不修范围外问题，不通过删除测试或降低规则获得绿色。

---

## F1｜自动验证

### 必跑

```bash
bash scripts/verify.sh
```

### 定向验证

- `ScorePageData`：ready(database/chain)、processing、failed、null。
- metadata：合法/损坏 JSON、缺参数、第三方 URL、单网关失败、超时与 128KiB 上限。
- sounds map：旧/v1/v2 格式。
- Web Audio：load、play、pause、resume、ended、replay、error、destroy。
- P9 session：初始化、事件调度、pause、余韵、destroy、replay 与路由重建。
- 音频互斥：进入 Score stop，全局播放器隐藏，离开不恢复。
- OG/海报媒体类型、canonical 与分享反馈。

不新增测试框架；优先使用现有 TypeScript/tsx 工具和真实公开 Token 快照。fixture 只进入测试或 reviews，不进入产品运行时。

---

## F2｜路由、视口与能力矩阵

| 路由/状态 | 375 coarse | 390 coarse | 768 coarse | 1024 fine | 1440 fine |
|---|---:|---:|---:|---:|---:|
| 首页导航与演奏 | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/score/1` idle 唱片 | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/score/1` playing 日食 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 第二枚历史 Token | ✓ | — | ✓ | — | ✓ |
| Score 链上降级 | ✓ | — | ✓ | — | ✓ |
| Score 七个 queue 状态 | ✓ | — | ✓ | — | ✓ |
| Score metadata/播放错误 | ✓ | — | ✓ | — | ✓ |
| Score 无 WebGL/context lost | ✓ | — | ✓ | — | ✓ |
| `/me` 未登录/空/少/多/局部失败 | ✓ | — | ✓ | — | ✓ |
| `/artist` 正常/统计失败 | ✓ | — | ✓ | — | ✓ |
| 登录全流程 | ✓ | ✓ | ✓ | — | ✓ |
| 全局 error/404 | ✓ | — | ✓ | — | ✓ |

### 每格

- 无 iframe、横向滚动、遮挡、重叠、不可达按钮与 hydration 警告。
- 页面标题、主动作、首屏分享、返回池塘与状态清楚。
- coarse pointer 没有 hover、鼠标跟随、视差、持续触摸追踪或额外指针粒子。
- fine pointer 的互动不遮挡控制、不污染账本阅读。
- console 无 P11 新增错误；证据注明 URL、视口、pointer/hover、登录与数据状态。

---

## F3｜永久输入、播放与 P9 专项

1. 对 Token #1 与第二枚历史 Token 记录 metadata URL、原始 `animation_url` 与解析后的 events/base/sounds。
2. 证明站内 Web Audio 与 P9 实际请求的引用逐字一致。
3. 改变当前环境 decoder/sounds 配置后，历史 Token 输入仍不变。
4. 在 DB 不可用路径重复验证同一结论。
5. 账本“打开永久播放器”能在新标签独立播放。

### 状态时序

```text
首页或档案正在播放
        ↓ 进入 /score
全局播放器 stop + 隐藏；Score session 初始化
        ↓ 用户点击静态唱片
唱片 → 日食；永久 Web Audio + P9 同钟播放
        ↓ pause / resume / ended / replay
唱片/日食、进度、声音与事件一致
        ↓ 离开
Audio + P9 + pointer + water session destroy；保持静音
```

### 连续演奏 Gate

- 代表家族：单键一次、同键约 8 次/秒持续 2 秒、暂停/恢复、最长余韵。
- 扩展后：两键交替约 6 次/秒持续 4 秒、四键近同时、全部永久 Events 与真实整段播放。
- voice 有固定上限和可解释让位；全局重音有冷却；月光/全局亮度不随每个事件爆闪。
- 所有临时参数回到基础值，无持续缓存增长、context loss 或路由泄漏。

### 通过标准

- 无双重声音、幽灵恢复、重复 context、残留 RAF/timer/fetch 或跨页 P9 状态。
- 播放失败不破坏作品身份、分享与凭证，永久 Decoder 出口仍可用。
- 本期没有 seek、自动播放或滚动控制播放。

---

## F4｜设计与可访问性

- 与批准样板并排检查：idle 是静态唱片，playing 是同一锚点的日食，不退化为卡片墙或通用 Web3 发光页。
- UI 强调使用暖墨黑、骨白、氧化黄铜与低饱和植被色；淡蓝不承担主要操作语义。
- 正文对比度 ≥4.5:1；大字、边界与焦点 ≥3:1。
- 200% 缩放仍能完成播放、分享、复制与核验。
- Tab 顺序等于视觉/DOM 顺序，弹窗焦点正确进入和归还。
- 触控目标 ≥44px，手机正文 ≥16px，行长 45–75 字符。
- Canvas 有 DOM 等价物；事件动画不逐条轰炸 live region。
- reduced-motion 降低空间运动、花瓣和水面负载，但保留播放状态、进度与短转场。
- 暗色单主题在系统强制配色和高对比模式下仍可操作。

---

## F5｜性能、移动降级与韧性

- Score 最多一棵 R3F Canvas + 现有花瓣 Canvas；无第三棵 PondGL、无第二个 P9 注册表。
- 首页构建产物不包含 Score data、playback、ledger 或单节点 session；Score 也不预载相邻 Token。
- coarse pointer 不注册高频 mousemove、raycast、hover 与额外 pointer effects。
- metadata 与身份先渲染；WebGL/音频延迟不阻断返回、分享、凭证与永久入口。
- 低性能门有 DPR/FBO/花瓣/环境频率预算；降级不修改音频时间线。
- DB 故障时数字 Token 仍可读链与播放；Arweave 双网关失败仍保留链上身份。
- 无 WebGL/context lost 时静态唱片 fallback 可播放音频或打开永久 Decoder。
- 无新增依赖、追踪脚本和第三方 UI 运行时。

### 最低性能证据

- 375px 移动仿真：首播、整段、滚动账本、后台/前台切换与页面返回。
- 1440px fine pointer：持续鼠标扰动 + 播放 + 滚动账本，不丢帧到不可操作。
- 长时间播放：内存趋稳、Canvas 不重挂、session 销毁后事件与 RAF 归零。
- 自动降级触发前后作品身份、分享和播放控制保持稳定。

---

## F6｜内容与文档 Gate

- Artist 页面逐段对照用户批准内容包；无假姓名、章节、经历、引语或链接。
- 108 项目无空投、收益、倒计时和未经批准的章节含义。
- STATUS/TASKS 写明真实完成与下一步。
- JOURNAL 记录唱片 ↔ 日食、桌面/手机分工、永久凭证与同源 PondGL 决定。
- LEARNING 记录 capability query、路由渲染会话隔离与“移动降级 ≠ reduced-motion”。
- ERRORS 只收录实际发生的 P11 错误。
- `reviews/` 保存最终报告、能力矩阵、五档截图、连续演奏录像与永久输入对照。

### 最终停点

- 完整验证与全部 Gate 通过。
- 用户完成首页、Score、Me、Artist 目验。
- 未经用户明确说 `commit / 发布`，只报告“已具备发布条件”。
