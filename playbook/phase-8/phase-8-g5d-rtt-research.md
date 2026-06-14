# P8-G5-D — 水面动态扭曲（render-to-texture + 全屏涟漪）技术调研报告

> **产出日期**：2026-06-14
> **范围**：纯调研。对照 [`phase-8-h.md`](./phase-8-h.md)「需求规格 v1」（原 `G5-D` 已重编号为 **H 线**，本报告标题保留 G5-D 作历史追溯标签）。**本报告产出过程未改任何项目代码、未装任何包。**
> **目标效果（一句话）**：垂直俯视一个塘，水面高度 = 可滚轮升降的全局变量 `L`；水位 `L` 以下的所有层（音乐圆圈/背景图/贴图/小鱼…）被**全屏水波实时扭曲**（对标 [sirxemic/jquery.ripples](https://sirxemic.github.io/jquery.ripples/)），水位以上清晰、画最上、不扭；含鼠标移动/点击泛涟漪并扩散。❌ 不要"给球加滤镜"、❌ 不要"纯半透明膜"、❌ 不要"静态无交互"。
> **已确认技术栈**（`package.json`）：`next@16.1.6` · `react@19.2.3` · `@react-three/fiber@^9.6.1` · `@react-three/drei@^10.7.7` · `three@^0.184.0`。正交相机、世界坐标=屏幕像素 1:1，DOM 命中层叠在 GL 之上不可被扭。

---

## 0. TL;DR（给路线决策）

1. **不存在"装一个库就完事"的方案。** 能给你 jquery.ripples 那种"会扩散的全屏涟漪 + 折射"的现成 R3F 库，要么闭源（Mancini），要么无 license（WaterSurface），要么停更且未在 R3F v9/three r184 测过（use-shader-fx）。
2. **最契合的是把 jquery.ripples 算法（MIT）直接移植进 drei `useFBO`** —— 纯 `three + drei`，**零新包**。其全部数学已扒到逐行 GLSL（见 §4 路径 1），约 100 行 shader，是"会扩散的涟漪 + 梯度折射"的最小可抄实现。
3. **你之前 ping-pong 没跑通，根因几乎可确定**（playbook 点名的四个嫌疑全坐实）：`autoClear` 冲掉累积 / `useFrame(fn, priority>0)` 夺走渲染循环却没补渲主场景 / 读写同一个 target / float target 配了 LinearFilter。逐条修法见 §3。
4. **保险阀**：手搓 ping-pong 若仍别扭，换 **three 自带的 `GPUComputationRenderer`**（`three/examples/jsm/...`，随 three 而来，**不算新包**），它把 ping-pong/swap/autoClear/能力检测全包了，官方 `webgl_gpgpu_water` 即水面高度场，近乎可抄。
5. **关键纠偏**：`MeshTransmissionMaterial` / `MeshRefractionMaterial` **不是这活该用的工具**——它们折射的是"3D 玻璃几何体的法线"，不是"俯视平面上水位线以下的一整片屏幕"。正解永远是 **FBO 抓场景 → 全屏 pass 按高度场梯度偏移 UV**。
6. **第一个半天 spike（G5-D0）= 路径 1 的"二分法"**：先单独验 RTT（假 sin 偏移），再加 ping-pong 高度场。先烧掉"离屏渲染稳不稳"这个唯一真风险。

**推荐排序**：路径 1（手搓 useFBO，零包，首做）→ 路径 2（GPUComputationRenderer，零包保险阀）→ 路径 3（装包，需审批，最后手段）。

---

## 1. 候选方案对比表

| # | 方案 | 核心技术 | 全屏扭"活动场景内容"? | 会扩散的鼠标涟漪? | 像 jquery.ripples? | License | 需新包? | R3F v9 / r184 兼容 |
|---|---|---|---|---|---|---|---|---|
| **A** | **手搓 jquery.ripples 移植 → drei `useFBO`** | 双 FBO ping-pong 波动方程 + 梯度折射 | ✅（内容渲进 FBO 再扭） | ✅ | **它本体** | MIT | **否** | ✅ 自写可控 |
| **B** | **three `GPUComputationRenderer`**（gpgpu_water） | 官方 GPGPU 高度场，内部 ping-pong | ✅ | ✅（cos 落差注入） | 同源，质感≈ | MIT | **否**（随 three） | ✅ 纯 client |
| **C** | `@funtech-inc/use-shader-fx`（`useRipple`/`useFluid`） | 真 ping-pong FBO；fluid 是 NS 流体 | ✅（喂它你的场景 RT） | ✅（fluid 更强） | ✅ | MIT | **是**（+`three-stdlib` peer） | ⚠️ 2024-08 起停更，未在 v9/r184 测 |
| **D** | `nhtoby311/WaterSurface` | 法线图水面 + `RippleFX`（包了 C） | ❌ 只是水面 | ✅（实为 C） | 间接 | **无 license（法律风险）** | 是（C + smoke.png） | ❌ 锁 v8/React18 |
| **E** | `taiyuuki/webgl-water-ripple` | **滚动法线图**，无物理 | ❌ 只扭一张图 | ❌ **无鼠标交互** | ✗ | MIT | 是（`glslCanvas`） | N/A（非 three） |
| **F** | `water-simulation.vercel.app`（Mancini） | R3F 焦散+水珠，全场景重型 | ✅ 但闭源 | ✅ 但闭源 | 不同路子（更重） | **闭源/无** | — | 拿不到源码 |
| **G** | `diver-jay/r3f-drei-water-caustics-effect` | 世界空间投影焦散 + 流体交互面 `addDrop()` | △（投在 mesh 上，非通用全屏） | ✅（`addDrop`） | 焦散向，非涟漪透镜 | MIT | **是**（`@react-three/postprocessing`） | ✅ **已跑在同款栈** |
| **H** | drei `RenderTexture` / `MeshTransmissionMaterial` | 内置离屏 / 玻璃折射 | RenderTexture ✅ / 透射材质 ✗ | 需自接 | △ | MIT | 否 | ✅ |
| **I** | Codrops 2019 `WaterTexture`（Velasquez） | CPU canvas 画涟漪→RGB 位移图→后期扭 | ✅（架构同你） | ✅（鼠标轨迹） | 架构同，涟漪非物理扩散 | 参考级（无 repo） | 旧版用 `postprocessing` | 需改写 |

---

## 2. 详细卡片（按 6 点模板）

### A. 手搓 jquery.ripples 移植 → drei `useFBO`　⭐ 首推

1. **链接 / License**：算法源 [sirxemic/jquery.ripples](https://github.com/sirxemic/jquery.ripples)（[demo](https://sirxemic.github.io/jquery.ripples/)），**MIT**（Pim Schreurs, 2017，可自由抄进项目）。维护向 fork：[lolrazh/enhanced-jquery-ripples](https://github.com/lolrazh/enhanced-jquery-ripples)（同 MIT）。
2. **核心技术**：双纹理 ping-pong 高度场。`.r`=高度、`.g`=速度。每帧一步离散波动方程：`vel += (4邻居高度均值 − height) * 2.0`（离散拉普拉斯回复力）→ `vel *= 0.995`（阻尼，唯一能量损耗）→ `height += vel`（半隐式欧拉）。折射 pass：用高度场对 +x/+y 邻居取单边梯度重建法线，`offset = -normalize(cross(dy,dx)).xz`，按 `offset * perturbance`（默认 0.03）偏移背景 UV，再叠假高光。逐行 GLSL 见 §4。
3. **怎么 RTT / 注入鼠标**：RTT = 两个 `useFBO(256,256,{type:HalfFloatType,minFilter:NearestFilter})`，`useFrame` 里 `setRenderTarget(write) → render(simScene) → setRenderTarget(null)` 后 swap。鼠标涟漪 = 在指针 UV 处加**升余弦凸包** `drop = 0.5 - 0.5*cos(PI*max(0,1-dist/radius))` 进 `.r`；强度移动 `0.01`、点击 `0.14`，半径默认 20px。
4. **契合度**：**最高**。全屏扭曲 ✅（把"水位以下内容"渲进内容 FBO 当背景喂入）；会扩散涟漪 ✅；水位遮罩 = 自己加（见 §5 纠偏）；像不像 = **它就是 jquery.ripples**。
5. **新包 / 性能 / 兼容**：**零新包**。性能大头是 256² sim + 一道全屏合成，与对象数量无关（合规格 §7）；DPR/分辨率可调降级。R3F v9/r184 完全可控。
6. **落地成本 / 风险**：算法风险=0（逐行已知）；唯一风险是 R3F 离屏管线接线——正是你上次翻车点。缓解：§4 的二分法 spike + §3 修法清单。**风险收敛到最小的路径。**

### B. three `GPUComputationRenderer`（官方 gpgpu_water）　⭐ 保险阀

1. **链接 / License**：[`GPUComputationRenderer.js`](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/misc/GPUComputationRenderer.js)，例子 [`webgl_gpgpu_water`](https://threejs.org/examples/#webgl_gpgpu_water)，**MIT**（随 three）。
2. **核心技术**：官方 GPGPU 帮手，内部就是双 RT ping-pong（`currentTextureIndex` 自动 swap）。水例用一个自依赖 `heightmap` 变量，`.x`=当前、`.y`=上一帧，`newHeight = ((N+S+E+W)*0.5 - prev) * viscosity`，鼠标 cos 落差注入。从邻居落差算法线 → 正好喂折射。
3. **怎么 RTT / 注入鼠标**：完全不碰 `setRenderTarget`——`gpu.compute()` 一行，`gpu.getCurrentRenderTarget(v).texture` 取高度纹理。鼠标 = 改 `uniforms.mousePos/mouseSize`。
4. **契合度**：高。把高度场当涟漪源，忽略它的 3D mesh 渲染，改成 2D UV 位移即可。质感与 jquery.ripples 同源（离散波动场）。
5. **新包 / 性能 / 兼容**：**不算新包**（`three/examples/jsm`，已装 three）。默认 `FloatType + NearestFilter`（安全组合）。纯 client，放进 `'use client'` 的 pond-gl 组件；只额外 import 同包 `Pass.js`，Next 16 ESM 解析 OK。
6. **落地成本 / 风险**：**最低管线风险**——`init()` 返回能力检测错误字符串，帮你定位"浮点 RT 不支持"。一次性消除翻车点 #1/#2/#3/#4/#6。代价：略不"R3F 范"（命令式），耦合 three 内部 example（升级 three 留意路径）。**手搓若仍别扭，直接换它。**

### C. `@funtech-inc/use-shader-fx`（`useRipple` / `useFluid`）

1. [repo](https://github.com/FunTechInc/use-shader-fx) · [npm](https://www.npmjs.com/package/@funtech-inc/use-shader-fx)（v1.1.43）· **MIT**。
2. **真 ping-pong FBO**：`useRipple` 指针处盖图并衰减；`useFluid` 是 Navier-Stokes 流体（比 jquery.ripples 更高级）。
3. RTT/鼠标都内建，喂指针坐标即注入扰动。
4. **契合度**：技术最对路（真 ping-pong）；要"扭你的场景"得把内容 RT 喂给它。
5. **需装包**：无 `dependencies`，但**全是 peerDependencies**——只往 bundle 加它自己 + **需要 `three-stdlib` peer**（drei 传递带进来，但要心里有数）。peer 范围 `three>=0.155 / R3F>=8.13 / react>=18` 不卡你。
6. **风险**：**2024-08 起停更**，无任何针对 R3F v9 / three r0.18x 的提交或测试。peer 不拦，但**运行时**可能撞 R3F v9 reconciler/`extend` 改动或 three r184 改名。**要装得先 smoke-test**。属"需装包审批"项；**即使不装，它的 `useRipple` 源码也是抄数学的好参考（MIT）**。

### D. `nhtoby311/WaterSurface`

[repo](https://github.com/nhtoby311/WaterSurface)。**无 LICENSE 文件 → 默认全版权保留，抄/依赖都不合法**。`RippleFX` 自承"是 `@funtech-inc/use-shader-fx` `useRipple` 的实现"，还要 `public/fx/smoke.png`。`package.json` 锁 `three^0.162 / R3F^8 / React18`，与你 v9/React19 顶。**结论：别依赖**；最多读它看怎么接 `useRipple`，但要 ripple 直接去 C。

### E. `taiyuuki/webgl-water-ripple`

[repo](https://github.com/taiyuuki/webgl-water-ripple)（npm 同名）· **MIT**。**滚动法线图**做位移，**无任何鼠标交互**、**只扭一张 `imageURL`**、依赖 `glslCanvas`（非 three）。两条硬伤（无交互 + 单图非场景）直接出局。它"轻量"在于"根本不是会扩散的物理涟漪"。**排除。**

### F. `water-simulation.vercel.app`（Anderson Mancini / ektogamat）

[demo](https://water-simulation.vercel.app/)。查遍其 [27 个 repo](https://github.com/ektogamat?tab=repositories) **无对应源码**——这类通常作付费/课程资产。R3F + RGB 焦散 + 水下扭曲 + 屏幕水珠，是"潜水进水里"的全场景重型款，**比俯视塘需要的重得多，且拿不到源码**。当**视觉灵感**看即可。

### G. `diver-jay/r3f-drei-water-caustics-effect`（最值得读的"活代码"）

[repo](https://github.com/diver-jay/r3f-drei-water-caustics-effect) · README 声明 **MIT**。**已跑在和你几乎一模一样的栈上**：`three^0.174 / R3F^9.5 / drei^10.7.7 / react^19`——证明"现代栈能跑通离屏管线"。架构 = `WaterCausticsProvider` + `useWaterCaustics()` 共享 uniform，每帧更新一次；**有 `addDrop()`（在 -1..1 sim 坐标加涟漪）**，正是鼠标喂涟漪样板。短板：它是"投影焦散到它认识的 mesh 上"，非通用全屏后期；且**需要 `@react-three/postprocessing`**（你灰名单未批）。**当 Provider/Hook + addDrop 注入模式的借鉴源。**

### H. drei 内置：`RenderTexture` / `MeshTransmissionMaterial`

- **`RenderTexture`**（[docs](https://drei.docs.pmnd.rs/portals/render-texture)）：把 children 通过 portal 渲进离屏 FBO。**可以**做"把子场景渲进纹理"，但全屏"扭已经在屏上的一切"更顺手的是 `useFBO` + 手动 `setRenderTarget`（精确控制何时渲、能 ping-pong）。两者都纯 drei。
- **`MeshTransmissionMaterial` / `MeshRefractionMaterial`**：**架构性不对**——折射 3D 几何法线（玻璃球/钻石），不是"俯视平面水位线以下的屏幕区域"。**别拿来做核心效果**（常见误区，先排掉）。

### I. Codrops 2019「Water-like Distortion」(Daniel Velasquez)

[文章](https://tympanus.net/codrops/2019/10/08/creating-a-water-like-distortion-effect-with-three-js/) · [CodeSandbox](https://codesandbox.io/s/three-water-effect-np4drs)。`WaterTexture` 类在 64px canvas 上画鼠标轨迹涟漪、**把 2D 流向+强度编码进 RGB**，再在全屏 shader 里用它位移**已渲染场景**的 UV——**架构和你要的"渲染场景→按涟漪图扭"几乎一样**。区别：涟漪是 CPU 画的扩张圆（非物理扩散），原版用了 `postprocessing` 包。**借它"位移已渲染场景 UV"的架构 + 你的 useFBO 高度场替掉 canvas 涟漪。**

**补充参考**（已验证存在、可深挖）：Maxime Heckel 的 [屏幕空间折射](https://blog.maximeheckel.com/posts/refraction-dispersion-and-other-shader-light-effects/) 与 [WebGL Render Targets](https://blog.maximeheckel.com/posts/beautiful-and-mind-bending-effects-with-webgl-render-targets/)（**纯 three+drei `useFBO` 的 RTT 圣经，强烈建议精读**）；[Wawa Sensei Render Target 课](https://wawasensei.dev/courses/react-three-fiber/lessons/render-target)；Evan Wallace [WebGL Water](https://madebyevan.com/webgl-water/)（焦散祖师爷，但 3D/无 license，只读不抄）；Shadertoy ripple（[mldcD2](https://www.shadertoy.com/view/mldcD2) / [WdVXDt](https://www.shadertoy.com/view/WdVXDt)，注意 CC-BY-NC 默认许可，逐个核对）。

---

## 3. ⚠️ 为什么你上次 ping-pong 翻车（最重要的一节）

调研把 playbook 点名的四个嫌疑（`autoClear` / `setRenderTarget` 时机 / `useFrame` 优先级 / 读写同 target）全坐实，并给出修法。**G5-D0 spike 前请逐条对照**：

| # | 翻车原因 | 现象 | 修法 |
|---|---|---|---|
| 1 | **读写同一个 target** | 黑屏 / NaN / 闪烁 | 必须**两个** target，读 `read`、写 `write`、帧末 swap；**永远不要**把 `write.texture` 喂给正在写 `write` 的材质 |
| 2 | **结尾忘了 `setRenderTarget(null)`** | **屏幕啥都没有**（主渲染画进了 FBO） | 离屏块结尾**永远** `gl.setRenderTarget(null)` |
| 3 | **`autoClear` 冲掉累积** | 涟漪建立不起来 / 不累积 | `const p=gl.autoClear; gl.autoClear=false; …; gl.autoClear=p`（**要还原**，否则主画布不清屏 → 残影） |
| 4 | **float target 配 LinearFilter** | target 不完整 → 黑 / 报错 | sim/数据纹理用 **`NearestFilter`**；优先 `HalfFloatType`（移动兼容）或 `FloatType`（精度）。**注意 drei `useFBO` 默认是 `LinearFilter`+`HalfFloatType`**，给 sim 必须覆写成 Nearest |
| 5 | **`useFrame` 顺序**：显示组件先于 sim 读到纹理 | 显示上一帧 / 空纹理 | sim 跑在**负优先级** `useFrame(fn,-1)`（在所有 priority-0 和主渲染之前），显示在 priority 0 读 |
| 6 | **`useFrame(fn, priority>0)` 悄悄夺走渲染循环** | "FBO 对了但屏幕全黑" | 任何 `priority>0` 会**关掉 R3F 自动渲染**，你必须自己 `gl.render(scene,camera)`。**spike 别用正优先级**——sim 用负优先级、让 R3F 渲主场景（[R3F docs](https://r3f.docs.pmnd.rs/api/hooks)、[#1339](https://github.com/pmndrs/react-three-fiber/discussions/1339)） |
| 7 | `frameloop="demand"` 冻结 sim | sim 不动 | 连续 sim 用 `frameloop="always"`，或每步 `invalidate()` |
| 8 | **React 19 StrictMode dev 双挂载** | dev 下 FBO/`init()` 跑两次、泄漏 | 一次性 GPU 资源放 `useMemo`/ref + 对应 cleanup dispose；`GPUComputationRenderer.init()` 别裸放在无 cleanup 的 effect 里；怀疑时临时关 StrictMode 隔离 |

> **核心心法**：sim 用**负优先级 `useFrame`**、让 R3F 自己渲主场景（别夺循环）；两 target ping-pong + 帧末 swap；离屏块 `autoClear` 存还原 + 结尾 `setRenderTarget(null)`；数据纹理 Nearest。

---

## 4. 推荐路径（排好序，含最小起步骨架）

### 🥇 路径 1：drei `useFBO` 手搓 jquery.ripples（先做这个 spike）

**零新包、契合度最高、风险已收敛。**

**G5-D0 spike 二分法（半天，强烈推荐的第一步）**：
- **Step 1 — 先单独验 RTT（30–60 分钟）**：把一张背景图（或一两颗球）渲进内容 FBO，全屏 shader 采样它，用**解析式假涟漪**（`sin` 波）偏移 UV。看到扭动 → **RTT 通了**（排除翻车点 #2/#6）。这步**先不碰 ping-pong**。
- **Step 2 — 再验 ping-pong（1–2 小时）**：加双 FBO 高度场（下方 jquery.ripples 数学）+ 鼠标滴水，用它的梯度替掉假 `sin` 偏移。涟漪会扩散 → **ping-pong 通了**。
- 若 Step 2 仍别扭 → **不纠结，sim 段直接换路径 2 的 `GPUComputationRenderer`**（合成 pass 不动）。

**最小起步骨架**（纯 `three + drei`，逐行算法来自 jquery.ripples 源码 MIT）：

```tsx
// water/use-ripple-fbo.ts —— 双 FBO ping-pong 高度场（jquery.ripples 数学）
import { useFBO } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

const RES = 256
const SIM_OPTS = {                       // 翻车点 #4：sim 必须 Nearest
  type: THREE.HalfFloatType, format: THREE.RGBAFormat,
  minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
  wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
  depthBuffer: false, stencilBuffer: false,
}

const SIM_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2  uDelta;            // (1/RES, 1/RES)
  uniform vec2  uMouse;            // 0..1，无输入时给 (-1,-1)
  uniform float uRadius, uStrength;
  const float PI = 3.141592653589793;
  void main() {
    vec4 info = texture2D(uPrev, vUv);
    float avg = (
      texture2D(uPrev, vUv - vec2(uDelta.x,0.0)).r +
      texture2D(uPrev, vUv - vec2(0.0,uDelta.y)).r +
      texture2D(uPrev, vUv + vec2(uDelta.x,0.0)).r +
      texture2D(uPrev, vUv + vec2(0.0,uDelta.y)).r) * 0.25;
    info.g += (avg - info.r) * 2.0;       // 速度 += (邻居均值-高度)*2
    info.g *= 0.995;                      // 阻尼
    info.r += info.g;                     // 高度 += 速度
    if (uMouse.x >= 0.0) {                // 鼠标滴水：升余弦凸包
      float d = max(0.0, 1.0 - length(uMouse - vUv) / uRadius);
      info.r += (0.5 - 0.5*cos(d*PI)) * uStrength;
    }
    gl_FragColor = info;                  // .r=高度 .g=速度
  }`
const QUAD_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

export function useRippleFBO() {
  const a = useFBO(RES, RES, SIM_OPTS)
  const b = useFBO(RES, RES, SIM_OPTS)
  const buf = useRef({ read: a, write: b })
  const heightRef = useRef<THREE.Texture>(a.texture)   // 给合成 pass 用
  const mouse = useRef(new THREE.Vector2(-1, -1))
  const strength = useRef(0)

  const scene = useMemo(() => new THREE.Scene(), [])
  const cam   = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const matObj = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: SIM_FRAG,
    uniforms: {
      uPrev:{value:null}, uDelta:{value:new THREE.Vector2(1/RES,1/RES)},
      uMouse:{value:new THREE.Vector2(-1,-1)}, uRadius:{value:0.08}, uStrength:{value:0.0},
    },
  }), [])
  useMemo(() => {                                       // 全屏 quad 进 sim 场景
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matObj))
  }, [scene, matObj])

  // 翻车点 #5/#6：负优先级，sim 在主渲染前跑，且不夺渲染循环
  useFrame(({ gl }) => {
    const { read, write } = buf.current
    matObj.uniforms.uPrev.value = read.texture
    matObj.uniforms.uMouse.value.copy(mouse.current)
    matObj.uniforms.uStrength.value = strength.current
    const prev = gl.autoClear; gl.autoClear = false    // 翻车点 #3
    gl.setRenderTarget(write); gl.render(scene, cam)
    gl.setRenderTarget(null);  gl.autoClear = prev     // 翻车点 #2
    heightRef.current = write.texture
    buf.current = { read: write, write: read }         // swap，翻车点 #1
    strength.current = 0                               // 一次性滴水用完清零
  }, -1)

  // 暴露注入接口：鼠标移动/点击调它（uv 为 0..1）
  const drop = (uv: THREE.Vector2, str: number) => { mouse.current.copy(uv); strength.current = str }
  const idle = () => { mouse.current.set(-1, -1) }
  return { heightRef, drop, idle }
}
```

```glsl
// 合成 pass 的 fragment（全屏面，主场景里）—— jquery.ripples 折射逐行
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;     // “水位以下内容”渲进的内容 FBO
uniform sampler2D uHeight;    // useRippleFBO 的 heightRef
uniform vec2  uDelta;         // (1/RES,1/RES)
uniform float uPerturb;       // ≈0.03
void main() {
  float h  = texture2D(uHeight, vUv).r;
  float hx = texture2D(uHeight, vUv + vec2(uDelta.x,0.0)).r;
  float hy = texture2D(uHeight, vUv + vec2(0.0,uDelta.y)).r;
  vec3 dx = vec3(uDelta.x, hx - h, 0.0);
  vec3 dy = vec3(0.0, hy - h, uDelta.y);
  vec2 offset = -normalize(cross(dy, dx)).xz;
  float spec = pow(max(0.0, dot(offset, normalize(vec2(-0.6,1.0)))), 4.0);
  gl_FragColor = texture2D(uScene, vUv + offset * uPerturb) + spec;  // 折射 + 假高光
}
```

**接线**（`'use client'` 的 PondGL，`<Canvas frameloop="always">`）：内容层（水位以下的球/背景图）渲进一个内容 `useFBO` → 把 `uScene=内容FBO.texture`、`uHeight=heightRef.current` 喂给合成全屏面 → DOM 命中层叠在 canvas 之上（天然不进 shader、不被扭，点击精准）。鼠标事件里换算 NDC→0..1 UV 调 `drop(uv, 移动0.01/点击0.14)`。

**jquery.ripples 载荷常量速查**（移植对照）：

| 项 | 值 |
|---|---|
| sim 分辨率 | 256×256，RGBA float（退 half-float），Nearest，ClampToEdge |
| 通道 | `.r`=高度，`.g`=速度 |
| 邻居 delta | `(1/256, 1/256)` |
| 波动力 | `vel += (avg4 - height) * 2.0` |
| 阻尼 | `vel *= 0.995` |
| 积分 | `height += vel` |
| 滴水形状 | `0.5 - 0.5*cos(PI * max(0, 1 - dist/radius))`，加进 `.r` |
| 滴水强度 | 0.01（移动）/ 0.14（点击） |
| 折射偏移 | `offset = -normalize(cross(dy, dx)).xz`，bg 采样 `uv + offset*perturbance` |
| perturbance | 0.03 |
| 高光 | `pow(max(0, dot(offset, normalize(vec2(-0.6,1.0)))), 4.0)` 加进 RGB |
| 每帧步数 | 1 次 update + 1 次 render；滴水为额外事件驱动 pass |

### 🥈 路径 2：three `GPUComputationRenderer`（手搓仍别扭时的保险阀）

零新包（随 three）。把路径 1 的"sim 段"整段换掉，**合成 pass 一字不改**：

```tsx
// water/use-gpgpu-ripple.ts —— 用官方 GPGPU 取代手搓 ping-pong
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js'
import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

const RES = 256
const HEIGHT_FRAG = /* glsl */`
  uniform vec2 uMouse; uniform float uRadius, uStrength;
  const float PI = 3.141592653589793;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;        // GPUComputationRenderer 注入 resolution
    vec4 info = texture2D(heightmap, uv);             // 变量名=addVariable 名
    vec2 d = 1.0 / resolution.xy;
    float avg = (texture2D(heightmap,uv-vec2(d.x,0.)).r + texture2D(heightmap,uv-vec2(0.,d.y)).r
               + texture2D(heightmap,uv+vec2(d.x,0.)).r + texture2D(heightmap,uv+vec2(0.,d.y)).r)*0.25;
    info.g += (avg - info.r)*2.0; info.g *= 0.995; info.r += info.g;
    if (uMouse.x >= 0.0) { float k=max(0.,1.-length(uMouse-uv)/uRadius); info.r += (0.5-0.5*cos(k*PI))*uStrength; }
    gl_FragColor = info;
  }`

export function useGpgpuRipple() {
  const gl = useThree((s) => s.gl)
  const heightRef = useRef<THREE.Texture | null>(null)
  const mouse = useRef(new THREE.Vector2(-1, -1)); const strength = useRef(0)
  const gpu = useMemo(() => {
    const g = new GPUComputationRenderer(RES, RES, gl)   // 默认 FloatType+Nearest，安全
    const t = g.createTexture()
    const v = g.addVariable('heightmap', HEIGHT_FRAG, t)
    g.setVariableDependencies(v, [v])                    // 自依赖=波动方程
    v.material.uniforms.uMouse = { value: mouse.current }
    v.material.uniforms.uRadius = { value: 0.08 }
    v.material.uniforms.uStrength = { value: 0 }
    ;(g as any)._v = v
    return g
  }, [gl])
  useEffect(() => {                                       // init 自带能力检测 + 翻车点 #8 cleanup
    const err = gpu.init(); if (err) console.error('[gpgpu]', err)
    return () => gpu.dispose?.()
  }, [gpu])
  useFrame(() => {
    const v = (gpu as any)._v
    v.material.uniforms.uMouse.value.copy(mouse.current)
    v.material.uniforms.uStrength.value = strength.current
    gpu.compute()                                        // ping-pong/swap 全包
    heightRef.current = gpu.getCurrentRenderTarget(v).texture
    strength.current = 0
  }, -1)
  return {
    heightRef,
    drop: (uv: THREE.Vector2, s: number) => { mouse.current.copy(uv); strength.current = s },
    idle: () => mouse.current.set(-1, -1),
  }
}
```

**何时选它**：路径 1 的 Step 2 在你环境仍出问题（黑/不累积/NaN），它把 swap/autoClear/能力检测一次性消掉，`init()` 还会直接告诉你"浮点 RT 不支持"之类。

### 🥉 路径 3：装包路线（仅当 1、2 都被环境卡住，需走审批）

按"需装包审批"标注，二选一：
- **`@funtech-inc/use-shader-fx`**（MIT，只加自己 + `three-stdlib` peer）——技术最对路（真 ping-pong/流体），但**停更、未在 v9/r184 测**，装前先 smoke-test `useRipple`。
- **`@react-three/postprocessing`**（你灰名单已点名未批）——可做全屏 displacement pass（参考 [diver-jay](https://github.com/diver-jay/r3f-drei-water-caustics-effect) 在同款栈的 `addDrop` 模式 / Codrops 2019 架构）。

> 起步骨架：`<Water><RippleFX ... /></Water>`（use-shader-fx）或自写 `EffectComposer` + 取 heightFBO 做 `mainUv` 位移的 Effect——但**两者都要先过审批**，且本质仍是"FBO 抓场景→按涟漪图偏移 UV"，所以**没理由不先用零包的路径 1/2 把风险烧掉**。

---

## 5. 落地建议 & 一处必读纠偏

1. **第一个半天 spike = 路径 1 的二分法**：先 30–60 分钟单独验 RTT（假 `sin` 偏移），再 1–2 小时加 ping-pong 高度场。先烧掉"离屏渲染稳不稳"这个唯一真风险，正中 G5-D0 立项意图。
2. **ping-pong 段若仍翻车，立刻切路径 2**（`GPUComputationRenderer`，合成 pass 不改）——零成本保险阀。
3. **路径 3 留作最后手段**，且必须走装包审批。
4. **⚠️ 一处会咬人的语义纠偏（要写进 G5-D 实现）**：水位 `L` 是**深度**、不是屏幕 Y。所以遮罩**不能**用 `step(waterLevel, vUv.y)` 这种屏幕纵坐标判断（那是网上教程的俯视误用）。正解 = 按**整颗对象的 z vs L** 决定它渲进"水下内容 FBO（被扭）"还是"露头清晰层（盖最上）"，与规格 §4「按整颗对象判上下、不切两半」一致。
5. **DOM 命中层**天然在 canvas 之上、不进 shader → 点击/拖拽不受折射偏移影响（规格 §5 ✅），不用额外处理。
6. **`ScenePanel` 开关**（项目铁律）：spike 落地时给"水波/扭曲/水位/perturbance/阻尼"都加上面板开关。

---

## 6. 来源

- [sirxemic/jquery.ripples (MIT)](https://github.com/sirxemic/jquery.ripples) · [demo](https://sirxemic.github.io/jquery.ripples/) · [enhanced-jquery-ripples fork](https://github.com/lolrazh/enhanced-jquery-ripples)
- [drei useFBO docs](https://drei.docs.pmnd.rs/misc/fbo-use-fbo) · [Fbo.tsx 源码](https://github.com/pmndrs/drei/blob/master/src/core/Fbo.tsx) · [drei RenderTexture docs](https://drei.docs.pmnd.rs/portals/render-texture)
- [R3F hooks（useFrame 优先级 / frameloop）](https://r3f.docs.pmnd.rs/api/hooks) · [RTT footgun #1339](https://github.com/pmndrs/react-three-fiber/discussions/1339) · [swap renderTargets #2474](https://github.com/pmndrs/react-three-fiber/discussions/2474)
- [Maxime Heckel: WebGL Render Targets](https://blog.maximeheckel.com/posts/beautiful-and-mind-bending-effects-with-webgl-render-targets/) · [Refraction/Dispersion](https://blog.maximeheckel.com/posts/refraction-dispersion-and-other-shader-light-effects/) · [Wawa Sensei: Render Target](https://wawasensei.dev/courses/react-three-fiber/lessons/render-target)
- [three GPUComputationRenderer 源码](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/misc/GPUComputationRenderer.js) · [webgl_gpgpu_water 例子](https://threejs.org/examples/#webgl_gpgpu_water)
- [@funtech-inc/use-shader-fx (MIT)](https://github.com/FunTechInc/use-shader-fx) · [npm](https://www.npmjs.com/package/@funtech-inc/use-shader-fx) · [diver-jay/r3f-drei-water-caustics-effect (MIT, 同栈)](https://github.com/diver-jay/r3f-drei-water-caustics-effect)
- [nhtoby311/WaterSurface (无 license)](https://github.com/nhtoby311/WaterSurface) · [taiyuuki/webgl-water-ripple (MIT)](https://github.com/taiyuuki/webgl-water-ripple) · [water-simulation demo (闭源)](https://water-simulation.vercel.app/)
- [Codrops 2019 Water Distortion](https://tympanus.net/codrops/2019/10/08/creating-a-water-like-distortion-effect-with-three-js/) · [Evan Wallace WebGL Water](https://madebyevan.com/webgl-water/) · [MDN OES_texture_float_linear](https://developer.mozilla.org/en-US/docs/Web/API/OES_texture_float_linear)
