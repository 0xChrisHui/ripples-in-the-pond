# Phase 8-E — 入场转场与收尾（splashIntro / groupWave / navPond）

> **定位**：P8 的页面级编排 track——处理"状态切换的水语言"（首屏入场、A/B/C 切组）+ 导航顶栏收尾。与 8-B"一个 flag 一个效果组件"的工作模式不同，本 track 碰的是 SphereCanvas 挂载流程与切组流程，故独立成 track，排在 A–D 之后。
> **立项**：2026-06-12 视觉评估对话，用户拍板"小件融入 A/B、编排类开 8-E"。
> **前置**：8-B S1 完成（涟漪总线椭圆化 + `bg-ripple:spawn` 监听 + `--pond-*` token）。E1 可参考 8-B S7 drops 的坠落 keyframe（非硬依赖）。
> **状态**：等"开始 P8-E"信号。
> **铁律**：沿用 P8 全局模块化/抽象/沙盒铁律（`overview.md`）+ 8-B §0 通用工程规则（flag 五件套 / 性能纪律 / 行数目录硬线）。

---

## E1 — `splashIntro` 入场编排

- **目标**：首屏第一印象 = "36 滴音落进塘里"。现状是 d3 布局算完球直接出现；水塘版：球错峰从上方落入各自终位，触水各发一圈小涟漪，1.5-2s 内全部落定归于平静。这是访客对"这是个水塘"的第一秒认知，也是最容易被截图传播的瞬间。
- **改法（方向性，开工前先勘探 SphereCanvas 挂载与 d3 首帧流程）**：
  1. d3 布局照常算终位，物理不动；视觉入场挂**内层** `<g>`（与 bobbing 同坐标系思路，见 8-A 补充二）：一次性 CSS keyframe `translateY(-40vh→0)` + `opacity 0→1`，`ease-in`（加速坠落），hash 错峰 delay 0–1.2s、单球时长 0.5-0.8s。**与 `bobbing`（8-B §2.18）协调（2026-06-12 关联审查）**：两者都用内层 g——嵌套两层（intro 外、bobbing 内）或 bobbing 的 animation-delay ≥ 入场总时长，禁止同元素同属性双动画。
  2. 触水时刻（delay + 时长）用 setTimeout 对位生成小涟漪——走 8-B §2.1 涟漪调度器的**独立一次性池**（36 圈不占运行时配额，入场结束整池销毁）。
  3. 仅首次挂载播一次；切组不触发（切组归 E2）；`prefers-reduced-motion` 命中直接跳过（球原地 0.3s 淡入）。
  4. `document.hidden` 状态下挂载（后台标签页打开）→ 跳过编排直接落定。
- **flag**：`splashIntro`（group=运动），桌面/移动默认 false（沙盒铁律）；一次性动画零持续成本，S 终拍板时移动端可考虑同开。
- **性能**：一次性，零持续成本。
- **验收**：`?splashIntro=1` 刷新首页可见落水入场、涟漪与触水时刻对位；2s 后与无 flag 状态完全一致（位置/物理/交互）；连刷不报错；关掉 = 现状直接出现。

## E2 — `groupWave` 切组涟漪转场

- **目标**：A/B/C 切组从"生硬瞬时重排"变成"一道波扫过，球群被冲洗成另一组"——把首页第三大交互翻译进世界观。
- **改法（开工前先勘探切组现流程）**：
  1. 切组事件触发一个大号手动涟漪（复用 bg-ripple-manual，size 放大、duration 稍长），起点 = 被点击的组标签位置（左侧）。
  2. 重排逻辑本身不动；可选给重排加 ≤150ms 延迟，使"波先到、球再动"的因果成立（体验后定）。
  3. 连续快速切组 ≥800ms 节流，不堆积涟漪。
- **flag**：`groupWave`（group=运动）。**性能**：忽略不计（一个一次性大涟漪）。
- **验收**：`?groupWave=1` 切组瞬间有波从标签侧扫过、重排读作"被波带动"；快速连切不堆积；关掉回瞬时重排。

## E3 — `navPond` 导航/顶栏水塘化

- **目标**：顶栏（标题 "Ripples in the Pond" + 登录按钮）脱离"星空时代白字"，与水塘世界观对齐——只做轻收尾，不改布局结构。承接 overview P8-S5 的导航部分。
- **改法**：
  1. 颜色：顶栏文字/边框/按钮 hover 态全部改引 `--pond-*` token（默认兼容值 = 视觉零变化；8-D 已冻结，接 token 是为未来配色重启留接口）。
  2. 可选点缀（体验后定去留）：标题 hover 时一次性轻微水波 displacement（复用 8-A 滤镜 def，非常驻）；顶栏底部 1px 水面光泽线（`var(--pond-glow)` @10%）。
  3. **不碰**：布局、字体、登录逻辑、其他页面复用顶栏处的行为。
- **flag**：`navPond`（group=渲染）。**性能**：忽略不计。
- **验收**：`?navPond=1` 默认无肉眼变化（token 兼容值，8-D 冻结期间无主题可验）；登录/点击不受影响；关掉回现状。

---

## 切步

| Step | 内容 | 📦 范围（越界即停） | 前置 |
|---|---|---|---|
| **E1** | splashIntro 入场编排（先勘探挂载流程） | `SphereCanvas.tsx` / `SphereNode.tsx`（内层 g）、`globals.css`（keyframe）、`effects-config.ts` | 8-B S1 |
| **E2** | groupWave 切组转场（先勘探切组流程） | 切组处接线、`BackgroundRipples.tsx`（若需大号 manual 参数）、`effects-config.ts` | 8-B S1 |
| **E3** | navPond 导航顶栏 | 顶栏组件、`globals.css`、`effects-config.ts` | 8-B S1（token） |

每步：`bash scripts/verify.sh` → 6 行汇报 → 等"继续"。E1/E2/E3 无相互依赖，顺序可按用户意愿调换。

## 触发停下问用户

- 想改顶栏布局 / 字体 / 信息架构 → 停（P11 范围）
- splashIntro 想接管 d3 首帧物理（而非纯视觉内层动画）→ 停，先讨论
- 想做 loading 页 / 路由转场 → 停（超出 P8 范围）
- 单文件超 200 行 / 撞合约 cron DB → 停

## Phase 8-E 完结标准

- [ ] 三 flag 各自独立开关、单独关掉完全回现状；全关 = 与开工前像素级一致
- [ ] splashIntro：落水入场 + 触水涟漪对位 + reduced-motion 跳过 + 2s 后状态与现状一致
- [ ] groupWave：切组有波扫过、快速连切不堆积
- [ ] navPond：默认零变化、随主题换肤、登录/点击不受影响
- [ ] `bash scripts/verify.sh` 全绿 + 真机实测 + STATUS/JOURNAL 同步

## 参考

- 立项来源：2026-06-12 视觉评估对话（splashIntro / groupWave / 导航收尾三点子 + 导航空缺发现）
- 依赖规格：8-B §1 token、§2.1 bgRipples、§2.10 `bg-ripple:spawn` 监听；8-A 滤镜 def 与补充二（内层 g 架构）
