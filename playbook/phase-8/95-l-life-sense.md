# P8-L — L 线 · 水塘生命感深化（无序而和谐）

> **立项**：2026-06-30（STATUS）。**需求打磨定稿**：2026-07-05 用户对话——原 L2/L3/L4 一句话立项重定义为 **10 个功能模块 + 2 个基建步**（用户 5 条需求 + Claude 5 条追加提案全采纳；滚轮去同步"幅度差/时滞差"两参数都上）。
> **自审**：2026-07-05 逐文件核对 /test3 现有代码后修订（各步附「审计实况」file:line）。关键修订：① 新增 L0b 零视觉管道重构（renderDepth 15 处调用点×8 文件不能顺手改）；② 透明度隐现必须同步 DOM 命中层；③ 花瓣场驱动权要先从 WaterPetals 抽出；④ SphereInstances 217/220、RippleSpikePanel 207/220 撞硬线 → 先拆再加；⑤ isScrolling 在 /test3 无消费者（原稿写错已删）。
> **沙盒**：`/test3`（`src/components/pond-gl-test3/` + `app/test3/`）。**/test1 = 冻结基线不碰**；共享 `pond-gl/`、`archipelago/` 不碰；`/`、`/test`、`/test2` 零变化。
> **commit scope**：`feat(p8-l): L2-1 …`
> **L1（新上 20 首音乐）不在本文档**：涉及 tracks 表 / Arweave / 球数，等艺术家素材 + 收尾方案重设计后另行规划。

---

## 总则

**目标**：水塘从"好看的静态背景"→"有机、会呼吸、对交互有反应"。手段 = 增加个体无序；纪律 = 保持整体和谐。

### 四条和谐纪律（每个模块都必须遵守）

1. **确定性种子**：每球个体差异一律从 `hashStr(node.id)`（共享 `sphere-config` 已有，`gl-sim-setup` 在用）派生 [0,1) 种子，模块级 Map 缓存。刷新后球"性格"不变、可复现可调参。**禁止每帧 Math.random**。
2. **无理数频率族**：所有周期项频率按黄金比例族取（×1 / ×1.618 / ×2.618…）→ 群体永不齐步、也永不散架。
3. **全局呼吸包络**：超慢全局正弦 `lifeEnv(t)`（周期 `lifeEnvPeriod` 默认 24s、深度 `lifeEnvAmount` 默认 0 = 恒 1）**乘在所有无序项幅度上** → 个体乱在集体节奏里（风一阵一阵吹过湖面）。
4. **小幅度多层叠**：单项无序压 5–20%，靠叠加出丰富度；任何单项调大都会破。

### 红线

- 每个功能模块**独立 flag**（`gl-flags.ts` + ScenePanel「生命感」折叠组）。初始施工时默认全 false；**2026-08-25 用户验收后当前默认改为 9 开、仅 `jelly` 关**。无论默认值如何，全关仍须与 L0a/L0b 基线像素级一致。
- 参数**不进** `ripple-tuning`（181/220 行放不下 24 个新字段）→ 新建 **`life/life-tuning.ts` 独立 store**（同款单例 + pub/sub + localStorage 范式，独立 key `test3-life-v2`）+ **`life/LifePanel.tsx`** 滑块面板（挂在 RippleSpikePanel 旁 = 同一调参栏区域；RippleSpikePanel 207/220 塞不下）。
- **五消费方深度/投影同源**：GL 球（SphereInstances）/ DOM 命中层（SphereOverlay）/ 水面遮罩（water-distort-setup）/ 花瓣层（WaterPetals）/ 日蚀（GlEclipse）全部经同一 `depthOf()`/`project()`/`applyFloat()` 管道 → 任何逐球偏移天然五处对齐；`unproject()` 与 `project()` 必须严格互逆（拖球命中红线）。
- **播放球 + hover 球豁免**隐现/颤动类效果（`playingIdRef`/`hoverIdRef` 现成，见 SphereInstances.tsx:195）。
- 全部尊重 `prefersReducedMotion`（`reduced-motion.ts` 现成）：reduced-motion → 所有无序项归零/冻结。
- 拖拽中的球（`fx/fy` 非空）不受 wake/flow/shiver 推动（与 driftSpheres/wavePush 现有口径一致）。
- **界面全中文（硬约束）**：ScenePanel 新增的 10 个开关 label + LifePanel 全部滑块 label + 分组标题，一律用**简体中文**，风格照抄现有 `ScenePanel.tsx`（如「球浮动」「月光焦散」）与 `RippleSpikePanel.tsx`（如「阻尼(持续)」「触发·划水」）。**不许出现英文 flag 名或参数键名当界面文案**（英文只存在于代码里的 flag key / tuning key）。分组标题建议：全局呼吸 / 运动无序 / 形态灵动 / 涟漪耦合 / 呈现无序。
- verify：**逐文件 tsc + eslint**（用户 dev 常开，不跑 build——dev/build 共用 `.next` 互踩，见 memory）。

### 执行模式

**L0a → L0b 必须先行且按序**；之后四条线（L2 运动 / L3 形态 / L4 涟漪耦合 / L5 呈现）互相独立、可任意顺序；线内串行，每线做完 ⏸ 集中浏览器验收。建议顺序 **L0a → L0b → L2 → L4 → L5 → L3**（shader 重活最后；L3-3 果冻感成本最高、验收不过可弃）。

### 现状锚点（2026-07-05 实测行数；⚠ = 接近 220 硬线）

| 文件 | 行数 | 在 L 线中的角色 |
|---|---|---|
| `spheres/SphereInstances.tsx` | **217 ⚠** | 每帧 CPU hub（writeFrame）——L0b 先拆 |
| `water/spike/RippleSpikePanel.tsx` | **207 ⚠** | 现有调参栏——不动，L 参数走新 LifePanel |
| `spheres/gl-sim-setup.ts` | 205 | GlPhysNode 类型（加 `_shiftOff/_shivX/...` 字段，几行） |
| `spheres/use-gl-sim.ts` | 198 | sim 编排——尽量不动（wake 驱动走独立 hook） |
| `water/water-distort-setup.ts` | 194 | 水面遮罩消费方（L0b 迁移 2 处调用点） |
| `overlay/SphereOverlay.tsx` | 190 | DOM 命中层消费方（L0b 迁移 3 处 + L5-1 opacity 同步） |
| `water/spike/ripple-tuning.ts` | 181 | 不加字段（放不下）——L 参数走 life-tuning |
| `decor/water-petals-sim.ts` | 177 | CPU 涟漪场（L4 力源，只加只读采样，不改） |
| `gl-flags.ts` | 148 | +10 flag（interface/defaults/parse ≈ +30 行，余量够） |
| `water/ripple-feed.ts` | 142 | L0b 迁移 3 处调用点 |
| `decor/WaterPetals.tsx` | 141 | L4 抽场驱动器后瘦身 |
| `app/test3/page.tsx` | 112 | flag 接线（10 个 life flag 打包成一个 `life` 对象 prop 下传，防 prop 爆炸） |
| `pointer-fx.ts` | 100 | 保持全局 shift 职责不变（per-node 偏移在 life-core 算） |
| `spheres/sphere-shader.ts` | 74 | L3 边缘 GLSL（+~40 行，余量够） |
| `sphere-projection.ts` | 73 | L0b 改 project/unproject/applyFloat 签名 |
| `overlay/ScenePanel.tsx` | 68 | +「生命感」折叠组 10 开关（余量够） |

新目录 **`pond-gl-test3/life/`**（≤8 文件硬线内）：`life-core.ts`（种子/包络/滚轮去同步/隐现/颤动的每帧计算）、`life-tuning.ts`（参数 store）、`LifePanel.tsx`（滑块面板）、`flow-field.ts`（L2-3）、`wake-field.ts`（L4 场驱动器）、`sphere-frame.ts` 放 `spheres/`（L0b 从 SphereInstances 拆出，归属球目录）。

---

## L0a — 脚手架：种子 + 包络 + flag/参数/面板（零视觉）

- 📦 新建 `life/life-core.ts` + `life/life-tuning.ts` + `life/LifePanel.tsx`；改 `gl-flags.ts`、`overlay/ScenePanel.tsx`、`app/test3/page.tsx`（flag 打包 `life` 对象下传）、挂 LifePanel。
- 做什么：
  - `lifeSeeds(id)`：`hashStr(id)` 位切出 4~6 个 [0,1) 种子，Map 缓存；
  - `lifeEnv(tSec) = 1 − lifeEnvAmount·(0.5+0.5·sin(2πt/lifeEnvPeriod))`；
  - `life-tuning.ts`：全部 L 参数（见总表）+ localStorage key `test3-life-v2` + 保存/重置（照抄 ripple-tuning 范式 158-181 行）；
  - `gl-flags.ts`：10 个 flag 进 interface/DEFAULT/parseGLFlags；初始施工全 false，当前默认以 2026-08-25 拍板的 9 开、`jelly` 关为准；
  - ScenePanel「生命感」折叠组 10 开关；LifePanel 滑块分五组（全局/运动/形态/涟漪/呈现），带保存/重置。
- 验收：flag 全关 → /test3 与改前像素级一致；面板可开合、滑块可动（暂无效果）；tsc + eslint 绿。
- 回滚：整步纯新增 + 死参数，revert 即回。

## L0b — 管道重构：per-node 深度/投影通道（零视觉，L2 全线前置）

> **审计实况**：`renderDepth(zBase, _floatPulse?)` 第二参已废弃但**仍被各处传着 `n._waveZ ?? 0`**（pointer-fx.ts:47 注释"兼容旧 20 处调用点"）→ 不能复用第二参做偏移，语义会被 _waveZ 污染。`isScrolling()`/`getScrollExtremity()` 在 /test3 **无任何消费者**（sphere-motion v3 已去滚轮耦合）→ 不需保护、不动。

- 📦 `sphere-projection.ts` + `pointer-fx.ts`（只加不改）+ 全部消费方 + 新建 `spheres/sphere-frame.ts`。
- 做什么（三件机械活，全部零视觉）：
  1. **深度助手**：pointer-fx 加 `depthOf(n) = clamp01(D_LO + n.z·D_SPAN + shift + (n._shiftOff ?? 0))` 与 `displayDepthOf(n)`（用 `n.displayZ ?? n.z`）；`GlPhysNode` 加 `_shiftOff?: number`（gl-sim-setup.ts:43 类型处）。**迁移全部 15 处调用点**（老 `renderDepth` 保留不删，供水线对齐等无 node 场景）：
     - `spheres/SphereInstances.tsx:130,143` → depthOf / displayDepthOf
     - `overlay/SphereOverlay.tsx:50,58,118`（118 = unproject 拖球）
     - `decor/WaterPetals.tsx:87,91,110,112`
     - `water/ripple-feed.ts:60,72,77`
     - `spheres/gl-sim-waves.ts:61`（wavePush 水下判定）
     - `water/water-distort-setup.ts:185,187`（遮罩）
     - `overlay/GlEclipse.tsx:34`
     - `spheres/use-gl-sim.ts:131` 水线对齐**保持 renderDepth(n.z, 0)**（建点时 _shiftOff 恒 0，语义不变）
  2. **投影签名升级**：`project(x, y, d, ctx, node?)` / `unproject(sx, sy, d, ctx, node?)` 加可选 node 参——视差项读 `node._parGain ?? 1` 与 `node._parAng ?? 0`（L2-2 用，本步恒缺省 = 现状）；`applyFloat(p, node, cx, cy)` 改收 node（内部读 `_waveZ`/`_shivX`/`_shivY`，后两个 L2-4 用，本步恒 0）。迁移 applyFloat 4 处调用点（SphereInstances:130 / SphereOverlay:58 / water-distort-setup:187 / GlEclipse:34）+ project 全部带 node 的调用点。
  3. **拆 writeFrame**：`SphereInstances.tsx`（217/220 ⚠）把 `writeFrame` + `InstanceBuf` + `hexToSRGB` 纯搬到 `spheres/sphere-frame.ts`——L 线所有每帧 CPU 逻辑（flicker/halo/shiver/flow/wake 调用）以后都长在这，SphereInstances 只剩组件壳。
- 验收：/test3 全功能回归（滚轮/拖球/hover/播放/花瓣/遮罩/日蚀）与改前逐项一致——这是**纯重构步，任何视觉差异 = bug**；tsc + eslint 绿。
- 回滚：本步独立 commit，出问题整步 revert。
- ⚠ 记录（不修）：WaterPetals 的 splash 注入/抠洞（:91,:112）走 project **不叠 applyFloat**（花瓣洞不跟球呼吸偏移）——pre-existing 不一致，K 线遗留，L 线不扩大战线。

---

## L2 线 — 运动无序

### L2-1 滚轮升降去同步（flag `wheelDesync`，依赖 L0b）

- **审计实况**：pointer-fx.ts:22 `shift` 全局单值 rAF 缓动（`shift += (target−shift)·0.12`），所有球同速升降；出入水先后差只来自 base z（band 0.35–0.65）。
- 做什么（**两参数都上**，2026-07-05 拍板；每帧一处统一计算）：
  - `life-core.stepWheelDesync(nodes, dt)`（由 sphere-frame 每帧调，在 stepSphereMotion 之后）维护每球 `_shiftOff`：
    - **时滞差** `wheelLagVar`：每球私有缓动值 `lagᵢ += (shiftTarget − lagᵢ)·0.12·kᵢ`，`kᵢ = 1 + (s₁−0.5)·2·wheelLagVar`（clamp ≥0.3 防永不到位）；
    - **幅度差** `wheelAmpVar`：`gᵢ = 1 + (s₂−0.5)·2·wheelAmpVar`，随极限收敛：`gᵢ′ = mix(gᵢ, 1, e²)`，`e = |shift|/SHIFT_MAX` → **滚到底必全沉、滚到顶必全出**；
    - 合成：`_shiftOff = (lagᵢ − shift) + shift·(gᵢ′ − 1)`；flag 关或 reduced-motion → `_shiftOff` 缓动归 0（不跳变）。
  - pointer-fx 导出 `getShiftTarget()`/`getShift()` 供 life-core 读（不动其内部职责）。
- 联动收益（免费）：per-node 深度经 L0b 管道流到全部消费方 → 出入水溅起（ripple-feed:72 穿越检测）、花瓣 splash（WaterPetals:90 限 5 滴/帧）、遮罩水上/水下判定**自动逐球错开**——正是"逐颗入水"的戏剧效果，限流已有。
- 参数：`wheelAmpVar` 0（0–0.6）/ `wheelLagVar` 0（0–0.8）。
- 验收（⏸）：开 flag 拉滚轮 → 球群参差出入水、有先有后、溅起错落；滚到极限全体到位；**水面遮罩的清晰/扭曲边界与球体一致**（同管道应自动成立，仍须目验）；拖球命中不偏；关 flag 平滑回全体同步。

### L2-2 视差去同步（flag `parallaxDesync`，依赖 L0b）

- **审计实况**：sphere-projection.ts:40 `mx·TILT_PX·tiltCoef(d)`，同深度球位移完全一致；unproject:63 是严格逆运算。
- 做什么：建点后（buildGlNodes 或 L0a lifeSeeds 首读时）写 `n._parGain = 1 + (s₃−0.5)·2·parVarAmp`、`n._parAng = (s₄−0.5)·2·parVarAngle`；project/unproject 的视差项改为 `rot(_parAng)·(mx,my)·TILT_PX·tc·_parGain`（L0b 已留 node 参口子）。flag 关 → 两字段视为 1/0。参数改动即时生效；视觉半径最小的一组球在幅度拉满时把 `_parGain` 压到 0.02–0.10，形成少量近静止小球。
- 参数：`parVarAmp` 0（0–1）/ `parVarAngle` 0（0–0.7 rad）。
- 验收（⏸）：动鼠标 → 球群位移幅度/方向有微差、层次感增强不齐步；**拖任意球在鼠标大幅移动中命中仍准**（unproject 对称性专项验）；日蚀层随播放球的视差与球一致。

### L2-3 流场游移（flag `flowDrift`）——追加提案 2 = 原 L2「运动轨迹」本体

- **审计实况**：现有 `driftSpheres`（gl-sim-waves.ts:19）= 每球**独立**双正弦随机游走（lw 种子已随机）→ 是"逐球抖动"，无空间结构。用户要的"轨迹感"缺的是**空间相干**：邻近球被同一股"暗流"带动。
- 做什么：新建 `life/flow-field.ts`：`flowAt(x, y, t) = curl(Ψ)`，Ψ 用 2~3 个不同向/不同波长的正弦势场叠加（黄金比频率、不引库、解析求偏导）；sphere-frame 每帧对非拖拽/非播放球 `v += flowAt(n.x·flowScale, n.y·flowScale, t·flowSpeed)·flowStrength·lifeEnv(t)`（注入 d3 vx/vy，velocityDecay 0.5 + cluster 力天然约束 → 漂而不散，与 driftSpheres 同构）。与 `sphereDrift` 正交可同开：drift 管"个体抖"、flow 管"集体流"。
- 参数：`flowStrength` 0（0–0.45）/ `flowScale`（0.002–0.06）/ `flowSpeed`（0.02–0.9）。
- 验收（⏸）：静置 30s → 球缓慢"游"出可辨认弧线，**相邻球有同向趋势**（洋流感），群不散不聚；与 drift 同开不打架；关 flag 回现状。

### L2-4 偶发颤动（flag `shiver`）——追加提案 4

- **审计实况**：applyFloat 四消费方（GL 球/命中层/遮罩/日蚀）——屏幕空间偏移必须走 applyFloat 内部才四处对齐（L0b 已把签名改为收 node）。
- 做什么：life-core 泊松调度（`−ln(rand(seed,时段))·shiverInterval` 或简化为随机间隔），每次挑一球写 0.3s 颤动：`_shivX/_shivY = shiverAmp·radius·sin(ωt)·e^(−t/0.1)·随机方向`（ω≈40rad/s 高频小幅）；applyFloat 内叠加到 sx/sy。豁免：播放球、拖拽中、正在 `_waveZ` 脉动的球（查 activeWaves 有无——sphere-motion 导出查询函数或看 `_waveZ !== 0`）。reduced-motion 全禁。
- 参数：`shiverInterval` 30（5–120s）/ `shiverAmp` 0（0–0.12，×半径）。
- 验收（⏸）：平均约 interval 秒偶见某球轻颤即止（像被鱼碰了下）；标题/角标/遮罩跟着一起颤（不分离）；不连发。

---

## L3 线 — 形态灵动（sphere-shader）

### L3-1 能量球边缘（flag `edgeWave`）——用户需求⑤

- **审计实况**：sphere-shader.ts:55 body = 固定 `uBodyRatio` 正圆 smoothstep；aParams 四通道**全满**（fill/halo/dim/blur）→ 相位种子必须走**新 attribute**；uniforms 已走 matRef 真身写入范式（SphereInstances.tsx:72 applyTuningUniforms，R3F uniforms prop 拷贝坑已踩平——**uTime 必须同样走 matRef，别走 prop**）。
- 做什么：
  - **新 instanced attribute `aSeed`（vec2）**：x = 相位种子 φᵢ（0–2π），y = 激励值（L3-2 用，本步恒 0）。sphere-frame 的 InstanceBuf 加 `aSeed: Float32Array(count·2)`，建 buf 时从 lifeSeeds 填 x、y 每帧写；
  - **片元边界调制**：
    ```glsl
    float th = atan(vUv.y - 0.5, vUv.x - 0.5);
    float w1 = sin(uEdgeK1 * th + aSeedX + uTime * uEdgeW1);
    float w2 = sin(uEdgeK2 * th - uTime * uEdgeW2 + aSeedX * 1.7);
    float amp = min(uEdgeAmp * (1.0 + uExciteGain * aSeedY), 0.15);   // 总幅 clamp，见下
    float body = bodyRatio * (1.0 + amp * (0.7 * w1 + 0.3 * w2));
    ```
    body 边界与虚化用 `body` 替换 `bodyRatio`，`aa` 加 `uEdgeSoft`；**halo 保持正圆**（能量包膜感）。
  - ⚠ **两个数学红线**（自审新增）：① `uEdgeK1/uEdgeK2` 必须**整数**（sin(kθ) 在 θ=±π 接缝只有 k∈ℤ 连续，否则球缘出现一条裂缝）——滑块整档步进，k₂ 取 k₁+3（非倍数、不合拍）；② 调制后半径 clamp ≤ 0.98·1.0（quad 归一半径），且 `uEdgeAmp` 上限 0.15 ≈ (1/bodyRatio−1)（bodyRatio≈0.862）——超了波峰顶进 halo 区/被 `d>1 discard` 切平。
  - uniform 组（uTime/uEdgeAmp/uEdgeK1/uEdgeK2/uEdgeW1/uEdgeW2/uEdgeSoft/uExciteGain）每帧经 applyTuningUniforms 同款函数从 life-tuning 写 matRef 真身；flag 关 → uEdgeAmp 写 0（shader 常驻无分支）。reduced-motion → uEdgeW1/W2 写 0（形状保留、停转）。
  - DOM 命中圈不动（振幅 ≤10% 点击无感）。sphere-shader.ts 74 行 +~40 = ~115，不撞线；真超了拆 `sphere-edge-glsl.ts`。
- 参数：`edgeWaveAmp` 0（0–0.15）/ `edgeWaveFreq` 5（3–9 整数）/ `edgeWaveSpeed`（0–2）/ `edgeSoft` 0（0–0.06）。
- 验收（⏸）：球缘变缓慢流转的波形膜（双向凸凹）+ 轻虚化；**θ 接缝处无裂缝**（把 amp 拉满转一圈目验）；hover 放大/播放白球/水下淡出不破形；关 = 正圆现状。

### L3-2 扰动激励边缘（flag `edgeExcite`，依赖 L3-1）——追加提案 1（④⑤打通）

- 做什么：sphere-frame 每帧维护 `n._excite`（`·= exp(−dt/exciteDecay)` 衰减，封顶 1）；注入源：拖拽中（drag.moved）恒 +、L4 wake 力大小 ×系数、出入水穿越瞬间 +0.6（ripple-feed 已有穿越检测，加一行写 _excite）。写入 aSeed.y → shader `amp·(1+uExciteGain·aSeedY)`（L3-1 已留通道 + clamp）。
- 参数：`exciteGain` 0（0–3）/ `exciteDecay` 0.8（0.2–3s）。
- 验收（⏸）：拖球/划水扫过/球出入水 → 该球边缘波瞬时剧烈、~1s 内平息；静止球安详；仅该球反应。

### L3-3 果冻感（flag `jelly`，最后做、验收不过可弃）——追加提案 5

- 做什么：sphere-frame 写矩阵处（sphere-frame 内原 SphereInstances.tsx:132 `makeScale.setPosition`）改为速度驱动的非均匀缩放：取 `v = (n.vx+_gvx, n.vy+_gvy)`（平滑 lerp 防抖），`e = min(0.1, jellyAmount·|v|)`，矩阵 = `T·R(vθ)·S(d·(1+e), d·(1−e))·R(−vθ)`（Matrix4 组合，绕速度方向拉伸）。⚠ halo 会跟着变椭（quad 空间整体拉伸）——小幅度下可接受，验收专项看；丑就弃。
- 参数：`jellyAmount` 0（0–0.4）。
- 验收（⏸）：wake/拖拽推动时球沿运动方向微拉伸、停即回圆；halo 变形不刺眼；无高频抖动伪影（lerp 到位）。

---

## L4 线 — 涟漪耦合

### L4-1 wake 连续扰动水下球（flag `wakeSpheres`）——用户需求④

- **审计实况（两个关键确认 + 一个耦合坑）**：
  - ✅ 力源白捡：花瓣 CPU 涟漪场（`water-petals-sim.ts`，160×NY 波动方程）喂的就是指针拖尾/点击/bg-ripple 同源事件，`petalGradAt` 采样现成——**不必读 GPU FBO**；
  - ✅ 注入口白捡：`_gvx/_gvy` 滑行通道（gl-sim-waves.ts:96 stepSphereGlide：慢衰减 + GLIDE_MAX 封顶 + 直改 n.x/y = DOM 同步）就是理想的力通道，wavePush 的 depthAtten 口径（:61 `below = waterLevel − depth`，刚没入最强、越深越衰、水上不推）直接复用；
  - ⚠ **耦合坑**：场的 alloc/resize、事件监听（pointermove/pointerdown/bg-ripple:wave 喂 petalDrop）、`stepPetalWater()` 推进**全部锁在 WaterPetals 组件 useEffect 里**（WaterPetals.tsx:27-132）——`flowerPetals` 关则场死，wake 没输入。
- 做什么（两个子步）：
  - **L4-1a 抽场驱动器（零视觉）**：新建 `life/wake-field.ts`——把"场生命周期"从 WaterPetals 搬出：`acquireWakeField()`/`releaseWakeField()` refcount 单例（alloc/resize 监听、三个事件监听喂 drop、自有 rAF 内 `stepPetalWater()` **每帧仅一次**，帧号防重）；WaterPetals 改为 acquire/release + 只做花瓣 update/draw + 球出入水 splash 注入（petal 专属逻辑留组件）。花瓣行为零变化验证。
    - ⚠ 记录耦合限制：drop 强度倍率（petalDrag/petalClick/petalWave）在**注入端**，wake 与花瓣共享同一场 → `petalDrag=0` 时拖尾对球也无扰动。默认 0.5 > 0 不触发；接受并在 LifePanel 标注"力源共享花瓣触发倍率"。
  - **L4-1b 球侧耦合**：`wakeSpheres` 开 → PondGL（或 page）挂 `useWakeField()` hook acquire；sphere-frame 每帧对非播放/非拖拽球：投影位 `project(n.x, n.y, depthOf(n), ctx)` → 换网格坐标 `(sx/W·NX, sy/H·NY)` → `[gx, gy] = petalGradAt(...)` → `atten = max(0, 1 − below/wakeDepthFalloff)`（`below = waterLevel − displayDepthOf(n)`，≤0 跳过）→ `_gvx += gx·wakeSphereForce·atten·lifeEnv`（_gvy 同）。滑行通道自带封顶/衰减/回位（cluster 力归位 = "分散漂游再归位"）。采样用**投影后屏幕位**（波是屏幕空间的，视觉上波扫过哪颗球哪颗动）。
- 参数：`wakeSphereForce` 0（0–0.5）/ `wakeDepthFalloff` 0.46（0.1–1，对齐 wavePushDepth 语义）。
- 验收（⏸）：L4-1a 单独验（花瓣一切照旧 + flowerPetals 关/开切换不泄漏监听）；L4-1b：按住滑动划过球群 → 尾迹路径上**水下球**被荡开、缓缓漂回，刚没入的球反应最大、深球几乎不动、出水球不动；`flowerPetals` 关时扰动照常；与 wavePush 事件推同开不冲突。

---

## L5 线 — 呈现无序

### L5-1 透明度时隐时现（flag `alphaFlicker`）——用户需求③

- **审计实况**：GL 侧通道现成——sphere-frame（原 SphereInstances.tsx:146）`aParams[i·4+2] = dimLerp·(1−submerge)` 每帧 CPU 写。⚠ **但 DOM 命中层的标题/角标 opacity 独立算**（SphereOverlay.tsx:63 `max(0.4, 1−sub·1.5)`）——只改 GL 会"球隐了标题还飘着"，两端必须同源。
- 做什么：
  - sphere-frame 每帧算 `n._lifeDim = 1 − flickerAmount·shape(w(t))·lifeEnv(t)`：
    - `w(t) = 0.5 + 0.5·sin(f·t·1.0 + φᵢ)·0.6 + 0.5·sin(f·t·1.618 + 2.3φᵢ)·0.4`（无理比双频）；
    - `shape(w) = pow(w, 3)`（**长亮短隐**非对称——大部分时间近 1、偶尔快速下潜）；
    - **下限保护**：`_lifeDim ≥ 0.12`（球可点但完全不可见 = 交互怪，floor 兜底；水下球可点已有先例，同口径）；
    - 豁免：`isPlaying || isHover || 拖拽中 → _lifeDim = 1`（缓动回 1 不跳变）；reduced-motion → 恒 1；
    - 可选深度加权 `flickerDepthBias`：水下乘额外系数 → 隐现与深度产生语义关联；
  - GL：按 R3 当前权威契约（`96-l-true-alpha-composite.md` §14），`aLifeDim` 只调制 halo；水上 body 继续使用 `playDim`，不得因生命感隐现而露出主体内水纹；
  - **DOM 同步**：SphereOverlay loop 的 opacity 乘 `(n._lifeDim ?? 1)`（一行）；
  - 记录：花瓣抠洞按 emerged 不按 dim——隐现中的出水球洞里是变淡的球，视觉成立，不改。
- 参数：`flickerAmount` 0（0–0.85）/ `flickerSpeed`（0.05–0.6）/ `flickerDepthBias` 0（0–1）。
- 验收（⏸）：球群各自若隐若现、节奏无法预测、整体不齐闪；**标题/角标与球同步隐现**；播放/hover/拖拽恒亮；最暗时球仍隐约可见可点；关 = 现状。

### L5-2 光晕呼吸（flag `haloBreath`）——追加提案 3

- **审计实况**：haloPeak 通道现成（sphere-frame `aParams[i·4+1] = (hover?0.5:0.3)·tuning.halo` 每帧写）。
- 做什么：该行乘 `1 + haloBreathAmp·(0.6·sin(bt+φᵢ) + 0.4·sin(1.618bt+2.3φᵢ))·lifeEnv(t)`（结果 clamp ≥0）。与 L5-1 互补：③管 body 隐现、这个管光晕含蓄涌动；两通道独立不打架。hover 峰值 0.5 保留（呼吸乘在其上，hover 感不丢）。
- 参数：`haloBreathAmp` 0（0–0.5）/ `haloBreathSpeed`（0.05–0.8）。
- 验收（⏸）：光晕缓慢明暗涌动、比 body 隐现更含蓄；与 alphaFlicker 同开层次分明；hover 高亮仍明显。

---

## flag / 参数总表

| # | flag（gl-flags；当前默认 9 开、仅 jelly 关） | 参数（life-tuning） | 步 | 依赖 |
|---|---|---|---|---|
| — | —（基建无 flag） | `lifeEnvAmount` 0（0–0.6）/ `lifeEnvPeriod` 24（8–60s） | L0a | — |
| 1 | `wheelDesync` | `wheelAmpVar` 0 / `wheelLagVar` 0 | L2-1 | L0b |
| 2 | `parallaxDesync` | `parVarAmp` 0 / `parVarAngle` 0 | L2-2 | L0b |
| 3 | `flowDrift` | `flowStrength` 0 / `flowScale` / `flowSpeed` | L2-3 | L0a |
| 4 | `shiver` | `shiverInterval` 30 / `shiverAmp` 0 | L2-4 | L0b |
| 5 | `edgeWave` | `edgeWaveAmp` 0 / `edgeWaveFreq` 5（整数档）/ `edgeWaveSpeed` / `edgeSoft` 0 | L3-1 | L0a |
| 6 | `edgeExcite` | `exciteGain` 0 / `exciteDecay` 0.8 | L3-2 | L3-1 |
| 7 | `jelly` | `jellyAmount` 0 | L3-3 | L0b |
| 8 | `wakeSpheres` | `wakeSphereForce` 0 / `wakeDepthFalloff` 0.46 | L4-1 | L0a |
| 9 | `alphaFlicker` | `flickerAmount` 0 / `flickerSpeed` / `flickerDepthBias` 0 | L5-1 | L0b |
| 10 | `haloBreath` | `haloBreathAmp` 0 / `haloBreathSpeed` | L5-2 | L0a |

---

## 完结标准（L 线本期收口 gate）

- [x] L0b 重构后全功能回归与改前逐项一致（滚轮/拖球/hover/播放/花瓣/遮罩/日蚀）
- [x] 10 个 flag 全部可独立开关；**全关 = 与 L0a 之前像素级一致**
- [x] 参数全进 LifePanel（调参栏区域），实时可调 + 保存/重置生效（localStorage key `test3-life-v2`）
- [x] 拖球命中在任意 flag 组合下不错位（浏览器 pointer cancel/capture 与统一投影回归通过）
- [x] 播放/hover 球保持可用；reduced-motion 自动运动冻结回归通过
- [x] **和谐压力测试**：2026-08-26 用户最终目验确认整体“活而不乱”合适
- [x] 完整 `scripts/verify.sh` 全绿；所有涉改文件与目录硬线通过
- [x] STATUS / TASKS / JOURNAL 同步

## 已知限制（记录在案，不阻塞）

- wake 力源与花瓣共享触发倍率（petalDrag/petalClick/petalWave 在注入端）→ 拉 0 会连带 wake 无输入；LifePanel 标注。
- WaterPetals 抠洞/splash 不叠 applyFloat（花瓣洞不跟球呼吸偏移）——K 线 pre-existing，L 不修。
- L3-3 jelly 会让 halo 跟着变椭（quad 空间拉伸）——小幅可接受，丑即弃。
- L2-1 幅度差在中段会轻微改变球间深度次序（painter 排序仍按建点 z，不重排）——理论上极端参数下前后遮挡与深度微不符，振幅上限 0.6 内不可感；观察项。
