# Phase 8-C — 开源方案引入（音频联动 / 噪声流场 / 回摆弹簧）

> **定位**：把 2026-06-12 三路开源调研（原 `p8-opensource-candidates.md`，已整理并入本文件）变成可逐步执行的引入 track。每个引入项 = 一个 `EffectsConfig` flag，/test 可手动开关。
> **前置**：与 P8-A/B 基本无文件冲突，可并行；唯 C1 的 displacement 联动信号要等 P8-A S1 的 `use-water-field.ts` 存在。
> **状态**：待用户说"开始 P8-C"。C2 需用户先批准装包。
> **铁律**：沿用 8-B 的抽象铁律 + 沙盒铁律 + flag 五件套（`phase-8-b-effects-migration.md` §0）；P8 全局模块化铁律见 `overview.md`。

---

## 0. 调研结论速览

| 层级 | 方案 | 成本 | 判定 |
|---|---|---|---|
| T0 原生/已白名单 | Web Audio AnalyserNode 音频联动 | ~150 行 / 0 依赖 / <0.1ms 每帧 | **C1 必做，性价比之王** |
| T0 | prefers-reduced-motion 接入（项目现状零接入） | ~10 行 | C1 顺手补 |
| T0 | tween.js `Easing.Elastic.Out`（已白名单） + 手写 20 行欠阻尼弹簧 | 0 包 | C3 |
| T0 | two.js 挖潜（已白名单，48.7KB 已在 bundle） | 0 包 | 备用引擎，需要顶点级有机变形时才启用 |
| T1 需登记 | simplex-noise@4.0.3（1.8KB gzip / MIT / 活跃 / TS） | 1 个小包 | **C2，需用户批准** |
| T2 直接抄 | liquid-glass 高光、yoksel 滤镜参数、CSS Fireflies 结构、月亮倒影 pen | 0 包 | 随 8-B S2/S4/S5 消化，不在本 track 立步 |
| T2 | Codrops gooey 粘连配方（MIT 已核实可商用） | 0 包 | C4 可选 |
| T3 gate | d3-force-limit@1.2.2（669B）塘岸边界 | 1 个微包 | 备选，视觉需要时再议 |
| 废弃 | Lottie（具象骨骼动画，抽象口径下无用）、具象 SVG 素材、flubber/zdog/css-doodle、全部弹簧库、web-audio-beat-detector（离线不适用流播）、Houdini（Chromium-only） | — | 不再回头看 |

---

## C1 — 音频联动：`audioPulse` + `beatRipple`【零依赖】

**目标**：字面实现产品隐喻"音乐在水面荡开涟漪"。两个独立 flag：`audioPulse`（能量驱动的连续脉动）、`beatRipple`（节拍触发的离散涟漪），/test 可分别开关。

**架构契合（已勘探）**：`PlayerProvider.tsx` 是单一 lazy `new Audio()` 永不销毁、换曲只换 src——正好匹配 `createMediaElementSource` 只能调一次的约束；播放由点击触发 = AudioContext 解锁手势天然存在；音频在 `public/tracks/`（同源）无 CORS 问题。

**实现**（新建 `src/components/archipelago/hooks/use-audio-energy.ts`，90-120 行）：

1. **建图**（仅 flag 开启且首次 `playing=true` 时执行；flag 关 = 完全不进 audio graph，零风险回退）：
   ```
   ctx = new AudioContext()                       // 点击内创建，勿模块加载时建
   src = ctx.createMediaElementSource(audio)       // 仅一次！ref 守卫（防 StrictMode 双跑）
   analyser = ctx.createAnalyser()                 // fftSize=1024, smoothing≈0.7
   src.connect(analyser); analyser.connect(ctx.destination)   // 必接 destination，否则静音
   ```
2. **能量/节拍**（手写 ~30 行，放弃一切节拍库）：每帧 `getByteFrequencyData` → bass = bins 1-5 均值（≈43-215Hz）→ 快攻(0.4)慢放(0.08)包络 `env` + 长期均值 `hist` → `beat = bass > hist*1.4 && bass > 0.12 && 距上次 >280ms`。输出连续 `env`(0-1) + 离散 `beat` 事件。
3. **三个绑定点**：
   - `audioPulse`：播放球 `scale *= 1 + env*0.07`（`use-sphere-sim.ts:177-180` 本就每帧写 transform，搭车成本 ≈0）；日食月亮同步脉动（`render-eclipse-moon.ts` 同模式）。
   - `beatRipple`：beat 时以播放球 sim 坐标 dispatch `bg-ripple:wave` + `bg-ripple:spawn`（短周期变体 3-5s、小半径，限流 ≥1.2s 间隔，防撞 MAX_AUTO=4）。
   - displacement 联动：`env` 作为 P8-A `use-water-field.ts` 的一路加项（播放球权重最大、邻球衰减，+10 行）——归 P8-A 验收，不另立 flag。
4. **坑位清单**（全部已查证）：每次 `play()` 内 `ctx.resume()`；`visibilitychange` 监听 resume（iOS interrupted 态）；创建元素时 `audio.crossOrigin='anonymous'`（赋 src 前，防未来迁 Arweave 网关）；`stop()` 后停采样并把 env 归零淡出；PlayerProvider 暴露 `getAudioElement()`（+3 行，不动核心逻辑）。
5. **顺手补 prefers-reduced-motion**：在 DESKTOP/MOBILE 基线选择处（`use-responsive-effects.ts`）检查 `matchMedia('(prefers-reduced-motion: reduce)')`，命中则**按规则关 `EFFECTS_META` 中 group=运动 的全部 flag**（2026-06-12 关联审查改为规则式判断——P8 候选池后运动类 flag 持续增多，列举清单必然过时，规则式对新 flag 自动覆盖）。这不是视觉功能，是无障碍基线 gate，不立 flag。

**性能**：`getByteFrequencyData(1024)` <0.05ms（FFT 在音频线程算好，调用只是拷贝 512 字节）；合计每帧新增 <0.1ms。
**flag 接入**：两个 key 进 `EffectsConfig` + `EFFECTS_META`（group=运动），桌面/移动默认 false；`DEGRADATION_ORDER` 不进（成本可忽略，且是播放核心反馈）。
**验收**：`/test?audioPulse=1` 播放时球随低频呼吸；`?beatRipple=1` 强拍处涟漪从球心荡开推动邻球；两 flag 全关 = 与现状完全一致；暂停后视觉 1s 内归静。

## C2 — 噪声流场：`flow`【需批准装包】

**前置**：用户批准 `npm install simplex-noise@4`（1.8KB gzip / MIT / 0 依赖 / TS 自带 / 2024-07 活跃）并登记 `docs/STACK.md` 白名单。**未批准前本步不动**。

**实现**：
1. 新建 `src/components/archipelago/forces/flow-force.ts`（~30 行）：自定义 d3 force——每 tick 对每球 `n.vx += noise3D(n.x*0.002, n.y*0.002, t*0.0001) * strength * alpha`（x/y 各一路错相位噪声；strength 量级 ≈0.05-0.15，体感"水在极缓慢地流"）。查证确认 d3-force 生态没有现成流场插件，自写是唯一路径。
2. `sphere-sim-setup.ts` 按 `effects.flow` 条件 `sim.force('flow', ...)` / 移除。
3. 噪声实例模块级单例；seed 用项目现有 hash 自写 PRNG（不另装 alea）。
4. 同包复用（不另立 flag，挂在各自宿主 flag 下）：浮光游走路径（8-B S5）、浮影暗斑边缘呼吸（8-B S7，配 ~50 行 vendored catmull-rom spline，@georgedoescode/spline 思路）、落滴轨迹微抖（8-B S7）。

**flag**：`flow`（group=运动），默认 false。进 `DEGRADATION_ORDER`（排 layerWave2 之后）。
**验收**：`?flow=1` 球群整体有不可预测的缓慢流动感（非同步、无方向偏置积累）；关掉回 d3 现状；FPS 零跌幅（纯算术）。

## C3 — 受扰回摆：`springBack`【零依赖】

**目标**：水感三原则之三"受扰必回摆"——被涟漪/水痕推开的球过冲→回摆→衰减，而非均匀摩擦滑回。

**实现**：
1. `render-helpers.ts`（或新建 `forces/spring.ts`）加 20 行半隐式欧拉弹簧：
   ```js
   // ζ = c/(2√k)，水面回摆 ζ≈0.3–0.5；dt clamp 防 tab 切回爆冲
   s.v += (-k * (s.x - target) - c * s.v) * Math.min(dt, 1/30);
   s.x += s.v * Math.min(dt, 1/30);   // k=60, c=6 起步
   ```
2. 接线：`effects.springBack` 时，`pushSpheresByWaves`（`sphere-sim-setup.ts`）推球后给球挂一个弹簧状态，anchor 回归阶段用弹簧替代纯 forceX/Y 拉回（直接读写 node.vx/vy 融合）。
3. 分工：可打断/带速度场景（波推、拖拽释放）用弹簧；固定时长补间（涟漪圈、UI 归位）用已白名单的 `tween.js Easing.Elastic.Out`（纯函数，`TWEEN.update(t)` 嵌现有 rAF）。
4. 全部弹簧库已查证放弃：wobble（7 年未维护，只抄其闭式解文档）、motion（framer 家族灰名单）、react-spring（接管渲染耦合高）、popmotion（停更）。

**flag**：`springBack`（group=运动），默认 false。
**验收**：`?springBack=1&bgRipples=1` 点击空白，被推开的球有 1-2 次肉眼可辨的过冲回摆；关掉回纯阻尼滑回；拖拽行为不受影响。

## C4 — 水珠粘连：`gooey`【可选，体验后拍板去留】

**实现**：Codrops CreativeGooeyEffects 经典配方（MIT，官方 license 页确认 demo 可商用）——`feGaussianBlur(stdDev≈6) → feColorMatrix(alpha 18 -7 压对比) → feComposite(atop)` 挂在**包住球群的 `<g>`** 上，球互相靠近时边缘粘连融合如水珠。
**风险**：这是大 region 滤镜，与 glow filter 叠加的 GPU 成本必须真机实测；与 P8-A waterRipple 滤镜同 `<g>` 叠加时注意 filter 链顺序。**另（2026-06-12 关联审查）**：gooey 包住球群 g 时，waterDrop（8-B §2.3）的高光/内反光小图层会被一起糊成粘连体——实测时与 waterDrop 同开专项看，必要时 gooey 只包主球层或与 waterDrop 互斥。掉帧压不住 → 本 flag 永久搁置（进 `DEGRADATION_ORDER` 第一位）。
**flag**：`gooey`（group=渲染），默认 false。
**验收**：`?gooey=1` 相邻球边缘融合、拖球穿过球群有"拉丝"感；点击判定不受影响（filter 只改像素）；FPS ≥55 否则降级。

## C5 — d3 参数水化：`viscous`【零依赖，2026-06-12 关联审查立项】

**目标**：8-A 补充二点名的"削弱 forceManyBody / forceLink（去星系结构感）+ 调高 velocityDecay（黏滞如水）"此前**无 flag 无归属**（flow/springBack 只覆盖了另外两条），现立项收口。

**实现**：`sphere-sim-setup.ts` 按 `effects.viscous` 切换一组 sim 参数（manyBody strength 削减、link strength 削弱、velocityDecay 调高至黏滞档——具体数值开工时在 /test 现场调），flag 关 = 现参数原样。与 flow（噪声微流）、springBack（回摆）正交可叠加。

**flag**：`viscous`（group=运动），默认 false。不进 `DEGRADATION_ORDER`（纯参数零成本）。
**验收**：`?viscous=1` 球群漂移明显更黏滞缓慢、星系簇结构感减弱；关掉回现状；拖拽手感不破坏。

## 随 8-B 各步消化的"直接抄"资源（不在本 track 立步）

- 8-B S2 `waterDrop` ← liquid-glass 高光/边缘渐变参数（shuding 1018★ / nikdelvin，MIT；不抄 backdrop-filter 路线）
- 8-B S4 `caustics` ← yoksel waves 配方（`feTurbulence 0.01 0.05 oct2 → feDisplacementMap scale20 G/A`）
- 8-B S5 `pondLights` ← mikegolus CSS Fireflies 双层结构（只取光点，不取萤火虫叙事）
- 水中月（EclipseLayer 改造，归 P8 氛围步）← ruhantai 月亮倒影 pen（零 JS：翻转+模糊+波动）

## 留 gate

- `d3-force-limit@1.2.2`（669B/MIT/活跃）：塘岸硬边界，视觉上需要"球永不漂出视口"时一行接入。

---

## 切步与停下

| Step | 内容 | 📦 范围 | 前置 |
|---|---|---|---|
| **C1** | audioPulse + beatRipple + reduced-motion | +`use-audio-energy.ts`、`PlayerProvider.tsx`(+3行)、`use-sphere-sim.ts`(+4行)、`use-responsive-effects.ts`、`effects-config.ts` | 无 |
| **C2** | flow 噪声流场 | STACK.md 登记、+`forces/flow-force.ts`、`sphere-sim-setup.ts`、`effects-config.ts` | **用户批准装包** |
| **C3** | springBack 回摆弹簧 | `render-helpers.ts` 或 +`forces/spring.ts`、`sphere-sim-setup.ts`、`effects-config.ts` | 无 |
| **C4** | gooey 粘连（可选） | `SphereCanvas.tsx` 或 `SphereGlowDefs.tsx`、`effects-config.ts` | 用户说要试 |
| **C5** | viscous d3 参数水化 | `sphere-sim-setup.ts`、`effects-config.ts` | 无 |

每步：verify.sh → 6 行汇报 → 等"继续"。停下条款沿用 8-B §4，另加：C2 未获装包批准 → 停；C4 真机 FPS 压不住 → 停并建议搁置。

## 完结标准

- [ ] `/test` 面板出现 audioPulse / beatRipple / flow / springBack / viscous /（可选 gooey）独立开关，逐个可开关、关 = 完全回现状
- [ ] 播放音乐时：球呼吸 + 强拍涟漪荡开推动邻球（双 flag 开启下）
- [ ] simplex-noise 已登记 STACK.md（若 C2 执行）
- [ ] prefers-reduced-motion 命中时运动类 flag 自动关
- [ ] verify.sh 全绿 + 真机 FPS ≥55
- [ ] STATUS/JOURNAL 同步

---

## 附录：功能 × 前端案例链接表（2026-06-12 核实）

| 功能 | 案例链接 |
|---|---|
| 球随音乐脉动（audioPulse） | ⭐[Chrome Music Lab](https://musiclab.chromeexperiments.com/)；[mattdesl kick analyser gist](https://gist.github.com/mattdesl/89359a19ed6a3eea180a3dcfc64ef221) |
| 节拍涟漪（beatRipple） | ⭐[Plink](https://experiments.withgoogle.com/plink-multiplayer-music-experience)；[kaleidosync](https://github.com/zachwinter/kaleidosync)；[awesome-audio-visualization](https://github.com/willianjusten/awesome-audio-visualization)；[MDN 可视化接法](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API) |
| 噪声流场（flow） | ⭐[Varun Vachhar: Noise in Creative Coding](https://varun.ca/noise/)；[Sighack: Perlin Flow Fields](https://sighack.com/post/getting-creative-with-perlin-noise-fields)；[simplex-noise 仓库](https://github.com/jwagner/simplex-noise.js) |
| 回摆弹簧（springBack） | [wobble（闭式解公式文档）](https://github.com/skevy/wobble)；[tween.js easing 曲线图](https://tweenjs.github.io/tween.js/examples/03_graphs.html) |
| gooey 粘连 | [Codrops CreativeGooeyEffects](https://github.com/codrops/CreativeGooeyEffects) + [demo](https://tympanus.net/Development/CreativeGooeyEffects/) |
| 水珠质感（8-B S2 用） | ⭐[shuding/liquid-glass](https://github.com/shuding/liquid-glass)；[nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass)；[kube.io 折射文章](https://kube.io/blog/liquid-glass-css-svg/)；[CSS-Tricks 玻璃球](https://css-tricks.com/making-a-realistic-glass-effect-with-svg/) |
| 滤镜配方（8-B S4 / P8-A 用） | ⭐[yoksel SVG Filters Playground](https://yoksel.github.io/svg-filters/)；[wakana-k 水下背景](https://codepen.io/wakana-k/pen/KKYmxYq)；[Red Stapler 水面滤镜](https://redstapler.co/realistic-water-effect-svg-turbulence-filter/)；[soju22](https://codepen.io/soju22/pen/OqPyrm)；[shaiqkar](https://codepen.io/shaiqkar/pen/QWWwZwj)；[enxaneta feDisplacementMap waves](https://codepen.io/enxaneta/post/svg-waves-with-fedisplacementmap) |
| 浮光光点（8-B S5 用） | ⭐[mikegolus CSS Fireflies](https://codepen.io/mikegolus/pen/Jegvym)（只取光点结构）；[milabear 单点辉光](https://codepen.io/milabear/pen/JjoBvV) |
| 落滴节奏（8-B S7 用） | [iondrimba Rain Drops](https://codepen.io/iondrimba/pen/MxbmGr) |
| 涟漪交互/机位 | ⭐[rachsmith 椭圆透视水滴](https://codepen.io/rachsmith/pen/xGrjvB)；[kitjenson Droplet](https://codepen.io/kitjenson/pen/gNEvyM)；[webbist 涟漪晃动](https://codepen.io/webbist/pen/zWGNRZ)；[Codrops SVG Ripples](https://tympanus.net/Tutorials/SVGRipples/)；⭐[Untapped Africa](https://www.awwwards.com/inspiration/interactive-water-ripple-effects-untapped-africa) |
| 水痕运动节奏（8-B S6 用） | ⭐[teamLab Koi and People](https://www.teamlab.art/w/koi_and_people/)（只看轨迹与涟漪因果）；[unicar 群游算法](https://codepen.io/unicar/pen/LwbRbo)（只抄行为） |
| 水中月 | ⭐[ruhantai 月夜水面](https://codepen.io/ruhantai/pen/OdJQNQ) |
| blob 呼吸 | [@georgedoescode/spline](https://github.com/georgedoescode/spline) |
| CSS @property（8-D 可用） | [web.dev @property Baseline](https://web.dev/blog/at-property-baseline)；[MDN @property](https://developer.mozilla.org/en-US/docs/Web/CSS/@property) |
| 塘岸 gate | [d3-force-limit](https://github.com/vasturiano/d3-force-limit) |
