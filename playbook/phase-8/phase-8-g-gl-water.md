# P8-G — /test1 GL 渲染层 spike（three.js + R3F + 水位层级系统）

> **立项**：2026-06-12 用户拍板。**取代** overview 里的旧 `P8-W` gate（"WebGL 背景水面"），范围升级为"渲染层整体迁移 spike"。
> **装包批准**：`three` / `@react-three/fiber` / `@react-three/drei` 已批准进 `docs/STACK.md` 白名单（2026-06-12，同日已登记）。
> **决策背景**：SVG + d3-force 管线已到性能/效果天花板（自适应降级系统靠"关特效"保帧率 = 结构性上限）；用户的"水位换层"产品愿景（见 §3）需要逐像素折射，SVG 滤镜做不到。完整论证见 2026-06-12 对话。

---

## 0. 是什么 / 不是什么

### 是

- 新沙盒页 **`/test1`**：先与 `/` 同步，再逐步换成 GL 渲染层
- **three.js + R3F** 渲染 35 球 + 高度场水面（涟漪 / 折射 / 月光高光）
- **水位层级系统**：滚轮升降水位，球分水上 / 贴面 / 水下三态
- `/test1` 默认**关闭 1 点透视**（perspective=false，页面级 override）

### 不是

- ❌ **不改 `/` 与 `/test` 的任何现状**（首页默认零变化铁律照旧）
- ❌ **不删共享 SVG 管线里的 perspective 代码**——G2 只是 /test1 页面级默认关；真正删码留到"GL 替换首页"拍板后（G7 出口）
- ❌ 不碰 Wave 2 热点文件：`effects-config.ts` / `config/effects-presets.ts` / `globals.css` / `SphereNode.tsx` / `use-sphere-sim.ts` / `sphere-sim-setup.ts` 等**一律只读**
- ❌ 不做氛围特效全量 GL 迁移（星/雾/彗星等 DOM 氛围层暂时共用）；不做日食/彗星 GL 版
- ❌ 不做移动端 GL 适配（移动端继续走 SVG + MOBILE_EFFECTS，G7 再议）

**与 Wave 2 的关系**：G 线全部落在新文件（`app/test1/`、`src/components/pond-gl/`），与 Wave 2（splashIntro / S8/F9 拍板）零文件冲突，先后顺序由用户定。

---

## 1. 架构蓝图

### 保留层（一行不改，直接复用）

| 复用什么 | 在哪 |
|---|---|
| 球数据纯函数（computeNodeAttrs / buildClusterAssignment / halton / generateLinks / pad…） | `sphere-config.ts` |
| d3-force 力参数 | `sphere-sim-setup.ts` / `forces/`（**只读**；若与 SVG drag 耦合则把参数快照进 use-gl-sim 并注明出处） |
| 播放器 / 音频能量 | `PlayerProvider` / `use-audio-energy.ts` |
| 涟漪事件总线 | `bg-ripple:wave` / `bg-ripple:spawn` CustomEvent（GL 水面直接订阅） |
| 机位 / 光源锚点 | `POND_TILT_RATIO`（椭圆压扁）/ `MOON_ANCHOR`（月光方向） |
| /api/tracks 数据流、分组逻辑 | `Archipelago.tsx` 现有取数路径 |

### 替换层（GL 重写）

- 35 球 SVG 元素（每球 9-17 节点 + filter）→ **一个 InstancedMesh（一次 draw call）**，光晕在片元 shader 里按径向衰减算（对标 gradientGlow=C 方案视觉），不再有 feGaussianBlur
- 水面（caustics/skyReflection/moonPath 等 SVG 叠层的最终归宿）→ **高度场水面 shader**（本 spike 先做最小集：涟漪 + 折射 + 月光高光）

### 新增层

- **DOM 命中层**（`SphereOverlay`）：35 个绝对定位 div，承载标题 / 角标 / 点击 / 拖拽 / hover，每帧只写 transform。点击热区跟 sim 坐标走，**不受水下折射视觉偏移影响**。

### 关键约定

- **坐标系**：正交相机，世界坐标 = 屏幕像素坐标 1:1 ⇒ d3 sim 坐标直接当 GL 坐标用，零换算。
- **开关体系**：G 线 flag 走独立 `pond-gl/gl-flags.ts`（URL 参数范式抄 effects-config，但独立文件 → 不碰共享热点）。P8 全局铁律 1 的精神保留：每个 G 功能可单独开关、关 = 回上一步现状。
- **包体纪律**：PondGL 全链路 `next/dynamic` + `ssr: false`，仅 /test1 挂载 ⇒ 首页 main bundle 零增量（G3 验收项）。
- **行数/目录纪律**：每文件 ≤200 行（shader 字符串单独拆文件）、每目录 ≤8 文件。

### 目录规划

```
src/components/pond-gl/
  PondGL.tsx            # 入口：dynamic Canvas + 正交相机 + DPR≤2 + WebGL 失败回退 null
  gl-flags.ts           # G 线沙盒开关（glBase/glSpheres/water/wheelMode/artDir…）
  spheres/
    SphereInstances.tsx # instanced 球，每帧从 sim 写矩阵/颜色/播放态
    sphere-shader.ts    # 球片元：径向渐变球体 + halo falloff
    use-gl-sim.ts       # 建 sim（复用 sphere-config 纯函数 + 力参数）+ tick 桥
  overlay/
    SphereOverlay.tsx   # DOM 命中层：标题/角标/点/拖(阈值8px)/hover → 写 node.fx/fy
  water/
    use-ripple-fbo.ts   # 高度场 ping-pong（256² half-float，按性能可升 512²）
    ripple-shaders.ts   # 模拟 pass：波动方程 + 阻尼 + 滴水注入
    WaterSurface.tsx    # 合成 pass：基调 + 折射 + 月光 specular + 水位三态
    water-level.ts      # 水位 store + wheelMode 互斥 + 三态参数表
app/test1/
  layout.tsx            # robots noindex（抄 /test）
  page.tsx              # G1 = / 克隆；G2 关透视；G3 起挂 PondGL
```

### 依赖（G3 才执行安装）

- `three`（最新稳定版）+ `@react-three/fiber@^9`（React 19 配套）+ `@react-three/drei@^10`（只用 Instances / useFBO 级轻工具）
- ⚠️ `@react-three/postprocessing` **未批准**：bloom 先用 shader falloff 替代，G5 验收若不够亮 → 停下来按灰名单流程问

---

## 2. Steps（G1-G7，每步一个闭环）

### G1 — /test1 = / 克隆

- 📦 范围：`app/test1/layout.tsx`、`app/test1/page.tsx`（新建 2 文件）
- 做什么：复制 `app/page.tsx` JSX 为 /test1（同 Archipelago / 同 effects 来源 / PerfHUD 自带），标题加 `— /test1 GL sandbox` 后缀；layout 抄 /test 的 robots noindex
- **同步机制**：复用同一 Archipelago 组件 + 同一 effects 预设 ⇒ `/` 的后续改动自动跟进 /test1；G4 之后"同步"语义收窄为"同数据 + 同交互语义 + 共用氛围 DOM 层"
- 验收：/test1 与 / 并排肉眼一致；verify.sh 绿

### G2 — /test1 默认关 1 点透视

- 📦 范围：`app/test1/page.tsx`（行级改动）
- 做什么：baseEffects 上叠 `{ perspective: false }` 再传 Archipelago；URL `?perspective=1` 仍可临时开回对比
- 边界：**不动** `config/effects-presets.ts`（/ 与 /test 现状零变化）
- 验收：滚轮 = 普通锚点居中缩放（走 use-sphere-zoom 的非 perspective 分支，无消失点扩散）；Esc reset、拖拽 pan 正常

### G3 — 装包 + GL 画布骨架 + 深色水体基调

- 📦 范围：`package.json`（装 3 包）、`pond-gl/PondGL.tsx` + `gl-flags.ts`（新建）、`app/test1/page.tsx`（挂载行）
- 做什么：`npm install three @react-three/fiber @react-three/drei`；PondGL = dynamic Canvas（ssr:false）+ 正交相机 + DPR cap 2 + 全屏基调平面；基调两档可切（`artDir=deep` 深蓝墨绿渐晕 / `artDir=black` 纯黑，见 §3 艺术方向）；WebGL 不可用或 context lost → 渲染 null（/test1 的 SVG 全套还在，视觉 = G2 态）
- 挂载：GL canvas 垫在最底层，与 SVG 共存
- 验收：verify.sh 绿 + `npm run build` 后**首页 First Load JS 零增量**；/test1 见基调层；`glBase=0` = 回 G2 现状

### G4 — GL 球 + sim 接驳 + DOM 命中层（⏸ 验收必停）

- 📦 范围：`spheres/` 3 文件、`overlay/SphereOverlay.tsx`（新建）、`page.tsx`（glSpheres 切换）
- 做什么：use-gl-sim 用 sphere-config 纯函数 + 力参数建 35 球 sim（与 SVG 版同参，实施前先勘探真实代码）；SphereInstances 每帧写 instance 矩阵/颜色/播放态；球 shader 复刻"径向渐变球体 + halo"；SphereOverlay 承载标题/角标/点击播放（PlayerProvider.toggle）/拖拽（8px 阈值区分 click，pointermove 写 fx/fy）/hover；播放时其他球淡出 = GL 透明度 + overlay opacity 同步
- `glSpheres=1` → 隐 SVG 球组（display:none 级 CSS，不卸载）；`=0` → 回 SVG
- 暂不做：日食 / 彗星 / links 线 / focus 景深（GL 线后续按需补）
- 验收（**停，等用户**）：35 球外观接近现状；拖/点/hover/播放全正常；PerfHUD 帧率 ≥ SVG 版；关 flag 回 G2
- **G4 实际落地（2026-06-13，commit `744b64d`）**：球数实为 A=15 / B,C=36（"35"是旧文案）；球色走手动 `hexToSRGB` 直通（绕过 three `Color`/`ColorManagement`，否则自定义 shader 不编码回 sRGB → 暗一半）；加了 `TunePanel` 实时调色面板（亮度/对比度/饱和度/光晕/浓度 + localStorage）。

> ### ⚠️ G4 验收转折（2026-06-13）→ 方向 A 立项
>
> G4 浏览器验收暴露**结构性问题**：原设计"GL **独立** sim + 只隐 SVG 球 + 留 SVG 线/日食/缩放" = **两套互不相干的 sim**（坐标/布局/组/缩放各算各），必然错位（切组球不变线变 / 滚轮线缩球不缩 / 日食黑圈与播放白圈错位）。根因不是 bug，是 G4 这步定义的**内在矛盾**。
>
> **用户拍板【方向 A：GL 彻底取代 SVG】**（否决"GL 镜像 SVG sim 坐标"——因 P8-G 初衷是验证 GL 能否替代 SVG、突破性能天花板；镜像方案 SVG 仍跑、GL 退化成换皮叠加，验证不了性能）。
> **架构边界**（重要）：**渲染层（球 / 水 / 光）走 GL；命中层（点 / 拖 / hover）+ 文字 / UI 继续用薄 DOM overlay**——不是"一切皆 GL"（DOM 接交互在折射解耦 / 原生事件 / 无障碍上更优）。
>
> **P0 止血已落地**（commit `744b64d`）：glSpheres=1 时 SVG sim 层【整层退场】（scoped `<style>` 隐整个 `svg.cursor-grab`＋portal 日食 `data-eclipse-layer`），GL 成唯一渲染、错位消除。
> **P1（GL 跟 nav 点击切组的桥）跳过**：它是过渡期临时桥，终态 GL 接管 nav/groupId 唯一化会吸收它（见 P2-b）；过渡期切组走键盘 ←→（不写注定删的代码）。

### P2 — SVG 视觉搬迁（方向 A，2026-06-13 立项，插在 G4 与 G5 之间）

> **目标**：让 glSpheres=1 时 GL 渲染**对等 SVG 现状**（视觉＋交互），最终**卸载 SVG**（而非隐藏）。这是"GL 取代 SVG"的前置，也让 G5/G6 在干净 GL 基础上加水波水位、帧率对照才公平。
> **执行**：P2-a…f 每步一闭环、可单独 flag/回退；视觉步骤末尾 ⏸ 等用户验收。
> **红线照旧**：`effects-config` / `effects-presets` / `SphereNode` / `use-sphere-sim` / `sphere-sim-setup` / `globals.css` 一律只读；不改 `/` 与 `/test`；任一步必须改 `Archipelago`/`SphereCanvas` 才能推进 → **停下问**（首页零变化铁律）。不装新包。

- **P2-a 连接线（links）搬进 GL**
  - 📦 范围：`spheres/`（新建 GL 连接线渲染，如 `gl-links.ts` + Canvas 内加一个 `LineSegments`）
  - 做什么：cluster 连接线用 GL 画（`THREE.LineSegments`，每帧从 `simLinks` 写顶点，读**同一 GL sim 坐标**）；颜色 = src 球色、透明度复刻 SVG（线宽 GL 难逐线变 → 用 alpha 近似 `0.05+corr*0.13`）；播放时整组淡出（同 SVG `anyPlaying` opacity 0）
  - 红线：links 数据复用 `generateLinks`（sphere-config 纯函数）
  - 验收（⏸）：glSpheres=1 出现连接线，与 GL 球**对齐**、随拖拽/切组实时跟随；播放淡出正常

- **P2-b nav 切组 GL 接管 + groupId 唯一化（吸收 P1）**
  - 📦 范围：`use-gl-sim`（groupId 来源）+ **不碰 Archipelago 的**组切换 UI
  - 做什么：让 GL 响应"切组"。**首选方案**：/test1 page 提升 groupId state（键盘 ←→ + GL 侧独立的小 nav），glSpheres=1 时用 CSS 隐掉 Archipelago 的 nav（同 P0 的 scoped style 套路），GL 用自己的 nav → groupId 唯一来源在 GL 侧
  - 红线：不改 Archipelago/SphereCanvas；隐其 nav 走 scoped `<style>`（不改组件）
  - 验收（⏸）：点 GL nav / 键盘 ←→ 都能切组；A=15 / B,C=36 正确

- **P2-c 滚轮缩放＋平移搬进 GL（与 G6 水位滚轮统一）**
  - 📦 范围：`spheres/`（缩放/平移状态）、正交相机或世界 group 变换、`gl-flags` 接 `wheelMode`
  - 做什么：GL 接 滚轮=缩放（非 perspective 锚点居中）＋拖背景=平移＋Esc reset；**与 G6 的 `waterLevel` 滚轮互斥**（`wheelMode` 二选一，这里先做 `zoomFx` 分支）
  - 红线：命中层 overlay 坐标要跟随缩放（点击仍精准）
  - 验收（⏸）：缩放/平移手感对照 /test 非 perspective 分支；缩放下拖/点仍精准

- **P2-d 播放叙事 / 日食搬进 GL**
  - 📦 范围：`spheres/` 或 `water/`（播放聚焦的 GL 版）
  - 做什么：播放时其他球淡出（已有 dim）＋补"月光/聚焦"GL 版（对标 SVG EclipseLayer 的意境，GL 实现不强求 1:1，可与 G5 月光 specular 共用）
  - 验收（⏸）：播放聚焦感与 SVG 接近、无错位（同一 GL 坐标天然对齐）

- **P2-e 氛围层评估（星 / 雾 / aurora / 水塘特效）**
  - 📦 范围：决策＋记录（reviews/ 或 JOURNAL），按需少量搬迁
  - 做什么：逐个评估 `AmbientLayers`——**背景氛围大多 DOM 保留**（不影响球交互、搬 GL 收益低）；仅"必须逐像素 / 与水面交互"的才搬。产出一张"搬 / 留"清单
  - 验收：清单落文档；不盲目全搬

- **P2-f SVG 真正卸载＋帧率公平对照**
  - 📦 范围：`page.tsx`（glSpheres=1 时**卸载** SphereCanvas 而非隐藏）
  - 做什么：P2-a…d 让 GL 对等后，glSpheres=1 时 /test1 不再挂 SVG 球渲染（条件卸载，SVG sim 停跑）；此时 PerfHUD 帧率 = GL 真实单跑值
  - 红线：**仍不改 Archipelago 本身**——在 page 层条件不挂其 SphereCanvas；若 Archipelago 结构不允许 page 层卸载内部 SphereCanvas → **停下评估**（可能 /test1 改用精简版页面而非整体克隆）
  - 验收（⏸）：DevTools 确认 SVG 球 DOM 不存在 / sim 不跑；帧率为 GL 单跑真实值，对照 glSpheres=0 拍板 GL 是否达标

> **P2 完结 → 回 G5/G6**：GL 对等 SVG 后，G5（水波高度场＋月光）/ G6（水位三态）在干净 GL 基础上推进（下文原样）。G7 对比验收时 GL 已是完整渲染层。

### G5 — 水波第一层：高度场 + 月光（⏸ 验收必停）

- 📦 范围：`water/` 4 文件（新建）、PondGL 挂载行
- 做什么：256² half-float ping-pong 高度场（波动方程 + 阻尼）；**滴水来源三路**：① 指针移动/点击 ② `bg-ripple:wave` 事件桥（groupWave / hoverRipple 语义自动进水面）③ 拖球喂点（dragWake 语义）；合成 pass：基调 + 高度场梯度折射 + `MOON_ANCHOR` 方向月光 specular；`POND_TILT_RATIO` 接入涟漪椭圆压扁
- 验收（**停，等用户**）：涟漪手感对照 sirxemic/jquery.ripples demo；月光碎闪可见；`artDir` 两档并排对比拍板；桌面 60fps

### G6 — 水位层级系统（本 track 的 payoff，⏸ 验收必停）

- 📦 范围：`water/water-level.ts`（新建）、WaterSurface / SphereInstances 接 uniform、overlay 水位指示
- 做什么：
  - **wheelMode 互斥**：`waterLevel`（/test1 默认）/ `zoomFx` 二选一，gl-flags + 页面小按钮切换
  - 滚轮驱动 `uWaterLevel ∈ [0,1]`（映射球 z 域，带缓动）
  - **三态**（详表见 §3）：水上 = 清晰原色；贴面 |z−L|<0.06 = 持续注入宽涟漪（半径 2.5×r）；水下 = 折射偏移 ≤8px + 亮度 ×0.6 + 青蓝 tint
  - **穿越动画**：出/入水迸圈 + 注大滴 + 200ms 弹动；**限流**：单帧 >6 球穿越 → 合并为一道大涟漪
  - 水位指示：屏幕右缘细刻度（DOM），滚轮时淡入
- 验收（**停，等用户**）：滚轮升降水位三态正确；快速扫水位不掉帧、无水花风暴；wheelMode 切换互斥正常；水下球点击仍精准（热区走 sim 坐标）

### G7 — 对比验收 + 去留拍板

- 📦 范围：`reviews/`（对比报告）、STATUS / JOURNAL / TASKS
- 做什么：/test1 vs /test 并排评测（帧率 / 视觉上限 / 交互完整性 / 包体）→ 一页报告；**用户拍板**三选一：
  - **a)** GL 线升级为首页方案 → 另立 track（特效全量迁移 + 移动端策略 + 首页替换 + SVG perspective 删码）
  - **b)** 继续打磨 G 线（列下一批目标）
  - **c)** 冻结归档（保留 /test1 与代码，记录原因）
- 验收：报告落 reviews/ + 拍板进 JOURNAL + STATUS/TASKS 同步

---

## 3. 技术规格（G5/G6 实施基准）

### 用户产品愿景（2026-06-12 原话要点，验收对照表）

1. 音乐圆圈保持现状不做大改动
2. 圆圈存在层（已有：z / baseLayer）
3. 滚轮升降水面所在的层
4. 水上 / 水下 / 贴面差异：水下折射、浮出有动画、水上更清晰、贴面更广涟漪
5. 滚轮缩放做成可开关 fx，与水位滚轮互斥
6. 纯黑背景的水效问题 → 本 playbook 解法：**不加背景图**，用"深色水体基调 + 月光 specular"让水可见（水靠扭曲内容 + 高光被看见）

### 水位三态

| 态 | 判定 | 视觉 |
|---|---|---|
| 水上 | z > L + 0.06 | 清晰原色，无折射；可选淡接触阴影投在水面 |
| 贴面 | \|z − L\| ≤ 0.06 | 持续微涟（注入半径 2.5×r、低幅高频）；球体原色 |
| 水下 | z < L − 0.06 | 折射偏移 ≤8px（高度场梯度驱动）+ 亮度 ×0.6 + 青蓝 tint；越深越暗（线性到 ×0.45 封底） |

### 滴水注入表

| 来源 | 半径 | 强度 | 备注 |
|---|---|---|---|
| 指针移动 | 小 | 低 | 节流 ~30Hz |
| 点击 / clickSplash 语义 | 中 | 高 | 一次性 |
| `bg-ripple:wave` 事件 | 按 detail.size | 按 prio | groupWave / hoverRipple 自动接入 |
| 拖球（dragWake 语义） | 小 | 中 | 跟球速度 |
| 贴面球常驻 | 2.5×r | 低 | 每球限频 |
| 穿越水面 | 3×r | 高 | 单帧 >6 球合并为一道大涟漪 |

### 艺术方向两档（G5 拍板）

- `artDir=deep`（推荐默认）：亮度 2-5% 的深蓝墨绿渐晕底 + 月光高光——夜塘感，水处处可读
- `artDir=black`：纯黑底，水只在"月光高光 + 被折射的球"处存在——更冷更神秘，易读性弱

### 性能预算

- 桌面 60fps（水面 sim + 合成 ≤2ms/帧 量级）；高度场 256² 起步，富余再升 512²
- DPR cap 2；`document.hidden` 时暂停 RAF / sim
- G4/G5/G6 每步用 PerfHUD 对照 /test 同场景帧率，**GL 版不得低于 SVG 版**（低了 = 停下来报告）

---

## 4. 风险与回退

- 每步 flag 化：任意 flag 关 = 回上一步现状；全关 = G2 态（纯 SVG）
- WebGL 不可用 / context lost → PondGL 渲染 null，SVG 全套兜底
- R3F v9 需 React 19 ✓（本项目 19.x）；three 为 ESM，Next 16 client 组件直接用
- 不碰共享热点文件 ⇒ 与 Wave 2 / 主干零合并风险
- spike 全程不动 `/` 与 `/test`：最坏情况损失 = /test1 + pond-gl/ 两个新目录，删除即回滚

## 5. 执行模式与停下条款

- **模式**：沿用 P8 松绑精神——step 内自动继续，**G4 / G5 / G6 末尾必停**等用户视觉验收；G1/G2/G3 完成后简报不等回复直接下一步。用户说"**跑 G**"即从 G1 开始。
- **触发停下问用户**：
  - 想装任何新包（含 @react-three/postprocessing）
  - GL 帧率低于 SVG 版同场景
  - 任何步骤发现必须改共享文件（effects-config / SphereNode / use-sphere-sim / sphere-sim-setup 等）才能推进
  - 水下折射引发点击/拖拽体验问题且 ≤8px 限幅救不回
  - 同一文件改 3 次还在改

## 6. 完结标准（G 线收口 gate）

- [ ] G1-G6 全部验收通过（用户浏览器实测）
- [ ] /test1：35 球拖/点/hover/播放 100% 正常 + 水位三态正确 + 桌面 60fps
- [ ] 首页 First Load JS 与 G 线开工前一致（dynamic import 验证）
- [ ] G7 对比报告落 `reviews/` + 用户拍板 a/b/c + JOURNAL 记录
- [ ] STATUS / TASKS 同步收口
