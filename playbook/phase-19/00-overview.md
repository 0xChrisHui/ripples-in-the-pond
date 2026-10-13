# Phase 19 — 首页无感加载（第一帧即夜塘，单层过渡，去文字化）

> 制定日期：2026-10-13。状态：执行计划，尚未开发。\
> 基线：`main@c11efa7`。\
> 本计划只改首页加载期的视觉与资源预取，**不改合约、不改数据库、不新增依赖**。

---

## 1. 起因与目标

打开 `/` 时，同一句“声音正在汇入水塘”先大后小连出现两次（2026-10-13 用户录屏 `20261013_150824.mp4` 反馈）。根因是三层加载画面依次接力，每次交接都是一次视觉跳变：

| 层 | 位置 | 表现 |
|---|---|---|
| ① 路由兜底 | `app/loading.tsx` | 纯黑底 + 大字（`text-4xl`/`sm:text-6xl`）+ 说明句 + 细线 |
| ② GL 加载浮层 | `src/components/pond-gl-test3/overlay/GlLoading.tsx`，挂载点 `src/features/home-pond/PondExperience.tsx:161` | 居中小字，`glSim.loading` 期间显示 |
| ③ 场景遮罩 | `src/components/pond-gl-test3/presentation/SceneCover.tsx` | 暗绿径向渐变，`sceneReady` 前盖住 Canvas |

**目标：用户打开 `/` 时没有“加载中”的状态，只看到一个从未中断的画面——第一帧就是夜塘，水面与球体从中“长出来”。**

---

## 2. 用户可验收的结果

1. 打开 `/` 时，**任何时刻都不出现**“声音正在汇入水塘”及其说明句（失败重试除外）。
2. 首帧（服务端 HTML 到达的瞬间）就是夜塘底色，不是纯黑；底色与 `SceneCover` 完全一致，从首帧到水面就绪之间**肉眼看不到色差或闪动**。
3. 水面就绪后遮罩淡出，缓动统一（`ease-out`，约 600–800ms），球体与文字随后依次淡入，不一次性弹出。
4. 慢网（超过约 3 秒仍未就绪）才出现一圈极淡的涟漪反馈；仍不出文字。
5. 加载失败时保留“加载失败，点击重试”，行为不变。
6. `prefers-reduced-motion` 下无涟漪、无淡入位移，只做不透明度切换。
7. 水面首帧比现在更早出现（以 §5 的实测数字为准）。

---

## 3. 待核对点（开工前先查，不得凭猜测改）

- **N1**：`app/loading.tsx` 是否真的包住了 `(pond)` 布局与 `PersistentPondShell`。Next.js 的 `loading.tsx` 只包同级及以下的 `page` 与子段，要确认大字出现的具体时段，用录屏逐帧或 Performance 面板核对，别靠推断。
- **N2**：`SceneCover` 的撤除条件 `mountGl && !sceneReady`，以及 `sceneReady` 到底在 GL 初始化的哪一步置位（`PersistentWaterCore` 的 `onSceneReadyChange`）。
- **N3**：`SceneCover` 在 `artDir !== 'black'` 与 `'black'` 两种取值下底色不同，服务端 HTML 的底色需要知道当前 `artDir`，确认它是否在服务端可得（flag 来源）。若只有客户端可知，首帧底色取默认值，并说明差异。
- **N4**：当前 GL 初始化的耗时分布：着色器编译、纹理/音频拉取、`glSim` 数据请求各占多少。**先测再决定预加载什么**，不凭感觉。
- **N5**：`/` 以外进入水塘外壳的路由（`/tracks`、`/me` 等）是否共用 `app/loading.tsx` 与 `GlLoading`，改动是否影响它们。

---

## 4. 步骤

> 每一步独立可验、独立 commit。顺序：先测、再合并层、再换视觉、最后提速。

### Step 0 — 基线测量（只测不改）

- 📦 范围：无代码改动；记录写入 `docs/JOURNAL.md`。
- 做法：桌面 + 手机视口、Fast 4G 与不限速两档，用 Performance 面板或 `performance.mark` 记录：首字节、首次绘制、水合完成、`glSim.ready`、`sceneReady`。同时录屏存档作“改前”对照。
- 完成标准：得到上述时间点的表格，并回答 N1、N2、N4。
- 回滚点：无。

### Step 1 — 第一帧换成夜塘底色（层 ①）

- 📦 范围：`app/loading.tsx`、`app/layout.tsx`（仅内联首帧底色）、必要时 `app/globals.css`。
- 做法：
  - `loading.tsx` 删除全部文字与细线，只渲染一个全屏容器，背景与 `SceneCover` 的默认渐变（`radial-gradient(ellipse at 50% 50%, #030a09 0%, #010303 82%)`）**取同一份常量**，不要手抄两遍。
  - 在根布局的 `<body>`/`<html>` 上也设同一底色，避免 `loading.tsx` 撤掉到外壳水合之间出现一帧纯黑或白。
  - 保留 `aria-busy="true"`、`role="status"`，给屏幕阅读器一个不可见文案（`sr-only`），视觉上不出字。
- 完成标准：关闭 JS 或限速到极慢，页面一直是夜塘底色；刷新过程无白闪、无纯黑闪。
- 验证命令：`npx tsc --noEmit`；浏览器 Fast 4G 下录屏对比。
- 回滚点：还原 `app/loading.tsx` 与 `app/layout.tsx`。

### Step 2 — 合并为单层过渡（层 ② 并入 ③）

- 📦 范围：`src/features/home-pond/PondExperience.tsx`、`src/components/pond-gl-test3/overlay/GlLoading.tsx`、`src/components/pond-gl-test3/presentation/SceneCover.tsx`。
- 做法：
  - `PondExperience.tsx:161` 的渲染条件由 `(glSim.loading || glSim.error)` 改为只在 `glSim.error` 时渲染，`GlLoading` 只剩失败重试一个分支。
  - `GlLoading` 删除“声音正在汇入水塘”与“网络较慢，正在连接…”文字；慢网反馈交给 Step 4 的涟漪。
  - `SceneCover` 成为唯一的过渡层：背景取与 Step 1 同一份常量；淡出时长由现在的 `duration-150` 调到 §2 第 3 项的值。
- 完成标准：从打开到水面出现，全程不再有任何文字；失败重试仍能点。
- 验证命令：`npx tsc --noEmit`；定向 ESLint；断网/拦截 `glSim` 请求验证失败分支。
- 回滚点：还原这三个文件。

### Step 3 — 依次淡入，不一次性弹出

- 📦 范围：`PondExperience.tsx` 中 `GlNav`、`SphereOverlay`、`GlEclipse`、标签等挂载处，以及它们各自的入场样式。
- 做法：
  - 以 `sceneReady` 为起点，球体先淡入，随后导航与文字，间隔 100–150ms，缓动统一。
  - 复用现有 `scenePresence`、`--pond-route-duration` 等变量，不新造动画系统。
- 完成标准：水面淡出后，元素按顺序出现，没有突然出现的元素。
- 回滚点：还原入场样式。

### Step 4 — 涟漪反馈（仅慢网）

- 📦 范围：新增一个轻量组件（放入 `src/components/pond-gl-test3/presentation/`，注意该目录文件数不得超过 8，超了先建子目录），挂在 `SceneCover` 内部。
- 做法：
  - 约 3 秒仍未 `sceneReady` 才渲染；一圈极淡的涟漪从中心扩散，纯 CSS 动画，不引入 JS 动画库。
  - `motion-reduce` 下改为静态微弱光晕，不动。
  - 不出任何文字。
- 完成标准：Fast 4G 与 Slow 3G 下，3 秒后出现涟漪；正常网速下完全看不到。
- 回滚点：删除该组件及挂载行。

### Step 5 — 预加载，缩短等待本身

- 📦 范围：`app/layout.tsx` 或首页入口的 `<link rel="preload">`，以及 GL 初始化中可前置的步骤；具体取决于 Step 0 的 N4 测量结果。
- 做法：
  - 按 N4 的最慢项处理：关键着色器/纹理/首屏音频加 `preload` 或 `prefetch`；`glSim` 首屏数据在服务端或更早的时机发起请求。
  - 评估水面“先低分辨率/简化着色器出第一帧，再升到完整效果”，**只有 Step 0 证明着色器编译是瓶颈才做**，否则不做。
  - 每个预加载项都要在 Step 0 的同一表格里复测，**没有可测改善就撤销**。
- 完成标准：`sceneReady` 时间相比 Step 0 基线有可复述的缩短；若没有，如实记录“无明显收益”并撤销改动。
- 回滚点：还原预加载声明与前置请求。

### Step 6 — 验收与记录

- 📦 范围：`docs/JOURNAL.md`、`STATUS.md`、`TASKS.md`。
- 做法：桌面与手机视口各录一份“改后”视频，对照 Step 0 的“改前”；跑完整检查（§6）；把表格与结论写入 JOURNAL。
- 完成标准：§2 全部 7 项通过，或明确列出未通过项与原因。

---

## 5. 风险与取舍

- **首帧底色依赖 `artDir`**：若 `artDir` 只在客户端可知，服务端首帧只能用默认渐变；当 `artDir === 'black'` 时，会有一次“暗绿 → 纯黑”的微小变化，需要在 N3 确认后决定是否把该 flag 提到服务端。
- **去掉文字后慢网用户没有“正在加载”提示**：由 Step 4 的涟漪补位，但涟漪不是进度信息；若后续发现用户误以为卡死，再考虑加回极轻的文字，**不在本阶段预设**。
- **预加载不是越多越好**：过多的 `preload` 会抢占首屏关键请求，Step 5 必须逐项实测，没有改善就撤。
- **共享组件**：`SceneCover`、`GlLoading`、`app/loading.tsx` 可能被 `/test1`、`/test3` 等页面共用（见 N5），改动前先确认引用面，避免破坏冻结基线（`/test1` 为冻结基线，**不得改动**）。

---

## 6. 全程检查清单

- `npx tsc --noEmit`
- 改动文件的定向 ESLint
- 单个代码文件不超过 200 行；目录文件数不超过 8
- 本地 dev 开着时不要跑 `build`/`verify`（`.next` 会互踩）
- 本地 `.env.local` 连生产库，只做只读验收
- 视觉效果必须目验对照改前录屏，不能只靠结构断言就说“已解决”

---

## 7. 不做的事

- 不改 GL 水面渲染算法与场景内容。
- 不改路由、不改外壳持久化逻辑（`PersistentPondShell`）。
- 不为本阶段新增任何依赖。
- 不动 `/test1`。
