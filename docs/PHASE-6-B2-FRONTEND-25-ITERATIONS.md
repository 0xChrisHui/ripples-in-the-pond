# Phase 6 B2 — 前端 25 轮优化历程

> 时间跨度：2026-04-28 ~ 2026-04-29
> 起点：sound-spheres v6（force layout 36 节点）
> 终点：主页沉浸式视觉作品（Archipelago fullscreen + 26 键 SVG 动画 + 日食模式 + 背景互动涟漪）
>
> 这份文档写给"以后回来翻看 / 想知道为什么这么做"的自己。
> 决策的"为什么"看 `JOURNAL.md` 2026-04-29 段；这里是叙述 + 经验 + 审美。

---

## 起点 vs 终点

| | 起点 | 终点 |
|---|---|---|
| 主页布局 | 70vh + max-w-6xl 居中 | fixed inset-0 全屏可拖 |
| 球网络 | 5 cluster 均匀分布 | 7 deterministic cluster + 22% outlier，散点格局 |
| 链接 | 全节点稠密 cross-link（~120 边） | 仅同 cluster 内（~40 边） |
| 按键反馈 | useKeyVisual（彩色圆淡出） | 26 键 SVG 动画（patatap 移植） |
| 播放高亮 | 圆变白 + 暂停 icon | 日食模式（黑月 + 减淡白光环 + 内核高亮环 + Portal 最上层） |
| 配色 | A Portra / B 复古 / C 工业金属 | A Portra / B 莓紫雾蓝 / C 莓紫绿粉蜜蜡黄 |
| 文案 | "我的乐谱 / 素材收藏 / 钱包地址" | "我的唱片 / 音乐收藏 / 我的音乐" |
| 背景 | 纯黑 | 自动 + 手动触发的白色涟漪 + 推球互动 |

---

## 25 轮按主题分组

### 主题 1：sound-spheres 视觉调优（v4-v10，约 7 轮）
**问题**：开局抖动、节点撞团、拖动后凝固、配色不准
- v4-v5：基本布局 + 防飞出 + 加连线
- v6：聚落分布 + 减弱抖动 + 首次秒开
- v7-v8：用户改配色 + 修拖动凝固 + 修复矩阵 6 项参数
- v9-v10：拉开间距 + 工业金属配色 + 拖动节点跳过 clamp

**核心决策**：
- 拖动时跳过 clamp（让节点能拖出 PAD 边界，自由感）
- alphaTarget baseline 0.008（极弱漂浮，不"心跳"）

### 主题 2：patatap 动画 Two.js 移植（3 轮，最终搁置）
**Phase 1**：Two.js + tween.js 基础设施 + corona demo（B 键）
**Phase 2**：3 个 worker agent **并行**移植 21 个动画 → 26 键独立映射
**结局**：用户测试发现"做的太糟糕，非常多 bug"，整体搁置

**关键教训**：
- 工程"完成度"不等于用户接受度
- 20 个 effect 文件留作 dead code（不删，防回退），等独立清理时一次砍

### 主题 3：SVG 动画引擎接入（v18 重构 + 配色多次调整）
切到 `references/aaaa/patatap-engine.jsx` 风格 — 纯 SVG + RAF + 12 动画函数：
- 12 个移植：bubbles/clay/confetti/corona/moon/pinwheel/pistons/prisms/squiggle/strike/wipe/zigzag
- 补 8 个缺失：flashes×3 / glimmer / spiral / splits / suspension / timer / ufo / veil
- 拆 multi-variant：pistons / prisms / flashes 各 3 变体 → 9 键
- 26 键独立映射（QWERTY 三排定位严格对齐 patatap hash）

**核心决策**：
- 黑底背景 + palette.black = rgb(0,0,0) 完全看不见 → 统一改 CREAM #E8D8B8
- B/C 配色多次推倒重来：海洋深邃 → 春日花园 → 暮色霓虹 → 莓紫绿粉蜜蜡黄

### 主题 4：/test 沙箱与日食模式（4 轮 + Portal 修复）
**沙箱目的**：试新方案不影响主页 — 后期同步到主页
**日食 v1-v4**：
- v1：黑圆 + 白光晕 + 暂停键
- v2：sim 不重启（playingId 用 ref，避免 useEffect 重建撞乱位置）+ 连线/hover 改白
- v3：z-index 强保证 + 散点聚落 + 拖走不回弹 + 光晕柔化 + 连线日食时隐藏
- v4：React **Portal** 跳出 stacking context（解决日食被按键动画遮）+ 内核高亮细环

**Portal SSR 修复**（紧急）：
- 症状：prod 首次进入主页点圆，日食不显示 → 圆变白；进 /me 再回来 OK
- 根因：`typeof window === 'undefined'` 早 return null，hydration 锁定 null，Portal 永不挂
- 修法：`useSyncExternalStore` 提供 server/client 双快照，hydration 后自动 re-render 挂 Portal

### 主题 5：主页同步 /test → 浮层布局
**z-stack**：
| 层 | 内容 | 备注 |
|---|---|---|
| z-0 | BackgroundRipples + Archipelago fullscreen | 球可拖 |
| z-30 | ABC tabs（左侧 vertical）+ TestJam UI | 操作面板 |
| z-40 | SvgAnimationLayer 按键动画 | pointer-events:none |
| z-50 | DraftSavedToast / TestJam 容器 | |
| z-60 | 顶栏（标题 + LoginButton "我的音乐"）| 可点 |
| z-9999 | EclipseLayer（Portal 到 body） | 真正最上层 |

### 主题 6：聚落算法的核心修复（v15 重写）
**用户洞察**："link 的拉力会撕裂聚落 — 是不是因为 link 和 cluster 算法不一致？"
**根因确认**：generateLinks 用 week hash，setupSimulation 用 Math.random，两套独立 → 同 cluster 节点之间没 link，跨 cluster 反而被 link 拉着不肯进自己 cluster

**修法（v15 deterministic 重写）**：
1. `getNodeCluster(node)` 用 id hash 算 cluster index（-1 = outlier）
2. `generateLinks` 仅在同 cluster 内生成（拉力方向 ≡ cluster anchor 方向）
3. `setupSimulation` 用同一 `getNodeCluster` 决定每节点 anchor
4. Anchor 位置用 **Halton 低差异序列**（数学保证 7 个点均匀分布、互相远离）

效果：力一致 + 聚落清晰 + 不再"缠绕"。

### 主题 7：背景涟漪 v15 → v25（10+ 轮迭代，最磨人的一段）

**演进**：
- v15：第一版随机白色涟漪
- v16-v17：太亮 → 太淡 → 闪烁的反复平衡
- v18：双发 + 邻近 burst（45% 概率连发 1-2 个邻近涟漪）
- v19：opacity 0.27 + 慢扩散（duration ×1.7）+ 放大优化
- v20：MAX_RIPPLES + zoom > 1.4 时 sim alphaTarget(0)
- v21：点击空白触发涟漪 + 涟漪推球（极弱 force 0.18）
- v22：MAX_AUTO=4 / MAX_TOTAL=8 双上限 + 末段 5s 慢淡出
- v23：起始 scale 0.05 + opacity 0.55（点击立即可见）+ CSS .zoom-large 暂停 sphere ripple
- v24-v25：手动点击强反馈 keyframe（前 2s 鲜明，逐渐渐变到普通涟漪）

**核心决策**：
- BackgroundRipples 用 **ref-based DOM**（`appendChild/removeChild`），不用 setState — 避免 React reconciliation 与 sphere 同帧 paint 抢预算
- MAX_TOTAL hard cap 防 GPU layer 累积闪烁
- 双上限：自动 4 / 手动允许叠到 8（手动反馈优先）
- transform 用两端单 stop ease-out（多 stop 卡顿）
- stroke-width / stroke-opacity 走 CSS keyframe（SVG attr 不参与 keyframe）

### 主题 8：性能闪烁排查链（贯穿后期）

**症状演化**：
1. 首次进入 → 偶发闪烁
2. 5s 后开始持续高频闪烁
3. 放大到 ~20 球大小再次闪烁

**排查链**：
| 怀疑 | 证据 | 修法 | 是否解决 |
|---|---|---|---|
| React reconciliation | 5s 后才闪 | ref-based DOM | 部分 |
| GPU layer 累积 | 涟漪堆积太多 | MAX_RIPPLES 限制 | 部分 |
| 大尺寸 filter cost | 放大才闪 | glow stdDeviation 5/10 → 2/4 | 部分 |
| sim alpha jitter | 持续 60Hz tick | zoom > 1.4 alphaTarget(0) | 部分 |
| ripple infinite anim | 36×3=108 个无限动画 | CSS .zoom-large pause sphere ripple | 解决放大闪烁 |

终态：正常 view + 适度放大 + 多涟漪叠加都稳定。极端放大或多重叠加可能仍闪 — 已是 SVG-based 方案的实践上限。

---

## 经验教训（写给自己）

### 1. 用户感知 > 工程"完成度"
Two.js 移植 21 动画技术上是成功的，但用户反馈 bug 多就该立刻搁置。不要陷入"我做的对所以坚持"陷阱。

### 2. 调参与用户感知协调要多次迭代
涟漪 opacity / size / 速度 / 频率反复调了 10+ 轮才稳定。每轮只调 1-2 参数，让用户感知变化更精准。

### 3. SSR / hydration 的隐藏陷阱
`typeof window === 'undefined'` 在 prod 是隐患（hydration 锁定 null）。
标准做法：`useSyncExternalStore` 给 server/client 双快照（false/true），hydration 后自动 re-render。

### 4. SVG attribute ≠ CSS animation
`setAttribute('stroke-width', '2')` 后 CSS keyframe 改不动它。
想 keyframe 控制 SVG 表现属性必须不 setAttribute，让 CSS 完全接管。

### 5. transform multi-stop ≠ 平滑
keyframe 每个 stop 之间是独立 ease-out。多 stop 拼接 = 每 stop 速度归零再启动 = 卡顿。
平滑过渡的正确做法：transform 用两端 stop（0% / 100%），中间属性走 keyframe 渐变。

### 6. GPU layer 是稀缺资源
每个 `transform: scale + transform-box: fill-box` 创建独立 GPU 合成层。
浏览器 layer 上限（Chrome ~256），超了退化 CPU paint → 闪烁。
解法：限 MAX 数 + 关闭非必要动画（zoom 时用 CSS animation-play-state pause）。

### 7. D3 sim 与渲染层的耦合
sim alphaTarget baseline 让节点持续 jitter，每帧 setAttribute('transform')。
与 GPU 合成 paint 同帧争抢，性能压力大。
缩放时 alphaTarget(0) 让 sim 静止 = 大幅减 paint 频率。

### 8. 聚落算法的"力一致性"原则
D3 force 系统中 link / cluster / charge 多力共存。
如果 link 把 A 拉向 B（不同 cluster），cluster 把 A 拉向自己 cluster anchor，A 永远在中间。
解法：让 link 仅在同 cluster 内生成（拉力同方向），用 deterministic hash 算 cluster 归属让 link 和 sim 共识。

### 9. ref-based DOM > setState（高频更新场景）
涟漪 spawn / remove 1-2/秒，setState 触发 React 协调全树。
直接 DOM `appendChild / removeChild` 走原生 DOM API，零 React 开销。
适用：动画、ticker、不需要 React 状态管理的场景。

### 10. 多 agent 并行的边界
Phase 2 用 3 个 worker agent 并行移植，但都因 8 文件硬线撞墙暂停。
教训：spawn 前先确认 hook / 硬线，prompt 里告诉 agent 撞线该怎么做（停下报告 vs 自动豁免）。

### 11. Math.random in render 被 React 19 ESLint 阻止
`react-hooks/purity` rule 阻止 useMemo body 用 Math.random。
解法：deterministic seed（基于 id hash）或者把随机搬到 useEffect 内。

### 12. 文件硬线触发时的元决策
单文件超 220 行 → 拆（自动）。
目录超 8 文件 → 拆子目录 / 加豁免（元决策必须问用户）。
本次 effects/ 加豁免（与 src/app/api/ 同类天然 fan-out）；archipelago/ 紧凑 JSX 压缩到 200。

---

## 审美原则（本次确立）

### 黑底 + 米黄主调 + 白色高光
- 项目背景永远是 `#000`，所以 palette.black = rgb(0,0,0) 在该背景看不见
- 统一改 CREAM `#E8D8B8` 作为黑色等价
- 涟漪 / 高光 / 暂停键用纯白：强反馈用 white opacity 0.95，柔和用 0.27

### 涟漪节奏：起小、立现、慢淡
- 起步 10-20px（不是从 0）让"小水滴"立刻可见
- duration 14-20s 慢扩散，模拟水波物理
- 末段 5s 多 stop 慢淡（70% / 82% / 92% / 100%），避免突然消失
- 手动触发 = 强反馈：起始 stroke-width 2.6 / opacity 0.95，2s 渐变到普通值

### 聚落 > 均匀分布
- 5-8 个小聚落（每个 3-5 节点）+ 22% outlier 散点 > 全图均匀
- Halton 低差异序列保证 anchor 之间最小距离
- cluster 拉力 0.20 / outlier 拉力 0.018（差 11×）让聚落清晰

### 链接拓扑：少而有结构
- 旧：~120 条边（全节点稠密 cross-link）→ 缠绕
- 新：~40 条边（仅同 cluster 内 + 完全无跨 cluster）→ 视觉清晰

### 交互反馈：立即 + 平滑
- 点击播放 → 日食立即出现（不延迟）
- 点击空白 → 涟漪立即可见 + 前 2s 强反馈
- 拖动后弱回弹（保留流动感，不完全冻结也不立即弹回）

### 性能即视觉
- 闪烁 = 视觉灾难，宁可减视觉换稳定性
- CSS `.zoom-large` 暂停 sphere ripple animation（用户在缩放状态下不需要 ripple 持续）
- 双上限：自动 4 / 手动 8（保护手动反馈优先级）

---

## 留存清单（dead code，下次专项清理）

不再用但保留的：
- `src/components/jam/HomeJam.tsx`（旧版含 useKeyVisual）
- `src/components/jam/KeyVisual.tsx` + `src/hooks/useKeyVisual.ts`
- `src/components/animations/effects/` 20 个 patatap Two.js effect 文件
- `src/components/animations/AnimationLayer.tsx` 等 Two.js 基础设施
- npm deps：`two.js@0.8.23` + `@tweenjs/tween.js@25.0.0`

清理量：~2000+ 行 TS + 2 个 deps。

---

## 关键文件 cheat sheet

| 文件 | 作用 |
|---|---|
| `app/page.tsx` | 主页 z-stack 浮层布局 |
| `src/components/archipelago/Archipelago.tsx` | 容器（fullscreen prop + 36 首 audio prefetch） |
| `src/components/archipelago/SphereCanvas.tsx` | 主图（D3 sim + 节点渲染 + 日食 sync + wave push） |
| `src/components/archipelago/SphereNode.tsx` | 单球（hover / ripple / 心形 / 日食 hover 改白） |
| `src/components/archipelago/sphere-config.ts` | 配色 + getNodeCluster + Halton + generateLinks（同 cluster 内连） |
| `src/components/archipelago/sphere-sim-setup.ts` | D3 force + drag（阈值 8）+ pushSpheresByWaves |
| `src/components/archipelago/EclipseLayer.tsx` | 日食浮层（Portal + useSyncExternalStore + 内核高亮环） |
| `src/components/archipelago/use-sphere-zoom.ts` | d3.zoom + zoom-large class（暂停 sphere ripple） |
| `src/components/animations-svg/engine.ts` | 26 键 → 12 动画函数映射 |
| `src/components/animations-svg/effects/*.ts` | 12 个 SVG 动画（含 helpers / palettes / types） |
| `src/components/BackgroundRipples.tsx` | 背景涟漪（auto + 手动 + spawn 时 dispatch wave event） |
| `src/components/jam/TestJam.tsx` | 简化 jam（无旧 keyVisual） |
| `src/components/jam/DraftSavedToast.tsx` | 草稿保存浮层（监听 jam:draft-saved 事件 + 滑入动画） |
| `app/globals.css` | ripple-out / bg-ripple-out / bg-ripple-manual / jam-toast-slide / .zoom-large |

---

## 下一步建议（优化方向）

按优先级：
1. **Dead code 清理** — 删 HomeJam / useKeyVisual / animations Two.js + 砍 two.js 等 deps
2. **真实 audio 联调** — 主页点圆是否能播放音乐（PlayerProvider）
3. **移动端响应** — 当前完全 desktop only，移动端需键盘提示但不能打字
4. **/test 路由** — 已可删（备用沙箱使命达成）
5. **Phase 6 Track 推进** — UI 大改完，回 playbook（Phase 6 还有 A2/A3/B3/D 等步未完）
