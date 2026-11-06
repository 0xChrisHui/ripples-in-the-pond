# Phase 21 — `/lens` 详情页（提灯照水）

> 制定日期：2026-10-28；同日按 Codex 审查修订（`reviews/2026-10-28-p20-p21-playbook-codex-review.md`）。状态：**已完成**（代码 2026-10-31 完成，用户目验通过；2026-11-06 合入 `main`，见 §10）。\
> **开工前提**：P20 已合入 `main`（两者都改 `PondExperience.tsx`、`PondGL.tsx`，不并行）。Step 0 把开工基线固定为具体 SHA。\
> 分支：从该 SHA 新开 `feat/p21-lens`，不用 worktree。\
> 本计划**不改合约、不改数据库、不改链上 / Arweave 永久内容、不新增依赖**；`/test1` 不得改动；旧 `/tracks` **页面功能与其内部测试保留**，只更新涉及全站入口的集成测试。\
> 开发直接在 `/lens` 上进行：顶栏入口到 Step 6 才切换，此前 `/lens` 只能手输进入，等于天然隐藏；这样从第一步起就在真实持久外壳里验证，不依赖 `/test4`（它没有持久外壳、P9 关闭）。

---

## 1. 已定的决策

| 决策 | 结论 | 理由 |
|---|---|---|
| 形态 | 首页加一个功能层：半透明黑色遮罩 + 跟随鼠标的圆形光圈，光圈里显示原本的颜色 | 用户构想；35 个球就是 35 首曲子 |
| 路径 | 新路径 `/lens`，作为**首页的别名**：共用首页场景、35 球、日食，不搬组件 | 比改造 `/tracks` 风险小得多 |
| 别名的含义 | **同一场景内切换**：`/ ↔ /lens` 不卸载、不重建场景、不出加载遮罩、不冻结旧表层；只切换功能层 | Codex 指出现有过渡只对"完全同路径"跳过事务（§3 F3），必须专门定义 |
| 入口 | 顶栏"曲目"改为 **"详情 / Details"**，指向 `/lens`；顶栏在 `/lens` 上保持存在，可直接去 `/me` 等页面 | 用户定 |
| 品牌标志 | 顶栏品牌仍回 `/`，不改成 `/lens` | 保留"回首页"语义 |
| 旧 `/tracks` | 站内**无入口**，只能手输；页面原样保留 | 用户定 |
| 单曲页 | `/score/material/{chain}/{contract}/{tokenId}` 不动 | 分享与核验用 |
| 信息显示 | 光圈落在某个原曲球上时显示链上信息面板 + 收藏键；光圈不在球上时什么都不显示 | 用户定 |
| 面板内容 | **OP 与 ETH 两条链都给**，并多放链上信息，显得专业；靠布局、字号、排版做到顺眼（字段见 D5） | 用户定 |
| 锁定 | **只有点击播放才锁定**：光圈锁在正在播放的球上并跟着它漂，鼠标自由；播放结束、停止或失败后恢复跟随。没有停留吸附 | 用户定 |
| 进入时已在播放 | 从首页带着播放进入 `/lens`，光圈直接锁在正在播放的球上 | 与"播放即锁定"一致 |
| #36 | **可以播放**（走它自己的 Echo 播放器）；不出链上面板（它不是原曲）；播放时光圈同样锁定（见 D8） | 用户定 |
| 退出 | Esc / 点空白水面 / 再点顶栏"详情"。播放锁定中先**停止播放**并解锁回到跟随；跟随中再触发才回到 `/` | 用户定（两级） |
| 事件优先级 | Esc 依次交给：登录弹窗 / 手机菜单 → 路由过渡取消 → `/lens` 两级退出；前者消费了就不再往下传 | 避免误退出（§3 F12） |
| 跳去别的页面 | 从顶栏去 `/me` 等页面时，停止播放（原曲与 #36 都停）、卸载功能层 | 用户定 |
| 未登录 | 收藏键换成登录入口 | 用户定 |
| 手记 | `/lens` 不显示创作手记；P20 的气泡照常（在遮罩下） | 用户定；D6 |
| 信息密度 | 紧凑、字号小；**点击区不缩**，按钮与链接 ≥44px | 手机可用性 |
| 原首页交互 | `/lens` 上关闭拖球与悬停播放小图标；滚轮浮沉、水面涟漪保持首页现状 | 用户定 |
| 手机 | 第一次点球 = 选中并显示信息；点播放键或再点同一球 = 播放并锁定；点空白退出 | 无悬停设备 |
| 键盘 | Tab 聚焦球 = 光圈照到它；Enter / Space 播放；Esc 两级退出 | 无障碍 |
| 深链 | `/lens?track=N` 进入或站内跳到它时，光圈落在第 N 球，**只选中不自动播放**；地址用 `replaceState`；客户端水合后读取，并在 query 变化时重新读取 | 浏览器自动播放限制；持久外壳不会因 query 变化重挂（§3 F3） |
| 加载 | 光圈、面板、编号映射、完整目录与收藏组件都在 `/lens` 的异步边界内，首页不下载 | 守住 P15-J（§3 F14） |

---

## 2. 用户可验收的结果

1. 访问 `/` 时，首页除顶栏"曲目"改为"详情"（预期差异）外，与开工基线**像素级一致**；首屏资源与基线相同。
2. 点顶栏"详情"进入 `/lens`：场景不重建、不闪；画面变暗，鼠标周围出现柔边光圈，跟随带轻微惯性。
3. 光圈落在原曲球上时，球旁出现紧凑面板：曲号、OP 与 ETH 两条链的链上信息、各自的单曲页与区块浏览器链接、收藏键（未登录为登录入口）；面板随球的位置翻面，不越出画面、不压顶栏，排版顺眼。
4. 点击球开始播放后，光圈锁在它身上并随之漂动，鼠标可自由移动；播放结束、停止或失败后光圈回到鼠标。
5. #36 可以点击播放，播放时光圈锁在它身上，不出链上面板。
6. Esc、点空白、再点"详情"都能退出；播放中先停止再退出；登录弹窗或手机菜单开着时按 Esc 只关它们。
7. 从 `/lens` 去 `/me`，音乐停止、功能层消失；从 `/me` 再点"详情"能回来；浏览器后退、前进都正常。
8. 手机上选中、播放、退出的路径完整可用；面板按钮可点、不溢出。
9. `/lens?track=12` 打开后光圈落在 12 号球上，不自动播放；站内跳到另一个 `?track=` 也会更新。
10. 手输 `/tracks` 仍能打开旧页面并正常使用；站内再没有链接通往 `/tracks`。
11. CN/EN 切换后 `/lens` 上的文字全部跟随；英文模式无中文残留。
12. 合约、数据库、链上与 Arweave 内容未被改动。

---

## 3. 已核对的事实（2026-10-28；"审查核实"= Codex 已对照代码核实、Claude 抽查属实）

| # | 事实 | 位置 | 约束 |
|---|---|---|---|
| F1 | `routeForPath('/lens')` 现在落到 `'archive'` | `pond-shell/transition/types.ts:28–35` | 须新增映射到 `home` |
| F2 | 写死"首页 = `/`"的判断：`PondHeader.tsx:39`、`use-prepared-archive.ts:9,11`、`PersistentRouteSurfaces.tsx:40`、`PondExperience.tsx:46`、`transition/types.ts:29` | Grep | 每处都要认 `/lens` |
| F3 | 过渡事务：`pond-transition.tsx:102` **只有路径完全相同**才跳过事务，所以 `/ → /lens` 会照常走 start → ready → reveal；同文件第 76 行 reveal 冻结旧表层、第 78 行处理滚动、第 158 行后退前进无条件开事务、第 166 行 preparing 阶段监听 Esc；`route-reducer.ts:18` 的 `start` 没有同场景分支；`PondRouteLink.tsx:20` 再点同入口默认仍导航；`PondExperience.tsx:57` URL 参数只在首次挂载读取；`use-route-presence.ts:39` 路径变化会重跑 presence | 审查核实 | 别名不是"改五处判断"，要在事务层定义同场景切换 |
| F4 | 首页路由文件只是一个空 `div` | `app/(pond)/page.tsx:2` | `/lens` 照写一个 |
| F5 | 顶栏"曲目"：`<PondRouteLink href="/tracks" …>{t('tracks')}</PondRouteLink>` | `PondHeader.tsx:30` | 改指向与文案 |
| F6 | 站内其余通往 `/tracks` 的入口：单曲页"全部曲目" `TrackCatalog.tsx:93,130`；`/score` 跳转 `app/score/page.tsx`；曲目缺失页 `PreparedTracks.tsx:21`；`PondNavigation.tsx:11,28`（预取与链接） | Grep | 按 D1、D2 处理 |
| F7 | `zh.json` 第 77 行是 `nav.tracks`（顶栏文案），第 758 行是 `titles.tracks`（旧 `/tracks` 页标题） | 代码实查 | 只改 `nav.tracks`；`titles.tracks` 属旧页，不动 |
| F8 | 普通球 id == 曲目 `trackId`（UUID，不是展示编号）；点球走首页 `PlayerProvider`；个人 #36 在 `glSim.nodes` 里以 `node.echo` 标识，走独立 Echo 播放（`useFeaturedEchoPlayback.ts:25`） | 审查核实 | 编号映射用 `displayNumber`；按 `node.echo` 识别 #36 |
| F9 | `SphereHit.tsx:79` 第一次 pointerup 就播放并移除焦点；拖动阈值 8px；没有关闭拖动、关闭播放图标、"只选中"的参数 | 审查核实 | 需要选择 / 激活 / 焦点三套接线，不止两个开关 |
| F10 | `PlayerProvider.tsx:146` 的 `stop()` 会取消异步播放并清状态 | 审查核实 | 退出与跳页用它停原曲，#36 另停 Echo 播放器 |
| F11 | 层级：`SphereOverlay` z-10、`GlEclipse` z-[23]、`SceneCover` 外包装 z-[25]、`GlNav` z-30、`PondHeader` z-[60] | 审查核实 | 遮罩放在球命中层之上、日食之下 |
| F12 | `LoginModal.tsx:105` 处理 Esc 只 `preventDefault()`，不阻止传播；手机菜单在 window 上监听、不消费事件 | 审查核实 | `/lens` 的 Esc 要检查 `defaultPrevented` 并让出优先级 |
| F13 | 涟漪遮蔽：按钮 / 链接或带 `data-pond-no-ripple="true"` 的元素不产生涟漪；滚轮放行只检查 `[data-pond-ui]` 属性是否存在 | `water/ripple-feed.ts:22–26`、`pointer-fx.ts` | 面板根节点打这两个标记 |
| F14 | `route-selection.ts` 静态导入 `asset-registry`，后者导入中文手记、metadata 并计算 catalog revision | 代码实查 | 编号映射、目录、收藏组件都放异步边界内，不进首页 |
| F15 | `MaterialMintPanel` 只需 `track: OriginalTrack`，内部自取登录；23px 标题、46px 按钮来自 `.track-ledger` 作用域样式（`tracks-content.css:17,84`），不是组件自带；ETH 行只对外部钱包登录显示 | 审查核实 | 在新作用域下写紧凑样式即可；`id="track-collect"` 不得重复 |
| F16 | `MaterialProvenance` 的复制 / 验证按钮在 `ProofRow` 里，行多、偏高 | 审查核实 | 新写只读的链上信息面板 |
| F17 | 仓库声明 35 首原曲在 OP（SBT）与 ETH（ERC-1155）均为 `ready`；实时链上状态与真实登录完整点击路径**未核实** | `asset-registry.ts`、`STATUS.md` | 本地不提交真实收藏 |
| F18 | 文件与目录余量：`PondExperience.tsx` 178 行（hook 计 179）；`src/features/home-pond/`、`src/components/pond-shell/`、`pond-gl-test3/overlay/`、`pond-gl-test3/` 根、`src/i18n/` 均已 8 个文件 | 审查核实 | 先拆；新文件全部进新子目录 |
| F19 | `scripts/ui/tracks-*` 共 11 个文件、1074 行；`tracks-circle/integration-gate.mjs:54,71,97` 点击顶栏 `a[href="/tracks"]`；`tracks-experience.test.ts` 早已过期（`TASKS.md:65`） | 审查核实 | 入口断言要改；过期测试单列，不算回归 |
| F20 | 本地 prerender 清单含 `/`、`/artist`、`/me`、`/tracks` 等，尚无 `/lens`；该文件只是历史构建产物 | 审查核实 | 验收时重新 build 比对 |

---

## 4. 待核对点

- **N1（Step 0）同场景切换语义**：首次进入、站内进入、只改 query、后退前进、快速来回、取消导航时，事务怎么走、功能层与选中状态怎么变；不出遮罩、不冻结表层、不重建场景。另查 F2、F3 之外是否还有隐含"首页 = `/`"的地方。查出的面远超预期就停下与用户重估。
- **N2（Step 0）交互状态表**：跟随 / 光照目标 / 面板宽限 / 播放锁定 / 加载中 / 播放失败 / 外部播放器抢占（底部播放器、单曲页）/ #36 播放 / 登录弹窗开着 / 收藏进行中，各自的进入与退出条件。
- **N3（Step 3 前）**：每帧找"光圈下最近的球"，用可见球的同一条投影链（`applyFloat(project(...))`）与投影半径；手指的容差半径。
- **N4（Step 3 前）**：遮罩用 CSS `mask-image` 径向渐变 + 每帧更新 CSS 变量的开销，手机是否掉帧。
- **N5（Step 0）**：`.env.local` 当前指向哪个数据库（只读确认）。

---

## 5. 用户需先定的事

| # | 问题 | 默认（不回答就按此做） | 阻塞 |
|---|---|---|---|
| D0 | `verify.sh` 的两项旧失败 | 同 P20 的决定 | Step 1 |
| D1 | `/score` 现在跳转 `/tracks`，改跳到哪 | `/lens` | Step 6 |
| D2 | 单曲页"全部曲目"链接改到哪 | `/lens?track=当前曲号` | Step 6 |
| D3 | 遮罩暗度、光圈大小、边缘柔度 | 暗度 60%、光圈半径约 120px（手机约 90px）、柔边约 40px，目验定 | Gate |
| D4 | 悬停时收藏键怎么够得着 | 光标、键盘焦点从球移进面板时面板保持；登录弹窗开着、收藏进行中也保持；离开球与面板约 0.2 秒后才隐藏。**不是锁定**，光圈照样跟随 | Step 5 |
| D5 | 面板字段 | 标题：原曲 NN。两条链各一块：链名、标准（Optimism · SBT / Ethereum · ERC-1155）、合约地址（缩写，可复制）、Token #N、状态、"单曲页"与"区块浏览器"两个链接。底部：收藏键（OP 对所有登录用户；ETH 只对外部钱包登录，沿用现规则）。地址与编号用等宽字体，标签小号字母间距，正文约 12px | Gate |
| D6 | P20 的气泡在 `/lens` 上 | 照常（在遮罩下）；手记不出 | Step 2 |
| D7 | 英文标签 | "Details" | Step 6 |
| D8 | #36 播放时光圈是否锁定 | 锁定（与原曲一致），不出面板 | Step 4 |

---

## 6. 步骤

> 每步独立可验、独立 commit，做完停下等用户回复。验收在本地生产构建的持久外壳里做（不与 dev 同时跑）。不交付空组件或占位代码。

### Step 0 — 基线与设计

- 📦 范围：只读代码；可改**本文件**（勘误、补 N1 语义表与 N2 状态表）与 `docs/JOURNAL.md`。
- 做法：记下开工 SHA；跑 `verify.sh` 记基线；解答 N1、N2、N5；按 P20 §8 的方法记录首页性能基线与首屏资源清单；截取首页像素基线。
- 完成标准：语义表、状态表写入本文件并交你过目；若 N1 的改动面远超预期，停下重估。

### Step 1 — 拆 `PondExperience`（纯重构）

- 📦 范围：`PondExperience.tsx`，抽出的模块放新子目录。
- 做法：把场景 / flag 合成与路由判断抽成独立模块，行为完全不变。
- 完成标准：`/`、`/test3`、`/test4`、`/tracks`、`/me`、`/score/*` 行为与像素一致；`PondExperience.tsx` 留出至少 40 行余量。

### Step 2 — `/lens` 别名最小闭环（没有任何新界面）

- 📦 范围：新建 `app/(pond)/lens/page.tsx`；`transition/types.ts`、`transition/route-reducer.ts`、`pond-transition.tsx`、`PondRouteLink.tsx`、`use-route-presence.ts`；F2 列出的各处；Step 1 抽出的模块；P20 的逐路由表按 D6 加一行。
- 做法：按 N1 语义表实现同场景切换；`/lens` 与 `/` 显示完全相同的首页；query 变化时重新读取参数。
- 完成标准：手输 `/lens` 显示首页；`/ ↔ /lens ↔ /me` 互跳、后退前进、快速来回都不闪、不重建场景；首页其他路由的过渡与基线一致。**这一步验证整条路线，不通过不往下做。**

### Step 3 — 光圈层

- 📦 范围：新建 `src/features/lens/`（遮罩、光圈跟随、最近球判定）；Step 1 抽出的宿主模块里按路由挂载（懒加载）。
- 做法：遮罩是 `fixed inset-0`、`pointer-events: none` 的 DOM 层，`mask-image` 径向渐变开孔；光圈每帧缓动；最近球判定按 N3；减弱动效时光圈直接跟手。
- 完成标准：`/lens` 光圈跟随顺滑，照到哪个球可在调试输出读出曲号；首页无变化、首屏资源不变；量 N4。

### Step 4 — 锁定、播放、退出、键盘与手机

- 📦 范围：`src/features/lens/`；`SphereHit.tsx`、`SphereOverlay.tsx` 新增选择模式、`draggable`、`showPlayIcon` 等参数（默认保持原行为）；它们的调用处（Step 1 抽出的宿主）。
- 做法：按 N2 状态表实现；播放锁定与解锁绑播放器状态，#36 绑 Echo 播放器；两级退出用 `PlayerProvider` 的 `stop()` 与 Echo 停止；Esc 按 §1 优先级；跳去别的页面时停止播放、卸载功能层；从首页带着播放进入时直接锁定。
- 完成标准：桌面鼠标、键盘、手机三条路径都走通；登录弹窗、手机菜单开着时 Esc 不误退；首页拖球与播放图标照旧。

### Step 5 — 链上信息面板 → **Gate：你在 `/lens` 目验**

- 📦 范围：`src/features/lens/` 下新建面板、紧凑收藏变体（新作用域样式，不改旧页 `.track-ledger` 的表现）、面板定位逻辑；中英词典新增 key（按 i18n-pond skill）。
- 做法：
  - 字段按 D5；两条链上下排列，地址缩写可复制，链接各自打开单曲页与区块浏览器。
  - 定位：以球的投影位置与半径为锚，依次试右、左、下、上，选第一个放得下的；避开顶栏与屏幕边缘；球漂到边缘时翻面，翻面用短淡入淡出，不跳。
  - 排版：正文约 12px、标签约 11px，等宽字体放地址与编号，行距宽松；面板材质与 P20 手记框同族；按钮与链接点击区 ≥44px。
  - 面板根节点打 `data-pond-no-ripple`、`data-pond-ui`；按 D4 实现宽限。
  - 未登录显示登录入口；本地只验状态，不提交真实收藏。
- Gate：你目验光圈手感与面板排版，定 D3、D4、D5、D8。

### Step 6 — 入口切换

- 📦 范围：`PondHeader.tsx` 链接与 `nav.tracks` 文案（中英，D7）；F6 的各入口按 D1、D2；`PondNavigation.tsx` 预取；`scripts/ui/tracks-circle/integration-gate.mjs` 等依赖顶栏入口的断言改为"手输 `/tracks`"或改测 `/lens`。
- 完成标准：站内无 `/tracks` 链接，手输仍可用；旧页内部测试照常通过（过期的 `tracks-experience.test.ts` 单列说明）。

### Step 7 — 测试与收尾 → **最终验收**

- 📦 范围：新写 `/lens` 浏览器门禁脚本（只用现有依赖）；首页回归检查；`STATUS.md`、`TASKS.md`、`docs/JOURNAL.md`。
- 做法：build 后比对 prerender 清单（原路由不变，`/lens` 新增且静态）；中英、桌面与手机各目验一次；后退前进、播放中切页、慢网、WebGL 兜底各走一遍。
- 完成标准：§2 十二项逐条过，未过项写明原因。

---

## 7. 风险与取舍

- **同场景别名的事务改动**（N1）：最大风险，改的是全站共用的过渡层。Step 2 不带任何新界面先验证，不通过就停。
- **首页回归**：所有新逻辑在 `/lens` 路由之后、懒加载；`SphereHit` 新参数默认保持原行为；每步对照像素基线。
- **收藏键够不着**：靠 D4 的宽限补救；你否决的话，收藏只能在播放锁定后点。
- **遮罩性能**：每帧更新 CSS 变量很轻，主要风险在手机；掉帧就降低更新频率。
- **日食与播放器单例**：不新建日食驱动，沿用首页现有的；停止播放走现有 `stop()`。
- **入口改名**："曲目"改"详情"后，P19 对照表与已有截图会过期，收尾时同步。

---

## 8. 全程检查清单

- `npx tsc --noEmit`；改动文件的定向 ESLint；相关单测与浏览器门禁
- `bash scripts/verify.sh`（dev 开着时不要跑）；旧失败按 D0
- 单个代码文件 ≤220 行（hook 末尾换行多算 1 行）；每个目录 ≤8 个文件（只数文件）
- 像素与性能对比方法同 P20 §8
- 本地 `.env.local` 可能连生产库：不点真实收藏 / 铸造
- 新增文案中英两套；英文为机器初稿时交你审
- 说"完成"前分清代码层与效果层，没目验就明说

---

## 9. 执行记录（2026-10-31，分支 `feat/p21-lens`，基线 main `8fe15d1`）

> 用户授权“一口气搞 P21，遇到决策点按推荐方案、中间不打断”。下列 D 项全部按本文 §5 的默认执行；**未推送、未部署、未写库**。

### 9.1 N1 同场景切换语义（已实现并由门禁验证）

| 场景 | 行为 |
|---|---|
| 站内 `/ → /lens`、`/lens → /`（点击、顶栏、PondRouteLink） | `navigate()` 发现目标与当前都是首页场景且事务稳定 → 只 `router.push`，**不开事务**：无 start/ready/reveal、不冻结表层、不出遮罩、Canvas 与 mountId 不变 |
| 后退 / 前进 `/ ↔ /lens` | `popstate` 同样跳过事务 |
| `usePathname` 变化后 | 稳定态下 `landed === current && pathname !== tx.href` → 发 `alias` 事件，只更新 `href/currentHref`（generation 不变），保证后续 `cancel`、`/lens → /me` 取消时回到 `/lens` 而不是 `/` |
| 只改 query（`/lens?track=N`） | 路径不变，`useSearchParams`（在 `/lens` 自己的 Suspense 内）重新读取；外壳不进 Suspense |
| 事务进行中（如正在去 `/me`）再点 | 走原有事务逻辑，不当别名 |
| 首次直接打开 `/lens` | `initialRouteTransaction('/lens')` → `home`，`LensSlot` 初始即挂载 |
| `/lens → /me`、`/artist` 等 | 正常事务；离开时停止原曲与 #36，遮罩淡出（层保持挂载不重建） |
| 其他隐含“首页 = `/`”处 | `isHomePath()` 收口：`PondHeader`、`use-prepared-archive`、`PersistentRouteSurfaces`、`PondExperience`、`routeForPath`；除 F2 列出的五处外未发现其他 |

### 9.2 N2 交互状态表（已实现）

| 状态 | 进入 | 光圈 | 面板 | 退出 |
|---|---|---|---|---|
| 跟随 | 默认；播放结束 / 停止 / 失败 | 缓动跟指针（τ=85ms；减弱动效直接跟手）；无指针则画面中心 | 指针在球内 → 该球；离开球后 200ms 宽限；指针或键盘焦点在面板内保持 | — |
| 悬停 | 指针落在原曲球内 | 同跟随 | 显示该球链上信息；#36 不出面板 | 离开 + 宽限结束 |
| 播放锁定 | 该球开始播放（原曲 `playing`，#36 `echoPlayingId`） | 锁在球心并随球漂，半径 `max(基准, 球半径×1.8)`；鼠标自由 | 锁定球的面板常驻（含收藏键，收藏键因此够得着） | 播放结束 / 停止 / 失败 / 暂停 |
| 选中（手机轻点、键盘 Tab、深链） | 手机第一次轻点；Tab 聚焦（`:focus-visible`）；`?track=N` | 钉在该球 | 显示面板 | 手机点空白（= 退出）；失焦；深链选中在真实鼠标移动后撤销 |
| 加载中 / 失败 | 点击后到 `playing` 前 | 不锁定（以 `playing` 为准） | 不变 | 失败回跟随 |
| 外部播放器抢占 | 单曲页 / 底部播放器接管 | `lockedId` 随 `playing` 变化自动解锁 | — | — |
| 登录弹窗 / 手机菜单 | 弹窗有 `role=dialog[aria-modal]`；菜单有 `#pond-public-navigation` | — | 面板 `focus-within` 保持 | Esc 只关它们，不退出 `/lens` |
| 退出 | Esc / 点空白（不含按钮、链接、面板、`data-pond-ui`、弹窗）/ 顶栏「详情」再点（`LENS_EXIT_EVENT`） | — | — | 锁定中：先 `stop()` + Echo 停止并解锁；跟随中：`navigate('/')` |

### 9.3 实际决定与偏离

1. **选球用球按钮的真实屏幕矩形**（`getBoundingClientRect`），不重新计算投影链：与肉眼所见、点击命中永远一致，且自动尊重 `dim`（播放时其它球不可点）、#36 隐现、减弱动效缩放。N3 因此不再需要单独的容差半径。
2. **遮罩用 `radial-gradient` 背景而不是 `mask-image`**：同样每帧只改三个 CSS 变量，少一层合成；暗度 .6、光圈半径 120（手机 90）、柔边 40（D3，待目验）。
3. **命中层与功能层之间用 `lens-bridge`（模块级回调）**：`SphereHit` 新增 `lensMode`（默认 false = 首页原行为）；轻点“选中 vs 播放”由功能层按 `pointerType` 判定（手机第一次只选中，桌面鼠标直接播放，键盘 Enter/Space 直接播放，#36 直接播放）。
4. **`MaterialMintPanel` 新增 `compact`**：不输出 `id="track-collect"`、标题与规则折叠；紧凑样式写在 `src/features/lens/panel/lens-panel.css`，不改旧页 `.track-ledger`。
5. **手机上面板很高放不下时**：取球上/下空间较大的一侧、压低高度并内部滚动，保证不盖住球（门禁在 390×844 验证第二次轻点能点到球）。
6. **`/score` → `/lens`（D1）；单曲页“全部曲目”两处 → `/lens?track=当前曲号`（D2）**，文案未改（仍是“全部曲目”）；预取 `/tracks` → `/lens`。
7. 深链用 `replaceState(window.history.state, …)` 写回（与 `TrackCatalog` 同一做法，Next 不会因此重读 query，不会回环）；站内换 query 靠 `router.push`（门禁用 `window.next.router.push` 验证）。
8. 旧 `scripts/ui/tracks-circle/integration-gate.mjs`：顶栏入口断言改为 `typed:` 前缀（Next 客户端路由模拟手输，保留共享 Canvas）；手机菜单断言改 `/lens`。其余 `tracks-*` 旧门禁点的是 `/tracks/pond` 老链接（早已过期），未动。
9. 文件拆分：`PondExperience.tsx` 192 → 约 160 行，抽出 `host/use-home-flags.ts`、`host/use-core-flags.ts`、`host/LensSlot.tsx`。

### 9.4 验证（代码层）

- `tsc --noEmit`、定向 ESLint、`i18n:check`（657 key）通过；`verify.sh` 仅余开工前就有的旧失败（线上 snapshot Gate、`self-mint`/`types` 目录超 8 文件）。
- 单测：`scripts/p21/lens-geometry.test.ts`（选球、缓动、桌面/手机面板摆放）、`scripts/ui/pond-unification/transition.test.ts`（别名事务）。已并入 `verify.sh` 2i。
- 浏览器门禁（无头 Edge + CDP，针对 `next dev`；SwiftShader 能画出球）：`scripts/ui/lens/browser-gate.mjs` 13 项（别名同场景无事务、光圈跟随、读出曲号、面板在画面内且两条链、宽限、点空白退出、后退前进、Esc、深链只选中、去别页遮罩撤下、`/tracks` 手输可用且站内无链接、`/score` 重定向）；`playback-gate.mjs`（桌面真实音频：点击播放锁定 → 鼠标自由 → Esc 停止 → Esc 回 `/`；手机：轻点两次播放、点空白两级）；`veil-check.mjs`（光圈内亮度保持约 94%，光圈外约 52%）；`shot.mjs`（中英桌面/手机截图，英文无中文残留）。
- **生产构建（`next build` + `next start`）**：`/lens` 为静态预渲染（○），原有路由不变；同样的 `browser-gate`（13 项）与 `playback-gate` 全部通过；`chunk-check.mjs`：首页 46 个 JS，点“详情”后才新增 1 个（功能层独立 chunk，首页不下载）。
- 目录规则：`lens-bridge` 放 `src/features/lens/bridge/`（`overlay/` 已满 8 个文件）；`src/features/lens/` 根目录 8 个文件，其余在 `panel/`、`bridge/`。
- 证据截图：`reviews/evidence/lens-{desktop,phone}-{zh,en}.png`。

### 9.5 未做 / 需你目验

- **你亲自目验**：光圈手感（D3 暗度/半径/柔边）、面板排版与字号（D5）、真实手机的轻点与滚动、慢网与 WebGL 兜底；无头浏览器测不到手感。
- 真实登录状态下收藏键的完整点击链路（F17）未测，也不提交真实收藏。
- 收藏键在“悬停但未播放”时只在光圈跟随期可达（指针移进面板有宽限）；键盘用户要进面板，需先 Enter 播放锁定（此时其它球 `tabIndex=-1`，Tab 直达面板）。
- 首屏资源对比：`/lens` 功能层是 `dynamic(..., { ssr:false })` 懒加载，首页不下载，但未做逐字节的资源清单对比（N5/性能基线未测）。

---

## 10. 收尾（2026-11-06）

- 合入：`feat/p21-lens` 快进合入 `main`，推送 `8fe15d1..3d72976`。截图 `reviews/evidence/lens-gate-failure.png` 未入库（本地未跟踪）。
- 审查：Codex 两轮审查（已提交部分、未提交部分）结论与处置见 `reviews/2026-10-31-p21-codex-review.md`。两条 P2 与一条 P1 均已修复并有门禁验证。
- 范围核对：P21 相对 `8fe15d1` 未改合约、`supabase/`、`app/api/`，未新增依赖。
- 构建：`next build` 单独重跑通过（BUILD_EXIT=0）；`verify.sh` 的失败均为开工前已有：线上 snapshot Gate（`播放回退与 Production snapshot Gate`）、`src/lib/self-mint`（9 文件）与 `src/types`（10 文件）超过 8 文件。P21 未触碰这些。

### 10.1 §2 验收结果（逐条对照证据）

| # | 验收项 | 结论 | 证据 |
|---|---|---|---|
| 1 | 首页与开工基线像素级一致（仅“详情”差异） | **未验证像素** | 结构门禁（35 球、挂载 id 不变）与首屏 chunk 检查通过；未做像素比对 |
| 2 | 点“详情”进 `/lens`：不重建、不闪，变暗、光圈有惯性 | 通过 | `browser-gate` 无事务、Canvas 不变；`veil-check` 光圈内亮度保持、外部变暗；用户目验 |
| 3 | 光圈落在原曲球上出面板，排版顺眼 | 通过 | 截图；`browser-gate` 面板在画面内、两条链；用户目验 |
| 4 | 点击播放后锁定，随球漂，播放结束回到鼠标 | 通过 | `playback-gate` |
| 5 | #36 可播放、锁定、不出面板 | **未验证** | 门禁未覆盖 #36（假 #36 只在开发环境） |
| 6 | Esc、点空白、再点“详情”退出；播放中先停；登录弹窗/菜单优先 | 大部分通过 | Esc 两级、点空白通过（`playback-gate`、`browser-gate`）；“再点详情”退出与登录弹窗优先**未门禁覆盖** |
| 7 | 去 `/me` 停音乐、功能层消失；后退前进正常 | 大部分通过 | 去 `/artist` 停播放、遮罩撤下；后退前进通过；去 `/me` 未单独覆盖（同一机制） |
| 8 | 手机选中、播放、退出可用，按钮可点不溢出 | 通过 | `playback-gate`（390×844，点击区 ≥44px）；用户目验 |
| 9 | `?track=12` 落在 12 号球、不自动播放；站内换 query 更新 | 通过 | `regression-gate`（含重进再次选中） |
| 10 | 手输 `/tracks` 仍可用，站内无 `/tracks` 链接 | 通过 | `browser-gate` 第 8 步 |
| 11 | 中英切换后 `/lens` 文字跟随，英文无中文残留 | 部分 | 英文截图人工检查无残留；未做全量英文扫描 |
| 12 | 合约、数据库、链上、Arweave 未改动 | 通过 | `git diff 8fe15d1` 核对（见上） |

### 10.2 遗留（不阻塞，列入后续）

- #36 播放的门禁（需要真实或假的 #36 数据）。
- 去 `/me` 的功能层卸载门禁；“再点详情”退出与登录弹窗优先的门禁。
- 首页像素基线比对（§2-1）。
- 性能：N4（手机遮罩掉帧）、N5（首屏资源逐字节对比）未测。
- 登录用户收藏键的真实点击链路（F17）未测；本地不提交真实收藏。
- 英文全量扫描（§2-11）。
- D3/D5 的参数（暗度 60%、光圈半径 120、柔边 40、面板字号）：用户目验后未调整，保持默认。

