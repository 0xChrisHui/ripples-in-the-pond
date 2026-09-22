# Track G — `/ ↔ /me` 永续水塘转场

> **状态**：计划已冻结，尚未施工
> **归属**：P11 全站 UI 大维修的后续扩展
> **目标**：路由变化时水面、花瓣与已有涟漪保持同一渲染会话，只让音乐圆圈与私人档案在水面上完成可逆换场。
> **原型**：`/me/test` 已验证「无音乐圆圈的池塘 + 花瓣 + 档案层」，但目前仍创建第二棵 PondGL，不是最终架构。

---

## 1. 三句话概念简报

1. 丝滑不等于把两张页面截图交叉淡化；真正连续的池塘必须在 `/` 与 `/me` 之间保持同一个 Canvas、同一组花瓣和同一份涟漪状态。
2. 路由只决定水面上方显示“音乐圆圈”还是“私人档案”，不能决定池塘是否挂载。
3. 动画是状态迁移而不是一次性延时：快速往返、浏览器后退、直接访问、无 WebGL 和 reduced-motion 都必须有确定终态。

---

## 2. 当前真值与问题

```text
当前 /
└─ app/page.tsx → app/test3/page.tsx → PondGL A

当前 /me/test
└─ app/me/test/page.tsx → PondGL B + MeArchivePage
```

- 两条路由分别创建 PondGL；客户端导航会销毁 A、创建 B。
- 即使参数和像素完全相同，WebGL context、FBO 水场、花瓣位置、涟漪能量与 RAF 仍会重置。
- `/me/test` 的 `glSpheres=false` 证明了同一渲染器可以只画池塘，但它不能证明跨路由连续。
- `PondGL` 当前以布尔值挂载/卸载 `SphereInstances`；直接切 `glSpheres` 会让圆圈瞬间消失，不能承担正式退场动画。
- 正式方案不得用第二棵透明 Canvas 叠在第一棵上，也不得用静态截图冒充持续水面。

---

## 3. 冻结决策

### G-D1｜共享 Layout 持有唯一池塘

- `/` 与 `/me` 进入同一个无 URL 前缀的 route group，并由共享 Layout 挂载 `PersistentPondShell`。
- Shell 把唯一生产 PondGL 拆成 `PersistentWaterCore` 与路由 Scene Adapter：Water Core 持有 WaterDistort、WaterPetals、GL health、scene ready 与 pointer 水场，首页 `glSim` 留在 `HomeSceneAdapter`。
- 页面只渲染前景 Surface；从 `/` 到 `/me` 时 Shell 不卸载、不换 key、不重建 Canvas。
- G 阶段 `/score/[id]` 仍在共享 Shell 外；Water Core/Scene API 不硬编码只有 home/archive 两态，为后续 P11-H 的单作品 Adapter 留稳定接缝。
- `/artist`、登录与其他页面不进入该 route group，避免全站承担首页 WebGL 成本。
- `/test3` 保持独立诊断沙盒；它不与生产 Shell 共享运行状态。

### G-D2｜水面永不参与转场

- 水体、月光、焦散、塘底、花瓣和已经产生的涟漪在转场期间继续逐帧运行。
- 不改变池塘整体 opacity、filter、相机、水位或调色来遮掩页面切换。
- 可以在档案文字背后使用可调的局部墨色 veil，但 veil 属于 `/me` Surface，不覆盖或拦截池塘 pointer 输入。

### G-D3｜圆圈用连续 presence 退场

- 新增 `scenePresence: 0…1` 或等价统一进度，驱动圆圈主体、标签、命中层、投影与静息环境的透明度/尺度/没入。
- `/ → /me` 开始时立即关闭圆圈命中与拖拽；视觉圆圈继续保留到 presence 到 0 后才允许卸载重资源。
- `/me → /` 先保证节点和纹理 ready，再从水下/低透明度恢复，禁止空白后突然整批出现。
- 快速反向导航必须从当前插值位置反向播放，不能先跳到端点。

### G-D4｜档案是前景 Surface，不是第二个页面背景

- `MeArchivePage` 继续负责认证、唱片、待铸造、收藏与播放行为。
- `/me` 不再创建 PondGL；`/me/test` 的池塘参数在 G4 合并到共享 Shell 后退役或转为纯调参入口。
- 档案进入使用轻微上浮、清晰度与 opacity；退出反向执行，不增加卡片墙、全屏黑幕或重毛玻璃。
- 数据请求只在 `/me` Surface 需要时发生；不能为了预备动画让首页常驻私人档案请求。

### G-D5｜路由、音频与 P9 边界

- URL 保持 `/` 与 `/me`，直接访问、刷新、复制链接、前进和后退全部成立。
- 使用 Next `<Link>` 客户端导航和预取；禁止以 `window.location` 全页刷新实现普通往返。
- 路由变化本身不停止全局播放器；正在播放的曲目继续，返回首页时对应圆圈恢复正确播放态。
- `/me` 禁用首页球命中、拖拽、分组与 P9 键盘演奏入口；水面 pointer 涟漪和花瓣继续可用。
- 不创建第二个 AudioContext、PlayerProvider、P9 registry 或水面事件总线。

### G-D6｜View Transition 只辅助 DOM

- 原生/React View Transition 可用于保存离场档案文字和导航的短时视觉快照。
- 它不能包住池塘 Canvas，也不能成为水面连续性的前提。
- 不支持 View Transition 的浏览器必须以普通 opacity/transform 路径完成同一功能。
- P11-G 不新增动画依赖；优先 CSS transition、现有 React/Next 能力和 Web Animations API。

### G-D7｜动效预算

| 能力 | 目标时长 | 空间运动 |
|---|---:|---|
| fine pointer 桌面 | 约 480–560ms | 圆圈轻微下沉/收束，档案上浮 8–16px |
| coarse pointer / 移动端 | 约 280–360ms | 主要使用 opacity，位移减半 |
| `prefers-reduced-motion` | ≤160ms | 只做短交叉淡化，不做下沉、缩放或错峰 |

- 任一模式都不能让导航超过 700ms 后才可操作。
- 转场结束后不保留 interval、临时 RAF、snapshot、离场 DOM 或 pointer lock。
- 时间值是首轮调参目标；最终以真实浏览器录屏和帧时间决定，不为追求固定数字牺牲响应。

---

## 4. 目标结构

```text
app/(pond)/layout.tsx
└─ PersistentPondShell
   ├─ PersistentWaterCore                  永不随 / ↔ /me 卸载
   │  ├─ PondGL 基调 + WaterDistort
   │  └─ WaterPetals / pointer / health
   ├─ HomeSceneAdapter                     首页 glSim / 圆圈 / scenePresence
   ├─ PondRouteTransition                  pathname → 可逆状态机
   └─ RouteSurface
      ├─ /        首页导航、圆圈命中、演奏 UI
      └─ /me      MeArchivePage + 局部 veil

app/test3/page.tsx                         独立诊断沙盒，保持现状
app/score/[id]                             独立作品水塘，不进入共享 Shell
```

### 转场状态机

```text
home ──进入档案──> leaving-home ──> archive
  ^                                     │
  └──── entering-home <────返回池塘─────┘
```

- 状态来源是目标 pathname + 当前 progress，不使用多个互相竞争的布尔值。
- 路由中断或反向时，从当前 progress 继续；最后一次导航意图获胜。
- 动画完成事件是正常收口，有限 timeout 只作浏览器异常兜底，不能作为唯一真值。

---

## 5. 施工顺序

## G0｜契约、基线与架构同步

### 范围

- 只读 `/`、`/me`、`/me/test`、`/test3` 的路由树、PondGL、glSim、P9、PlayerProvider 与 pointer 生命周期。
- 更新 `docs/ARCHITECTURE.md` 的“生产首页与私人档案共享一棵持久 PondGL”边界。
- 新增 `reviews/` 基线：路由前后 Canvas 数量、mount id、WebGL context、RAF/listener、音频和首帧录屏。

### 必须回答

1. 哪些首页状态必须进入 Shell，哪些仍属于首页 Surface？
2. `glSim` 在直接访问 `/me` 时是延迟准备还是后台预备？默认采用延迟准备；返回首页前完成 ready，水面期间不等待。
3. 首页当前有哪些 overlay 会拦截 `/me` pointer 或键盘？
4. 哪些 P15 性能/缓存工作可以复用，哪些不能提前夹带？

### Gate

- 基线能证明当前导航产生两个不同 Canvas 生命周期。
- 架构文档、playbook 与实际范围一致。
- 本步不修改产品视觉。

---

## G1｜建立 PersistentPondShell

### 实现

- 建立只覆盖 `/` 与 `/me` 的 route group 共享 Layout，URL 不变。
- 把生产 PondGL 的水体、scene-ready、health、pointer 和水面级 state 收敛为 `PersistentWaterCore`。
- 把首页节点、命中层与 `glSim` 收敛为 `HomeSceneAdapter`，不写入 Water Core。
- 首页和 `/me` 改为消费稳定 Scene API；`/me/test` 暂时保留作并排对照。
- 为 Shell 增加只读诊断：稳定 `mountId`、Canvas/花瓣计数与 scene mode；生产不显示调试面板。

### 禁止

- 不把 PondGL 放进根 `app/layout.tsx`。
- 不让 `/score` 复用首页 glSim 或 Player session；P11-H 只能复用 Water Core。
- 不复制 `PondGL.tsx`、WaterDistort shader 或花瓣模拟。

### Gate

- `/ → /me → /` 三次往返前后同一个 Canvas DOM 引用与 mountId。
- 任意时刻最多一棵生产 R3F Canvas + 一棵现有花瓣 Canvas。
- 直接访问 `/me`、刷新和无 WebGL fallback 正常。
- `bash scripts/verify.sh` 通过。

---

## G2｜路由转场控制器

### 实现

- 建立 `home / leaving-home / archive / entering-home` 单一状态机。
- 首页入口预取 `/me`；导航意图、pathname 落地和动画进度分开记录。
- 支持点击入口、返回池塘、浏览器前进/后退、连续双击和动画中反向。
- DOM Surface 使用渐入/渐出；支持时可叠加 View Transition，fallback 不依赖快照。
- 离场层在视觉结束后立即释放，不长期把两个完整页面放在 DOM 中。

### Gate

- 10 次快速往返无卡死、黑帧、双页面点击区或错误 URL。
- 动画中点击返回会平滑反向，不先闪到终态。
- 转场结束后焦点落到目标页合理入口，Tab 不进入离场层。
- `bash scripts/verify.sh` 通过。

---

## G3｜音乐圆圈真实进退场

### 实现

- 将 `scenePresence` 接入 SphereInstances、DOM 命中层、标签、阴影/接触影和首页静息装饰。
- 离场开始即关闭命中；视觉圆圈按同一进度轻微下沉、缩小并消散。
- 入场先准备真实节点，再分组或按深度轻错峰浮现；不得重新随机初始位置造成跳变。
- 当前播放圆圈保留播放身份，返回首页后与 PlayerProvider 一致。
- P9 瞬态在离开首页时有界收束；水面涟漪与花瓣不清零。

### Gate

- 逐帧证据至少包含 0 / 120 / 260 / 520ms，圆圈无整批 pop、无残影和无提前点击。
- 导航前制造的明显涟漪在 `/me` 出现后继续扩散。
- 返回首页节点位置连续，不重新散射；播放态正确。
- `prefers-reduced-motion` 不执行下沉/缩放。
- `bash scripts/verify.sh` 通过。

---

## G4｜档案 Surface 合并与原型收口

### 实现

- 正式 `/me` 使用共享池塘和现有 `MeArchivePage`。
- 档案标题、分区和行内容以轻微上浮 + opacity 出现；不增加全屏卡片或硬边框。
- 局部 veil 保留开关/透明度作为调参能力，最终默认值由真实账号目验冻结；正式页是否暴露控制条由目验决定。
- `/me/test` 不再挂第二棵 PondGL；完成并排验收后删除实验路由，或仅保留不进生产导航的 Surface 调参入口。
- 保留收藏整行播放、待铸造倒计时与“铸造唱片”主动作。

### Gate

- 0、1、20+ 数据与未登录、认证中、缓存刷新、局部失败全部可读。
- 375/768/1024/1440px 无文字与花瓣冲突到不可读、无横向滚动。
- veil 不拦截水面 pointer，档案按钮不会被 Canvas 抢事件。
- `bash scripts/verify.sh` 通过。

---

## G5｜降级、输入与生命周期

### 矩阵

- fine pointer：完整水面 pointer + 圆圈空间进退场。
- coarse pointer：保留点击水波，关闭高频鼠标跟随、hover 与额外视差。
- reduced-motion：短 opacity 切换，水面继续但降低花瓣/环境运动负载。
- no WebGL / context lost：静态夜塘保持，Surface 切换和所有档案操作可用。
- 页面后台再返回：不补播过期转场；直接收敛到当前 pathname 的稳定终态。
- 登录弹窗、BottomPlayer、safe-area、软键盘与滚动位置不得被固定 Canvas/Surface 破坏。

### 生命周期断言

- 不重复注册 pointer、resize、keyboard、P9 或播放器订阅。
- `/me` 不响应首页演奏键；输入框、range、弹窗操作不制造意外水波。
- 转场不新建 AudioContext，不停止或重启正在播放的全局音频。
- P11-H 执行前，`/score` 仍按原合同隔离并清理自己的水塘/音频会话。

### Gate

- 能力矩阵、断网、context lost、后台/前台和浏览器历史全部有证据。
- 20 次往返后 Canvas、RAF、listener、内存与音源数量趋稳。
- `bash scripts/verify.sh` 通过。

---

## G6｜最终浏览器 Gate 与交付

### 自动验证

```bash
bash scripts/verify.sh
```

- 静态断言生产 `/` 与 `/me` 只引用一个 PersistentPondShell。
- 自动浏览器保存导航前后的 Canvas 引用与 mountId，断言未替换。
- 检查首页、档案、Score bundle 边界，没有把私人档案数据或 Score 内核打进首页核心场景。

### 真实浏览器矩阵

| 场景 | 375 coarse | 768 coarse | 1024 fine | 1440 fine |
|---|---:|---:|---:|---:|
| `/ → /me` | ✓ | ✓ | ✓ | ✓ |
| `/me → /` | ✓ | ✓ | ✓ | ✓ |
| 浏览器后退/前进 | ✓ | — | ✓ | ✓ |
| 动画中反向 | ✓ | — | ✓ | ✓ |
| 正在播放时往返 | ✓ | ✓ | ✓ | ✓ |
| reduced-motion | ✓ | — | ✓ | ✓ |
| no WebGL/context lost | ✓ | — | — | ✓ |
| `/me` 直接访问/刷新 | ✓ | ✓ | ✓ | ✓ |

### 体验通过标准

- 水面没有黑帧、重载、花瓣重排或涟漪清零。
- 圆圈和档案像同一池塘的两种状态，而不是两个页面交叉淡化。
- 首次直接访问可以加载，但站内往返不能再次出现整池 loading。
- 动画期间和结束后都可操作；快速用户不被强制等待表演。
- 用户使用真实账号完成 `/ → /me → /` 最终体感目验。

### 收尾

- 删除只用于验证的双 PondGL 原型与临时诊断 UI；保留可复用的自动断言。
- 更新 STATUS、TASKS、JOURNAL、ARCHITECTURE 与最终 review 证据。
- P11-G 完成不自动改写 P14/P15 的业务结论，不自动推送或部署生产。

---

## 6. Track G 完成定义

- [ ] `/` 与 `/me` 共享唯一且不重挂的生产 PondGL/花瓣会话。
- [ ] Water Core 与 Home Scene 已分层，后续接入 Score 不需要搬迁或复制水面状态。
- [ ] 进入档案时音乐圆圈连续退场，返回时从已准备状态连续浮现。
- [ ] 水面、花瓣、pointer 涟漪与导航前已有波纹全程连续。
- [ ] 档案认证、收藏播放、待铸造倒计时与铸造动作无回退。
- [ ] 直接访问、刷新、浏览器历史、快速反向和后台恢复均收敛正确。
- [ ] fine/coarse/reduced-motion/no-WebGL 四类能力路径通过。
- [ ] 20 次往返后 Canvas、listener、RAF、内存与音源数量趋稳。
- [ ] 完整验证、浏览器矩阵和真实账号目验通过。
