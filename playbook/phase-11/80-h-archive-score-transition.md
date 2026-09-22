# Track H — `/me ↔ /score` 档案到作品水塘

> **状态**：计划已冻结，尚未施工
> **前置硬门**：P11-G 全部完成并证明 Water Core 在 `/ ↔ /me` 往返中不重挂
> **目标**：用户从私人档案取出一张已完成唱片时，同一片水面继续运行，档案条目转为 Score 的单作品锚点；Score 音频、P9、永久数据与路由会话继续严格隔离。
> **推荐方案**：共享 Water Core，路由 Scene 与 Audio Session 独立；不把整个 Score 页面塞进首页状态。

---

## 1. 三句话概念简报

1. `/me → /score` 的主角不是页面，而是用户点击的那张唱片：它从档案索引中被取出，在同一片水面中央展开。
2. 可以共享的是水体、花瓣与涟漪；不能共享的是首页多节点 glSim、Score 永久播放输入、独立 AudioContext 和 P9 路由会话。
3. 转场必须等待真实 Score 身份准备好，但不能用假唱片、假 Token 或全屏 loading 填补等待。

---

## 2. P11-G 完成后的起点

```text
PersistentPondShell
├─ PersistentWaterCore          水体 / 花瓣 / pointer / health
├─ HomeSceneAdapter             多音乐圆圈 + 首页 glSim
├─ ArchiveSurface               私人档案 DOM
└─ PondRouteTransition          home ↔ archive

当前 /score/[id]
└─ 独立 ScorePondScene          单作品 PondGL + ScoreAudio/P9 Session
```

P11-H 只在 G 的 Water Core 边界已经稳定后施工。若 G 最终仍把首页 glSim、水面和路由 UI 混在同一组件中，H0 必须先修正边界，禁止再叠第三棵 Canvas 赶进度。

---

## 3. 冻结决策

### H-D1｜只共享 Water Core

- P11-H 把 `/score/[id]` 纳入生产 Pond route group，但共享 Layout 只提供 Water Core 和 Scene 接口。
- 首页使用 `HomeSceneAdapter`，档案不挂作品 Scene，Score 使用 `ScoreSceneAdapter`。
- 首页多节点 glSim 绝不传给 Score；Score 单节点、静态唱片与日食绝不写回首页 Scene。
- Score 页面数据、永久 manifest、播放器、P9 Session 与凭证账本仍由 Score 路由拥有。
- `/artist`、`/echo` 和其他页面不因 H 自动进入持久水塘。

### H-D2｜被点击的档案条目是转场锚点

- 增强转场只用于拥有稳定 Token 路由与真实作品身份的已完成 Score。
- 点击后记录 `scoreKey/tokenId`、条目矩形、档案分页与滚动位置；其他档案行降低存在感并退出。
- 条目的编号、标题或真实封面可通过 DOM View Transition/FLIP 移向中央；最终由真实 Score 静态唱片锚点接管。
- Processing、failed、UUID-only 与数据不完整条目继续走现有状态页，不伪装成永久唱片变形。
- Pond Echo 与 MaterialNFT 不纳入本 Track；它们保持自己的详情/播放路径。

### H-D3｜Score Scene 是同一 Canvas 的单作品 Adapter

- `ScoreSceneAdapter` 把已有单节点视觉输入接入 Water Core，不再创建第二个 PondGL。
- Score idle/loading/paused/ended 继续显示真实永久封面的 DOM 唱片；playing 才显示同一锚点的单球日食与 P9。
- Water Core 不因 `home/archive/score` mode 改变 key、颜色基线、FBO、水位、花瓣数组或 pointer 波场。
- Scene 切换使用连续 presence；旧 Scene 归零并释放后，新 Scene 才取得命中和键盘权限。
- 不让首页圆圈与 Score 单节点在稳定终态同时可见或可点击。

### H-D4｜Score Audio/P9 继续严格隔离

- 路由落到 Score 且真实播放 Session 准备接管时，按现有合同 stop 并隐藏全局播放器；不能在用户刚点击条目、目标尚未 ready 时提前制造无声空窗。
- Score 不自动播放；必须由用户在 Score 页面点击真实唱片/播放动作后创建或恢复 AudioContext。
- Score P9 Session 只消费该 Token 永久 metadata 的 events/base/sounds，不读取首页当前 Track 或数据库替代输入。
- 离开 Score 时销毁 Score Audio、P9 voices、timer、RAF、fetch 与临时 pointer 状态，但不销毁 Water Core。
- 返回 `/me` 后保持静音，不恢复进入 Score 前被停止的全局曲目。

### H-D5｜Score 阅读与水面交互边界不变

- Score Hero 继续浮在水塘上，向下滚动仍进入作品注脚和永久凭证账本。
- 桌面保留鼠标视差与水面扰动，但滚轮永远用于页面阅读，不恢复首页滚轮景深接管。
- 账本进入阅读区时降低高频 pointer 工作，不暂停 Water Core，也不根据滚动位置控制音频。
- 移动/coarse pointer 只保留点击开始、水波、花瓣环境和声音驱动演出。

### H-D6｜返回档案必须恢复来源位置

- 从 `/me` 进入 Score 时把来源记录写入持久 Shell 的短期 transition context，不写 localStorage，不跨账号保留。
- 返回时恢复原档案分区、分页与合理滚动位置，被点击唱片从中央回到对应行。
- 直接访问 `/score/[id]` 没有来源记录时，返回 `/me` 使用默认首屏，不制造不存在的反向变形。
- 浏览器 Back/Forward、页面刷新、登录身份变化或条目被删除时，过期来源记录立即失效并降级为普通淡入。

### H-D7｜View Transition 是锚点工具，不是水面工具

- View Transition/FLIP 只连接档案条目与 Score DOM 唱片锚点。
- Water Core 排除在 snapshot 外，始终保持 live 和可响应。
- 不支持 API、跨设备降级或目标数据超时时，使用黄铜短线/opacity 的普通转场，功能与路由不受影响。
- 不引入 Framer Motion 或新的路由/动画依赖。

### H-D8｜时序预算

| 阶段 | fine pointer 目标 | coarse pointer 目标 |
|---|---:|---:|
| 档案退场 + 锚点离位 | 180–260ms | 120–180ms |
| Score 锚点接管 + UI 出现 | 260–380ms | 180–260ms |
| 总可感知换场 | 520–680ms | 320–440ms |
| reduced-motion | ≤180ms opacity | ≤180ms opacity |

- 数据已预取时按目标时序完成；数据未 ready 时水面保持 live、锚点进入明确等待态，不能循环播放假动画。
- 目标失败时在原档案行恢复交互并显示真实错误，不留半张唱片或不可点击遮罩。
- 用户可以中断或反向；动画不得成为强制等待的展示片段。

---

## 4. 目标结构

```text
app/(pond)/layout.tsx
└─ PersistentPondShell
   ├─ PersistentWaterCore                    所有三条路由共享
   │  ├─ PondGL base / WaterDistort
   │  ├─ WaterPetals / pointer ripple
   │  └─ health / DPR / context fallback
   ├─ SceneSlot                              同一时间一个主 Scene
   │  ├─ HomeSceneAdapter                    /：多节点
   │  ├─ ArchiveSceneAdapter                 /me：无节点
   │  └─ ScoreSceneAdapter                   /score/[id]：单节点/日食
   ├─ PondRouteTransition
   └─ RouteSurface
      ├─ HomeSurface
      ├─ MeArchivePage
      └─ ScoreSurface + Ledger

路由私有会话
├─ PlayerProvider                            / 与 /me
└─ ScoreAudioSession + ScoreP9Session         只在 /score
```

### `/me → /score` 故事板

```text
点击已完成唱片
  ↓ 禁用该行重复点击；预取目标
其他档案内容退场，选中条目留在原位
  ↓
条目标题/封面向池塘中央移动
  ↓ Water Core、花瓣、旧涟漪持续
真实 Score 静态唱片锚点接管
  ↓
Score 标题、分享和播放动作出现；账本在下方可滚动
```

### `/score → /me` 故事板

```text
停止并销毁 Score Audio/P9 Session
  ↓
Score UI 退出，静态唱片锚点保留
  ↓
锚点回到来源档案条目
  ↓
恢复原分区/分页/滚动与档案交互
```

---

## 5. 施工顺序

## H0｜G 验收复核与 Score 基线

### 前置检查

- 复用 G6 证据，确认 `/ ↔ /me` 20 次往返只存在一个稳定 Canvas/mountId。
- 盘点生产 `ScorePondScene`、`use-score-pond-sim`、ScoreAudio、P9、pointer、scroll 与 fallback 生命周期。
- 记录 `/me → /score/<token>` 当前冷/热导航、首个 Score DOM、首个可见唱片、首个可播放时刻与 Canvas 重挂证据。
- 选用真实 OP Mainnet ready Token；Sepolia 或 mock 只作隔离 fixture，不冒充生产作品。

### 架构 Gate

- 更新 ARCHITECTURE：Water Core 可跨三路由持久，Home/Score Scene 与 Audio Session 仍隔离。
- 若 Score 只能通过复制 shader/水面或共享首页 glSim 接入，停止 H 并先修 G 的 Scene 接缝。
- 本步不改变产品视觉和播放逻辑。

---

## H1｜把 Score 路由接入持久 Shell

### 实现

- 将 `/score/[id]` 纳入 Pond route group，URL、canonical、OG、poster 与动态参数不变。
- Score page 只消费 Water Core context；数据与账本仍由原 Score route/server boundary 提供。
- 为 Score 动态加载 `ScoreSceneAdapter`，首页和 `/me` bundle 不包含 Score data/playback/ledger/session。
- 直接访问 Score 时建立一棵 Water Core；从 `/me` 进入时复用现有 mountId。

### Gate

- `/me → /score → /me` 前后 Canvas DOM 引用、mountId、花瓣数组和 pointer 水场连续。
- 直接 `/score`、刷新、分享链接和浏览器新标签正常。
- 首页构建产物对 Score data/playback/ledger/session 的禁入模式继续 0 命中。
- `bash scripts/verify.sh` 通过。

---

## H2｜ScoreSceneAdapter 单作品接管

### 实现

- 把当前 Score 单节点、静态唱片、日食和投影输入改接 SceneSlot。
- idle/loading/paused/ended 不绘制球体；真实静态唱片锚点保持 Score 身份。
- playing 时只挂该 Token 单节点和 GlEclipse；Water Core 不重新初始化。
- Scene presence 同步命中层、标签、阴影、日食与 pointer 权限，避免视觉消失后仍可点击。
- Score 性能降级只调整自身 Scene/Session；共享 Water Core 的 DPR 由单一 owner 管理。

### Gate

- Score idle、play、pause、resume、ended、replay 与 error 行为和 P11-B 证据一致。
- 单作品出现/消失无整棵 Canvas flash、FBO 清空或花瓣重排。
- 首页多节点和 Score 单节点不会同时进入稳定可见/可点击状态。
- `bash scripts/verify.sh` 通过。

---

## H3｜档案条目到作品锚点的前向转场

### 实现

- `ScoreArchiveRow` 只对 ready Token 暴露 enhanced navigation metadata，保持普通链接语义和新标签能力。
- 点击时保存来源 key、分区、分页、scroll 与条目矩形；立即防重复提交并预取目标。
- 用 View Transition/FLIP 连接条目标题或真实封面与 Score 静态唱片；Water Core 明确排除。
- 目标 ready 后一次接管；目标失败则恢复原行并显示既有错误/重试。
- 登录态变化、地址变化和路由目标变化会取消旧 transition context。

### Gate

- 热路径按预算完成，冷路径不白屏、不假完成、不显示错误作品。
- 中途双击、Escape、Back、目标失败和快速改点另一唱片都有确定终态。
- 普通打开、新标签打开、复制链接和键盘 Enter 行为不回退。
- `bash scripts/verify.sh` 通过。

---

## H4｜Score 返回档案的反向转场

### 实现

- 返回前先停止并销毁 Score Audio/P9 route session，静态唱片视觉锚点与 Water Core 继续存在。
- 有有效来源记录时恢复原分区、分页和滚动位置，再把锚点送回对应条目。
- 来源行不存在、用户已切换、档案读取失败或直接访问 Score 时，降级为普通 `/me` Surface 淡入。
- 浏览器 Back 与页面内“返回档案”走同一 transition controller，不维护两套时序。

### Gate

- 返回后无 Score 音频、P9 voice、日食、timer、RAF、fetch 或 pointer 残留。
- 原档案页位置稳定，被点击条目可继续播放/打开；焦点回到合理目标。
- 动画中反向可重新进入 Score，不出现双音源或双锚点。
- `bash scripts/verify.sh` 通过。

---

## H5｜直接访问、降级与阅读路径

### 矩阵

- `/score/<token>` 直接访问、刷新、外链、新标签。
- ready database、chain fallback、processing UUID、failed、not-found。
- metadata 单网关失败、全部网关失败、坏 JSON、缺永久输入。
- WebGL unavailable、context lost、低 FPS 自动降级。
- fine/coarse pointer、reduced-motion、后台/前台恢复。
- Hero → 凭证账本滚动、返回顶部、浏览器 Back/Forward。

### 不变量

- 水面连续不是播放和凭证的前置；fallback 下仍可分享、核验和打开永久 Decoder。
- Score 不接管滚轮，账本可正常阅读。
- 直接访问没有档案来源时不播放虚假的“回到某一行”动画。
- 路由或动画失败不改变永久数据、链上身份和音频输入。

### Gate

- 所有矩阵路径都有明确 UI、可访问名称与恢复出口。
- no-WebGL/reduced-motion 不依赖 View Transition。
- `bash scripts/verify.sh` 通过。

---

## H6｜最终连续性、隔离与性能 Gate

### 自动验证

```bash
bash scripts/verify.sh
```

- 自动记录 `/ → /me → /score → /me → /` 全链路 Canvas 引用、mountId、context 状态与 Scene owner。
- 断言任一稳定时刻只有一个主 Scene 取得命中权限。
- 断言 Score Session 销毁后 AudioContext/P9/RAF/listener/fetch 回到基线。
- 断言首页与 `/me` bundle 不吸收 Score 私有播放/账本代码。

### 真实浏览器矩阵

| 场景 | 375 coarse | 768 coarse | 1024 fine | 1440 fine |
|---|---:|---:|---:|---:|
| `/me → /score` 热路径 | ✓ | ✓ | ✓ | ✓ |
| `/me → /score` 冷路径 | ✓ | — | ✓ | ✓ |
| `/score → /me` 来源恢复 | ✓ | ✓ | ✓ | ✓ |
| 浏览器 Back/Forward | ✓ | — | ✓ | ✓ |
| 动画中反向/换目标 | ✓ | — | ✓ | ✓ |
| Score play/pause/ended 后返回 | ✓ | ✓ | ✓ | ✓ |
| reduced-motion | ✓ | — | ✓ | ✓ |
| no WebGL/context lost | ✓ | — | — | ✓ |
| Score 直接访问/刷新 | ✓ | ✓ | ✓ | ✓ |

### 连续性证据

- 导航前在 `/me` 制造一圈明显水波；Score 出现后该波继续扩散，花瓣不重排。
- 逐帧保存档案条目、中央唱片锚点和 Score UI 的接管过程，无双唱片、黑帧或错误标题。
- 20 次 `/me ↔ /score` 往返后 Canvas、FBO、listener、RAF、内存与音源数量趋稳。
- Score 完整播放一次后返回档案，再进另一作品，永久输入与 P9 不串片。

### 收尾

- 删除旧 Score 独立 PondGL 挂载路径与仅供迁移的桥接代码，保留 fallback 和自动断言。
- 更新 STATUS、TASKS、JOURNAL、ARCHITECTURE 与最终 review 证据。
- P11-H 完成不自动扩展到 `/echo` 或 `/artist`，不自动推送或部署生产。

---

## 6. Track H 完成定义

- [ ] P11-G 已完整通过，H 没有复制或重建 Water Core。
- [ ] `/me` 与 `/score` 往返使用同一 Canvas、水面、花瓣和 pointer 波场。
- [ ] 已完成唱片可以从档案条目连续转为真实 Score 静态唱片锚点，并可靠反向。
- [ ] Processing/failed/direct-entry 等不适用路径诚实降级，不伪造变形。
- [ ] Score Audio/P9/永久输入严格隔离，返回后无残留或串片。
- [ ] Score 滚动阅读、分享、凭证、永久 Decoder 和 fallback 无回退。
- [ ] fine/coarse/reduced-motion/no-WebGL 四类能力路径通过。
- [ ] 20 次往返后 Canvas、FBO、listener、RAF、内存与音源数量趋稳。
- [ ] 完整验证、浏览器矩阵和真实主网唱片目验通过。
