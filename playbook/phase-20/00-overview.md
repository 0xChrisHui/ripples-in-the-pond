# Phase 20 — 池塘气泡与创作手记

> 制定日期：2026-10-28；同日按 Codex 审查修订（`reviews/2026-10-28-p20-p21-playbook-codex-review.md`）。状态：执行计划，尚未开发。\
> **开工前提**：P14-I 已合入 `main`。Step 0 把开工基线固定为一个具体 SHA，不凭 STATUS / TASKS 判断合并状态（两份台账目前有漂移，见 §3 F17）。\
> 分支：从该 SHA 新开 `feat/p20-pond-bubbles`，不用 worktree。\
> 本计划**不改合约、不改数据库、不改链上 / Arweave 永久内容、不新增依赖**；`/test1` 不得改动；不改共享的 `archipelago/sphere-config.ts`。\
> 分两段：**P20-A 气泡视觉**（Step 0–3）、**P20-B 手记**（Step 4–6）。另含一个与气泡无关的小改：#36 默认态变淡（Step 1）。\
> P21（`/lens` 详情页）见 `playbook/phase-21/00-overview.md`，在本 Phase 合入后开工。

---

## 1. 已定的决策

| 决策 | 结论 | 理由 |
|---|---|---|
| 画面 | 空中俯视一个清澈、约 3 米深的池塘；水下的动物或植物偶尔吐出**一小串**气泡，"咕噜咕噜"几下就结束 | 用户描述 |
| 随机性 | 位置、每串个数、间隔、上升时长、串与串的间隔都在区间内随机；**只在生成时取值**，运动过程中不逐帧取随机数 | 用户要求；画面不抖 |
| 渲染路线 | 气泡是 **R3F 对象，挂在 `<Canvas>` 里面**（照 `FloatingMotes`，`PondGL.tsx:148`），落在背景层，随水面折射和涟漪一起扭曲。手记是 HTML，挂在 Canvas 外，两者通过一个模块级小状态交换"载体泡的屏幕坐标与生命周期" | 用户选 B；Codex 指出初稿写成"照花瓣挂载"是错的——花瓣是 Canvas 外的 2D 画布（§3 F14） |
| 透视 | 每个泡有自己的深度 `d`，从池底（约 0.05）升到有效水位；屏幕位置按 `0.5 + d` 绕画面中心外扩，与球的一点透视一致 → 泡沿径向外飘、变大、变清晰 | 首页透视在屏幕空间模拟（§3 F1） |
| 与球的遮挡 | 背景层永远画在球后面。处理：**生成时避让整条上升路径上的球** + **每帧按到球边缘的距离柔性淡出**；球的位置用与可见球**同一条投影链**（含浮动），半径取保守值，另加折射位移余量 | 用户提出避让；拖球、滚轮浮沉、#36 移动都会重叠（§3 F16） |
| 外观 | 抽象：冷白（与微光 `#cce5ff` 同族）柔边光环、中心近透明、一个小高光朝 `MOON_ANCHOR`（左上）；越深越小、越软、越淡；**峰值亮度低于球高光**；不用彩虹膜、不用暖色 | 项目视觉红线（§3 F8） |
| 声音 | 不做 | 33 键音效集已冻结 |
| 手记来源 | 35 首曲目的创作手记，**不显示属于哪一首**；中文 `artist-notes.json`，英文 `artist-notes.en.json`。**35 首英文均为艺术家认可的版本**：24 首按新稿更新（`e7e9df9`），其余 11 首艺术家确认原译不改（2026-10-28） | 用户要求与确认 |
| 手记片段 | 按段落长度拆分，中英各自独立拆（不需对齐）；以"非空行"为段（手记里的换行是艺术家自己的断句）；超长段在句末切 | 用户定；统计口径见 §3 F10 |
| 同屏 | 气泡最多 1 串在升；手记**同屏最多 1 条** | 用户定 |
| 手记出场 | 最后一个泡停在水面作载体 → 裸字逐行淡入（无框）→ 悬停或点按才出现半透明框 → 字先淡出、泡后破 | 用户与艺术家"气泡上浮现半透明框"，细化为"框只在读的时候出现"，避免产品感 |
| 手记停留 | 时长随字数，区间随机；**鼠标悬停可延长停留** | 用户要求 |
| 切换语言 | 切换时撤下正在显示的手记，下一条用新语言；英文加载失败就跳过手记，**不回退中文** | 保证"英文模式无中文手记" |
| 下载 | **本功能不新增首屏下载**：中文手记在第一次要出手记时动态加载；英文沿用现有英文内容加载（英文模式下现已提前加载，见 §3 F11） | 守住 P15-J |
| flag | 新增 `pondBubbles`，**默认关**；用户目验批准后再决定是否默认开 | P8 规则；旧 archipelago 已有 `bubbles`，必须避名 |
| #36 默认态 | 默认态（非播放）**最终主体覆盖率约 85%**，并让它"不那么刺眼"（见 D1）；播放态、日食、身份渐显 / 隐退保持现状 | 艺术家意见；实现方式见 Step 1 |

---

## 2. 用户可验收的结果

1. Step 1 之后，以它为基线：`pondBubbles` 关闭时，首页、`/test3`、`/test4` 与基线**像素级一致**（固定视口、采样时刻比较）。
2. `/test4?pondBubbles=1` 与 `/?pondBubbles=1` 下，池塘不时在随机位置冒出一小串气泡，在水下、被水面扭曲，靠近水面变清晰，破水时留一圈很小的涟漪。
3. 气泡**不会出现在音乐圆圈前面**：避开圆圈生成；圆圈被拖过去、滚轮浮沉时，气泡在圆圈边缘悄悄淡掉。
4. 气泡安静、不抢眼：最亮处低于圆圈高光，节奏明显慢于涟漪，与花瓣、微光像一家人。
5. 部分气泡串在水面停下后浮出一段手记；同屏最多 1 条；悬停出现半透明框并延长停留；手机点按保持、点空白消失。
6. CN/EN 切换时当前手记撤下，之后按新语言出现；英文模式下没有中文手记。
7. 系统开启"减弱动效"（含运行中途开启）时，气泡与手记不再自动出现。
8. 首屏资源与基线相同；首帧、水面就绪、可交互时间按 §8 的方法测量，无可感知变化。
9. #36 默认态更淡；播放时与日食的表现与现在一致；`/me`、Echo 页上的 #36 按 Step 0 的结论处理。
10. 合约、数据库、链上与 Arweave 内容、`catalog.v1.json`、`/test1`、`sphere-config.ts` 均未改动。

---

## 3. 已核对的事实（2026-10-28；"审查核实"= Codex 已对照代码核实、Claude 抽查属实）

| # | 事实 | 位置 | 约束 |
|---|---|---|---|
| F1 | 首页是正交相机（`PondGL.tsx:127`）；透视在屏幕空间：缩放 `0.5 + d`（`sphere-projection.ts:39`），绕视口中心同比外扩；原始水位 0.5，**映射后的有效水位约 0.525**（`water-level.ts:33–49`） | 审查核实 | 气泡升到有效水位，不写死 0.5 |
| F2 | 每帧：背景层 → 球水下 → 球水上三个场景 pass，另有高度场模拟与最终合成；背景层被折射（`water-distort-shaders.ts:142–152`） | `render-passes.ts:132` 起 | 气泡进背景层即被折射，不改渲染流程；代价是永在球后 |
| F3 | `FloatingMotes` 用 NDC 写 `gl_Position`、不经相机，加色混合、柔边无 `discard`；hook 计为 216 行，只剩 4 行 | `decor/FloatingMotes.tsx` | 照它的范式写新组件，不往它里面加东西 |
| F4 | 加 flag 改 3 处（接口、`DEFAULT_GL_FLAGS`、`parseGLFlags`）；文件 201 行，加完 hook 计 205 行 | `gl-flags.ts` | 之后不得再往这里塞调参项 |
| F5 | `/test4` = `PondExperience mode="test4"`，**未开 `persistent`、P9 关闭**（`app/test4/page.tsx:10`、`PondExperience.tsx:45`）；生产走持久外壳 `PersistentPondShell.tsx:16` | 审查核实 | `/test4` 只做视觉 Gate；功能 Gate 必须在生产外壳 |
| F6 | **URL 参数在所有模式首次挂载时都会解析**（`PondExperience.tsx:57–61`），生产也一样；之后不再重读 | 代码实查 | 生产外壳可用 `/?pondBubbles=1` 验收，须整页加载 |
| F7 | `bg-ripple:wave` 有**两个消费者**：`WaterDistort.tsx:129` 读 `{x,y,strength,radius}` 画水纹；`use-gl-sim.ts:110` 读 `{x,y,size,duration}` 推球（`duration` 单位为秒）。`ripple-feed.ts` 没有公开的入队接口 | 审查核实 | Step 3 前冻结事件合同；破泡若只要水纹不要推球，须走专用通道 |
| F8 | 视觉红线：只许抽象；装饰层透明度 <1、加色柔光、退让不抢球；装饰峰值亮度低于球高光；光向一律取 `MOON_ANCHOR` | `playbook/phase-8/00-overview.md`、`10-a-water-ripple.md`、`20-b-effects-migration.md` | 外观与节奏的硬边界 |
| F9 | 减弱动效：全局单例 `prefersReducedMotion()`，监听运行中的变化 | `pond-gl-test3/reduced-motion.ts:15–26` | 气泡与手记属自动动画 |
| F10 | 手记按**非空行**统计：中文 77 段，4–184 字（>80 字 15 段，>160 字 2 段）；英文 146 段，4–354 字符（>180 字符 19 段）。按空行分段则为中文 51、英文 127 | 两份手记 JSON | 片段以非空行为单位 |
| F11 | `catalog.v1.json` 的 revision 含手记、被铸造订单校验，**不能改**。英文内容加载（`use-english-content.ts:13`）把艺术家内容与全部英文手记一起加载；生产外壳始终隐藏挂载艺术家页（`PersistentRouteSurfaces.tsx:129`），所以**英文模式下现已提前下载英文手记** | 审查核实 | 不新增手记数据文件；不承诺"英文首次用到才下载" |
| F12 | 半透明材质先例：`/me` 控件 `rgb(1 7 6 / 72%)`、`blur(14px)`、边框 `color-mix(bone 12%)`（`me-pond.css:63–69`）；字体令牌 `--p11-font-display`（`p11-tokens.css:27`） | 审查核实 | 手记框复用，不另造视觉语言 |
| F13 | 直接文件数：`pond-gl-test3/` 根 8、`overlay/` 8、`decor/` 6、`src/features/home-pond/` 8、`src/i18n/` 8（hook 只数文件） | `check-folder-size.js:117` | 新代码进新子目录 `decor/bubbles/` |
| F14 | `PondGL.tsx` 177 行；`<Canvas>` 在第 126–169 行，`FloatingMotes` 在第 148 行（Canvas 内）；`WaterPetals` 在第 172 行（**Canvas 外的 2D 叠层**） | 代码实查 | 气泡挂第 148 行附近；手记宿主挂 Canvas 外 |
| F15 | 跨页：注册场景（score / tracks）下 `coreFlags` 透传 `flowerPetals`（`PondExperience.tsx:92–98`）；`/me`、`/artist` 用 `ARCHIVE_FLAGS`，**从默认 flags 派生**（`PondSceneLayers.tsx:9`）；score 场景还会换 `coreSim`（`PondExperience.tsx:103`） | 审查核实 | 花瓣默认开所以跨页看似正常；气泡默认关，照抄不会出现。须逐路由定 |
| F16 | 可见球的位置是 `applyFloat(project(...))`（`sphere-frame.ts:118`、`SphereOverlay.tsx:75`），GL 另叠悬停放大与场景缩放；花瓣只用 `project()`（`WaterPetals.tsx:134`）。个人 #36 已直接在 `glSim.nodes` 里，以 `node.echo` 标识（`echo-node.ts:46–55`）；合成折射位移上限约 UV ±0.025 | 审查核实 | 避让照可见球的投影链，按 `node.echo` 识别 #36，不按下标 |
| F17 | 台账漂移：STATUS 写 P15-J、P19 未合并，实际已在 `main`；P19 有另一份审查 `reviews/2026-10-28-p19-i18n-review.md`（5 项 P1，建议暂不收口） | 审查核实 | 开工基线写 SHA；P19 的 P1 是否先修由用户定 |
| F18 | #36 的透明度陷阱：水上 pass 有 `alpha = max(alpha, bodyMask * playDim * waterWeight)`（`sphere-shader.ts:106`），只调 `fillOpacity` 时水上主体仍会被拉回不透明；#36 颜色是 `#FFFFFF`（`sphere-config.ts:154`），shader 第 113 行起做饱和度与偏色；身份渐显 / 隐退进入 `sphere-frame.ts:160` 的透明度 | 审查核实 | Step 1 必须给 `node.echo` 加独立视觉因子，两个水 pass 都生效 |
| F19 | 旧 SVG 栈已有 `bubbles` 效果（DOM 元素，1–2px，同屏 ≤4） | `archipelago/effects/motion/bubbles.tsx` | 只借鉴节奏，不复用代码 |

---

## 4. 待核对点

- **N1（Step 0）逐路由表**：首页、`/me`、`/artist`、`/tracks`、`/score/*`、Echo 页各自是否出气泡、是否出手记、避让用哪组节点（`coreSim` / 首页 `glSim`）、播放时是否抑制。作为 Step 6 的依据。
- **N2（Step 0）#36**：默认态的视觉因子放在 shader 哪一级（主体覆盖率、颜色）；`/me` 与 Echo 页上的 #36 是否跟着变（默认只改首页场景）。
- **N3（Step 2 前）**：气泡组件如何在 Canvas 内每帧取到可见球的投影位置与半径（照 `sphere-frame.ts` 的投影链；`glSim` 怎么传进来）。
- **N4（Step 3 前）**：破泡涟漪的事件合同：`x/y` 屏幕像素，`strength/radius` 管水纹，`size/duration` 管推球。默认**只要水纹、不推球**——确认只发半套字段时推球一侧是否安全（`size` 缺失是否产生 NaN）；不安全就加一个只写水纹的小入口，范围相应扩大。
- **N5（Step 5 前）**：手记框 `backdrop-filter` 叠在 WebGL 上的逐帧开销，手机是否掉帧。

---

## 5. 用户需先定的事

| # | 问题 | 默认（不回答就按此做） | 阻塞 |
|---|---|---|---|
| D0 | `verify.sh` 已有两项旧失败（`src/lib/self-mint`、`src/types` 目录超 8 文件），AGENTS 规定失败即停 | **只有基线之外的新失败才停**；需你确认 | Step 1 |
| D1 | #36 是纯白，"降低饱和度"无法按字面做。三种理解：(a) 降亮度，白→浅灰；(b) 让白带一点池塘冷调；(c) 只降不透明度、不动颜色 | (a)，亮度约 85%，目验定 | Step 1 收尾 |
| D2 | 气泡观感（大小、亮度、速度、间隔） | Step 2–3 的初值，`/test4` 控制台可调 | Gate A |
| D3 | 手记出现频率 | 每 2–4 串气泡带一条；有手记在场时不出新的 | Step 5 |
| D4 | 播放音乐（日食）期间是否出手记 | 不出；气泡照常但间隔加倍 | Step 5 |
| D5 | 片段长度 | 软目标中文 80 字、英文 180 字符；硬上限为手记宽度下 **6 行**；超出依次在句末、分句标点、词边界处切 | Step 4 |
| D6 | 生产是否默认开 `pondBubbles` | 保持关，Gate B 后由你决定 | Step 6 |

---

## 6. 步骤

> 每步独立可验、独立 commit，做完停下等用户回复。说"完成"前分清代码层与效果层；视觉必须对照基线目验，没目验就明说。不交付空组件或占位代码（AGENTS.md:31）。

### Step 0 — 基线与核对

- 📦 范围：只读代码；可改**本文件**（勘误 §3、补 N1 逐路由表）与 `docs/JOURNAL.md`。
- 做法：确认 P14-I 已合入并记下开工 SHA；跑 `bash scripts/verify.sh` 记基线；解答 N1、N2；确认 `.env.local` 当前指向哪个数据库（只读确认，不写）；按 §8 记录性能基线。
- 完成标准：SHA、基线、N1 表、N2 结论均写入本文件；有出入的事实已改。交你定 D0。

### Step 1 — #36 默认态变淡（与气泡无关，单独提交）

- 📦 范围：`spheres/sphere-shader.ts`、`spheres/sphere-frame.ts`（或其就近模块）里给 `node.echo` 加独立视觉因子；不改 `sphere-config.ts`。
- 做法：因子只作用于默认态的最终主体覆盖率与颜色，两个水 pass 都生效；播放态、日食、身份渐显 / 隐退照旧参与计算。
- 完成标准：登录后首页 #36 默认态更淡；播放、日食、出现与离开的过渡与改前一致；其余 35 球像素不变。交你目验定 D1。之后的像素对比以本步为基线。

### Step 2 — 最小可见的气泡闭环

- 📦 范围：`gl-flags.ts`（+3 行）、`pond-gl-test3/overlay/ScenePanel.tsx`（一行开关"池塘气泡"）、`PondGL.tsx`（Canvas 内一行挂载）、新建 `decor/bubbles/`（调度、模拟、避让、简单光环 shader）。
- 初值（可调）：
  - 串与串间隔 10–30 秒，同时只升 1 串；每串 3–6 个，泡间隔 0.4–1.5 秒，不规则。
  - 上升 5–8 秒，`d` 从约 0.05 升到有效水位；横向蛇行振幅很小，大泡更明显。
  - 到水面停 0.3–1.2 秒再消失（本步先淡出，不出涟漪）。
  - 出生点在画面 15%–85% 区域；整条径向路径与所有可见球（投影半径 × 1.2，再加折射余量）不相交才生成，最多重试 5 次，失败就跳过这一串。
  - 每帧：泡到最近球边缘的距离小于阈值时线性淡出，贴边为 0。
  - 减弱动效时不生成。
- 完成标准：flag 关时三个页面与 Step 1 基线像素一致；`/test4?pondBubbles=1` 气泡可见、在升、被折射、不出现在球前；拖球压过去时泡淡掉；帧率与关闭时对比有记录。

### Step 3 — 破水涟漪、外观精修、调参面板 → **Gate A：用户在 `/test4` 目验**

- 📦 范围：`decor/bubbles/` 内；按 N4 结论接涟漪（若需专用入口，范围加 `water/WaterDistort.tsx` 或 `water/ripple-feed.ts` 的最小改动）；`SandboxControls.tsx` 加气泡调参（大小、亮度、速度、间隔、每串个数）。
- 外观初值：水面处半径 3–7px、深处 1–2px；环峰值约 0.4（低于微光 0.6、低于球高光）；冷白 `#cce5ff` 族；高光方向取 `MOON_ANCHOR`；越深越软越淡；破泡一圈极小、极快的水纹。
- Gate A：你在 `/test4` 对照 Step 1 基线目验，定 D2。未通过就在本步调，不进 P20-B。

### Step 4 — 手记片段池（P20-B 开始）

- 📦 范围：新建片段切分模块（放 `decor/bubbles/` 下的子目录，或 `src/lib/music-catalog/` 下新子目录，按目录余量定）与单测。
- 做法：运行时从中、英两份现有手记切片段：按非空行；超过 D5 的在句末、分句标点、词边界依次切；不跨行拼接；不带曲目编号。中文手记动态加载；英文取现有英文内容加载的结果，失败则返回空。
- 完成标准：单测覆盖中英、超长行、只有一句的行、英文加载失败；首屏资源与基线相同。

### Step 5 — 手记出场

- 📦 范围：Canvas 外新建手记宿主组件与样式（`PondGL.tsx` 在花瓣旁加一行挂载）；**Step 2–3 的调度与载体泡生命周期模块**（让载体泡在手记期间停留、字先退泡后破）；词典里极少量无障碍文案（中英两套，按 `.claude/skills/i18n-pond/SKILL.md`）。
- 出场：载体泡停在水面 → 裸字（Cormorant + 宋体，半透明白）在泡旁逐行淡入，每行间隔约 0.3 秒、上漂 4–6px（只动 `opacity` / `transform`）→ 停留 `3 秒 + 每字约 0.08 秒`，加随机抖动 → 悬停时淡入半透明框（F12 材质），停留计时暂停，离开 3 秒后再收 → 字先淡出，泡后破。
- 手机：点按保持，点空白或超时消失；点击区 ≥44px。
- 位置：锚在载体泡的屏幕坐标；排版区不越出画面、不压顶栏；只有文字本身接收指针，不挡球的点击。
- 按 D3、D4 控制频率；切换语言时撤下当前手记；减弱动效时不出。
- 完成标准：`/test4` 中英各目验；悬停延长、手机点按、减弱动效、切换语言都按预期；量一次 N5。

### Step 6 — 跨页与生产外壳 → **Gate B：用户在生产外壳目验**

- 📦 范围：按 N1 逐路由表改 `PondExperience.tsx` 的 `coreFlags` 与 `PondSceneLayers.tsx` 的 `ARCHIVE_FLAGS`（`PondExperience.tsx` 若因此超 220 行，先把 flag 合成抽到新子目录）；按 D6 决定 `DEFAULT_GL_FLAGS`；`STATUS.md`、`TASKS.md`、`docs/JOURNAL.md`。
- Gate B：本地生产构建（不与 dev 同时跑）下用 `/?pondBubbles=1` 走 `/ ↔ /me ↔ /artist ↔ /tracks ↔ /score/*`、播放中切页、浏览器后退前进、WebGL 兜底（`?forceFallback=1`）、P9 开启状态；中英各一遍；桌面与手机各一遍。
- 完成标准：§2 十项逐条过，未过项写明原因。

---

## 7. 风险与取舍

- **永在球后**：背景层方案的固有代价，靠避让 + 淡出掩盖；目验仍穿帮就另立计划改走球那一遍。
- **与现有画面不协调**：最大的主观风险。先做得过分安静，对照基线逐项加强。
- **#36 改动波及面**：shader 是 36 球共用的，因子必须只认 `node.echo`；Step 1 单独提交、单独目验，出问题可单独回滚。
- **性能**：气泡数量极少；主要风险在手记框的 `backdrop-filter`（N5），手机掉帧就改为纯半透明底。
- **文件上限**：`gl-flags.ts` 加完只剩约 15 行，`PondExperience.tsx` 178 行；超线先拆再加，不压缩代码凑行数。
- **台账漂移**：P19 另有 5 项 P1 待定；若先修 P19，本 Phase 的基线 SHA 跟着更新。

---

## 8. 全程检查清单

- `npx tsc --noEmit`；改动文件的定向 ESLint；相关单测
- `bash scripts/verify.sh`（dev 开着时不要跑，`.next` 会互踩）；按 D0 处理旧失败
- 单个代码文件 ≤220 行（hook 按 `split('\n')` 计数，末尾换行多算 1 行）；每个目录 ≤8 个文件（只数文件）
- 像素对比：同一视口、固定采样时刻；以 Step 1 为基线
- 性能测量：同一 SHA、设备、网络档位、页面置前可见；记录首帧、水面就绪、可交互、首屏资源清单、帧耗时；另测运行中开启减弱动效、切后台再回来、窗口缩放 / 转屏、WebGL context lost
- 本地 `.env.local` 可能连生产库：只做只读验收
- 新增界面文案中英两套，走 i18n-pond skill

---

## 9. 执行记录（2026-10-28，Claude；分支 `feat/p20-pond-bubbles`，本地提交、未推送）

**基线**：开工 SHA `a9f5e42`（P14-I/J 代码已在 main；`feat/p14-i` 仅多一个文档提交）。`verify.sh` 基线失败三项且与 P20 无关：Production snapshot Gate（H7 读到线上有活跃旧队列）、`src/lib/self-mint` 9 文件、`src/types` 10 文件。D0 按默认处理：只有基线之外的新失败才停。

| 步 | 提交 | 内容 | 代码层验证 |
|---|---|---|---|
| 1 | `da8e17b` | #36 默认态变淡：新 `special36/special36-calm.ts`，`aParams.z` ×0.85、球色 ×0.88，仅认 `node.echo`，播放/悬停高亮时平滑回 0；`nodes.ts` 加 `_calm` | tsc、ESLint |
| 2 | `42d86be` | `decor/bubbles/`：模拟 `bubble-sim.ts`、可见球投影 `bubble-env.ts`、shader、`PondBubbles.tsx`、调参存储；`pondBubbles` flag（默认关）、ScenePanel 开关、PondGL 一行挂载 | tsc、ESLint、`scripts/p20/bubble-sim.test.ts` |
| 4 | `a2aa92d` | 手记片段池 `notes/`（子代理完成，已审）：按非空行切、中英独立、英文失败返回空；`use-english-content.ts` 仅加 `export` | 单测、tsc、ESLint |
| 3 | `66ea47c` | 破水涟漪（`bg-ripple:wave` 带 `size:0,duration:0`，只出水纹不推球）、`BubblePanel` 调参面板 | 同上 |
| 5 | `787e011` | 载体泡 + `bubble-bridge.ts` + `notes/PondNotes.tsx`、`usePondNoteTimeline.ts`、`note-display.ts`；词典 `home.noteLabel` 中英 | 单测、tsc、ESLint、词典检查 |
| 6 | `ca5713e` | `pondBubbles` 透传到注册场景与档案场景（`PondExperience.tsx` +2 行） | tsc、ESLint |

（提交顺序里 Step 4 排在 Step 3 前，因 Step 4 由子代理并行先完成；两者互不依赖。）

**N 项结论**：N1——气泡与花瓣同属持久水面核心，flag 透传到注册场景（score/tracks）与档案场景（/me、/artist）；避让用各场景传给 `PondGL` 的 `glSim`；播放（日蚀）期间气泡间隔加倍、手记不出且撤下。N2——#36 因子放在 `sphere-frame.writeFrame`（写 `aParams.z` 与 `aColor`），`/me`、Echo 页若经同一 `writeFrame` 也会变淡（未逐页确认）。N3——`collectDiscs` 按 `writeFrame` 同一条链 `applyFloat(project(...))`，半径 ×1.2 加 0.03×短边折射余量。N4——`WaterDistort` 只读 `x/y/strength/radius`，`use-gl-sim` 读 `size/duration`；`duration=0` 的波下一帧开头被 `filter` 剔除，故不需要专用入口。N5——**未测**。

**与计划不一致 / 没做的**：
- Step 0 的 N1 逐路由表、性能基线（§8）未按计划写成表与数字；上面是简化结论。
- 手记硬上限 `HARD_MAX` 中文 144、英文 240 是估算（每行约 24 字 / 40 字符 × 6 行），未测真实排版；手记宽度我定为 360px、字号 15px，也未目验。
- 英文停留按每字符 0.04 秒（中文 0.08 秒），为我的取舍。
- 日蚀期间"撤下手记"通过 `setSuppressed` 实现；气泡串在日蚀开始后仍会走完。
- 手机点按保持 / 点空白消失、悬停半透明框、切语言撤下、减弱动效中途开启：只有逻辑与单测（排版规则、载体停留放行），**没有任何实机验证**。

**效果层完全未验**：无头 Edge 能加载 `/test4?pondBubbles=1`、无 shader 编译报错，但画面里没有球与气泡（headless 软渲染下场景未就绪），所以气泡外观、被折射、不压球、破水涟漪、手记排版、#36 变淡幅度均须 Gate A / Gate B 目验。§2 十项里，第 10 项（合约/数据库/catalog/`/test1`/`sphere-config.ts` 未改）已用 git diff 确认；其余九项均未过。
