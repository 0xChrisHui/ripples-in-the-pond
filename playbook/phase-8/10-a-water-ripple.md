# Phase 8-A — 水波效果（水下折射动效）

> **定位**：Phase 8「水塘视觉重设计」的第一个落地子track。先做"小球在水里晃动/折射"的动效骨架，是 P8 最核心的体感（贴合 Ripples in the Pond）。
> **前置**：`playbook/phase-8/overview.md`（P8 总览）+ `playbook/roadmap-P8-P16.md`
> **状态**：方案已拍板（2026-06-11），等"开始 P8-A"信号逐 step 实施。

---

## 决策记录（2026-06-11）

**技术路线：选 A —— 纯 SVG 滤镜（`feTurbulence` + `feDisplacementMap`）**

用户在多维评估后拍板 A，不用 WebGL。核心理由：

- **架构契合**：现有栈是 SVG + d3-force，**零 WebGL**。A 只是给球体系套一层 SVG filter，和已有的 `gradientGlow`（SphereNode 里 filter vs gradient 切换）同构。
- **保全交互**：小球是 SVG `<circle>` + onClick 播放，filter 只改像素不碰 DOM 事件，**100% 不破坏可点击/可播放**。
- **可回退**：一个 effects flag，关掉即回现状（和现有 13 个 effect 开关一致）。
- **复用信号**：直接吃现成的 `zMap`（水位）+ `bg-ripple:wave`（涟漪源）。

**B（SVG + WebGL 背景水面）= 不在 P8-A，降级为可选 Phase 8-B gate**：先把 A 在沙盒里真机看一眼，若"背景还差口气"再单独开 P8-B 加 z-0 WebGL 背景层（隔离风险、不碰小球）。

**切步粒度：5 步**（用户定）。

---

## 架构勘探结论（已读真实代码）

| 资产 | 文件 | P8-A 怎么用 |
|---|---|---|
| 球体节点 | `src/components/archipelago/SphereNode.tsx` | `<circle filter={url(#glow-soft/strong)}>` — 在外层 `<g data-sphere>` 叠加水波 displacement filter |
| 滤镜 defs | `src/components/archipelago/SphereGlowDefs.tsx` | 新增 `feTurbulence`+`feDisplacementMap` def，与现有 glow filter 并存 |
| 水位信号 | `src/components/archipelago/hooks/use-sphere-z.ts` | `zMap: Map<string, number>`（0-1），现成"水位" |
| 涟漪信号 | `src/components/BackgroundRipples.tsx` | 已 `window.dispatchEvent('bg-ripple:wave', {x,y,size,duration})` |
| 效果配置 | `src/components/archipelago/effects-config.ts` | `EffectsConfig` 扁平布尔 + URL 同步；加 `waterRipple` key 即自动获得 `?waterRipple=1` + 面板复选框 |
| 调试面板 | `app/test/EffectsPanel.tsx` | 经 `EFFECTS_META` 自动渲染开关；slider 需另加 |
| 移动端降级 | `effects-config.ts` `MOBILE_EFFECTS` | 已默认关重效果 → `waterRipple: false` 移动端天然默认 |

**沙盒开关**：在 `EffectsConfig` 加 `waterRipple: boolean`（桌面默认可先 false，避免影响线上首页基准），用 `?waterRipple=1` 在 `/`、`/star`、`/test` 单独打开预览。**不污染线上默认视觉**，符合"先沙盒、风险最低"。

---

## 5 步实施计划

| Step | 内容 | 主要产出 | 触碰文件 |
|---|---|---|---|
| **S1** | **接信号**：把 `zMap`（水位）+ `bg-ripple:wave`（涟漪源）汇成一个 water 驱动 hook，输出"每球当前扰动强度" | `hooks/use-water-field.ts` | 新建 hook |
| **S2** | **滤镜骨架 + 开关**：`feTurbulence`+`feDisplacementMap` 的 SVG def；`EffectsConfig` 加 `waterRipple` + `EFFECTS_META` 一行 → 自动得 `?waterRipple=1` 与面板开关 | SphereGlowDefs 扩展 + effects-config + EFFECTS_META | `SphereGlowDefs.tsx`、`effects-config.ts` |
| **S3** | **扭曲绑信号**：displacement `scale` 绑到 S1 的扰动强度，让球随水位/涟漪晃动；`<g data-sphere>` 套 filter（与 glow 叠加，保 onClick） | SphereNode filter 接线 | `SphereNode.tsx` |
| **S4** | **背景水感**：现有 BackgroundRipples 描边圆叠加水色/折射调（仍纯 SVG，不引 WebGL）；与小球折射呼应 | 背景层调整 | `BackgroundRipples.tsx` / globals.css |
| **S5** | **面板 slider + 降级 + 实测**：EffectsPanel 加强度 slider；`MOBILE_EFFECTS.waterRipple=false`；接 `adaptiveQuality` 降级表；真机实测 | slider + 降级接线 + verify | `EffectsPanel.tsx`、`effects-config.ts` |

每步完成跑 `bash scripts/verify.sh` + 6 行汇报 + 等"继续"。

---

## 触发停下问用户（沿用 AGENTS.md 铁律）

- SVG filter 在低端机掉帧、`adaptiveQuality` 压不住 → 停，评估是否 B 路线或降默认
- 单文件超 220 行 → 停
- 想引入 WebGL（= 跨到 B/P8-B）→ 停，B 是独立 gate 不在 P8-A
- 改动撞合约 / cron / DB → 停（本 track 不应发生）

---

## Phase 8-A 完结标准

- [ ] `?waterRipple=1` 下首页小球有可信的"水下折射/晃动"感（真机实测）
- [ ] 关掉 flag 完全回到现状（无残留、无性能损耗）
- [ ] 可点击 / 可播放 100% 不受影响
- [ ] 移动端默认 false，桌面开启时 `adaptiveQuality` 能兜住 FPS 下限
- [ ] `bash scripts/verify.sh` 全绿
- [ ] 用户真机预览拍板：是否"够水"（决定要不要再开 P8-B WebGL 背景）

---

## 补充一：水面机位与椭圆涟漪（2026-06-12 收编）

**概念**：涟漪是躺在水面上的圆，从斜上方观看会因透视缩短变成椭圆，`ry/rx = sin(俯角)`——0.35 ≈ 20° 低斜视角（贴水面看），1.0 = 垂直俯视正圆。这个比例一旦确定就定义了**全场景统一机位**，所有"躺在水面"的元素（背景涟漪、球涟漪、节拍涟漪、水痕涟漪、浮影暗斑）必须共享同一比例，否则透视互相穿帮。球本体始终保持正圆（风格化混合透视，读作漂浮球体）。

- **拍板（2026-06-12）**：用户倾向**垂直视角正圆**——`POND_TILT_RATIO` 默认 **1.0**（= 现状，默认零视觉变化）。
- **保留体验设计**（用户确认保留）：EffectsPanel 加机位 slider（0.25–1.0，实现照本 track S5 的强度 slider 模式），用户在 /test 亲手滑动体验不同机位后，再决定是否偏离 1.0。
- **落地（2026-06-12 关联审查修订）**：`export const` 无法被运行时覆盖——`render-helpers.ts` 给 `POND_TILT_RATIO_DEFAULT = 1.0`，slider 值经 React context（或 CSS 变量 `--pond-tilt`）运行时广播；**所有消费者必须响应式读取**（背景涟漪 / 球涟漪 / waterWake / dragWake / pondShadow / cursorRing 等），任何一处在模块加载时读死常量，slider 一动就出现"一半元素压扁一半没压"——恰好违反本常量存在的唯一目的（全场景统一机位）。禁止各处写死数值。
- **模块化**：slider 是 /test 面板的体验工具，比例 ≠1.0 的视觉只有用户手动滑动（或未来拍板改默认）才会出现。

## 补充二：动效语言——从"飘在太空"到"浮在水上"（自 p8-s1 §三 收编）

水感成立的三条关键原则（本 track 各 step 的动效判断基准）：

1. **涟漪有源、有寿命、会减速**——每个涟漪诞生于一个事件（点击、落滴、水痕、音符落水），用 `cubic-bezier(0.2, 0.6, 0.35, 1)` 减速扩散后消亡；禁止无源永动同心圆。所有元素的动作统一经 `bg-ripple:wave` 总线兑现成水面反应。
2. **多频叠加 + 全员异相**——每球 = 慢大涌（10–20s）× 快小漪（2–4s）× 噪声漂移三层运动叠加，36 球相位/周期互不相同；任何两个元素同步摆动立刻穿帮成机械感（现有 hash 错峰已符合，推广到所有新元素）。
3. **受扰必回摆**——被涟漪推开的球要过冲 → 回摆 → 衰减（欠阻尼弹簧，ζ≈0.3–0.5），而非均匀摩擦滑回。这是"浮在水上"区别于"飘在太空"的最直白物理签名。

落地架构（与 d3-force 零冲突）：

- d3 继续每 tick 写**外层** `<g>` 的 x/y（大尺度位置）；bobbing 用 CSS keyframe 挂**内层** `<g>`（translateY 0→-4~8px→0，3–6s + 双轴不可通约周期 + ±1.5° 微旋，hash 错峰 delay）——不同元素不同坐标系，CSS 在合成线程跑，不占 rAF 预算。
- d3 参数方向：削弱 forceManyBody / forceLink（去星系结构感）、调高 velocityDecay（黏滞如水）、anchor 弹簧化（欠阻尼回摆 → phase-8-c `springBack`）、可选噪声微流 force（→ phase-8-c `flow`）。
- 音乐 × 水：点击播放 = "一滴音落水"（球心涟漪 + 推开邻球）；播放中按节拍发周期涟漪、displacement scale 轻微脉动（→ phase-8-c `audioPulse` / `beatRipple`）。
- **模块化铁律**：本 track 及 P8 全部动效改动，每一项都必须挂 `EffectsConfig` flag，在 /test 面板可手动单独开关。

## 补充三：光源锚点 `MOON_ANCHOR`（2026-06-12 收编，8-B 各光元素共用）

**概念**：与机位常量 `POND_TILT_RATIO` 同理，"光"也需要全场景统一锚点——水珠高光方位（左上 10-11 点钟）、碎光月光带（上 1/3）、方向 B 的月光水路、水中月（8-B §2.14）位置偏好，若各自写死方位，分散实现后必然穿帮。单一光源的一致性是"好看"和"高级"的分水岭。

- **落地**：`render-helpers.ts` 加 `export const MOON_ANCHOR = { x: 0.35, y: -0.1 }`（视口比例坐标，光源在画面上方偏左，与现状水珠高光 35%/30% 方位自洽）；派生量：高光偏移方向、碎光带 y 范围、月光水路 x 位置、水中月出现侧偏好。
- **纪律**：所有光元素引用常量推导方位，禁止写死；改一处 = 全场景光向一致变化。
- **归属**：常量本体随 8-B S1 与 `POND_TILT_RATIO` 一并建立（同文件同模式）；各光元素接线随 8-B 对应 step（S2 waterDrop 高光 / S5 pondLights 碎光带 / S7.5 waterMoon）。
- **唯一允许的例外（2026-06-12 关联审查）**：8-F `lightFollow`（月光寻声）只许移动 moonPath / 环境月光斑这类**环境光斑**，**球体高光方位永远锚定 MOON_ANCHOR 不动**（与"球本体保持正圆"同属风格化混合透视）；waterMoon 与 lightFollow 同开时两者必须同源汇合于播放球——画面里不得出现两个各自为政的月光源。

## 与 overview.md 的关系

`overview.md` 的 P8-S4「Archipelago 动效改造」= 本 track。P8-A 是它的**具体落地方案 + 路线决策**。overview 其余板块（颜色体系 / 球体质感 / 背景水面 / 导航）为 P8 的并行子track，P8-A 完成后按用户节奏推进。
