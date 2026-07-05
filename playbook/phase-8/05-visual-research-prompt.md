# Phase 8 视觉设计调研提示词（主视觉现状全量快照）

> **用途**：本文件整体就是一份可直接投喂给任何 AI / 设计师的提示词。它包含 pond-ripple.xyz 首页主视觉的全部现状 + 硬约束 + Phase 8 目标。基于它去调研"如何把前端视觉做到非常棒"的设计方案。
> **快照时间**：2026-06-12（代码勘探自真实仓库，文件路径见各节）。现状若有变更需重新生成。

---

## 一、角色与任务

你是一位顶级的互动视觉设计师 + 创意前端工程师。请基于下面的【产品背景】【主视觉现状】【硬性约束】【Phase 8 目标】，调研并提出**让首页视觉效果脱胎换骨的设计方案**——核心方向是从"星空/星系感"转为"水塘/涟漪/水面漂浮感"（产品名 Ripples in the Pond 的视觉对齐）。

## 二、产品背景

- **Ripples in the Pond**（pond-ripple.xyz）：音乐 NFT 项目，OP 链。
- 首页 = 一片互动"群岛"：**36 个音乐小球**漂浮在暗色背景上，**点击小球播放对应音乐**，可拖拽，可切 A/B/C 三组。
- 另有键盘 Jam（按键触发音效 + 全屏 SVG 按键动画）叠在主视觉之上。

## 三、主视觉现状（全量）

### 3.1 渲染层级（z-index 自下而上）

| 层 | 内容 |
|---|---|
| z-0 | BackgroundRipples（背景涟漪）+ Archipelago 全屏 SVG（极光/星尘/雾 + 36 球） |
| z-30 | A/B/C 组标签（左侧）+ 键盘 Jam 面板 |
| z-40 | SvgAnimationLayer（按键动画覆盖层，pointer-events:none） |
| z-60 | 顶栏：标题 "Ripples in the Pond"（font-light, tracking 0.3em, white/80）+ 登录按钮 |
| z-9999 | EclipseLayer：播放时的"日食月亮"（Portal 到 body） |

### 3.2 球体（SphereNode，纯 SVG `<g>` + `<circle>`）

- **大小**：半径 14–28px（importance × 10 层深度衰减，最小层 = 最大层 50%）。
- **颜色**：3 组各 8 色的胶片色板（Portra 暖橙 / Cinestill 夜景 / Ektar 鲜艳），如 `#D8A878 #7EA898 #A83A3A #6A7898 #E8D8B8`。fillOpacity ≈ 0.52–0.88。
- **光晕**：A 方案 SVG filter（feGaussianBlur 1.2/2.5 + feMerge，region 已压缩省 GPU）；C 方案 radialGradient halo（currentColor 单 def 复用，默认关）。
- **涟漪圈**：每球 3 个描边 circle，`ripple-out` keyframe（scale 1→1.6 + opacity 0.44→0），周期 7.2–12.2s 按 ID hash 错峰。
- **状态反馈**：hover = scale 1.09 + glow-strong + 序号 badge（Modak 字体）变亮；播放中 = 填白色 + opacity+0.2 + pause 按钮；其他球播放时本球淡出。

### 3.3 物理 / 运动（d3-force，永不停息的慢漂浮）

- forceLink（相关性距离）+ forceManyBody 斥力 + forceCollide + forceX/Y anchor + forceCenter；alphaTarget=0.008 保持微动。
- Cluster 布局：halton 序列 anchor + power-law 簇大小，确定性 jitter。
- **假 3D**：zMap ∈ [0,1]（halton + hash jitter）驱动 painter's algorithm 渲染序、视差 tilt 幅度、一点透视缩放、焦平面 blur。

### 3.4 特效系统（13 个布尔开关，effects-config.ts，URL `?flag=1` 同步）

| 开关 | 桌面/移动 | 视觉 |
|---|---|---|
| focus | ✅/❌ | 焦平面景深（按 z blur+brightness） |
| tilt | ✅/❌ | 鼠标视差 |
| perspective | ✅/❌ | 一点透视缩放 |
| comet | ✅/✅ | 彗星（≤3 条，70 点拖尾，SVG 对象池） |
| sphereRipple | ✅/❌ | 球涟漪 3 圈 × 36 |
| layerWave2 | ✅/❌ | 每 2s 随机 1 球做 8–12s 正弦层级波 |
| fog | ✅/❌ | 景深雾（线性渐变） |
| stars | ✅/✅ | ~80 颗星尘，闪烁 + 呼吸式生灭 |
| aurora | ✅/✅ | 4 层极光渐变漫流（紫绿蓝粉，50–80s 周期） |
| bgRipples | ✅/✅ | 背景白描边圆涟漪（自动 ≤4 / 总 ≤8，点击空白手动触发），并 dispatch `bg-ripple:wave{x,y,size,duration}` 推动小球 |
| gradientGlow | ❌/❌ | C 方案渐变光晕 |
| viewportCull | ✅/✅ | 视口外球 display:none |
| adaptiveQuality | ✅/✅ | FPS<30 持续 2s 逐个降级（comet→sphereRipple→layerWave2→fog/aurora/stars），FPS>55 持续 15s 回升 |

### 3.5 颜色基调（当前 = 星空夜）

- 背景 `#07070f`（蓝紫深黑）、前景米色 `#d8d3c8`、涟漪/彗星/月亮 = 白色系、surface/border = 白 3%–7% 透明。

### 3.6 音频联动

- 点击球 → 播放 → 球变白 + 日食月亮跟随；**无任何音频可视化**（无波形/频谱/节拍脉冲）。

## 四、硬性约束（违反 = 方案不可用）

1. **纯 SVG + CSS animation + rAF**：零 Canvas、零 WebGL、零 framer-motion。栈 = React 19 / Next 16 / Tailwind v4 / d3-force。WebGL 只允许作为独立的可选 Phase 8-B 背景层 gate，不在本轮方案核心。
2. **交互 100% 不可破坏**：球的 onClick 播放、拖拽、hover、A/B/C 切组。滤镜只能改像素，不能挡 DOM 事件。
3. **每个新效果必须是 effects flag**：可 `?flag=1` 沙盒预览、可一键回退、移动端默认关、能接入 adaptiveQuality 降级表。
4. **性能红线**：桌面 ≥55fps、移动端靠默认关重效果保命；SVG filter region/stdDeviation 要省 GPU；动画尽量只用 transform/opacity（合成线程）。
5. 单文件 ≤220 行；不碰合约 / cron / DB / 其他页面内容区。

## 五、Phase 8 目标与已拍板决策

- **目标**：星空 → 水塘。关键词：水塘、涟漪、水面、漂浮、水珠、波纹、墨绿/深青、池塘月色。弱化宇宙感和3D感。
- **已拍板（P8-A）**：小球"水下折射/晃动"用 `feTurbulence` + `feDisplacementMap` SVG 滤镜实现，displacement scale 绑定 zMap（水位）+ `bg-ripple:wave`（涟漪源）信号。
- **待调研的开放问题**（P8 overview 列出，需要你给方案）：
  1. **颜色体系**：深蓝紫星夜 → 什么样的水塘色板？（背景、球色板、光色如何整体迁移又保留胶片质感）
  2. **球体质感**：发光星球 → 一些池塘中的典型事物，纯 SVG（渐变/高光/滤镜）怎么画才可信？
  3. **动效语言**：轨道引力感 → 水面漂浮感，d3-force 参数和新增动效怎么配合？
  4. **背景**：星空黑 + 极光 + 星尘 → 水面深色 + 什么替代物？（现有 13 开关里哪些保留/改造/替换）
  5. **氛围统一**：彗星、日食月亮、雾、按键动画在"水塘"世界观里变成什么？（如彗星→水黾/游鱼/落叶？月亮→水中倒影月？）
  6. **导航/顶栏**：如何配合水塘视觉微调？

## 六、输出要求

1. **2–3 套完整设计方向**（如"夜塘月色"/"墨绿深潭"/"雨后池塘"），每套含：色板（具体 hex）、球体质感画法、动效语言、背景方案、氛围元素重映射、参考关键词（供搜参考图）。
2. **每个效果给出纯 SVG/CSS 可行性方案**：用什么滤镜/渐变/keyframe，预估性能成本（高/中/低），移动端降级策略。
3. **指出现有 13 个 effect 开关的去留映射表**（保留 / 调色 / 改造 / 替换为 X）。
4. **明确分期**：哪些进 P8（纯 SVG）、哪些建议留给 P8-B（WebGL gate）。
5. 方案要"非常非常棒"但**可信可落地**——每条建议都要能通过上面的硬性约束检验。
