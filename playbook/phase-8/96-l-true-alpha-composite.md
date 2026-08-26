# P8-L — 真透明合成：彻底消除「时隐时现」黑圈

> **架构评审版 v2**：2026-08-23。已对照 `/test3` 当前 `PondGL → WaterDistort → compositeMaskFrag` 实现逐项复核。
> **状态**：A0–A6 已完成并收敛为真透明单路径；2026-08-23 进入 R1 严格分层维修。
> **沙盒**：只改 `/test3`（`src/components/pond-gl-test3/` + `app/test3/`）。`/test1` 是冻结基线；本线不迁移首页。
> **目标**：球体透明度降低时，露出同一位置原本的池底、水纹与装饰，不留下黑圈、灰圈、亮圈或折射残影。

---

## 1. 评审结论

方向正确，但初版方案低估了四个连带反应：

1. **透明度不是唯一状态**：当前 shader 同时用球体遮罩决定折射、焦散、月光和投影。若只拆颜色、不拆语义，透明球仍会在水面留下光影圆盘。
2. **背景和球不能继续共用一套采样 UV**：背景应该始终作为水面被折射；球体只在水下部分被折射。继续使用当前 `sampleUv = vUv + disp * sub` 会让球消失时背景折射也跟着变化。
3. **预乘 alpha 必须贯穿球体局部光照**：透明纹理上的加法光若不乘 alpha，会把黑圈修成亮圈。
4. **不能长期保留两套运行时管线**：按 `alphaFlicker` 开关切换旧/新 FBO，会让以后每个水面效果维护两份逻辑，产生更大的脆弱性。

因此采用以下最终决策：

- 单 Canvas、单 WaterDistort；施工验收期在 `/test3` 提供“原合成 / 真透明”A/B 按钮，用户拍板后只保留胜出路径。
- `waterFx && glSpheres` 时始终使用背景/球体分层，不因 `alphaFlicker` 开关改变架构。
- 只把唯一的 `SphereInstances` 放到专用 layer；其余对象继续留在默认 layer，避免逐个改所有装饰组件。
- 背景颜色、球体颜色、球体几何深度、球体视觉可见度四种数据各司其职，不再互相代替。
- 不引入 MRT、depth texture、第二个 Canvas 或新依赖，保持 WebGL1 可用路径。
- 旧管线在 `/test3` 保留到用户完成同场景 A/B 对照；用户明确确认采用真透明后才删除，长期代码仍只留一条路径。

---

## 2. 当前根因

当前一帧由 `WaterDistort` 的 priority-1 `useFrame` 接管：

```text
priority 0：球体 / 装饰更新矩阵与 uniform
priority 1：
  ① state.scene（BaseTone + 装饰 + 球体）→ content FBO
  ② 高度场 read → write
  ③ content + height → composite → 屏幕
```

问题发生在第①步：球体已经通过普通透明混合烘焙进不透明暗背景。后面的 composite 只拿到一个 `uScene` 像素，无法知道其中哪些 RGB 来自球、哪些来自池底。降低 `_lifeDim` 或 `uSphereVis` 只能撤销遮罩和附加效果，无法恢复球后方真实背景。

当前 pond-floor 还使用亮度阈值区分“暗底”和“球/亮物”。球逐渐变暗时会跨过阈值，让圆形区域走另一条塘底混合路径，进一步放大黑圈。

---

## 3. 目标架构

### 3.1 场景所有权

```text
默认 layer（0）
  BaseTone / BgImage / FloatingMotes / WaterPlants / WaterColumns
                  │
                  └──→ backgroundTarget（不含球）

球体 layer（1）
  SphereInstances（唯一对象）
                  │
                  └──→ sphereTarget（透明黑清屏，保留真实 alpha）

height ping-pong ───────────────────────┐
backgroundTarget + sphereTarget ───────┼──→ composite → 屏幕
uSpheres（几何/深度）──────────────────┘
```

只给 SphereInstances 设置 layer 1，原因是当前球体只有一个 InstancedMesh；背景/装饰全部天然留在 layer 0。这样不用修改每个装饰组件，也避免 Three.js layer 不继承给子对象所造成的漏渲风险。

当 `waterFx=false` 时，SphereInstances 必须回到默认 layer 0，由 R3F 原生路径正常渲染。layer 切换在 React commit 后、首帧前同步完成，禁止出现切开关后闪一帧或丢球。

### 3.2 一帧顺序

```text
priority 0
  球体、植物、微光、柱体更新

priority 1（WaterDistort）
  保存 renderer + camera 状态
  camera.layers = BACKGROUND_LAYER
  backgroundTarget 以不透明底色清屏并渲染
  camera.layers = SPHERE_LAYER
  sphereTarget 以 rgba(0,0,0,0) 清屏并渲染
  推进 height ping-pong
  分别处理背景水面与球体水下效果
  预乘 alpha 合成到默认 framebuffer
  finally 恢复 renderer + camera 状态
```

状态保存/恢复必须走 `try/finally`。至少覆盖：render target、clear color、clear alpha、autoClear、camera layer mask、viewport、scissor、scissorTest；不得把 layer 或透明清屏状态泄漏到下一帧、R3F 或调试 pass。

### 3.3 alpha 数学契约

SphereInstances 当前输出 `vec4(color, alpha)`，透明材质经过 Three.js NormalBlending 写入透明 FBO 后，纹理 RGB 按 alpha 预乘。新管线明确把 `sphereTarget` 当作预乘 alpha 纹理：

```glsl
vec4 sphere = texture2D(uSphereScene, sphereUv); // rgb 已预乘
sphere.rgb *= sphereWaveLight;                  // 乘法光保持预乘关系
sphere.rgb += additiveBallLight * sphere.a;     // 加法光必须乘 alpha
vec3 outRgb = sphere.rgb + background.rgb * (1.0 - sphere.a);
gl_FragColor = vec4(outRgb, 1.0);               // Canvas alpha=false，最终背景不透明
```

禁止以下写法：

- `mix(background.rgb, sphere.rgb, sphere.a)`：会对已预乘 RGB 再乘一次 alpha，边缘发黑。
- `sphere.rgb += light`：alpha 为 0 时仍留下亮圈。
- 在 sphereTarget 使用非透明清屏色：会重新制造圆外底色污染。
- 在球体 shader 内手动预乘后仍沿用当前 NormalBlending：会发生双重预乘。

### 3.4 折射与可见度解耦

新 shader 分开处理两条采样路径：

- **背景路径**：背景是水面下的连续底图，始终按水面梯度采样；不能因为某颗球正在消失而改变背景折射。
- **球体路径**：用 `uSpheres` 的几何深度决定当前像素对应球的出水/水下比例；水上采原 UV，水下采折射 UV，再按软边混合。
- **可见度路径**：只决定 sphere alpha、球体投影和球体局部光的权重，不再参与背景 UV 的选择。

这意味着现有 `computeAbove()` 要拆成“几何没入判定”和“视觉效果权重”两个概念。球体消失时：

- 背景恢复完整水面折射。
- 球体颜色、球上月光、球产生的影子/挡光/反光晕一起淡出。
- 球的几何深度仍稳定，不会因为 alpha 改变而出现折射跳动。

### 3.5 单一可见度来源

当前存在两套近似同步状态：

- `sphere-frame.ts` 的 `dimLerp` 决定真正画出来的球。
- `water-distort-setup.ts` 的模块级 `sphereVis` Map 再独立 lerp 一次遮罩。

两者虽然同为 `0.12`，但注册顺序、切组和首帧状态可能不同。新线将最终整体可见度写成 node 上的 `_visualDim`，由 SphereInstances priority-0 更新，WaterDistort priority-1 只读取；删除独立 `sphereVis` 状态机。

`_visualDim` 只表达整体可见度，不替代球体纹理的逐像素 alpha。它用于投影、挡光等解析式效果随球同步淡出；最终颜色合成以 `sphereTarget.a` 为准。

### 3.6 `/test3` A/B 对照按钮

视觉控制台增加一个两段式按钮：

```text
合成方式  [ 原合成 ] [ 真透明 ]
```

- 默认进入 `/test3` 时选择“原合成”，保证第一眼就是当前基线；用户主动点“真透明”查看新方案。
- 切换只改变 WaterDistort 的最终渲染路径，不重建 Canvas、不重建 GlSim、不重置球位置、水位、高度场、播放、hover 或生命感参数。
- 两种模式共用同一份 height ping-pong；切换前后的涟漪必须连续传播，不能因 A/B 归零而失去可比性。
- 按钮旁持续显示当前状态“原 / 新”，避免用户忘记正在看哪一版。
- 对照状态只属于 `/test3` 沙盒，可进入 URL query 方便刷新复现，但不进入生命感参数 localStorage，也不迁移首页。
- 在用户明确说“采用真透明，可以删除原合成”之前，A5 不得删除按钮或旧路径。
- 用户拍板后，删除旧路径、A/B flag 和按钮；最终生产代码恢复为单一真透明管线。

---

## 4. 连带反应矩阵

| 区域 | 可能连带反应 | 设计护栏 |
|---|---|---|
| R3F 渲染循环 | positive priority 已接管自动 render；多一个同优先级 pass 会互相覆盖 | 只扩展现有 WaterDistort priority-1；`rtt` spike 与 `waterFx` 明确互斥 |
| Three.js layers | layer 不会从 group 自动继承到所有子 mesh | 只设置唯一 SphereInstances，不给背景 group 批量设 layer；相机 mask 每帧恢复 |
| flag 切换 | `waterFx` 关闭后球仍停在 layer 1，会直接消失 | SphereInstances 接收 `separatePass`，同步切回 layer 0，并专项测试连续开关 |
| 透明边缘 | straight/premultiplied alpha 混用会产生黑边或双重变暗 | 固定预乘纹理契约；用纯色诊断背景验 0%/50%/100% alpha |
| pond floor | 旧亮度阈值把渐隐球识别成暗底 | pond floor 只处理 backgroundTarget；球体在其后合成，不再参与底图分类 |
| 焦散/月光 | 球体加法光未乘 alpha 会留下亮圈 | 所有球体局部加法项乘 `sphere.a`；乘法项只乘 sphere.rgb |
| 阴影/挡光 | 球消失但解析式投影仍在，会留下另一种黑圈 | 解析式效果统一乘 `_visualDim`；不再各自维护淡出状态 |
| 水下折射 | 用可见度驱动 `sub` 会导致球越透明、折射位置越跳 | 几何深度决定 sphereUv；alpha 只决定最终覆盖 |
| 球重叠 | 合并后的 sphereTarget 只有最终 alpha，解析式深度仍按球数组选择 | 保留“最大覆盖球”规则，并增加重叠球专项目验 |
| 装饰前后关系 | 分层可能把原本位于球上方的对象强制压到球下 | 以当前 JSX 顺序为基线：现有 GL 装饰都在球之前；DOM 花瓣仍在 Canvas 外，不进 FBO |
| DOM 命中层 | GL 球不可见但 DOM 仍可点，或标题透明不同步 | 继续复用现有 lifeDim/播放豁免；专项测试看不见不可误触的既定语义 |
| DPR / resize | 两张 target 尺寸短暂不一致会拉伸、读旧帧或闪黑 | 两 target 同一尺寸来源、同帧 resize；尺寸取 Canvas drawing buffer，不取 `window.innerWidth` |
| GPU 内存 | 1080p DPR2 新增 RGBA8 target 约 31.6 MiB | sphereTarget 无 depth/stencil/mipmap/MSAA；服从 AutoDpr 与 maxTextureSize |
| context restore | 新 target 恢复后可能含未定义旧像素 | restore 后重置 ping-pong 引用并主动清三张 target；Canvas 不重挂 |
| 颜色空间 | target colorSpace 或 tone mapping 改变会造成全屏色差 | backgroundTarget 沿用现 content 的格式/颜色空间；不顺手引入 sRGB 转换或 tone mapping |
| 资源生命周期 | 手建 target/scene 未 dispose 会在热更新或切 flag 时泄漏显存 | target 继续由 `useFBO` 所有；新增材质/几何若手建必须在 effect cleanup dispose |

---

## 5. 范围与文件规划

### 修改

- `src/components/pond-gl-test3/gl-flags.ts`
  - 增加沙盒专用 `trueAlphaComposite` A/B flag，默认 false，并支持 URL query 复现；不加入 `LIFE_FLAG_KEYS`。
- `src/components/pond-gl-test3/overlay/ScenePanel.tsx`
  - 在“生命感”的时隐时现附近增加“原合成 / 真透明”两段式按钮和当前状态，不使用含糊的单个 checkbox。
- `src/components/pond-gl-test3/PondGL.tsx`
  - 把 `waterFx` 状态传给 SphereInstances；把 `glSpheres` 和 `trueAlphaComposite` 明确传给 WaterDistort，支持无球时跳过 sphere pass 和原/新路径切换。
- `src/components/pond-gl-test3/spheres/SphereInstances.tsx`
  - 同步设置默认/球体 layer；不改变 instancing 和材质调参接口。
- `src/components/pond-gl-test3/spheres/sphere-frame.ts`
  - 将实际使用的整体 dim 写入 `node._visualDim`，成为水面解析式效果的单一可见度来源。
- `src/components/pond-gl-test3/spheres/gl-sim-setup.ts`
  - 为 `_visualDim` 补类型；建点初值为 1，切组不继承旧组状态。
- `src/components/pond-gl-test3/water/WaterDistort.tsx`
  - 持有 background/sphere/height targets；保持唯一 priority-1 帧编排器。
- `src/components/pond-gl-test3/water/water-distort-setup.ts`
  - 新增球体纹理 uniform；移除独立 sphereVis Map，效果权重读取 `_visualDim`。
- `src/components/pond-gl-test3/water/water-distort-shaders.ts`
  - 拆背景/球体采样，落实预乘 alpha 与透明度/几何解耦。

### 新增

- `src/components/pond-gl-test3/water/composite/render-passes.ts`
  - layer 常量、renderer 状态快照、背景/球体/sim/最终 pass 与 `try/finally` 恢复。

`water/` 当前正好 8 个文件，因此新增文件必须进入 `water/composite/` 子目录。`WaterDistort.tsx` 当前 194 行、`water-distort-setup.ts` 196 行、shader 188 行，实施时禁止继续把编排逻辑塞回原文件；超过 220 行前必须按职责下沉，不靠删注释硬挤。

### 明确不动

- `/test1`、首页、共享 `pond-gl/`、`archipelago/`。
- 音频、曲目、D3 布局、拖拽和 DOM 花瓣 overlay。
- `docs/ARCHITECTURE.md`、`docs/STACK.md` 和任何依赖。
- 不把 `RttSpike` 并入新管线；它是 H1 隔离实验，不是生产合成的一部分。

---

## 6. 分步执行

### A0 — 基线、能力与语义冻结（1.5–2 小时）

- 确认 `waterFx=true`、`rtt=false` 是本线唯一工作组合；若 URL 同时开两者，开发环境给明确告警，不让两个 priority-1 renderer 互相覆盖。
- 记录桌面 DPR1/DPR2 与窄屏的截图/短录屏和指标：FPS、draw calls、drawing-buffer 尺寸、target 数量。
- 基线矩阵：
  - 水面、塘底、焦散、月光倒影分别开/关。
  - 球在水上、入水软边、浅水、深水。
  - 全显、50% alpha、完全消失、hover、播放、拖拽、两球重叠。
- 加临时纯红/纯绿诊断底，专门观察透明边缘是否发黑；诊断入口 A5 删除。
- 先落 `/test3` 的“原合成 / 真透明”两段式按钮；此时两边都指向原管线，点击只能改变状态文案，画面必须完全一致，用来验证按钮本身不会重置场景。
- 输出：一份明确基线；不改生产视觉。

### A1 — 帧编排与 layer 骨架（2–3 小时，零视觉）

- 把现有 `tick()` 机械迁入 `render-passes.ts`，先仍只渲旧 content target，证明提取前后像素一致。
- 定义 `BACKGROUND_LAYER=0`、`SPHERE_LAYER=1`；SphereInstances 仅在 `waterFx=true` 时进入 layer 1。
- 实现 renderer/camera 状态快照与 `try/finally`，但此步不启用第二 target。
- 验收：所有 flag 关闭或保持默认时与 A0 一致；连续切 waterFx 20 次不丢球、不闪首帧；context 数量不增长。
- 回滚：单独 revert 本步，不触碰 shader。

### A2 — 双 target 与 alpha 契约（3–4 小时）

- 将旧 content target 语义改名为 `backgroundTarget`，尺寸/格式/颜色空间与旧 content 完全一致。
- 新增 `sphereTarget`：RGBA8、Linear、Clamp、无 depth/stencil/mipmap/MSAA，透明黑清屏。
- `glSpheres=false` 时不执行 sphere pass，并给 composite 传透明纹理/`uHasSpheres=0`，避免无意义带宽。
- 加临时 debug view：background RGB、sphere RGB、sphere alpha、final 四档。
- 将“真透明”按钮接到双 target 新路径；“原合成”继续走 A0 冻结的 combined-content 路径。两条路径共享同一高度场与球节点，禁止各自维护一份 sim。
- 用诊断底验证 sphereTarget：球外 alpha=0；球边 alpha 连续；RGB 是预乘结果；0% alpha 时 RGB 也为 0。
- 验收：此步先以 alpha=1 合成，视觉与 A0 一致；只证明分层正确，不迁移水面光照。

### A3 — 真透明与折射解耦（4–6 小时，核心）

- 背景始终使用背景折射 UV；不再读取球可见度来决定背景 sampleUv。
- 球体分别采样原 UV 与水下折射 UV，由几何深度软混合；防鬼影逻辑只作用于 sphere texture。
- final 使用预乘 alpha over 公式，输出 alpha 固定 1。
- `sphere-frame` 写 `_visualDim`；`applySpheres` 删除独立 sphereVis Map，解析式效果只读 `_visualDim`。
- 所有球体局部加法光乘 `sphere.a`，投影/挡光/反光晕乘 `_visualDim`。
- 验收：0%/50%/100% alpha 都无黑圈、亮圈、暗边；透明变化不改变背景涟漪的位置和幅度。

### A4 — 水面效果逐项迁移（3–5 小时）

严格按以下顺序，每完成一项立即对照 A0，失败就停在当前项：

1. pond floor：只处理 backgroundTarget；保留装饰保护，不再把球当亮度分类对象。
2. 水下球折射和 `waveOnBall`：只修改 sphere.rgb，保持预乘关系。
3. 球上焦散/月光：加法项乘 sphere.a；水上/水下衰减保持现参数语义。
4. 暗影、挡月光、反光晕、接触影：统一乘 `_visualDim`，球完全消失时效果也为 0。
5. debug 水位、waterZoom、鼠标/点击涟漪：确认只改变应改变的 target/UV。

验收：每项单开和常用组合都无圈；球淡出期间水面光照连续，不出现某一帧跳亮或跳暗。

### A5 — 删除临时逻辑，收敛为单路径（1–2 小时）

- 本步有用户 gate：先保留 `/test3` A/B 按钮，请用户在同一场景反复切换并明确说“采用真透明”。没有这句确认，本步停在这里，不提前清理。
- 逐条 A/B 当前临时改动：`uSphereVis × _lifeDim`、pond-floor 对渐隐球的亮度补丁。
- 新架构仍有明确语义的部分重命名后保留；仅为遮黑圈存在的部分删除。
- 用户确认后删除 alpha/RGB debug view、纯色诊断底、`trueAlphaComposite` flag、A/B 按钮和运行期旧管线路径。
- 不保留“alphaFlicker 关走旧管线、开走新管线”的生产分支；回滚依靠本线独立 commits。
- 验收：代码只有一个 waterFx 合成真相来源；关闭 alphaFlicker 仍走同一管线且与 A0 一致。

### A6 — 性能、恢复与完整回归（2–3 小时）

- 桌面 Chrome/Edge、窄屏、触屏模拟各跑一次：
  - 切换 1/2/3 组、滚轮、hover、播放、拖球、重叠球。
  - 所有生命感 flag 单开与常用组合。
  - waterFx/glSpheres 连续切换、resize、DPR 升降、后台切回。
- 模拟 context lost/restore：恢复后主动清 background/sphere/height targets，重置 ping-pong read/write，不重挂 Canvas。
- 对比 A0：桌面持续 FPS 下降不得超过 10%；AutoDpr 降档后两 target 必须同帧同尺寸。
- 跑 `bash scripts/verify.sh`，再由用户在 `/test3` 做最终目验。

---

## 7. 性能与资源预算

- 当前帧：场景 pass + sim pass + composite pass，共 3 个主要 pass。
- 新帧：背景 pass + 球体 1 draw-call pass + sim pass + composite pass，共 4 个主要 pass。
- 新增的主要显存是 sphereTarget：1920×1080、DPR2 的 RGBA8 约 31.6 MiB；禁用 depth/stencil/mipmap/MSAA 后不再额外翻倍。
- backgroundTarget 与 sphereTarget 必须共享同一有效 drawing-buffer 尺寸，并 clamp 到 `gl.capabilities.maxTextureSize`；禁止直接用 `window.innerWidth × devicePixelRatio` 各算一套。
- sphere pass 保持一个 InstancedMesh draw call；禁止退化成逐球 pass。
- 不按 alphaFlicker 动态创建/销毁 target，避免开关瞬间显存抖动和 shader 首帧编译卡顿。
- 只有 `glSpheres=false` 时允许跳过 sphere draw；target 可保留复用，避免频繁分配。
- 若性能不达标，按顺序处理：
  1. 检查 target 是否误挂 depth/stencil/mipmap/MSAA。
  2. 检查是否整场景被重复画进 sphere pass（layer 泄漏）。
  3. 服从 AutoDpr 降低两张颜色 target 的统一尺寸。
  4. 最后才评估 sphereTarget 独立低分辨率；若边缘变糊或错位则放弃该优化。

不接受“只在 alphaFlicker 开时换管线”作为性能优化，因为它会制造两套行为和开关视觉跳变。

---

## 8. 验收清单

### 视觉正确性

- [ ] `/test3` 可直接点击“原合成 / 真透明”切换，当前模式标识清楚。
- [ ] A/B 切换不重置球位置、水位、播放状态或正在传播的涟漪，同一画面可直接比较。
- [ ] 时隐时现 0%/50%/100% 三档均无黑圈、灰圈、亮圈、黑边和残影。
- [ ] 球消失时恢复真实池底、装饰和连续水纹，不是静态补色。
- [ ] 透明度变化不改变背景涟漪位置、大小或传播速度。
- [ ] 水上、入水软边、浅水、深水球的折射连续。
- [ ] 焦散、倒影、四种投影分别开关时，球消失后对应局部效果也完全撤销。
- [ ] 两球重叠、一颗渐隐时，另一颗不出现破洞或颜色污染。
- [ ] hover、播放球始终按既定豁免保持可辨认。

### 交互与状态

- [ ] DOM 标题、角标、拖拽命中与球位置同步。
- [ ] 切换 1/2/3 组不继承上一组 `_visualDim`，不出现首帧闪烁。
- [ ] waterFx 连续开关后球不会因为 layer 未恢复而消失。
- [ ] glSpheres 关闭时 sphere pass 不绘制，背景水面正常。
- [ ] `rtt=false`；若开发 URL 同时开 rtt/waterFx，有明确告警而非静默互相覆盖。

### 工程与性能

- [ ] renderer/camera 状态在每帧结束后完整恢复，异常路径也恢复。
- [ ] 两张颜色 target 在 resize、AutoDpr、context restore 后尺寸一致且无旧帧。
- [ ] 无新增 WebGL context；切 flag 不持续增长 GPU 资源。
- [ ] 所有生命感 flag 关闭时与 A0 基线一致。
- [ ] 桌面持续 FPS 相比 A0 不下降超过 10%。
- [ ] 代码文件 ≤220 行、目录 ≤8 文件、`scripts/verify.sh` 全绿。

---

## 9. 明确拒绝的替代方案

- **继续调 pond-floor 阈值或 `uSphereVis`**：只能隐藏某一组参数下的圈，无法恢复球后真实像素。
- **把整个 Canvas 改成 alpha=true**：只能让 Canvas 透到底层 DOM，解决不了同一 WebGL 场景内被球覆盖的池底。
- **第二个 Canvas 专门画球**：增加上下文、同步、DPR、context-lost 和合成顺序问题，违背现有 J1 单 Canvas 稳定性决策。
- **MRT 同时输出颜色/深度/遮罩**：WebGL2 依赖与 shader 复杂度超出本问题需要，/test3 现有解析式深度已够用。
- **每球独立 render target**：36–48 倍 pass 和显存，不可接受。
- **把旧/新双路径带入最终生产**：`/test3` 验收期必须保留 A/B 按钮满足用户直观对照；用户拍板后继续长期保留才会造成僵化，届时应删除旧路径并依靠 git 回滚。

---

## 10. 提交与回滚顺序

1. `refactor(p8-l): 提取水面帧编排并固定渲染状态`
2. `refactor(p8-l): 分离背景与球体渲染目标`
3. `fix(p8-l): 统一球体可见度状态`
4. `fix(p8-l): 用预乘透明合成消除黑圈`
5. `fix(p8-l): 恢复水面光照与投影语义`
6. `chore(p8-l): 删除临时管线并完成性能回归`

每个 commit 都必须可运行、可独立回退。A3 后若仍有圈，保留 sphere RGB/alpha debug 证据并回退到第 3 个 commit；不得继续增加颜色阈值补丁。

---

## 11. 完成定义

只有同时满足以下条件，黑圈问题才算关闭：

1. 视觉、交互、工程验收清单全部通过，并有 A0/A6 对照证据。
2. 最终只有一套 waterFx 合成路径；透明度不参与背景折射几何决策。
3. 球体局部加法光遵守预乘 alpha，球完全消失时不留下任何解析式效果。
4. 临时 pond-floor/遮罩补丁和 debug 入口已完成取舍，没有双重状态机。
5. 用户已使用 `/test3` 的“原合成 / 真透明”按钮完成同场景对照，并明确确认采用真透明；随后旧路径、A/B flag 和按钮已删除。
6. `STATUS.md`、`docs/LEARNING.md`、`docs/JOURNAL.md` 已同步。
7. 用户在 `/test3` 亲眼确认后，才讨论是否迁移首页。

---

## 12. R1 — 严格分层与曝光维修（2026-08-23）

> 本节是用户验收真透明后的维修规格，优先级高于前文施工期 A/B 要求。用户已明确废弃原合成，不恢复旧 shader、flag 或对照按钮。
>
> **2026-08-23 用户复验结论：R1 失败。** 单张 `sphereTarget` 只保存最终 RGBA，不保存该像素来自水上球还是水下球；合成 shader 的解析圆形遮罩无法与真实球边、重叠关系和抗锯齿 alpha 完全一致。R1 的 `dryBackground` 混合只能缓解，不能保证水上球彻底绕开水纹与增亮，禁止继续在此方案上调阈值。

### 12.1 已确认问题

1. **水面层级错误**：几何 `above` 能正确区分水上/水下，但当前 shader 先整屏生成折射、焦散和倒影，再让半透明球覆盖；水上球内部仍透出动态水面，视觉上等同水面压在球上。
2. **球体过度曝光**：球体 RGB 先乘 `waveOnBall`，再直接加焦散/月光；亮色球缺少剩余亮度空间，容易超过 1 后裁成死白。
3. **参数调暗不是根治**：关闭焦散/倒影能缓解曝光，却不能修复水上/水下的合成语义，因此不以降低全局亮度代替架构维修。

### 12.2 冻结的视觉规则

- **水上球**：使用原 UV；不吃折射、波纹、焦散或月光增亮；半透明处只能看到无动态水光的背景。
- **水下球**：使用折射 UV；允许克制的波纹明暗和环境水光。
- **出入水软边**：沿现有几何 `above` 连续混合，禁止突然跳层、闪白或闪黑。
- **透明消失**：球体视觉 alpha 归零时，背景恢复完整水面，不留下干燥圆盘、亮圈或暗圈。
- **亮度上限**：球体增亮只能占用预乘颜色到 `sphere.a` 的剩余空间；禁止直接把 RGB 加到可表示范围之外。

### 12.3 实现契约

1. 保留 background/sphere 双 target，不新增 Canvas、MRT、依赖或第三套运行路径。
2. composite 同时保留 `dryBackground`（原 UV、无动态水光）和 `wetBackground`（折射、焦散、倒影完整路径）。
3. 球体区域按“几何 above × 实际可见度”选择背景；几何 above 仍单独控制 sphere UV，禁止让 alpha 改变折射位置。
4. 水上球的水光增益固定为零，删除失去语义的“水上球衰减”调参；水下球参数继续保留。
5. 正向波纹与环境光使用 headroom 公式：向 `vec3(sphere.a)` 靠近；负向波纹只做乘性减光，保持预乘 alpha。
6. 最终仍使用 `sphere.rgb + background * (1.0 - sphere.a)`；不得恢复亮度阈值抠球。

### 12.4 验收矩阵

- [ ] debug 遮罩中绿色水上球完全无折射、焦散、倒影和波纹扫光。
- [ ] 红色水下球保留折射和轻微水光，且不会爆白。
- [ ] 球在水线两侧往返时层级连续，没有整球突然切换。
- [ ] 白色播放球、浅黄色球、红球均保留内部色阶，不出现大面积纯白裁切。
- [ ] 焦散/倒影全开时仍不改变水上球；全部关闭时球亮度不发生异常跳变。
- [ ] `alphaFlicker` 0%/50%/100% 无干燥圆盘、黑圈、亮圈。
- [ ] 两球重叠、hover、播放、拖拽、切组、resize/DPR 后语义不变。
- [ ] `/test3` 与兼容入口 `/test4` HTTP 200；类型、lint、生产构建和 `git diff --check` 通过。

---

## 13. R2 — 显式水上/水下渲染通道（2026-08-23）

> **用户视频复验结论：R2 仍失败。** `C:\Users\Hui\111221.mp4` 的 1.89s、2.76s、5.34s、6.20s、8.78s 可见点击同心圆穿过已浮出的球体。原因不是通道身份丢失，而是 R2 仍让水上球主体保持半透明，并用 `aboveSupport=smoothstep(0.55,0.88,alpha)` 主动保留部分湿背景；水面高光也因此绕过水下球的 headroom 限幅，从球后透入并形成爆白亮带。

### 13.1 根因修正

- 水上/水下身份必须在球体 draw 时保留，不能等球体已经压成一张 RGBA 纹理后再按屏幕坐标猜。
- 每个 instance 增加 `aSubmerge`，直接复用 `getSubmerge(displayDepthOf(node))`；CPU、DOM 与 GPU 继续共享同一条水位曲线。
- 球体材质增加内部 pass 模式：普通、水下、水上。它只裁分 alpha，不改原颜色、位置、形状和生命感参数。

### 13.2 帧顺序

1. 背景层进入 `backgroundTarget`。
2. 球体材质切到“水下”，仅水下权重进入 `sphereTarget`。
3. 球体材质切到“水上”，仅水上权重进入 `aboveSphereTarget`；这张纹理同时提供真实球边 alpha 与层级身份。
4. composite 生成完整动态水面：水下球合成到湿背景；水上球主体以真实 alpha 揭示原 UV 静态背景后覆盖到最上层，低 alpha 光晕仍透出水面，避免干燥圆盘。
5. `finally` 恢复球体材质为普通模式，并恢复 renderer/camera 状态。

入水软带使用互补权重：水下 `submerge`、水上 `1-submerge`，二者之和恒为 1；因此穿越水线时连续，但任何属于水上通道的颜色都不再经过水面 shader。

不能只在 composite 后直绘半透明水上球：那样动态水纹仍会从透明部分透出。R2 因此接受一张额外 RGBA8、无 depth/stencil/MSAA 的 `aboveSphereTarget`，以确定性层级换取约一张颜色纹理的显存；仍保持单 Canvas、单材质和 instanced draw。

### 13.3 曝光规则

- 水上通道完全使用原球 shader，不叠 `waveOnBall`、焦散或月光增亮。
- 水下通道保留 R1 的预乘 headroom 限幅，`sphere.rgb` 始终不超过 `sphere.a`。
- 删除 R1 的解析圆形 `dryBackground` 权重与 `sphereUv` 混合；干背景只由真实 `aboveSphereTarget.a` 揭示，不以降低全局焦散、倒影或球色参数冒充修复。

### 13.4 R2 验收

- [ ] 水上球直接覆盖在最终水面之上，点击/划水时球内无涟漪扫光或折射位移。
- [ ] 水上浅色球保持原有内部色阶，不受焦散、倒影和 `waveOnBall` 参数影响。
- [ ] 水下球仍有折射和受限水光，亮度不超过预乘 alpha 可表示范围。
- [ ] 出入水软带连续，无闪白、闪黑、重影或 alpha 跳变。
- [ ] `waterFx` 关闭后材质恢复普通模式，球不会因残留 pass 状态消失。
- [ ] 类型、lint、生产构建、路由与文件/目录约束全部通过；最终视觉仍以用户目验为准。

---

## 14. R3 — 水上实体主体 + 透明光晕（最终限界尝试，2026-08-23）

### 14.1 产品语义

- 放弃“水上球主体真透明”；水上球是浮在水面的发光实体，主体必须遮住水面。
- 只有 body 外的 halo 保持透明，允许水面从光晕后方自然可见。
- 水下球继续进入折射、波纹和受限水光路径。
- `alphaFlicker` 不再降低水上主体覆盖度，只作用于 halo；否则主体淡出时水纹必然重新穿入。
- 播放态对非播放球的既有淡出仍保留，因为那是明确的界面状态，不属于生命感透明效果。

### 14.2 唯一实现方案

1. 保留 R2 已有的水下/水上球 target，不新增 target、Canvas、MRT、依赖或第三套遮罩。
2. 球 shader 增加独立 `aLifeDim`：halo 使用 `playDim × lifeDim`；水上 body 使用 `playDim`，忽略 `lifeDim`。
3. 水上 pass 的 body alpha 至少为 `bodyMask × playDim × aboveWeight`；完全出水、非播放淡出时主体 alpha=1。
4. 水位视觉通道把现有宽 `submerge` 曲线压成窄门：`smoothstep(0.45,0.55,submerge)`；球明确出水后水下 target 必须为透明黑。
5. composite 删除 `dryCol`、`aboveSupport` 和静态背景圆盘；最终只做水下球 over 湿背景，再做水上实体球 over。
6. debug 不再显示解析圆形猜测，直接显示真实 target alpha：绿=水上、红=水下；完全出水球内部不得出现红色。

### 14.3 曝光边界

- 水上 body 颜色直接来自原球 shader，不叠 `spec`、焦散、倒影或 `waveOnBall`。
- 水下球继续使用预乘 headroom，RGB 上限为 alpha。
- 禁止为了通过目验降低全局 `specular`、焦散、倒影、球亮度、浓度或光晕参数。
- 禁止 final 全屏 clamp 冒充修复；必须从层级上阻断水面亮带进入水上主体。

### 14.4 验收与硬止损

- [x] debug 中完全出水球为纯绿色主体，水下纹理红色为 0；混合水位红/绿分流正确（Edge 自动复验）。
- [x] 正常视图在完全出水球中心点击，涟漪可绕过/经过 halo，但主体内部无同心圆、亮带或折射位移（点击中心 `{x:519,y:533,r:37}` 动态截图复验）。
- [x] 浅黄、白、红、橙四类球在涟漪经过前后保持同一主体颜色，不爆白。
- [x] 水下球仍显示水纹；滚轮穿越水线保持连续（2026-08-26 用户 R3 最终目验通过）。
- [x] `alphaFlicker` 开启时水上主体仍稳定，真实水上 target 保持完整纯绿主体。
- [x] 播放、hover、切组、resize/DPR 与 `waterFx` 开关回归通过（浏览器矩阵 + 用户最终目验）。
- [x] 完整 `scripts/verify.sh`、42 个合约测试、`/test3`、`/test4` 与硬线检查通过（2026-08-24）。

**止损线**：R3 不允许再增加 R4 遮罩或调亮度补丁。若真实点击视频中完全出水球主体仍出现水纹/爆白，立即回退到真透明前稳定版本，关闭主体透明度时隐时现；本方向终止。
