# P8-G — /test1 GL 水塘（总伞 + G 线地基）

> **立项**：2026-06-12 用户拍板（取代 overview 旧 `P8-W` gate）。**装包批准**：`three` / `@react-three/fiber` / `@react-three/drei` 已进 `docs/STACK.md` 白名单（2026-06-12）。
> **定位演进（2026-06-14 重定）**：本 track 已从"**试探 GL 能否替代 SVG 的 spike**"毕业为"**在 /test1 上用 GL 正式重建水塘、持续优化**"。GL 方向已定，**取消去留拍板（原 G7）**；水面方向从"程序化叠层"改为"**全屏动态扭曲**"（对标 [sirxemic/jquery.ripples](https://sirxemic.github.io/jquery.ripples/)）。
> **本文 = 总伞 + G 线**：红线 / 编号 / 架构 / 执行模式 / 弃用记录在此。详细子文档：
> - **H 线 · 水面子系统** → [`phase-8-h.md`](./phase-8-h.md)（核心：动态扭曲水面 + 水位 + 运动模型）
> - **I 线 · 去 SVG + 新组件** → [`phase-8-i.md`](./phase-8-i.md)
> - **RTT 技术调研** → [`phase-8-g5d-rtt-research.md`](./phase-8-g5d-rtt-research.md)（H 线实施圣经）
> - **旧版存档（复盘对比）** → [`phase-8-g-gl-water.md`](./phase-8-g-gl-water.md)（spike 时期原貌：G1-G7 + P2 对等 + 去留拍板 + 折射三态）

---

## 0. 是什么 / 不是什么（重定 2026-06-14）

### 是

- **`/test1`** = 用 GL（WebGL，经 three.js + R3F）重建的水塘，**持续优化的开发面**（不是临时 demo）。
- 渲染层：InstancedMesh 球 + **全屏动态扭曲水面**（jquery.ripples 式涟漪折射）+ GL 日蚀/聚焦 + 后续新组件。
- **水位 = 全局变量**：滚轮 / 触控缩放手势升降；水位以下的**所有层**被全屏涟漪实时扭曲，水位以上清晰。
- `/test1` 默认**关 1 点透视**——深度感改由"水"来给。

### 不是

- ❌ 不再是"试探 GL 能否替代 SVG 的 spike"：**GL 方向已定**，无去留拍板（原 G7 取消）。
- ❌ 不改 `/` 与 `/test` 的任何现状；**不删共享 SVG 代码**（/test1 只是不再挂它，`/` 与 `/test` 仍用）。
- ❌ 主路径**不装新包**（`three` + `drei` 已够；`GPUComputationRenderer` 随 three 不算新包；要装 `@react-three/postprocessing` / `use-shader-fx` 必**停下问**）。
- ❌ 不做移动端（桌面优先，移动端 lite 留未来）。
- ❌ 本期**不搬上首页**（GL→首页是更远将来，另立 track）。

### 红线（硬，hooks/铁律 + 自觉）

- `/` 与 `/test` 零变化；**共享 SVG 代码只读不删**（`Archipelago` / `SphereCanvas` 仍服务 `/` 与 `/test`）。
- 只读不碰：`effects-config` / `config/effects-presets` / `SphereNode` / `use-sphere-sim` / `sphere-sim-setup` / `globals.css`。
- 主路径**零新包**；任何装包**停下问**。
- 每文件 **≤220 行**（以 `wc -l` 计，含注释空行；接近上限先拆，不删注释充数）、每目录 **≤8 文件**（`docs/CONVENTIONS.md` §1，hooks 强制；shader 字符串单独拆文件）。
- 任何新视觉模块**必在控制台 `ScenePanel` 加对应开关**（铁律 memory `feedback_test1_panel_buttons`）。

---

## 1. 编号系统（G / H / I 三条线）

> 本 track 已长成三块独立的活，按项目惯例（A/B/C/D/E/F 线 + G）给后两块各开一条线、**各占独立文档**。`G1–G4` 已提交、名字不动。

```
═══ G 线 · GL 地基　✅ 已完成（本文 §3）═══════════════════════
  G1 /test1 克隆   G2 关透视   G3 装包+Canvas+基调   G4 GL球 instanced + DOM命中层

═══ H 线 · 水面子系统（核心，进行中）→ phase-8-h.md ════════════
  H1 RTT spike  H2 整合扭曲  H3 水位遮罩  H4 涟漪交互  H5 运动模型  H6 参数板

═══ I 线 · 去 SVG + 全新组件（开放）→ phase-8-i.md ═════════════
  I1 去 SVG + GL nav   I2 日蚀 GL 重做   I3 新组件首批   ── 收口线（并入 I）──
```

**老编号 → 新编号 对照**（防混）：
- 旧 `G5-D`（含 `G5-D0` spike）/ `GW0–GW5` → **H1–H6**（[`phase-8-h.md`](./phase-8-h.md)）
- 旧"阶段三 / GP（SVG 对等）" / 旧 `P2-a…f` → **I 线**（改为"去 SVG + 重设计"，不再追平 SVG）
- 旧 `G5`（程序化水面 `eb5e11d`）/ `G6`（折射三态）/ `G6-1`（淡出覆盖）→ **弃用/兜底**，水全走 H 线（见 §8）
- 旧 `G7`（去留拍板）→ **取消**

**commit scope**：全沿用 `feat(p8-g): H1 …` / `feat(p8-g): I1 …`（`p8-g` 当 GL 总伞，省改）；结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

---

## 2. 架构蓝图

### 保留层（复用，不改）

| 复用什么 | 在哪 | 备注 |
|---|---|---|
| 球数据纯函数（computeNodeAttrs / buildClusterAssignment / halton / generateLinks / pad…） | `sphere-config.ts` | 只读 import |
| d3-force 力参数 | `sphere-sim-setup.ts` | **只读**；已快照进 `gl-sim-setup.ts`（G4 期 commit `744b64d`）并注明出处行号 |
| 播放器 / 音频能量 | `PlayerProvider` / `use-audio-energy.ts` | 运动公式可读音频能量 |
| 涟漪事件总线 | `bg-ripple:wave` CustomEvent | GL 水面/球直接订阅（已接） |
| 光源 / 机位锚点 | `MOON_ANCHOR`（月光方向）/ `POND_TILT_RATIO` | 月光 specular / 椭圆压扁 |
| 取数 | `/api/tracks`（`use-gl-sim` **已独立取数**） | I1 去 SVG 后不依赖 Archipelago |

### 渲染层（GL）/ 命中·UI 层（DOM）

- **GL（被水扭的世界）**：InstancedMesh 球（`SphereInstances`）、扭曲水面、GL 日蚀/聚焦、新组件。
- **DOM（不被水扭）**：`SphereOverlay`（命中：标题/角标/点/拖 8px 阈值/hover，每帧只写 transform，热区走 sim 坐标）、GL nav（I1 新建）、`ScenePanel` / 参数板 / `WaterLevelIndicator` / 标题 / 登录。
- **架构边界**：渲染走 GL；命中/文字/UI 走薄 DOM overlay——折射解耦、原生事件、无障碍更优。**DOM 在 canvas 之上 → 天然不进 shader、不被扭，点击恒精准**（无需额外处理）。

### 水面子系统架构（H 线核心，RTT + ping-pong）

```
[水位以下的所有层] ──渲进──▶ 内容 FBO ──┐
                                         ├─▶ 合成扭曲 pass（按高度场梯度偏移 UV + 月光高光）──▶ 屏幕
[ping-pong 高度场 sim] ──高度纹理──────┘
[水位以上的层（露头）] ───────────────────────────────────────清晰盖在最上 ▲
```
- **高度场 sim**：双 FBO ping-pong 离散波动方程（256² half-float，**Nearest**），鼠标/对象注入升余弦凸包滴水。逐行 GLSL + 常量见调研报告 §4 路径 1。
- **风险阀梯**：手搓 ping-pong 别扭 → 换 three 自带 `GPUComputationRenderer`（零包，合成 pass 不动）→ 再不行才装包（必停问）。
- **深度遮罩纠偏**（必读）：水位 `L` 是**深度**不是屏幕 Y。**不能** `step(L, vUv.y)`；正解 = 按**整颗对象 z vs L** 分到"水下内容 FBO（被扭）/ 露头清晰层（盖上）"两拨渲。

### 关键约定

- **坐标系**：正交相机，世界坐标 = 屏幕像素 1:1 ⇒ d3 sim 坐标直接当 GL 坐标，零换算。
- **开关体系**：flag 走独立 `pond-gl/gl-flags.ts`（不碰共享 effects-config）；每个功能可单独开关、关 = 回上一步。
- **包体纪律**：`PondGL` 全链路 `next/dynamic` + `ssr:false`，仅 /test1 挂载 ⇒ 首页 main bundle 零增量（已验，+89B≈0）。
- **行数/目录**：≤220 行 / ≤8 文件；水 sim 的 GLSL 字符串单独拆文件；`water/` 接近 8 文件时拆子目录。

### 目录规划（现状 + H/I 新增）

```
src/components/pond-gl/
  PondGL.tsx            # 入口 Canvas（dynamic ssr:false）+ 渲染流（H2 重构：内容 FBO→扭曲 pass→露头层）
  gl-flags.ts           # 沙盒 flag（H 线加扭曲水面相关 flag）
  base-tone-shader.ts · BgImage.tsx
  spheres/              # SphereInstances / sphere-shader / use-gl-sim / gl-sim-setup / sphere-tuning（5）
  overlay/              # 现状(4)：SphereOverlay / ScenePanel / TunePanel / WaterLevelIndicator；待建：✏GLNav(I1)、✏波纹参数板(H6) → 共 6
  water/                # water-level.ts（G6-1）+ H 线新建：内容FBO / ping-pong sim / 扭曲合成 / GLSL
                        #   旧 use-ripple-fbo.ts / ripple-shaders.ts / WaterSurface.tsx = 弃用或改造（见 §8）
                        #   ⚠ 文件数接近 8 → 拆 water/ripple/ 子目录
app/test1/{layout,page}.tsx   # I1：page 从"克隆首页+GL叠加"重写为"干净 GL 页"
```

### 依赖

- **"新包"定义**：`package.json` 的 `dependencies` 新增条目才算新包；`three/examples/jsm` 内的东西（`GPUComputationRenderer` / `Pass.js`）随 three 一起装、**不算新包**。
- 已装：`three@^0.184` · `@react-three/fiber@^9` · `@react-three/drei@^10`。
- **保险阀（不算新包）**：`GPUComputationRenderer`（`three/examples/jsm/misc/`，随 three）。
- **灰名单（须 `npm install` = 新包，装必停问）**：`@react-three/postprocessing`、`@funtech-inc/use-shader-fx`。

---

## 3. G 线 · GL 地基（✅ 已完成）

| 步 | 做了什么 | commit |
|---|---|---|
| **G1** | `/test1` 克隆 `/`（同 Archipelago / effects / PerfHUD）；layout 抄 /test 的 robots noindex | `dd9c9e1` |
| **G2** | 页面级默认关 1 点透视（`?perspective=1` 可临回对比）；不动 `effects-presets` | `dd9c9e1` |
| **G3** | 装 three/R3F/drei；`PondGL` = dynamic Canvas（ssr:false）+ 正交相机 + DPR≤2 + 基调层（`artDir` deep/black）；WebGL 失败→渲染 null 兜底；首页 First Load JS +89B≈零增量 | `dd9c9e1` |
| **G4** | GL 球 InstancedMesh（一次 draw call，A=15 / B,C=36）+ 径向渐变球体 + halo shader；`SphereOverlay` DOM 命中层（点/拖/hover/播放）；`TunePanel` 实时调色（hexToSRGB 直通绕过 ColorManagement） | `744b64d` |

> **G4 验收转折（2026-06-13）→ 方向 A**：原"GL 独立 sim + 只隐 SVG"= 两套 sim 必错位（根因是内在矛盾、非 bug）。用户拍板 **GL 彻底取代 SVG**。**P0 止血**（`744b64d`）：glSpheres=1 时 scoped `<style>` 隐整个 `svg.cursor-grab` + portal 日食 `data-eclipse-layer`，GL 成唯一渲染。过渡期切组走键盘 ←→。
> ⚠ 注：P0 只是**隐**藏 SVG（display:none），其 d3 sim 仍后台空跑 → **I1 才真正卸载**。

---

## 4. H 线 · 水面子系统 → 见 [`phase-8-h.md`](./phase-8-h.md)

> 核心：全屏动态扭曲水面（RTT + ping-pong）+ 水位深度遮罩 + 涟漪交互 + 对象运动模型 + 参数板。含**需求规格 v1（锁定锚点）**与 H1–H6 详细步骤。**起手前先 commit 归档 G6-1**（见 §6）。

## 5. I 线 · 去 SVG + 全新组件 → 见 [`phase-8-i.md`](./phase-8-i.md)

> 去 SVG（/test1 卸载、不删共享码）+ 日蚀 GL 重做 + 新组件首批；**收口线**并入此线。I1 可从 H1–H3 稳定后并行。

---

## 6. 执行模式与停下条款

- **起手硬前置**：开 H1 前**必做** `git commit` 归档 G6-1（`water-level.ts` + 球淡出覆盖 + matRef 修 uniform），把探索态快照下来，再开 H1 实验（干净分开、好回退）。
- **模式**：lane 内自动继续；**H1–H6 / I1–I3 每步末尾 ⏸ 必停**等用户浏览器视觉验收（视觉/交互只有用户能判）。
- **dev/build 互踩**（memory `project_dev_build_shares_next`）：用户开着 `npm run dev`（3001）时**别跑 `npm run build`/完整 verify.sh**（冲 `.next` 致 404）；只跑 `tsc --noEmit` + `npm run lint`（安全），生产构建等用户停 dev 后再跑。
- **触发停下问用户**：
  - 想装任何新包（含 `@react-three/postprocessing` / `use-shader-fx`）。
  - H1 spike 离屏渲染在本环境跑不通（且 `GPUComputationRenderer` 也救不回）。
  - 任何步骤发现**必须改共享/红线文件**才能推进。
  - 帧率明显掉、`prefers-reduced-motion` 之外仍晕眩。
  - 同一文件改 3 次还在改 → 报告"可能在退步，建议回滚"。
- **H1 离屏渲染失败判定树**：① FBO 创建/读取就失败 → 直接路径2 `GPUComputationRenderer` 或停下问；② FBO 可读但**黑屏** → 查翻车 #2(`setRenderTarget(null)`)/#3(autoClear)/#6(正优先级夺循环)；③ FBO 对但**sim 不累积/不动** → 查 #1(读写同 target)/#5(负优先级)/#7(frameloop)；④ 逐条排查无果 → 换路径2；仍不行 → 停下问。（翻车编号见调研报告 §3）

## 7. 风险与回退

- **每步 flag 化**：任意 flag 关 = 回上一步；全关 = G2 态（纯 SVG）。
- **离屏渲染（唯一真风险）**：H1 二分法先烧 → 风险阀梯 手搓 `useFBO` → `GPUComputationRenderer`（零包）→ 装包（必停问）。翻车八条修法见调研报告 §3。
- **WebGL 不可用 / context lost** → `PondGL` 渲染 null，SVG 兜底（I1 卸 SVG 后，/test1 需保留一个非 GL 兜底视图或接受空塘——I1 实施时决定）。
- **不碰共享/红线文件** ⇒ 与主干零合并风险；最坏损失 = /test1 + pond-gl/，删除即回滚。
- **起手前**：先 `commit 归档 G6-1`（探索存档：`water-level.ts` + 球淡出覆盖 + matRef 修 uniform），与 H1 实验干净分开。

## 8. 弃用 / 取消记录（防止误读历史）

| 旧条目 | 状态 | 说明 |
|---|---|---|
| 旧 G5 程序化水面（commit `eb5e11d`） | **弃用** | 当时手搓 ping-pong 离屏渲染没跑通 → 落地的是**纯解析涟漪**（`use-ripple-fbo.ts` 的 `MAX_RIPPLES` 向量存储，**非 FBO**）；H1 重新挑战 RTT+ping-pong（调研已证可行）取代之 |
| 旧 G6 折射三态（z>L+0.06 / 折射≤8px / 变暗×0.6 / 青蓝 tint） | **弃用** | 改为 H3"水上清晰 / 水下被全屏涟漪扭"；明确**不要**变暗滤镜（见 [`phase-8-h.md`](./phase-8-h.md) 需求规格 v1 第 4 项） |
| 旧 G6-1 球淡出覆盖（工作树/将归档） | **降级兜底** | 扭曲跑通后由 H 线取代；保留代码作 RTT 不稳时退路 |
| 旧 G7 去留拍板（a/b/c） | **取消** | GL 方向已定；/test1 持续优化，上首页是更远将来另立 track |
| 旧 P2 / GP（SVG 视觉对等、卸载 SVG） | **重构为 I 线** | 不再"追平 SVG"，改"去 SVG + 全新设计"；其中"卸载 SVG" → I1，"日食搬 GL" → I2 |
| 旧"水下折射三态表 / 滴水注入表 / artDir 两档" | **部分留作参考** | 月光/常驻微波/穿越限流的语义沿用；折射"变暗+tint"那套作废；完整旧表见旧版存档 [`phase-8-g-gl-water.md`](./phase-8-g-gl-water.md) |
