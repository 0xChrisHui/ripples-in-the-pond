# Phase 8-F — 效果候选池（15 flag 广撒网 + 统一删减拍板）

> **定位**：2026-06-12 立项（用户拍板"全部加上"）。玩法 = **尽可能多加功能 → /test 逐个体验 → 用户给删减名单 → F9 统一拍板**。所有条目先写方向级规格，实施时再按 8-B 风格细化（先勘探真实代码再动手）。
> **前置**：8-B S1（token + 涟漪总线 + MOON_ANCHOR）。各条另有前置见各组标注。
> **状态**：等"开始 P8-F"信号；与 8-B/8-C 可穿插执行（文件交集小，撞文件时后做的等先做的）。
> **铁律**：P8 全局模块化/抽象/沙盒铁律（`overview.md`）+ 8-B §0 通用工程规则（flag 五件套 / 性能纪律 / 行数目录硬线）。15 个 flag 桌面/移动默认**全 false**。

---

## F0 — /test 面板升级（本池前置基建，建议最先做）

flag 总量将达 ≈58 个，平铺面板已不可用：

1. **分组折叠**：EffectsPanel 按 `EFFECTS_META` 的 group（运动/环境/渲染/主题）折叠分组，记忆展开状态。
2. **3 个预设按钮**："现状基准"（全关）/ "水塘推荐"（8-B 沙盒组合 URL 那套 + 池内入围项，随拍板更新）/ "全开压测"。预设 = 一次性批量 set flags + URL 同步，不引入新状态机制。全开压测要专项看**单球四层滤镜叠加**（waterRipple displacement + gooey + glow + focus）的真机 FPS（2026-06-12 关联审查）。

## 目录方案（2026-06-12 拍板：ambient 做子目录）

1. 新建 **`effects/ambient/pond/`**：8-B 与本池全部新增环境组件统一入此——caustics-layer / film-grain / pond-lights / drops-layer / pond-shadow（8-B 的 5 个）+ sky-reflection / moon-path / pond-edge（本池 3 个）= **8 个顶满单目录硬线**；再加 = 先删后加。8-B 正文写 `effects/ambient/xxx.tsx` 的路径一律按本方案落地（8-B §0.5 已同步）。
2. `rain` 不建新文件——作为 drops-layer 的强化档参数实现（同文件）。
3. 运动/交互类新组件入 `effects/motion/`：现 comet-system + 规划 water-wake，本池 +bubbles / breeze / cursor-ring = 6 个，不超线。
4. 池子的本质就是要删减：pond/ 顶满可接受，F9 删减后自然回落。
5. 旧组件 aurora/stars/fog 留 ambient/ 根，去留归 8-B S8。

---

## F1 组：极低成本四件套【一步做完】

### `tide` 潮汐呼吸（group=运动）
- 球群容器外层 `<g>` 挂 CSS keyframe：scale 1↔1.015，45-60s ease-in-out 往复，transform-origin 视口中心——整口塘在呼吸。
- **transform 归属硬规定（2026-06-12 关联审查）**：tide 必须套**独立 wrapper `<g>`**——zoomG 的 transform 属 d3-zoom 专属、球外层 g 属 d3 sim 专属，tide 都不得写；与 tilt 容器的嵌套次序开工时勘探后定。**验收**：全场极缓呼吸、滚轮缩放/点击/拖拽全部不受影响（transform 不破坏 hit-test）。

### `dropShimmer` 高光呼吸（group=环境）【前置：8-B S2 waterDrop】
- waterDrop（8-B §2.3）的主高光 ellipse 加 opacity 0.6↔1.0 呼吸 keyframe，4-7s，hash 错峰——水珠"活"了。只动 opacity。

### `clickSplash` 点击水花（group=运动）
- 点击播放瞬间球心迸出 3-5 个 r≈1-2px 光点（fill `var(--pond-light)`）：一次性 keyframe 沿随机方向抛出 8-16px + opacity 1→0，0.4-0.6s，元素用后即删。给全站最重要的交互加一帧爽感。

### `pondEdge` 塘岸暗缘（group=环境，pond/pond-edge.tsx）
- 全屏静态羽化暗角框（大圆角 rect 粗描边 + blur，或 2 层错位叠加做不规则感），暗示"这是一口塘不是无限宇宙"。`pointer-events: none`，零动画。

## F2 组：播放叙事四件套【建议 8-C C1 先行；C1 未建时用固定周期假节拍降级实现，C1 建成后接 env/beat】

### `echoRipple` 回声涟漪（group=运动）
- 播放开始事件 → 取距播放球最近 4-6 球，按距离排 0.3-0.8s 延迟，各 dispatch 一个小号 `bg-ripple:spawn`（走 8-B §2.1 涟漪调度器 **P2 播放叙事级**）——声音在水里传到了它们身上。每曲发一轮；C1 可用时强拍可选重发（≥4s 节流）。

### `playWaves` 持续声波环（group=运动）
- 播放球处 2-3 环同心环连续扩散（环周期 1.6-2.4s），像水面上的电台信号；C1 可用时 opacity/速率乘能量包络 env；暂停即淡出。与 beatRipple 互补（连续 vs 离散强拍）。

### `bubbles` 气泡升腾（group=运动，motion/bubbles.tsx）
- 播放中每 3-6s 在播放球附近 spawn 1-2 个 r 1-2px 光点：自下而上漂 20-40px + 轻微正弦横摆 + 到位淡出（纯 transform/opacity），同屏 ≤4——歌在水下冒泡。纯圆形光斑，抽象合规。

### `lightFollow` 月光寻声（group=环境）【前置：moonPath 或主题月光斑存在】
- 背景月光斑/月光水路在播放时以极慢 transition（10-20s 级）向播放球方向偏移 ≤15% 视口；停止后缓慢回 `MOON_ANCHOR` 原位。实现 = 一个容器 transform，无重绘——"月光找到了正在唱歌的球"。
- **光向纪律（8-A 补充三的唯一例外条款，2026-06-12 关联审查）**：本 flag 只许移动环境月光斑，**球体高光方位永远锚定 MOON_ANCHOR 不动**；与 waterMoon 同开时两者必须同源汇合于播放球，画面里不得出现两个各自为政的月光源。

## F3 组：倒影与光【前置：MOON_ANCHOR（8-B S1）】

### `skyReflection` 星空倒影（group=环境，pond/sky-reflection.tsx）
- 12-20 个模糊光点（blur 1-2px 或径向渐变模拟），位置静态、各自 1-3px 极慢晃动 + 呼吸明灭——旧 stars 不是删除而是"倒进水里"，老世界观的抽象彩蛋。亮度封顶纪律同 pondLights（峰值低于球高光）。与 stars/pondLights 的并存关系归 F9/S8 拍板。

### `moonPath` 月光水路（group=环境，pond/moon-path.tsx）
- 垂直光带（线性渐变 `var(--pond-glow)` → transparent，宽 8-12% 视口），x 位置由 `MOON_ANCHOR` 派生；2 层错相位极慢明暗摇曳（opacity 0.04-0.10）。方向 B 的核心元素独立成 flag，任何主题都能开。

## F4 组：雨与风

### `rain` 细雨（group=环境，drops-layer 内参数档）【前置：8-B S7 drops】
- drops 的强化档：spawn 间隔降至 2-5s、同屏 ≤6、滴更小更快、涟漪走小号。rain=1 时覆盖 drops 节奏（互斥优先）。涟漪走 8-B §2.1 调度器 **P3 氛围级**（只用剩余配额，永不挤占用户交互涟漪）。

### `breeze` 风过水面（group=运动，motion/breeze.tsx）【springBack（8-C C3）为加分项非硬前置】
- 每 40-90s 一阵：① 一条宽而淡的碎光带（线性渐变窄带，角度随机 ±20°）4-7s 扫过全屏（纯 transform）；② 同时对全体球施加同向微力 2-3s（量级远小于涟漪推力）→ 风停球回稳（springBack 开启时有回摆）。

## F5 组：高风险/复杂件【做出来看，随时弃】

### `sphereSheen` 球面流光（group=渲染）【前置：8-B S2 waterDrop】
- 每球内 clip 一条斜向高光带缓慢扫过（单层 linearGradient + transform keyframe，8-15s 错峰）。36 球 × 1 层 = **本池最贵**，真机 FPS 不达标即弃；进 DEGRADATION_ORDER 前列。

### `cursorRing` 指尖涟漪（group=运动，motion/cursor-ring.tsx）
- 空白水面上一圈低 opacity 椭圆环（`ry = rx × POND_TILT_RATIO`）以 lerp 延迟跟随鼠标（rAF 内 transform）；悬停球上/拖拽中隐藏；移动端无意义恒关。

### `idleCalm` 静息（group=运动，hooks/use-idle-calm.ts）
- 全局活动信号：30s 无活动 → calm 态：自动涟漪间隔 ×2、bobbing 幅度收小（经 CSS 变量系数）、drops/waterWake 暂停 spawn；任何交互 0.5s 渐变唤醒。
- **现成地基（2026-06-12 关联审查发现）**：`render-helpers.ts:33-52` 已有 lastActivityTime 活动追踪（监听 mousemove/wheel/keydown/click），直接复用不重造。**播放中视为持续活跃**：playing=true 期间禁止进 calm——音乐在放的时候塘不能睡着。
- **架构约束**：实现为"一个系数广播"（CSS 变量 + 自定义事件），各效果**自愿订阅**，禁止 idleCalm 反向改各效果内部实现。本池逻辑最复杂件，排最后。

---

## 切步

| Step | 内容 | 前置 |
|---|---|---|
| **F0** | /test 面板分组折叠 + 3 预设按钮 | 无（建议最先） |
| **F1** | tide + dropShimmer + clickSplash + pondEdge | dropShimmer 需 8-B S2 |
| **F2** | echoRipple + playWaves + bubbles + lightFollow | 建议 8-C C1 先行（否则假节拍降级版） |
| **F3** | skyReflection + moonPath | 8-B S1（MOON_ANCHOR） |
| **F4** | rain + breeze | rain 需 8-B S7 |
| **F5** | sphereSheen + cursorRing + idleCalm | sphereSheen/需 8-B S2；idleCalm 排最后 |
| **F9** | **统一删减拍板**：用户 /test 体验完给名单，每 flag 三选一（转默认 / 留 flag 不转默认 / 删码）+ 需降级的并入 DEGRADATION_ORDER + 去留清单写 JOURNAL | 用户体验完成 |

每步：flag 五件套齐全 + `bash scripts/verify.sh` → 6 行汇报 → 等"继续"。F1-F5 顺序可按用户意愿调换（前置满足即可）；F9 必须最后。

## 触发停下问用户

- 任一步 FPS 桌面 <55 压不住 → 停（F5 高危件直接建议弃）
- 想画具象形态 → 停（抽象铁律）
- `pond/` 或 `motion/` 要超 8 文件 → 停（先删后加）
- idleCalm 想直接改其他效果内部实现（绕过系数订阅）→ 停
- 改动撞合约 / cron / DB → 停

## Phase 8-F 完结标准

- [ ] 15 个 flag 全部在 /test 分组面板可独立开关，单独关掉完全回现状；全关 = 与开工前像素级一致
- [ ] 预设按钮三档可用且与 URL 同步
- [ ] F9 删减拍板完成：去留清单落 JOURNAL、删码项已删、转默认项已切、降级表已并
- [ ] `bash scripts/verify.sh` 全绿 + 真机实测（"水塘推荐"预设下桌面 ≥55fps）

## 参考

- 立项来源：2026-06-12 视觉评估对话第三轮（15 候选 + "广撒网再删减"工作流拍板）
- 依赖规格：8-B §1 token / §2.1 涟漪总线 / §2.3 waterDrop / §2.10 drops；8-A 补充三 MOON_ANCHOR；8-C C1 音频能量、C3 springBack
