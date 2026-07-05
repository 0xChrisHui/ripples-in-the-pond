# Phase 8-B — 特效体系水塘化迁移（13 开关去留落地）

> **定位**：把 `p8-s1-visual-research.md` 第四节「13 个 effect 开关去留映射表」变成可逐步执行的实施手册。AI 拿到本文档 + 拍板结果即可动手。
> **前置**：P8-A（水波折射，`phase-8-a-water-ripple.md`）完成——本 track 与 P8-A 在 `SphereNode.tsx` / `SphereGlowDefs.tsx` / `effects-config.ts` 有文件交集，必须排在其后避免冲突。色彩方向**不再阻塞本 track**（2026-06-12 拍板：token 默认现状兼容值，三方向做成 8-D 的主题开关）。
> **状态**：等"开始 P8-B"信号。
> **抽象铁律（2026-06-12 用户定）**：氛围元素**禁止任何具象形态**——鱼、水黾、落叶、莲叶、花一律不做，只用光、波、斑、雾、痕这类抽象形态表达。原"水黾/游鱼/落叶/莲叶"降为运动节奏的意象参考，抽象版落地规格见 2.8-2.12。
> **沙盒铁律（2026-06-12 用户定）**：所有新效果先在 `/test` 页可开关体验——新 flag 桌面/移动默认**全 false**，EffectsPanel 自动出复选框，用户充分体验后才在 S8 拍板默认值。任何效果不经 /test 体验不得改线上默认视觉。
> **命名备注**：`phase-8-a-water-ripple.md` 里提过的"可选 Phase 8-B = WebGL 背景 gate"自本文档起改称 **P8-W（WebGL gate）**，"P8-B"名号归本 track。下次改动 phase-8-a 文档时同步该称呼。

---

## 0. 通用工程规则（每一步都适用）

1. **新效果一律走新 flag，旧 flag 语义不变**——保证任何时刻"关掉 flag 完全回现状"。替换类（aurora→caustics、stars→pondLights、comet→waterWake）沙盒期新旧 flag 并存，S8 统一切默认值，旧组件是否删码由用户在 S8 拍板。
2. **新 flag 接入五件套**（每个 flag 都做齐，缺一不可）：
   - `effects-config.ts`：`EffectsConfig` 接口加 key + `DESKTOP_EFFECTS`（沙盒期一律 `false`）+ `MOBILE_EFFECTS`（一律 `false`）
   - `EFFECTS_META` 加一行（label 中文 + group）→ `/test` 面板自动出现复选框
   - 渲染处条件挂载（`effects.xxx && <Xxx/>`）
   - URL `?xxx=1` 自动生效（`parseEffectsFromURL` 遍历 key，零额外代码）
   - 需要降级的进 S8 的 `DEGRADATION_ORDER`
3. **性能纪律**（v87 已付过学费，不许回退）：动画只用 transform/opacity（合成线程）；禁止动画化 stroke-width / filter 属性（globals.css:81-96 的 Z2 注释就是教训，唯一豁免：≤8 个的一次性 bg-ripple-manual）；SVG filter 必须收紧 region；禁止逐帧改 feTurbulence 的 baseFrequency / seed。
4. **行数硬线**：单个代码文件 ≤200 行（CONVENTIONS 硬线，hooks 强制；旧 phase 文档写的 220 以 CONVENTIONS 为准）。`SphereNode.tsx` 现 137 行，P8-A 还要加东西——S2 改它前先看当时行数，预计超线就把水珠图层拆成 `SphereDropLayers.tsx` 子组件。
5. **目录硬线**：单层目录 ≤8 个文件。**2026-06-12 拍板（随 8-F 立项）：新建 `effects/ambient/pond/` 子目录**——本 track 与 8-F 全部新增环境组件统一入此，本文档正文写 `effects/ambient/xxx.tsx` 的一律落到 `effects/ambient/pond/xxx.tsx`。配额：本 track 5 个（caustics-layer/film-grain/pond-lights/drops-layer/pond-shadow）+ 8-F 3 个（sky-reflection/moon-path/pond-edge）= 8 顶满，再加 = 先删后加（详见 `phase-8-f-effects-pool.md` 目录方案）。旧组件 aurora/stars/fog 留 ambient/ 根。§2.15 的 water-moon 仍走 EclipseLayer 内分支实现（或 S8 删旧组件后再议）。
6. **一次性涟漪独立 class（2026-06-12 关联审查）**：`.zoom-large .ripple-c` 的"暂停"语义只适用于无限循环的球涟漪圈；P8 所有**一次性**涟漪（waterWake/dragWake 微涟漪、echoRipple 等）一律用新 class `.ripple-once`——同款 transform/opacity 动画但不进暂停规则，zoom>1.5 时的处理 = 提前结束并移除，**绝不暂停冻结残留在屏上**。
7. **挂载分层标注（2026-06-12 关联审查）**：现 ambient 层挂 zoomG 之外、不随滚轮缩放——星空世界观成立（远景天空），但水面元素会穿帮（zoom 拉近球放大 5×、水面纹理不动）。每个新氛围层立项必须标注**水面层（随 zoom）/ 镜头层（不随 zoom）**。当前划分：pondShadow = 水面层（进 zoomG 或镜像）；waterMoon = 水面层（走 EclipseLayer 现成 eclipseZoomG 镜像）；waterWake/dragWake/球涟漪 = 水面层（本就随球坐标）；caustics/filmGrain/fog/pondEdge/pondLights/skyReflection/moonPath = 镜头层（全屏滤镜随 zoom 重渲染成本不可接受，读作镜头叠加层可接受）；BackgroundRipples 维持镜头层（现状先例 + 改造成本高，S8 真机评估 zoom 深处体验后再议）。
8. 每步完成：`bash scripts/verify.sh` → 6 行汇报 → 等"继续"。非显然决定追加 `docs/JOURNAL.md`。

---

## 1. 色彩 token（S1 一并建立，全 track 共用；方向值归 phase-8-d）

`app/globals.css` 的 `:root`（现 18-25 行）追加 6 个变量。**模块化原则（2026-06-12 修订）：`:root` 里给"现状兼容值"（白色系，= 视觉零变化），三套水塘方向值放 `.theme-pond-a/b/c` 类覆盖**——由 `pondThemeA/B/C` 三个 flag 控制（见 `phase-8-d-color-direction.md`）。这样 8-B 任何效果单开时仍是现状配色，勾选某个主题 flag 才整体换对应方向的皮：

```css
/* Phase 8-B — 水塘色 token（:root = 现状兼容值；三方向值见 phase-8-d 的 .theme-pond-a/b/c） */
:root {
  --pond-bg: #07070f;          /* = 现 --background */
  --pond-ripple: #ffffff;      /* 涟漪描边（现状白） */
  --pond-light: #ffffff;       /* 高光 / 强发光（现状白） */
  --pond-mist: #ffffff;        /* 雾（现状白） */
  --pond-glow: #ffffff;        /* 焦散 / 碎光 */
  --pond-accent: #F3D340;      /* 浮光暖金（新效果专用，无现状对应） */
}
```

> **8-D 已冻结（2026-06-12，A–K 11 套经 D0 预览粗筛全部淘汰）**：`.theme-pond-*` 覆盖块暂不实现，`:root` 兼容值即当前唯一值——token 体系本身**保留不变**（本 track 各效果仍一律引用 `--pond-*`，为未来配色重启留接口，效果代码零改动即可换肤）。
>
> 注意：`--background` 本体的替换（星夜黑→水塘底色）归 phase-8-d（已冻结，即不动），本 track 不动；本 track 所有新效果只引用 `--pond-*`。SVG attribute 不认 CSS 变量的地方（如 JS createElement 设置 stroke）用 `getComputedStyle(document.documentElement).getPropertyValue('--pond-ripple')` 读一次缓存，或直接在 TSX 里 `style={{ stroke: 'var(--pond-ripple)' }}`（style 属性认变量）。

---

## 2. 13 开关逐项实施规格

### 2.1 bgRipples — 升级为世界观核心总线【S1】

- **现状**：`src/components/BackgroundRipples.tsx:37-51` 用 `createElementNS('circle')`，stroke 纯白（自动 `rgba(255,255,255,0.27)` / 手动 `white`）；keyframe 在 `app/globals.css:112-177`（`.bg-ripple` / `.bg-ripple-manual`），timing `ease-out`。
- **目标**：椭圆透视涟漪（斜视水面而非俯视雷达波）+ 月光青白色 + 减速扩散曲线。
- **改法**：
  1. `circle` → `ellipse`：`createElementNS(SVG_NS, 'ellipse')`，`rx=size`、`ry=size*POND_TILT_RATIO`（删 `r`；常量默认 **1.0 = 正圆**，见 8-A 补充一，slider 体验后才可能偏离）。keyframe 全是 `transform: scale()` 等比缩放，比例自动保持，**keyframe 不用改结构**。
  2. 颜色：自动涟漪 `stroke: rgba(255,255,255,0.27)` → `c.style.stroke = 'var(--pond-ripple)'; c.style.strokeOpacity = '0.27'`；手动涟漪 `white` → `var(--pond-light)`（`bg-ripple-manual` keyframe 里的 stroke-opacity 数值不变）。
  3. 扩散曲线：`.bg-ripple` / `.bg-ripple-manual` 的 `animation-timing-function: ease-out` → `cubic-bezier(0.2, 0.6, 0.35, 1)`（先快后慢，真实波减速扩散）。
  4. **不加** stroke-width 衰减动画（违反性能纪律 3），能量衰减已由现有 opacity 多 stop 表达。
  5. `bg-ripple:wave` 事件、`archipelago:reset`、点击空白触发——语义全部不动；配额机制升级见第 6 点。
  6. **涟漪调度器（2026-06-12 关联审查新增）**：P8 之后涟漪生产者达 8+ 个（自动 / drops / rain / hoverRipple / echoRipple / beatRipple / groupWave / splashIntro），MAX_AUTO=4 / MAX_TOTAL=8 必然超订（静默丢失或刷屏）。S1 把涟漪池升级为三级优先调度：**P1 用户直接交互**（点击空白 / hoverRipple / groupWave）不丢弃，必要时挤掉 P3；**P2 播放叙事**（beatRipple / echoRipple）同源限流合并（≥1.2s）；**P3 氛围**（自动涟漪 / drops / rain）只用剩余配额。splashIntro 入场 36 圈走**独立一次性池**（不占运行时配额，入场结束整池销毁）。MAX_TOTAL 实测后可上调（建议 ≤12）。
- **flag**：沿用 `bgRipples`，无新 flag（改动随 P8 视觉走，关掉 flag 仍是"无背景涟漪"= 回现状的语义成立）。
- **性能**：零增量（同元素数、同动画属性）。
- **验收**：`?bgRipples=1` 下涟漪月光青白色、先快后慢；默认机位（1.0）下形状与现状一致，/test slider 滑动时变椭圆；点击空白手动涟漪正常；球仍被波推动。

### 2.2 sphereRipple — 椭圆化 + 减速曲线【S1】

- **现状**：`src/components/archipelago/SphereNode.tsx:67-76` 每球 3 个 `<circle r={radius}>` class `.ripple-c`；keyframe `ripple-out` 在 `globals.css:81-96`（scale 1→1.6 + opacity 0.44→0，`ease-out`，静态 stroke-width 0.6）；`rippleStroke` 在 SphereNode.tsx:50（`isAnyPlaying ? '#ffffff' : color`）。
- **改法**：
  1. `<circle r={radius}>` → `<ellipse rx={radius} ry={radius * POND_TILT_RATIO} cy={radius * 0.45 * (1 - POND_TILT_RATIO)}>`（比例 <1 时涟漪圈压扁并下移到球的"水线"位置；默认 1.0 时 ry=radius、cy=0，与现状完全一致）。
  2. `.ripple-c` 的 timing → `cubic-bezier(0.2, 0.6, 0.35, 1)`。
  3. SphereNode.tsx:50 的 `'#ffffff'` → `'var(--pond-light)'`（style 属性认变量，改用 `style={{ stroke: ... }}` 传）。
  4. hash 错峰逻辑（SphereNode.tsx:51-59）、`.zoom-large .ripple-c` 暂停（globals.css:164-166）不动。
- **flag**：沿用 `sphereRipple`。
- **性能**：零增量。
- **验收**：默认机位下涟漪圈与现状一致，slider <1.0 时变球脚下扁椭圆；36 球仍错峰；zoom>1.5 仍暂停。

> **共享机位常量**：`POND_TILT_RATIO` 的概念、拍板与 slider 设计见 `phase-8-a-water-ripple.md` 补充一。**默认 1.0 = 垂直视角正圆（用户 2026-06-12 拍板）**，默认状态零视觉变化；本文档所有出现 `× POND_TILT_RATIO` 的地方在 1.0 时即等于现状圆形。所有水面元素统一引用该常量，禁止写死数值；slider（0.25–1.0）在 /test 供体验。

### 2.3 gradientGlow → 新 flag `waterDrop` 水珠质感【S2】

- **现状**：`SphereGlowDefs.tsx:35-46` 有 C 方案 halo 渐变；`SphereNode.tsx:79-100` 按 `gradientGlow` 选 halo+实色 或 filter+实色。主球是**实色填充**（fill=color，fillOpacity 0.52-0.88）。
- **目标**：球读作"水中物"——中心透、边缘深（和发光星球反着来）+ 左上主高光 + 底部内反光 + rim light。
- **改法**：
  1. `SphereGlowDefs.tsx` 加 2 个 def（currentColor 复用，同 halo 模式）：
     ```xml
     <radialGradient id="drop-body" cx="35%" cy="30%" r="75%">
       <stop offset="0%"  stopColor="white"        stopOpacity="0.30" />
       <stop offset="45%" stopColor="currentColor" stopOpacity="0.35" />
       <stop offset="85%" stopColor="currentColor" stopOpacity="0.60" />
       <stop offset="100%" stopColor="currentColor" stopOpacity="0.80" />
     </radialGradient>
     <radialGradient id="drop-spec">
       <stop offset="0%"  stopColor="white" stopOpacity="0.9" />
       <stop offset="60%" stopColor="white" stopOpacity="0.25" />
       <stop offset="100%" stopColor="white" stopOpacity="0" />
     </radialGradient>
     ```
  2. `SphereNode.tsx`：`effects.waterDrop` 为 true 时主球 `fill` 从实色换 `url(#drop-body)`（`style.color` 注入球色，同 halo 写法），并在主球**之上**叠 3 个 `pointerEvents: 'none'` 元素：
     - 主高光：`<ellipse cx={-r*0.30} cy={-r*0.30} rx={r*0.25} ry={r*0.18} fill="url(#drop-spec)">`
     - 底部内反光：`<ellipse cx={0} cy={r*0.55} rx={r*0.38} ry={r*0.10} fill="white" opacity={0.12}>`
     - rim light：`<circle r={r} fill="none" stroke="white" strokeOpacity={0.15} strokeWidth={1}>`
  3. 主球的 onClick / cursor / transition / hover scale 全部不动（事件仍在主球 circle 上）。
  4. 播放态：`renderFill` 白色逻辑保留，但 waterDrop 模式下播放改为 `drop-body` + `style.color='var(--pond-light)'`（月光色水珠，比纯白球更贴世界观）。
  5. 可点击性底线：rim light + 高光保证球缘对暗水 ≥3:1；dimmed 态 `opacity: 0`（SphereCanvas.tsx:175）本 track 不动（属播放交互，P9/P10 范围）。
  6. **行数预案**：若 SphereNode 超 200 行，把 ②的 4 个图层抽成 `SphereDropLayers.tsx`（props: radius/color/isPlaying）。
- **flag**：新增 `waterDrop`。与 `gradientGlow` 互斥优先级：`waterDrop=1` 时忽略 gradientGlow 分支（halo 是"发光"语义，与水珠世界观冲突）。glow filter（A 方案）在 waterDrop 下仍可叠（水珠也要轻微柔光）——默认叠 `glow-soft` 不变。
- **性能**：低（纯渐变，无新滤镜；+3 元素×36 球与 sphereRipple 3 圈同量级）。
- **验收**：`?waterDrop=1` 球变半透明水珠（中心透边缘深、左上高光、底部内反光）；关掉完全回实色球；点击/拖拽/hover 不变；FPS 无肉眼跌幅。

### 2.4 focus — 重释为"水深"【S3】

- **现状**：`hooks/use-sphere-sim.ts:146-158`——15Hz 节流算 `blur(dist*0.6*decay) brightness(1-dist*0.15*decay)`，挂到每球 `el.style.filter`。
- **改法**：filter 字符串追加 `saturate()`——深处的球更灰绿暗淡：
  ```ts
  const sat = Math.round((1 - dist * 0.25 * decay) * 100) / 100;
  const fStr = blur === 0 ? '' : `blur(${blur}px) brightness(${bright}) saturate(${sat})`;
  ```
  同一字符串同一节流同一 cache，零结构改动。`EFFECTS_META` label `'焦平面景深'` → `'水深景深'`。
- **flag**：沿用 `focus`。
- **性能**：零增量（saturate 与 brightness 同属 color matrix 类滤镜，合并执行）。
- **验收**：开 focus 时远球明显更暗更灰（水下感）；关掉无残留 filter（use-sphere-sim.ts:95-101 的清理逻辑已覆盖）。

### 2.5 tilt — 减幅【S3】

- **现状**：`render/render-helpers.ts:8` `TILT_PX = 145`。
- **改法**：`145 → 72`（减半，水面视差应远弱于"相机转头看星系"）。常量旁注释标 P8-B。
- **flag**：沿用 `tilt`。**验收**：开 tilt 鼠标平移时球群位移肉眼约减半，无迟滞感变化。

### 2.6 perspective — 桌面默认关【S3】

- **现状**：`render-helpers.ts:18-28` 一点透视（factor cap 4）；`effects-config.ts:23` 桌面默认 true。
- **改法**：`DESKTOP_EFFECTS.perspective: true → false`（弱化 3D 的主力开关；代码与 flag 保留，`?perspective=1` 随时可看回）。注意 `comet-system.tsx:107` 读 `cfg.perspective` 自动跟随，无需改。
- ⚠️ **zoom 路径分叉（2026-06-12 关联审查）**：`use-sphere-zoom.ts:80-97`（v84）——perspective 开 = 滚轮缩放走自定义 vanish-point 逐球缩放、且禁 pan；perspective 关 = 走 zoomG transform、支持 pan。**本步翻默认会连带切换滚轮缩放的渲染路径与 pan 行为**，不只是"无放大透视缩放"。
- **验收**：首页默认无放大透视缩放；滚轮缩放 / pinch / pan 在 perspective=0 下全链路实测（zoomG transform 路径，含 `.zoom-large` 涟漪暂停）；`?perspective=1` 行为同旧版（含 zoom 禁 pan）。

### 2.7 aurora → 新 flag `caustics` 水焦散【S4】

- **现状**：`effects/ambient/aurora-background.tsx`——4 个 radial-gradient div（紫绿蓝粉，rgba 值在 52/63/74/85 行），keyframe 50-80s 漫流，opacity 0 起、willChange。
- **目标**：水下焦散网纹替代极光（同样的"缓慢漫流的环境光"角色）。
- **改法**：新建 `effects/ambient/caustics-layer.tsx`，结构抄 aurora（固定全屏 div 容器 z-[-1] + style 内联 keyframes）：
  1. SVG 静态焦散纹理（**滤镜只渲染一次，之后绝不改属性**）：
     ```xml
     <svg className="absolute inset-0 h-full w-full">
       <filter id="caustics-tex" x="0" y="0" width="100%" height="100%">
         <feTurbulence type="turbulence" baseFrequency="0.012 0.03" numOctaves="2" seed="7" result="n" />
         <!-- alpha 行 9/-3.6：把噪声压成高对比"棱线"窄带，RGB 行染成 --pond-glow 色 -->
         <feColorMatrix in="n" type="matrix"
           values="0 0 0 0 0.96  0 0 0 0 0.94  0 0 0 0 0.86  0 0 0 9 -3.6" />
       </filter>
       <rect width="100%" height="100%" filter="url(#caustics-tex)" />
     </svg>
     ```
  2. 外层包 2 个错相位 div 层（各含一份上述 SVG，seed 分别 7 / 13），`mix-blend-mode: soft-light`，opacity 0.06-0.12，keyframe = 60-90s 的 translate(±6%) + scale(1↔1.12) 缓慢漂移（抄 aurora-drift 的 transform-only 模式）+ `willChange: 'transform, opacity'`。
  3. 挂载点：`Archipelago.tsx` 里 aurora 的旁边，`effects.caustics && <CausticsLayer />`。
- **flag**：新增 `caustics`（EFFECTS_META group=环境）。aurora flag 与组件原样保留，S8 拍板默认值（预期 aurora=false / caustics=true）。
- **性能**：中（2 个全屏 filter 各渲染一次后静态；动的只是合成层 transform。**禁止**动 baseFrequency/seed）。mix-blend-mode 全屏层限 2 个。
- **验收**：`?caustics=1&aurora=0` 背景出现缓慢游移的水光网纹；DevTools Performance 看 filter 不在每帧重算（Rasterize 仅出现在首帧/层失效时）；FPS 桌面 ≥55。

### 2.8 stars → 新 flag `pondLights` 浮光+水面碎光【S5】

- **现状**：`effects/ambient/stars-background.tsx`——80 颗白色小圆（viewBox 0-100），12.5% 闪烁，每秒 30% 生灭。
- **目标**：~14 个**浮光光点**（少而大、缓慢游走、呼吸明灭——纯抽象光点，不做萤火虫具象）+ ~24 条水面碎光短横线（聚在上 1/3"月光带"）。
- **改法**：新建 `effects/ambient/pond-lights.tsx`（结构抄 stars：useEffect + createElementNS + 内联 keyframes）：
  1. **浮光**：14 个 `<circle r=0.25-0.4>`（viewBox 100 制）fill `var(--pond-accent)`，每个两层动画——外层游走：JS 在 mount 时为每个生成 4 个随机途经点，写成专属 keyframe（`@keyframes fl-{i}`，translate 序列，40-70s，`ease-in-out infinite alternate`，插进组件 `<style>`）；内层呼吸：`fill-opacity 0.1↔0.9`，1.5-3s，随机 delay（抄 star-twinkle 模式）。
  2. **碎光**：24 条 `<rect width=1.2-3 height=0.18 rx=0.09>` fill `var(--pond-glow)`，y 分布在 viewBox 8-35（月光带），x 随机；动画只有 opacity 闪烁 `0.05↔0.5`、2-4s、随机 delay。无位移（碎光是水面镜面反射，原地闪）。
  3. 生灭节奏：沿用 stars 的 1s tick + 30% spawn/despawn 模式但仅对碎光（浮光数量恒定，渐显渐隐不突兀）；`document.hidden` 跳过逻辑照抄（stars-background.tsx:54）。
- **flag**：新增 `pondLights`。stars 原样保留，S8 拍板默认值。
- **性能**：低（38 个元素 < 现 80 颗星；动画全 opacity/transform）。**亮度封顶纪律**：浮光/碎光峰值 opacity 必须低于球高光（暗水面上最亮的只许是球和月光，见 p8-s1 §三）。
- **验收**：`?pondLights=1&stars=0` 浮光缓慢游走呼吸、碎光在上方水带闪烁；同屏元素 ≤45；FPS 无跌幅。

### 2.9 comet → 新 flag `waterWake` 水痕（抽象掠水扰动）【S6】

- **现状**：`effects/motion/comet-system.tsx` + `comet-spawn.ts` + `render/render-comet-trail.ts`——rAF tick、二次贝塞尔路径、70 点拖尾对象池、推球（comet-system.tsx:134-147）、鼠标靠近减速（118 行）、点击变日食月亮（164-190 行）、`playingId` 存在时停 spawn（45-55 行）。
- **目标**：把"天上的访客"换成**一道看不见的水面扰动**——没有任何身体形状，观者只看到它留下的痕迹：一串微椭圆涟漪沿路径次第绽开 + 途经的球被轻轻推开。运动节奏借"水黾冲-滑-停"的意象（仅节奏，不画生物）。
- **改法**（新建 `effects/motion/water-wake.tsx`，骨架抄 comet-system）：
  1. **运动**：从匀速贝塞尔改"冲刺-滑行-停"累积制——tick 里不再用 `t=(now-spawnTime)/duration` 线性推进，改 `c.progress += dt * speed(now)`，`speed = max(0, sin(now*0.0008 + phase))^3 * base`（速度脉冲：冲一下、滑一段、停一拍）。
  2. **可见物只有痕迹**：头部**不渲染**（或仅一个 opacity ≤0.08 的 blur 光斑示意水面隆起）；冲刺期间沿途每行进 30-50px spawn 一个 6-12px 微椭圆涟漪（`ry = rx × POND_TILT_RATIO`，复用 trail 对象池渲染，class 走 `.ripple-once`（§0 规则 6：一次性涟漪独立 class，避免 zoom-large 暂停冻结），stroke `var(--pond-ripple)`）；停顿时无任何可见物——"它消失了"正是水面扰动的神秘感。
  3. 推球循环（comet-system.tsx:134-147 的 PUSH 逻辑）原样搬；鼠标靠近 → 加速逃散（把 118 行的"减速"反转为 progress 加速）；spawn 频率沿用 35-70s 一道，≤2 道同屏。
  4. **不继承**"点击变日食"交互（星空世界观遗产）——头部无实体也无可点击物；不 dispatch `comet:eclipse-changed`（SphereCanvas.tsx:98-107 的监听只对旧 comet 生效，不迁移）。
- **flag**：新增 `waterWake`。comet 原样保留，S8 拍板默认值。
- **性能**：低于现 comet（无 70 点拖尾重建，可见元素 = 冲刺期 ≤8 个一次性涟漪）。
- **验收**：`?waterWake=1&comet=0` 水面偶尔有"什么东西掠过"的痕迹感（涟漪串次第绽开、节奏冲-滑-停），但看不到任何具象物；途经球被推开；鼠标追它会加速散掉；FPS ≥ 现 comet 基线。

### 2.10 新 flag `drops` 落滴（抽象涟漪发生器）【S7】

- **目标**：偶发一粒光点从上方坠落 → 触水生涟漪 → 消失。"涟漪有源"原则的氛围级示范——意象是"一滴月光/一滴音落进塘里"，纯抽象，无叶无花。
- **改法**：新建 `effects/ambient/drops-layer.tsx`：
  1. 滴形：一个 `<circle r=1.5-2.5>` fill `var(--pond-light)` opacity 0.5，下落中拉成短竖痕（`scaleY 1→2.2` 随速度），无任何具象轮廓。
  2. 生命周期两段（全 CSS keyframe + 一次 setTimeout 接力）：**坠落** 1.2-2s（translateY 从 -5% 加速到随机水位 35-75vh，`ease-in`，轻微 translateX 漂移 ≤12px）→ **触水**：滴本体瞬间淡出，同时在落点 `dispatch('bg-ripple:wave', {x, y, size: 90, duration: 8})`（借总线推球）+ dispatch 新自定义事件 `bg-ripple:spawn{x,y}` 画圈（BackgroundRipples.tsx 加 6 行监听调 `spawnAt(x,y,false)`）。无漂浮段——落滴入水即化，干净利落。
  3. spawn：每 25-45s 一粒，同屏 ≤2，`document.hidden` 跳过。
- **flag**：新增 `drops`，group=环境。
- **性能**：低（≤2 元素，全 transform/opacity）。
- **验收**：`?drops=1` 光点坠落触水那一刻有真实涟漪扩散且邻近球被轻推；滴本体入水即消失无残留。

### 2.11 fog — 调色为夜霭【S7】

- **现状**：`effects/ambient/fog-layer.tsx:32-36`——白色垂直渐变（顶 1.4× → 中 1× → 底 0.4×opacity）。
- **改法**：`stopColor="white"` 三处 → `var(--pond-mist)`；渐变方向反转（水汽贴水面：顶 0.4× → 中 1× → 底 1.4×，把 32-35 行三个 stop 的 opacity 系数对调）。id `fog-vertical` 与挂载不动。
- **flag**：沿用 `fog`。**验收**：雾变青灰且沉在画面下部。

### 2.12 新 flag `pondShadow` 浮影暗斑（尺度参照物）【S7】

- **目标**：2-4 块大的暗色椭圆斑贴背景层（水面浮影/暗流斑，纯抽象——不做莲叶豁口等任何具象细节），给"球 = 水面漂浮物"提供尺度锚。
- **改法**：新建 `effects/ambient/pond-shadow.tsx`：每块 = `<ellipse rx 90-150 ry={rx × POND_TILT_RATIO}>`（与涟漪共享机位压扁比）fill `#0A1F1A` 系（比背景亮半档）+ 边缘 1px `var(--pond-ripple)` 10% 描边；位置避开视口中央 40%（球群主区）；动画 = 120-180s translate ±12px + rotate ±2°（极慢漂）；`pointer-events: none`，z 在球 SVG 之下（挂 Archipelago.tsx 背景区、BackgroundRipples 之上）。
- **flag**：新增 `pondShadow`。**性能**：忽略不计。**验收**：暗斑不挡任何球的点击；视觉上球群"变小变漂浮"；看不出任何具象植物轮廓。

### 2.13 layerWave2 / viewportCull / adaptiveQuality — 保留【S8 仅 adaptive 扩表】

- **layerWave2**：语义本来就是"水涌"（单球 8-12s 钟形沉浮），零代码改动；`EFFECTS_META` label → `'水涌（每 2s 单球）'`。
- **viewportCull**：不动。
- **adaptiveQuality**：`hooks/use-adaptive-effects.ts:27-34` 的 `DEGRADATION_ORDER` 扩成（先关最贵的，新旧 flag 都列上，未启用的 flag 被 force-off 无副作用）：
  ```ts
  const DEGRADATION_ORDER: (keyof EffectsConfig)[] = [
    'waterWake', 'comet',         // rAF 运动层最贵
    'waterRipple',                // P8-A displacement（降级=移除 filter attribute，非 scale=0）
    'sphereRipple', 'layerWave2', 'bobbing',
    'drops', 'caustics', 'filmGrain', 'pondLights',
    'fog', 'aurora', 'stars',
  ];
  ```
  **永不降级**（不进表）：bgRipples（涟漪总线 = 世界观核心）、waterDrop（零滤镜的底线质感）、pondShadow、focus/tilt/perspective/gradientGlow/viewportCull（沿用现注释的理由）。

### 2.14 新 flag `hoverRipple` — hover 入水反馈【S1】（2026-06-12 评估补入）

- **现状**：hover = scale 1.09 + glow-strong + badge 变亮，仍是"星球发光"语义；水塘世界观里指尖掠过水面应有一圈轻触涟漪。
- **改法**：hover 进入瞬间在球心 dispatch 一次 `bg-ripple:spawn{x,y}` 生成小号一次性涟漪（监听规格见 §2.10 落滴——S1 与 S7 谁先做到，谁负责在 BackgroundRipples.tsx 建监听，后做的复用）；每球 ≥800ms 节流，防鼠标扫过球群刷屏；现有 scale/glow/badge 行为全部不动。
- **flag**：新增 `hoverRipple`（group=运动）。**性能**：忽略不计（事件驱动一次性元素）。
- **验收**：`?hoverRipple=1` 鼠标掠过球有"指尖轻触水面"的一圈小涟漪；快速扫过 36 球不刷屏；关掉回现状。

### 2.15 EclipseLayer → 新 flag `waterMoon` 水中月【S7.5】（2026-06-12 评估补入）

- **现状**：播放时的"日食月亮"（EclipseLayer，Portal 到 body z-9999）是 P8 各 track 完成后**残留的最大星空元素**，而播放状态恰是用户注视时间最长的状态。⚠️ 本节未做代码勘探，**开工前先读 EclipseLayer 现实现**再细化规格。
- **目标**：月亮从"挂在天上"改为"落在水里"——播放球附近一轮水面月影：模糊光斑 + 横向暗带切割（波纹碎月感）+ 极慢呼吸。意象参考 8-C 附录"水中月"pen（零 JS 动画路线）。
- **改法（方向性，勘探后定稿）**：
  1. 按 flag 分支渲染月影形态（新组件或 EclipseLayer 内分支，超 200 行则拆）；月影 = radialGradient 光斑 + 2-3 条横向暗带，颜色走 `var(--pond-light)`，动画只用 transform/opacity。
  2. **z 层反转**：月影不再 z-9999 悬顶，挂球群 SVG **之下**——"倒影在水里、球浮在倒影上"，免费的深度暗示。月影属**水面层**（§0 规则 7）：保留 EclipseLayer 现成的 eclipseZoomG zoom 镜像，随滚轮缩放与球同步。
  3. 跟随播放球的定位逻辑沿用现状；audioPulse（8-C C1）开启时月影同步呼吸（C1 已留同模式绑定点）。
- **flag**：新增 `waterMoon`。日食旧形态原样保留，S8 拍板默认值。
- **性能**：低（无新滤镜），不进 DEGRADATION_ORDER（播放核心反馈）。
- **验收**：`?waterMoon=1` 播放时球旁出现随波呼吸的水面月影且位于球群之下；关掉完全回日食月亮；不挡任何点击。

### 2.16 新 flag `dragWake` — 拖拽水痕【S6】（2026-06-12 评估补入）

- **目标**：拖拽是唯一未翻译成水语言的核心交互——点击有涟漪、播放有节拍涟漪，唯独拖球穿过水面静默。拖拽应在球身后留一串尾迹涟漪。
- **改法**：复用 §2.9 waterWake 的对象池与微椭圆涟漪渲染：drag 事件中每行进 30-50px 在球身后 spawn 一个 6-12px 微椭圆涟漪（`ry = rx × POND_TILT_RATIO`，stroke `var(--pond-ripple)`，`.ripple-once` 一次性动画，§0 规则 6）；同屏尾迹 ≤8（对象池上限兜底）；drag 结束即停。**池独立性（2026-06-12 关联审查）**：对象池模块独立于 waterWake / dragWake 两个 flag——谁开谁用，waterWake=0 时 dragWake 必须仍可用。**不** dispatch `bg-ripple:wave`（拖拽本身已在物理推球，避免双重力）。
- **flag**：新增 `dragWake`（group=运动）。**性能**：低（事件驱动，复用池）。
- **验收**：`?dragWake=1` 拖球时身后涟漪串次第绽开消散；松手即停；快速甩动同屏不超 8 个；关掉回现状。

### 2.17 新 flag `filmGrain` — 胶片颗粒【S4】（2026-06-12 评估补入）

- **目标**：三组球色板的身份是 Portra/Cinestill/Ektar 胶片，11 套主题也以"胶片感"为纲——胶片感最便宜的统一载体是一层全屏静态颗粒，能让所有主题瞬间统一气质。
- **改法**：新建 `effects/ambient/film-grain.tsx`（caustics 同模式：滤镜只渲染一次）：全屏 SVG `feTurbulence`（type=fractalNoise，baseFrequency≈0.9，**绝不逐帧动**）+ `feColorMatrix` 去色压淡 → 全屏 `<rect>`，`mix-blend-mode: overlay`，opacity 0.03-0.05。静态即可（暗底低 opacity 下静态颗粒不穿帮）；若体验后想要"颗粒在动"，用 caustics 同款 2 层错相位极慢 transform 位移，禁止重渲染噪声。
- **flag**：新增 `filmGrain`（group=环境）。进 `DEGRADATION_ORDER`（caustics 之后）。
- **性能**：低-中（一次渲染 + 合成层）。⚠️ mix-blend-mode 全屏层纪律：caustics 2 层 + grain 1 层 = 3 层，S4 真机实测；压不住优先把 grain 的 blend 降为普通叠加（视觉损失最小）。
- **验收**：`?filmGrain=1` 全画面均匀细颗粒、暗部不脏（现状配色下验；8-D 冻结，主题项留待配色重启后复验）；关掉无残留；FPS ≥55。

### 2.18 新 flag `bobbing` 浮沉呼吸【S3】（2026-06-12 关联审查立项）

- **目标**：8-A 补充二"多频叠加 + 全员异相"原则的**主载体**——此前只存在于架构描述，无 flag 无归属步骤，三原则之二实际无人实施，现立项收口。
- **改法**：每球内层 `<g>`（若 P8-A S3 已建内层 g 则复用）挂 CSS keyframe：translateY 0→-4~8px→0（3-6s）+ 双轴不可通约周期 + ±1.5° 微旋，hash 错峰 delay。CSS 在合成线程跑，d3 继续写外层 g 的 x/y，互不冲突。**与 E1 splashIntro 协调（2026-06-12 关联审查）**：两者都用内层 g——嵌套两层（intro 外、bobbing 内）或 bobbing 的 animation-delay ≥ 入场总时长，**禁止同元素同属性双动画**（后者会静默覆盖前者）。
- **flag**：新增 `bobbing`（group=运动）。进 `DEGRADATION_ORDER`（layerWave2 旁）。
- **性能**：低（合成线程，但 36 个常驻动画需真机验证）。
- **验收**：`?bobbing=1` 36 球各自异相浮沉、找不到任何两球同步；与 layerWave2 同开不打架；关掉回现状。

---

## 3. 切步计划（9 步，每步一个闭环）

| Step | 内容 | 📦 范围（越界即停） | 前置拍板 |
|---|---|---|---|
| **S1** | 色 token 6 行（兼容值）+ `POND_TILT_RATIO` 常量与 slider + `MOON_ANCHOR` 光源锚点常量（8-A 补充三）+ bgRipples/sphereRipple 接常量+token+减速曲线 + `hoverRipple` hover 入水反馈（§2.14） | `globals.css`、`render-helpers.ts`、`BackgroundRipples.tsx`、`SphereNode.tsx`、`EffectsPanel.tsx`、`effects-config.ts` | 无 |
| **S2** | `waterDrop` 水珠质感（defs + 图层 + flag 五件套） | `SphereGlowDefs.tsx`、`SphereNode.tsx`（超线则 +`SphereDropLayers.tsx`）、`effects-config.ts` | 无 |
| **S3** | 3D 弱化：focus 加 saturate、TILT_PX 145→72、perspective 桌面默认 false（⚠️ 连带 zoom 路径切换，见 §2.6）+ `bobbing` 浮沉呼吸（§2.18） | `use-sphere-sim.ts`、`render-helpers.ts`、`SphereNode.tsx`、`globals.css`、`effects-config.ts` | 无 |
| **S4** | `caustics` 焦散层 + `filmGrain` 胶片颗粒（§2.17，各自 flag 五件套） | +`effects/ambient/caustics-layer.tsx`、+`effects/ambient/film-grain.tsx`、`Archipelago.tsx`、`effects-config.ts` | 无 |
| **S5** | `pondLights` 浮光+碎光（新组件 + flag 五件套） | +`effects/ambient/pond-lights.tsx`、`Archipelago.tsx`、`effects-config.ts` | 无 |
| **S6** | `waterWake` 水痕 + `dragWake` 拖拽水痕（§2.16，复用同对象池） | +`effects/motion/water-wake.tsx`、`SphereCanvas.tsx`（含 drag 接线）、`effects-config.ts` | 无 |
| **S7** | `drops` 落滴 + fog 调色 + `pondShadow` 浮影暗斑 | +`drops-layer.tsx`、+`pond-shadow.tsx`、`fog-layer.tsx`、`BackgroundRipples.tsx`（+6 行 spawn 监听）、`Archipelago.tsx`、`effects-config.ts` | 无 |
| **S7.5** | `waterMoon` 水中月（EclipseLayer 水塘化；**开工前先勘探 EclipseLayer 现实现**） | EclipseLayer 相关文件（或 +`water-moon.tsx`，见 §0.5 目录硬线）、`effects-config.ts` | 无 |
| **S8** | DEGRADATION_ORDER 扩表 + 新旧 flag 默认值切换拍板（aurora/stars/comet→false，新 flag→true）+ 旧组件去留拍板 + **移动端最小水塘集拍板**（零/低成本质感项——waterDrop / 椭圆涟漪 / fog 调色——是否移动端默认开；动效类维持 false）+ `/test` 全开关过一遍 + 真机实测 | `use-adaptive-effects.ts`、`effects-config.ts` | 用户真机预览 |

每步完成跑 `bash scripts/verify.sh` + 6 行汇报 + 等"继续"。S1-S5 之间无依赖顺序可按用户意愿调换；S8 必须最后。

**沙盒预览组合 URL**（给用户验收用）：
`/test?waterDrop=1&caustics=1&filmGrain=1&pondLights=1&waterWake=1&dragWake=1&hoverRipple=1&drops=1&pondShadow=1&waterMoon=1&aurora=0&stars=0&comet=0&perspective=0`

---

## 4. 触发停下问用户（沿用 AGENTS.md 铁律）

- 任一步 FPS 桌面 <55 且 adaptiveQuality 压不住 → 停，砍参数或降默认
- 单代码文件要超 200 行 → 停（先提拆分方案）
- `effects/ambient/` 目录要超 8 个文件 → 停（提删旧组件或建子目录）
- 想动 `--background` / 顶栏 / 导航 → 停（那是 P8-S2/S5 的范围）
- 想引 WebGL → 停（→ P8-W gate）
- 想画任何具象形状（鱼/虫/叶/花/生物轮廓）→ 停，违反抽象铁律，回到光/波/斑/雾/痕
- 想在 `:root` 直接写水塘方向色值（绕过 .theme-pond-* 开关体系）→ 停，违反"默认保持现配色"拍板
- 改动撞合约 / cron / DB → 停（本 track 不应发生）

---

## 5. Phase 8-B 完结标准

- [ ] 沙盒组合 URL 下：涟漪减速扩散（机位默认正圆，slider 可体验椭圆）、球是水珠质感、背景有焦散、浮光+碎光、水痕掠过、落滴触水生涟漪——且全程无任何具象元素
- [ ] `?waterMoon=1` 播放时月亮呈水面月影（位于球群之下）；关掉完全回日食月亮
- [ ] hover 一圈小涟漪、拖拽留尾迹涟漪、全画面胶片颗粒、36 球异相浮沉（hoverRipple / dragWake / filmGrain / bobbing 开启下），各自单独关掉回现状
- [ ] 涟漪调度器三级优先实测：splashIntro/rain 全开时点击空白的涟漪永不丢失；滚轮 zoom>1.5 下无一次性涟漪冻结残留
- [ ] 每个新效果都在 `/test` 面板有独立开关，用户逐个开关体验过
- [ ] 每个新 flag 单独关掉都完全回现状；全关 = 与 P8-B 开工前像素级一致
- [ ] 36 球点击 / 拖拽 / hover / A/B/C 切组 100% 不受影响
- [ ] 桌面 ≥55fps；移动端默认值按 S8 拍板的"最小水塘集"执行（拍板前一律 false）；DEGRADATION_ORDER 实测可逐级压住低端机
- [ ] `bash scripts/verify.sh` 全绿
- [ ] S8 用户真机拍板默认值后：STATUS.md 更新 + JOURNAL 加默认值切换决策一行

---

## 6. 参考

- 设计依据：`playbook/phase-8/p8-s1-visual-research.md`（三套色板 hex / 动效三原则 / 技术纪律全文）
- 提示词快照：`playbook/phase-8/visual-research-prompt.md`
- 兄弟 track：`playbook/phase-8/phase-8-a-water-ripple.md`（waterRipple flag 与 displacement 滤镜在那边落地）
