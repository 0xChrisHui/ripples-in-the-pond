# Track J — Score 三向无缝换场与档案透景

> **状态**：最小安全收口完成（2026-09-24）；深度矩阵与视觉采样 deferred
> **归属**：P11-I 完成后的体验精修轨；G/H/I 的完成事实、永久播放合同与证据保持有效
> **工作目录**：`E:\Projects\nft-music-p11-i`，分支 `claude/p11-i-replay`
> **目标路径**：`/me → /score`、`/score → /me`、`/score → /`
> **视觉增量**：Score 的 `Permanent record · 永久档案` 改为可读的深色半透明水面阅读层
> **执行方式**：2026-09-24 用户把 J0–J7 全量收口改为“最小安全收口后启动 P16”，并授权本地提交与 push 当前 P11 分支；仍不合并 main、不部署、不清理

---

## 1. 三句话概念简报

1. 丝滑换场的关键是让来源前景保持真实可见，目标前景在隐藏层完成最小视觉准备，再用一次短动画交接；网络等待不进入动画回调。
2. 首页、档案和 Score 共享同一 Water Core，三条路径只切换前景 Surface 与 Scene 输入；普通路由循环中 Canvas 与花瓣 Canvas DOM 身份保持不变、WebGL context/FBO 创建数不增长，已有水波保持连续。
3. View Transition 只增强唱片锚点形变；双层 CSS 淡入淡出是所有设备、reduced-motion 与无 View Transition 环境都能工作的基础路径。

---

## 2. 用户已拍板的体验

- `/me → /score` 要达到 `/ → /me` 的连续感：Score 冷加载时档案与水面仍然可见，目标视觉就绪后才揭幕。
- `/score → /me` 使用同一套反向机制；有来源记录时恢复原唱片行、分页、滚动与焦点，没有来源时诚实淡入档案首屏。
- `/score → /` 也要连续；首页层与首页 Scene 已常驻，Score 退场时直接交回首页，不重建水塘。
- Score 下方 `Permanent record · 永久档案` 使用类似 `/me` 的深色半透明状态，让水面隐约延续到阅读区。
- 三条路径共享一套技术与状态机，不分别堆叠临时时序。

---

## 3. 当前真值与根因（2026-09-24）

| 项目 | 当前事实 | J 轨要解决的问题 |
|---|---|---|
| Water Core | P11-I 已证明三路由使用同一 Core/Canvas/花瓣 Canvas，context 与 FBO 创建数稳定 | 保持该不变量，转场不得重挂或截图替代水面 |
| `/ → /me` | 唯一档案实例提前挂载；目标 ready 后两层用 CSS 交接 | 把“先准备、后揭幕”推广到 Score |
| `/me → /score` | 点击时 `phase` 立即变为 `score`；Score Server Component 随后读取动态数据 | Score visualReady 前档案可能过早隐藏 |
| View Transition | update promise 最长等待 Score 锚点 30 秒，root snapshot 又被隐藏 | 网络等待期间可能出现停顿、黑场或只剩唱片锚点 |
| Score 数据 | 数字 Token 至少读取 active pointer 与 verified revision；本地响应存在抖动 | 预热只能缩短等待，不能承担正确性 |
| Score 返回 | 已能恢复来源行，但导航与锚点 provider 分别管理时序 | 统一 generation、反向与清理时机 |
| Score → 首页 | 首页 DOM/模拟状态仍在 Shell 中，但当前没有直接入口与完整的 Score→Home 交接合同 | J4 增加低权重“回到水塘”入口，并完成 Scene 准备与双前景换场 |
| 永久档案 | `.score-archive` 使用完全不透明 `var(--p11-surface-solid)` | 改为局部半透明阅读层，同时保证密集凭证可读 |

J0 先记录现状证据。后续不得用“动画看起来开始了”代替 `visualReady`、黑帧与资源断言。

---

## 4. 冻结决策

### J-D1｜只有一个路由事务协调器

- `PondTransitionProvider` 是路由换场的唯一时序 owner。
- 事务至少记录：`id/generation`、`current`、`target`、`href`、`stage`、`targetVisualReady` 与 `interactiveOwner`。
- `current/target` 只取 `home | archive | score`；`stage` 只取 `stable | preparing | revealing | settling`。
- `ScoreOriginProvider` 只保存 Token、来源行、分页、滚动、矩形和锚点 stage；J1 删除其 `run()`、30 秒 wait、active View Transition 与 popstate 调度，不再独立决定路由 phase。

### J-D2｜来源前景活到目标视觉就绪

- `preparing` 期间来源 Surface 保持 opacity 1，并继续承担交互；选中行只锁定自身，用户仍可 Back、Escape 或改点另一张唱片。
- 目标 Surface 在隐藏层挂载，必须 `aria-hidden`、`inert`、`pointer-events:none`；用 opacity/visibility 隐藏并保留可测布局，禁止 `display:none` 或条件卸载目标主体。
- `visualReady` 只要求真实页面身份、标题、静态唱片或真实状态主体和基本布局已有非零尺寸。
- `visualReady` 不等待 holder、音频下载/解码、P9、全部永久媒体、完整账本补齐或 WebGL healthy。

### J-D3｜动画回调不等待网络

- RSC、数据库、chunk 与目标 React 挂载全部发生在 `preparing`。
- `document.startViewTransition()` 只包住一次同步的 Surface/锚点 owner 切换。
- `/me → /score` 先在 View Transition 外执行 push/等待 hidden Score visualReady，再同步把 Surface 与 `score-record` owner 交给 Score。
- 程序化 `/score → /me|/` 的目标 Surface 已常驻：在 Score subtree 仍挂载时启动 View Transition，同步切换 Surface/锚点 owner并发起路由提交；callback 不等待 router、网络或清理完成。
- 浏览器 Back 无法阻止 URL 先变化：popstate 必须在最早时机捕获旧 Score 前景并交给常驻目标；无 View Transition 时立即显示 ready 的 Home/Archive，保证至少一个真实前景可见。禁止为动画缓存或重挂第二份 Score React 树。
- 浏览器没有 View Transition、调用抛错或用户使用 reduced-motion 时，CSS Surface 交叉淡入仍完成导航。
- 禁止把 `waitUntil()`、fetch、router 落地或 30 秒 deadline 放进 View Transition update promise。

### J-D4｜最后一次意图获胜

- 每次导航递增 generation；旧 ready、timer、RAF、fetch 完成信号必须核对 generation 后才能写状态。
- 双击、快速反向、Back/Forward、Escape 和换目标都以最后一次导航意图为准。
- 取消准备时恢复来源 Surface、busy、焦点和可交互状态，不遗留双前景或双 `view-transition-name`。

### J-D5｜共享唱片锚点只用于真实匹配

- `/me → /score` 只有 ready、稳定 Token 且来源行和目标 Token 精确匹配时使用唱片形变。
- 旧快照中只有来源行持有 `score-record`；新快照中只有 Score 唱片持有该名称。
- processing、failed、UUID、not-found 与 direct entry 是已落地的真实路由结果，使用普通 Surface 淡入，不伪造唱片形变。
- RSC/navigation error、超时仍无主体、取消或身份不匹配才恢复来源行并清除 busy。

### J-D6｜三条路径的固定语义

- `/me → /score`：档案准备期持续显示；Score ready 后档案淡出、Score 淡入、唱片锚点接管。
- `/score → /me`：先恢复来源行/默认档案，再反向交接；页面返回按钮与浏览器 Back 共用控制器。
- `/score → /`：首页 Surface 与真实 Home Scene ready 后交叉淡入；不制造档案唱片形变，并清除过期 ScoreOrigin。
- Score Header 保留“返回档案”主动作，并增加低权重、可键盘访问的“回到水塘”入口；375px 下两者与分享入口都可触达。
- 任何浏览器历史或程序化导航只要目标是 `/`，同样进入 Score→Home 事务，不维护第二套时序。

### J-D7｜Water Core 与 Scene 连续

- Water Core、Canvas、花瓣 Canvas、pointer 波场与已有水波不参与路由快照，也不因普通路由换场卸载；context/FBO 创建数不得因普通路由循环增长。显式 context-loss/restore 可创建 replacement，但旧资源必须释放、live set 回到基线，且恢复后只有一个有效 Core/context/FBO owner。
- `preparing` 期间稳定 Scene owner 不抢跑；单一 Water Core 每帧只消费一个 `glSim`。`revealing` 使用两段式 Scene 交接：旧 Scene presence `1→0` 并撤命中/日食，原子切换 descriptor/owner，再让新 Scene presence `0→1`。
- `/score → /` 恢复既有 Home `glSim` 节点位置，不重新随机散射。
- context lost、forced fallback、no-WebGL 与低性能路径使用同一事务终态。

### J-D8｜音频与重型清理退出关键帧

- 进入 Score 的导航本身不创建 AudioContext；全局播放器仍只在 Score 真正 playing 时由既有合同接管。
- 离开正在播放的 Score 时，在一个动画帧内 pause/mute 并停止新增排程。
- Score Audio/P9/media/source、pointer、timer、RAF 与 fetch 的销毁不得作为 reveal callback 内的同步重活；路由卸载可以在旧视觉快照退场时立即启动销毁，最迟 settle 后 1 秒回到基线。
- 不自动恢复此前的全局播放器；用户的下一次明确播放动作决定声音。

### J-D9｜预热有界且不决定正确性

- ready 唱片在进入视口、pointerenter、focus 或 touchstart 时精确预取目标 href。
- 对高意图事件做去抖，同一时刻只触发最近一个尚未发出的 Score 预取；Next Router 已写入的缓存没有通用驱逐 API，不伪造“取消已发预取”。不后台挂载全部 Score，不为每一行预载音频。
- 预取失败、缓存失效和离线恢复仍必须通过来源层持续可见的冷路径。
- J0/J2 若证明现有 route prefetch 已满足预算，不修改 Score 服务端数据合同或 snapshot 真值。

### J-D10｜永久档案是半透明阅读层

- `.score-archive` 使用深色半透明渐变，桌面参考约 72%→84%，coarse/移动参考增加约 8 个百分点；最终值以四视口可读性 Gate 为准。
- section 自身保持 `opacity:1`；文字、链接、焦点环和复制值不随背景一起变淡。
- Provenance Ledger 可使用更深的局部半透明表面；外层禁止全区域 `backdrop-filter`、`filter` 或 `mix-blend-mode`。
- 阅读区只柔和降低 Score 单作品视觉存在感；水面、花瓣、微光继续运行，滚动位置不控制播放。
- forced-colors 下回到系统实色 Canvas，动态背景不是凭证可读性的前置条件。

---

## 5. 目标结构与时序

```text
PersistentPondShell
├─ PondTransitionProvider          唯一路由事务
├─ ScoreOriginProvider             只保存锚点来源元数据
├─ PondSceneSlotProvider           Scene descriptor 接缝
└─ PondExperience
   ├─ PersistentWaterCore          永不参与换场
   ├─ HomeSurface                  首次访问后常驻
   ├─ PreparedArchiveSurface       首次首页/档案访问后常驻
   └─ RouteSurface                 当前 Score / fallback / lifecycle
```

```text
stable(source)
  → preparing(target hidden, source live)
  → target visualReady
  → revealing(source out, target in, optional record morph)
  → settling(focus + delayed cleanup)
  → stable(target)
```

### 每帧不变量

1. 至少一个前景 Surface 有非零矩形且 computed opacity > 0.2；不得出现黑/白空帧。
2. 任一时刻最多一个 `interactiveOwner`；隐藏目标始终 inert。
3. `revealing` 的开始时间不得早于对应 generation 的 `visualReady`。
4. 稳定态 `sceneOwner` 与目标页面一致；preparing 不提前抢 Scene。
5. 任一 View Transition 快照中 `score-record` 最多一个；前后快照各自指向正确元素。

---

## 6. 施工顺序

### 每步验证规则

- 每步开始前执行 `git fetch origin`、`git merge-base --is-ancestor origin/main HEAD` 与 `git rev-list --count HEAD..origin/main`；最后一项必须为 0。origin/main 前进时停止后续施工，不自行合并。
- 只修改 `E:\Projects\nft-music-p11-i`；不改其他 worktree，不删除现有 `.edge-*-profile`、分支、目录或证据。
- 浏览器 Gate 与 dev server 运行期间不启动 production build。
- 每次运行 `bash scripts/verify.sh` 前先停止本工作树的 dev server，避免共用 `.next` 造成假 404；验证后需要浏览器测试时再重启。
- 每步证据都标明真实数据或 `fixture=true`，不得把 fixture 冒充真实账号、真实 processing/failed 或生产视觉证据。

## J0｜基线、诊断合同与证据脚本

### 📦 范围

- `scripts/p11/score-route-handoff.mjs`（新建入口，≤220 行）
- `scripts/p11/score-route-handoff/**`（采样、fixture、断言 helper；每文件≤220 行）
- `reviews/evidence/p11-i/lib/edge-cdp.mjs`（复用，只有通用 CDP 能力确有缺口时才改）
- `reviews/2026-09-24-p11-j-baseline.md`
- `reviews/evidence/p11-j/baseline/**`
- `STATUS.md`、`TASKS.md`（只记录 J0 结果与下一步）

### 实现

- 只读记录三条路径的 pathname、真实前景 marker、Surface opacity/visibility/inert、Canvas/mountId、context/FBO 创建计数、Scene owner、锚点数量、RAF/listener/fetch/audio 与时序。
- 建立两套时钟：相对 `intentAt` 的 0/150/450/1500ms 与 cold 1900/2150/2600ms 用于证明等待期；相对 `visualReadyAt` 的 0/150/450/1500ms 用于证明揭幕。JSON 保存 `intentAt/visualReadyAt/revealStartAt/settledAt` 及全部差值。
- 页面内 RAF telemetry 在事务全程逐帧记录 `.me-archive`、Home 主体与 `main[data-score-state]` 的矩形、opacity、inert、interactiveOwner、sceneOwner；空 `.pond-route-surface` 不能充当前景。另用 CDP screencast/视频帧检测黑白闪。
- cold Gate 在打开来源页前启用 RSC 拦截并清理/禁用 cache；只 hold 带 RSC 标记的目标导航请求，取消自动预取或放行后再次清 cache，由脚本事件显式释放请求，不用固定 sleep 冒充冷路径。
- fresh profile 没有登录态时允许复用 I8 的只读 `/api/me/*` fixture 与本地假会话，只让档案行指向真实公开 `/score/1`；真实 Score target 不伪造，JSON 标记 `fixture=true`。真实账号/真实行恢复保留人工目验。
- processing/failed 若没有稳定公开 ID，J0 记录为人工/既有证据缺口；后续自动 Gate 只能使用明确标记的只读状态 fixture，不冒充生产真值。
- 记录支持与禁用 View Transition 两条路径。

### Gate

- 不修改产品代码和视觉。
- 基线诚实捕获当前来源层何时消失、目标何时 ready、是否存在空帧。
- 原 I8 continuity 继续通过；先停止本树 dev server，再运行 `bash scripts/verify.sh`，需要浏览器复核时重新启动。
- 同源非 GET/HEAD/OPTIONS 请求为 0；生产数据库保持只读。
- `reviews/evidence/p11-j/` 总量控制在约 50MB 内；循环只保存 JSON 与异常帧，代表性截图按矩阵抽样。

### 建议提交

`test(p11): 记录 Score 三向换场基线`

---

## J1｜统一路由事务状态机与 visualReady 握手

### 📦 范围

- `src/components/pond-shell/pond-transition.tsx`
- `src/components/pond-shell/transition/**`（新子目录；根目录已经 8 个文件，不再增加根文件）
- `src/components/pond-shell/score/score-origin.tsx`
- `src/components/pond-shell/PersistentPondShell.tsx`
- `src/components/pond-shell/PondRouteLink.tsx`
- `src/components/pond-shell/pond-shell.css`
- `src/features/home-pond/PondExperience.tsx`
- `src/features/home-pond/PersistentRouteSurfaces.tsx`（新建，承接常驻前景层；为 220 行硬线腾出空间）
- J0 脚本、transaction trace 与 J1 证据

### 实现

- 建立 J-D1 的 route transaction、generation、cancel、visualReady、reveal、settle 与诊断属性。
- 把 `score-origin.tsx` 的路由等待、View Transition、timer/RAF 与 popstate 调度迁出；该 provider 只保留来源元数据与锚点 stage。若文件仍接近硬线，只能在既有 `pond-shell/score/**` 下拆分，不在 `pond-shell` 根新增文件。
- stable 终态保持现有像素与行为；J1 只搭协调器，不提前改变三条路径的产品动画。
- 目标 ready 必须由目标 Surface 主动报告；timeout 只能进入失败/恢复路径，不能冒充 ready。
- `pond-transition.tsx` 接近 220 行前先拆纯类型/状态归约，不把新逻辑继续堆进单文件。
- `PondExperience.tsx` 当前恰好 220 行；先把 Home/Archive/Route 三个前景容器抽到 `PersistentRouteSurfaces.tsx`，保持 DOM、层级和像素不变，再接入新事务。

### Gate

- J0 脚本输出确定性的 transaction trace，覆盖三方向、快速反向、换目标、Back/Forward、取消与旧 generation 晚到；逐项断言状态序列。
- 诊断中稳定态只有一个 current、一个 interactive owner；pathname 与 stable target 一致。
- 现有 `/ ↔ /me`、Score 播放、锚点返回和 I8 自动 Gate 无回归。
- `bash scripts/verify.sh` 通过。

### 建议提交

`refactor(ui): 统一池塘路由换场事务`

---

## J2｜`/me → /score` 先准备后揭幕

### 📦 范围

- `src/components/pond-shell/score/score-origin.tsx`
- `src/components/me/archive/ScoreArchiveRow.tsx`
- `src/components/me/archive/ArchiveSection.tsx`（仅实际需要的 busy/分页合同）
- `app/(pond)/score/[id]/components/ScorePondScene.tsx`
- `app/(pond)/score/[id]/components/ScoreLifecycle.tsx`
- `app/(pond)/score/[id]/FallbackShell.tsx`
- `src/features/home-pond/PondExperience.tsx`
- `src/features/home-pond/PersistentRouteSurfaces.tsx`
- `src/components/pond-shell/pond-shell.css`
- J0 脚本与 J2 证据

### 实现

- 点击 ready Token 后进入 `preparing(score)`，档案保持可见；只把来源行标为 busy。
- 精确预取最近一个高意图目标；普通链接、新标签、复制地址和修饰键语义保持不变。
- ready Score、processing、failed 与 fallback 分别报告真实 visualReady。
- visualReady 后一次同步切换锚点 owner 和 Surface，播放 520/320/≤140ms 能力预算内动画。
- processing/failed/not-found 若已落地真实主体，按普通 Surface 揭幕；RSC/navigation error、超时仍无主体、取消或身份不匹配才恢复原行。

### Gate

- 人为冷延迟 2 秒期间：档案 opacity=1、可反向/换目标，水面继续，Score 隐藏且 inert。
- ready 后无黑帧、白闪、布局跳动、错误作品或双唱片；`visualReadyAt → revealStartAt` 不超过 2 个 animation frame（建议 ≤50ms）。点击到 visualReady 只记录 J0 p50/p95，不设迫使提前揭幕的预算。
- fine 320–520ms、coarse 220–360ms、reduced ≤180ms 收敛。
- 全局播放器在 preparing/revealing 不因导航停止；导航不创建 AudioContext。
- 双击、Escape、Back、换 Token、RSC/navigation error、超时无主体与 View Transition 禁用全部收敛。
- `bash scripts/verify.sh` 通过。

### 建议提交

`feat(ui): 让档案先准备再揭幕作品`

---

## J3｜`/score → /me` 对称返回

### 📦 范围

- `src/components/pond-shell/score/score-origin.tsx`
- `src/components/p11/ScorePondHeader.tsx`
- `src/components/me/archive/MeArchivePage.tsx`
- `src/components/pond-shell/use-prepared-archive.ts`
- `src/features/home-pond/PersistentRouteSurfaces.tsx`
- `src/components/pond-shell/pond-transition.tsx` / `transition/**`
- `src/components/pond-shell/pond-shell.css`
- `src/features/score-playback/use-score-playback.ts`
- `src/features/score-playback/engine.ts`
- `src/features/score-playback/timeline-session.ts`
- `src/features/score-playback/score-p9-session.ts`
- `src/features/score-playback/streaming/stream-base.ts`
- 上述 playback 文件只改证据实际命中的清理路径；该目录根已有 8 文件，禁止新增根文件
- J0 脚本与 J3 证据

### 实现

- Score 保持显示，先恢复来源分区、分页、scroll 与目标行布局，再开始反向 reveal。
- 程序化返回在 Score subtree 尚挂载时启动 View Transition：旧快照由 Score 唱片持名，update 同步把 Surface/锚点 owner 交给已恢复的档案并发起路由提交；不在 callback 内等待导航。
- 浏览器 Back 在 popstate 最早时机捕获旧前景；若原生 View Transition 无法接管，就立即显示已 ready 档案，CSS 完成剩余淡入，不能缓存第二份 Score 树。
- 没有有效来源、账号已变化或行已不存在时，使用档案默认入口和普通 Surface 淡入。
- 返回按钮和浏览器 Back 共用 generation/ready/settle；不维护第二套事件顺序。
- 播放中的 Score 在离开意图后一个动画帧内静音；销毁可随路由卸载在旧视觉快照退场期间启动，不放进同步 update callback，最迟 settle 后 1 秒完成。

### Gate

- 有来源时焦点回原行，页面位置稳定；无来源时焦点落档案入口。
- 前后快照各只有一个 `score-record`；快速反向重新进 Score 没有双音源或双锚点。
- settle 后 1 秒内 Score-owned AudioContext/source/media/fetch 与可观测 P9/timer/RAF 回到基线。
- Back/Forward、Escape、直接访问、账号变化、档案失败与 View Transition 禁用通过。
- `bash scripts/verify.sh` 通过。

### 建议提交

`feat(ui): 对称恢复作品来源档案`

---

## J4｜`/score → /` 常驻首页交接

### 📦 范围

- `src/components/p11/ScorePondHeader.tsx`
- `src/components/pond-shell/pond-transition.tsx` / `transition/**`
- `src/features/home-pond/PondExperience.tsx`
- `src/features/home-pond/PersistentRouteSurfaces.tsx`
- `src/components/pond-shell/scene-slot.tsx`
- `src/components/pond-shell/motion/use-scene-presence.ts`
- `app/(pond)/score/[id]/components/ScorePondScene.tsx`
- `src/components/pond-shell/pond-shell.css`
- J0 脚本与 J4 证据

### 实现

- 保留 Score Header 的“返回档案”主动作，新增低权重“回到水塘”入口，并把该入口、浏览器历史与程序化 `/` 导航接入统一事务。
- 导航时 Score 前景继续显示，Home Surface 与 Home Scene 在隐藏层恢复 ready 后才 reveal。
- 单一 SceneSlot 使用两段式交接：Score presence `1→0` 并撤命中/日食，原子切换到 Home descriptor/glSim，再让 Home presence `0→1`；共享水面和花瓣不做 opacity 截图。
- 清除过期 ScoreOrigin；直接访问 Score 也可以普通淡入首页。
- 离开 Score 的音频策略与 J3 相同，不自动恢复全局播放器。

### Gate

- idle、playing、paused；direct entry 与从 `/me` 进入的 Score 均可连续回首页。
- 首页节点位置不重新随机，旧水波继续扩散；普通循环中 Core/Canvas/花瓣 Canvas DOM 身份不变，context/FBO 创建数不增长。
- 切换帧只允许一个 glSim 进入 PondGL、一个 Scene 取得 pointer/keyboard 权限。
- `/me → score → /` 后 Back/Forward 的 URL、前景与 Scene 一致。
- 快速 `score → me → /`、`score → / → me` 最后意图获胜，无 Scene 抢跑。
- 375px 下返回档案、回到水塘与分享入口均可触达，不造成横向滚动。
- `bash scripts/verify.sh` 通过。

### 建议提交

`feat(ui): 连续交接作品与首页水塘`

---

## J5｜永久档案半透明阅读层

### 📦 范围

- `app/(pond)/score/[id]/score-pond-page.css`
- `app/(pond)/score/[id]/score-archive.css`（新建；从 211 行主样式中迁出永久档案规则）
- `app/(pond)/score/[id]/layout.tsx`（引入拆出的样式）
- `app/(pond)/score/[id]/components/ScoreArchive.tsx`（仅在需要语义/诊断属性时）
- `app/(pond)/score/[id]/components/ScorePondScene.tsx`
- `app/(pond)/score/[id]/components/use-score-pond-sim.ts`（仅在阅读区 presence 需要时）
- `src/styles/p11-primitives.css`（仅共享 ledger token 确需调整时）
- `playbook/phase-11/00-overview.md`
- `reviews/evidence/p11-j/j5/**`

### 实现

- 将 `.score-archive` 的实色背景换为 J-D10 的深色半透明渐变；Hero 到档案之间用连续渐变连接。
- `score-pond-page.css` 当前 211 行；先把现有 archive 相关规则原样迁到 `score-archive.css` 并证明像素不变，再做半透明调整。
- Ledger 使用比外层更深的局部表面，正文、code、链接与焦点环保持 opacity 1。
- 不给整个 section 加 `backdrop-filter`；不以模糊掩盖对比度问题。
- 档案滚入视口时只降低 Score 单作品存在感，不暂停水面、不重排花瓣、不用滚动控制播放。

### Gate

- 375/768/1024/1440 在档案顶部、中段、底部截图；移动端背景可比桌面提高约 8 个百分点。
- 自动对比度方法：在四视口×档案 top/mid/bottom×多个动画帧，临时隐藏文字取得相同 bbox 的实际合成背景像素，以 computed foreground RGBA 按 WCAG 相对亮度公式计算并输出 sample JSON；焦点环单独采样 ring 与相邻背景。
- 动态背景最差采样下：正文/code/链接对比度 ≥4.5:1，大标题与焦点环 ≥3:1。
- 只在 healthy WebGL 且非 reduced-motion 路径，用同一非文字区域相隔约 300ms 的两帧证明水面像素仍变化；reduced/no-WebGL 只验静态背景可读和功能完整。
- section computed opacity=1、无全屏 blur、hash 可读可复制、滚轮与 pointer 正常、无横向滚动。
- forced-colors、reduced-motion、no-WebGL 下凭证仍完整可读。
- `bash scripts/verify.sh` 通过。

### 建议提交

`style(ui): 让永久档案透出持续水面`

---

## J6｜中断、降级与生命周期硬化

### 📦 范围

- `src/components/pond-shell/pond-transition.tsx` / `transition/**`
- `src/components/pond-shell/score/score-origin.tsx`
- `app/(pond)/score/[id]/components/ScoreLifecycle.tsx`
- `app/(pond)/score/[id]/FallbackShell.tsx`
- `src/features/score-playback/use-score-playback.ts`
- `src/features/score-playback/engine.ts`
- `src/features/score-playback/timeline-session.ts`
- `src/features/score-playback/score-p9-session.ts`
- `src/features/score-playback/streaming/stream-base.ts`
- 上述 playback 文件只改证据实际命中的清理路径；不在已有 8 文件的根目录新增文件
- J0 脚本与 J6 证据

### 矩阵

- 双击、Escape、快速反向、换 Token、Back/Forward、来源消失、账号变化。
- 目标 2 秒延迟、offline → online、后台 → 前台、导航失败、not-found。
- View Transition 缺失/抛错、forceFallback、真实 context loss、`--disable-webgl`。
- Score idle/loading/playing/paused/ended/error 离页。

### Gate

- RAF telemetry 的逐帧断言为 `blankFrame=false`、`singleInteractive=true`、`oldVisibleUntilReady=true`、`revealStartsAfterReady=true`；CDP 视频帧另验黑/白闪。
- context loss 发生在 preparing/revealing 中仍收敛；允许一次 replacement context/FBO，旧 live set 必须释放并回到单 owner 基线。no-WebGL 三方向都完成且静态 cover 可见。
- settle 后 **Score 事务拥有的** active fetch/media request/AudioContext/source/media=0；Next RSC、router prefetch、`/me` 数据读取/轮询不计为 Score 泄漏。
- J0/J1 的只读 monkeypatch/诊断明确记录 context/FBO create-delete live set、timeout/interval、RAF/listener；P9 只在应用已有可观测 active voice 时自动断言，否则列为真实播放证据项。
- 失败路径清除 busy、destination、旧 generation 和 `score-record`，不会卡死 inert。
- 同源写请求为 0；不触发保存、铸造、注册、删除、cron 或管理接口。
- `bash scripts/verify.sh` 通过。

### 建议提交

`fix(ui): 硬化作品换场中断与降级`

---

## J7｜三向总验收、文档与交付准备

### 📦 范围

- `scripts/p11/score-route-handoff.mjs`
- `scripts/p11/score-route-handoff/**`
- 必要时扩展 `scripts/p11/pond-continuity.mjs`；避免复制 CDP 基础设施
- `reviews/evidence/p11-j/**`
- `reviews/2026-09-24-p11-j-completion-review.md`
- `STATUS.md`、`TASKS.md`、`docs/JOURNAL.md`、`docs/LEARNING.md`
- `docs/ERRORS.md`（仅真实发生并解决错误时）
- `playbook/phase-11/00-overview.md`

### 自动验证

```bash
bash scripts/verify.sh
```

- 20 次 `/ → /me → /score → /me → /`。
- 20 次 `/score → /`，覆盖 direct entry 与从档案进入两种来源。
- 三方向各含 warm、受控释放的 2 秒 cold、无 View Transition、快速反向与 Back/Forward。
- fine/coarse/reduced-motion/forceFallback/no-WebGL；另做真实 context loss 与后台恢复。
- 记录 Core/Canvas/花瓣 Canvas DOM identity、context/FBO 创建与 live 计数、Scene owner、DOM、heap、listener、RAF、Score-owned fetch/media request、AudioContext、source 与 media 趋势。
- fresh profile 优先使用已有只读登录态；否则使用 J0 同类只读档案 fixture 并标记 `fixture=true`。真实账号、真实行恢复、真实 processing/failed 继续列人工待办。

### 资源阈值

- 延续 I8 的趋势口径：heap 增量 <25MB、DOM nodes 增量 <500、listeners 增量 <80、RAF ≤ baseline+3。
- 最终 Score-owned active fetch/media request/AudioContext/source/media 均为 0；不把合法 Next/档案请求误判为泄漏。
- 稳定态只有一个 Scene owner 与一个 interactive owner。
- 首页与 `/me` 构建产物继续不吸收 Score 私有 playback/ledger/session 模块。

### 证据

- JSON：完整状态、资源与时序断言。
- 截图与 telemetry：分别按 `intentAt` 和 `visualReadyAt` 取样；cold 的 intent 时钟另含 1900/2150/2600ms，并保存四个绝对时间戳与差值。
- 视觉：四视口档案透景、正文/代码/焦点对比度、fallback。
- 音频：优先在真实媒体可用时补 Score playing 离页；若外部媒体不稳定，明确复用 I6 real-playing 证据并单列本轮限制，不能只凭创建 AudioContext 宣称播放 Gate 通过。

### 文档与交付

- STATUS/TASKS 记录每步提交、Gate 与未完成人工目验。
- JOURNAL 记录统一路由事务、延迟清理与半透明阅读层的非显然决定。
- `docs/ARCHITECTURE.md` 仍属于 P11-I D-5 的单独授权项，本轨不暗改。
- push、合并 main、部署、修改 Vercel 环境变量与清理 Edge profile/worktree 都需用户分别授权。
- `reviews/evidence/p11-j/` 总量约≤50MB；循环保留 JSON/异常帧，代表性截图抽样。

### 建议提交

`test(p11): 完成 Score 三向无缝换场验收`

---

## 7. 2026-09-24 最小安全收口结果

### 已通过

- 三方向 warm/cold，以及支持/禁用 View Transition 的冒烟；受控 2 秒冷加载期间来源档案、水面与 Canvas 持续可见。
- Back、cold preparing 阶段 Escape 快速反向、准备期换目标、真实 `/score/99999999` failed 生命周期返回均收敛到最后一次意图。
- 离开 Score 后 AudioContext `1→0`，source/media/Score-owned fetch 回到 0，双播放器帧为 0；真实 playing 离页沿用 P11-I I6 证据。
- 普通路径 Water Core、Canvas 与 WebGL context 身份稳定，FBO 无循环增长；direct Score→Home 的 `6→8` 是首页球层首次恢复时的一次性懒分配。
- TypeScript、定向 ESLint、生产构建、现有 `scripts/verify.sh` 和 Forge 56/56 通过；Google Fonts 临时验证绕行已恢复。
- 永久档案半透明实现、forced-colors 回退和样式静态 Gate 完成。

### Deferred

- 20 次以上压力循环与全能力组合矩阵。
- offline、context loss、no-WebGL 的重复组合。
- J5 四视口动态对比度采样与证据美化。
- 深度代码 review；必须在 P16 开始共享前端文件施工前完成。

详细交接见 `reviews/2026-09-24-p11-j-minimum-handoff.md`。

---

## 8. 额外停止条件

- origin/main 在施工中前进：停止后续步骤，先说明差异；未经用户授权不合并。
- 为达到视觉效果需要第二棵 Water Core、第二个播放内核、新依赖或全屏截图遮罩：停止并报告。
- 同一问题尝试 3 次仍有黑帧、双锚点、Scene 抢跑或生命周期泄漏：停在该步，不提交失败步骤。
- 需要改变永久 snapshot、events/base/sounds、播放语义、链上身份或生产数据：越界停止。
- 单文件接近 220 行先按本 Playbook 的 `transition/**` 边界拆分，不把复杂度继续塞入 provider。
- 浏览器 Gate 发现写请求、密钥输出或生产管理接口访问：立即停止。

---

## 9. 非目标与工作线边界

- 不扩展到 `/echo`、`/artist`、管理页或新的路由分组。
- 不重新设计 Score Hero、日食、P9、分享、播放器和永久凭证字段。
- 不修改 P15 永久媒体 resolver、verified snapshot、音频启动闭包或流式播放合同。
- 不预渲染全部 Score，不增加客户端全局数据缓存，不新增依赖。
- 不把本地开发态 Google Fonts 失败当作核心 Gate；提交前恢复任何临时字体绕过。
- 本地数据库为生产库，浏览器与脚本只读。

---

## 10. Track J 全量完成定义（最小收口未勾选项均属 deferred）

- [ ] 三条路径都遵守 `stable → preparing → revealing → settling → stable`，最后一次意图获胜。
- [ ] Score 冷加载期间来源前景和水面持续可见；reveal 严格晚于 visualReady。
- [ ] `/me → /score` ready Token 正向形变，processing/failed/direct entry 诚实淡入。
- [ ] `/score → /me` 恢复来源行/分页/滚动/焦点；无来源时恢复档案默认入口。
- [ ] `/score → /` 有低权重“回到水塘”入口，首页 Surface/Scene 连续接管且节点不重新随机。
- [ ] 三方向均无黑帧、白闪、双唱片、双 Scene、布局跳动或交互卡死。
- [ ] 普通三向循环中 Water Core/Canvas/花瓣 Canvas DOM 身份不变、context/FBO 创建数不增长、已有水波连续；显式恢复场景的 replacement live set 回到单 owner 基线。
- [ ] Score 离页在一帧内静音，settle 后 Score-owned Audio/fetch/media 与可观测 P9/timer/RAF/listener 回到基线。
- [ ] 永久档案为深色半透明阅读层，动态水面可见且四视口凭证可读。
- [ ] fine/coarse/reduced-motion/no-View-Transition/fallback/no-WebGL/context-loss 路径通过。
- [ ] 三方向循环、完整 `scripts/verify.sh`、资源趋势与只读 Gate 全绿。
- [ ] 用户完成最终体感/视觉目验后，再分别决定 commit、push、合并、部署与清理。
