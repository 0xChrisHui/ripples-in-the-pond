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

## 与 overview.md 的关系

`overview.md` 的 P8-S4「Archipelago 动效改造」= 本 track。P8-A 是它的**具体落地方案 + 路线决策**。overview 其余板块（颜色体系 / 球体质感 / 背景水面 / 导航）为 P8 的并行子track，P8-A 完成后按用户节奏推进。
