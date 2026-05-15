# Track C — 全站提速

> **范围**：用户原话"打开一个新页面需要多久才能加载出来。我需要加载的快一些"。
>
> **前置**：无（独立 track）。部分 step 与 Track A 重叠（C4 / A11 同一改动；C5 复用 A10 占位组件）
>
> **核心交付物**：首页 / /me / /score / /artist 四个核心页面 LCP 达标（建议 < 3s）+ 对比 baseline 报告

---

## 冻结决策

### D-C0 — C1 跑两次（2026-05-13 修订）

**原决策（已废弃）**：C1 必须等 A3+A12 完结才能跑（避免 25min lease 污染）。
**新决策（用户 2026-05-13）**：C1 跑两次：
- **第一次（C1）**：现在跑作为"修前 baseline"，反映当前用户真实感知（含 25min lease 慢）。这反而是有意义的 baseline。
- **第二次（C8）**：A3+A12 + C3-C7 完结后跑，作为"修后对照"。两组数据对比写完结报告。

理由：Track C 起点不再被 Track A 阻塞，3 个 Track 完全并行。"修前 baseline + 修后对照"对投资人 / 协作者更有说服力。

### D-C1 — baseline 优先于优化

用户原话"具体怎么实现可以讨论，可以开放讨论" → **不允许凭经验优化**。先跑 Lighthouse 拿真实数据，对比目标值，**有差距才优化**。避免"看起来慢就优化"的无效功。

### D-C2 — 四个体感目标 + ROI 准则（2026-05-15 修订）

C2 不再单独开 30 分目标值会议，改为吸收用户已给的四个体感目标：① `/` → `/me` 到所有内容展示约 2 秒；② 进入 `/me` 后待铸造项目"正在上传"约 3 秒；③ 点击某个唱片约 1 秒内进入；④ 进入 `/` 约 0.8 秒有反馈。

执行准则：**对四个目标帮助大、框架改动小、风险低就做；帮助小、改动大、风险高就不做**。因此 P7 做 C3 + C5 + C6 温和版 + C7 + C8；不做 C6 激进字体裁剪。

### D-C3 — UX 感知优先于工程指标

如果 Lighthouse 指标好看但用户实测"看起来慢"，**信用户**。可能是骨架屏 / 加载文案 / 字体闪烁等感知问题。

### D-C4 — 不引新依赖

P7 期间不引入 Lighthouse CI / web-vitals 库。Lighthouse 直接用浏览器内置（DevTools）或 PageSpeed Insights。

### D-C5 — /api/me/scores split 不破坏现有 caller

C3 step 拆 split 时 `/api/me/scores` 返回结构**新增字段不减字段**。drafts[].events 字段保留，只新增 `eventCount`，让旧 caller（草稿 ▶ 按钮）继续 work。Phase 8 / 9 再考虑彻底拆 client-side fetch。

---

## 📋 Step 总览

**关键顺序**（2026-05-15 修订）：C1 已作为"修前 baseline"产出；C2 目标值讨论已被用户四个体感目标 + ROI 准则吸收，不再单独执行；C3 必须先于 A14+A15（DraftCard polling 契约由 C3 定义）；C8 在 C3/C5/C6温和/C7 完结后跑作为"修后对照"。

| Step | 内容 | 对四个目标的贡献 | 工时 | 依赖 | 与其他 track 重叠 | 环境 |
|---|---|---|---|---|---|---|
| [C1](#step-c1--lighthouse-baseline) | Lighthouse 跑 4 个核心页面"修前 baseline" | 已提供判断起点 | 半天 | **无（Track C 起点）** | 无 | Vercel preview |
| [C2](#step-c2--四个体感目标--roi-准则) | 已合并为四个体感目标 + ROI 准则 | 决定做/不做边界 | 已完成（讨论）| C1 | 无 | — |
| [C3](#step-c3--api-me-scores-拆-split) | 直接命中 ① `/`→`/me` 2s、② 上传中 3s | 半天 | 无 | **必须先于 A14+A15** | 本地 |
| [C5](#step-c5--首页慢网占位--spinner--重试) | 体感命中 ④ 进入 `/` 0.8s 有反馈 | 半天 | 共享原子组件 | **复用 = LoadingSpinner + RetryButton 两原子组件**（不复用业务壳）| 本地 |
| [C6](#step-c6--字体加载优化) | 温和版小收益，降低字体阻塞；激进裁剪不做 | 30 分 | 无 | 无 | 本地 |
| [C7](#step-c7--路由-transition--loading-tsx-骨架) | 体感命中 ① `/me` 切换、③ 唱片 1s 内有反馈 | 1 天 | C5（共享 LoadingSpinner）| 复用 C5 原子组件 | 本地 |
| [C8](#step-c8--lighthouse-对比报告) | 验证四个目标和 ROI 是否成立 | 半天 | C3-C7 + 重测 buffer | 无 | Vercel preview |

**Track C 总工时**：约 3-4 天（C2 不再单独占时；只做高性价比项。未达标但需大改架构的项挪 P8/P10，不在 P7 硬啃）。

### C4 已删（合并 audit only）

原 C4（/api/me/score-nfts 改 event_count generated column）= Track A A11 = commit `0d75a93` 5/8 已修。C4 不单独列 step，仅在 C1 baseline 阶段附带 audit。

---

## 当前已知慢点（来自 STATUS.md 悬空 TODO + B8 实测）

| 慢点 | 现状 | 归属 step |
|---|---|---|
| `/api/me/scores` 联 `events_data` 35 秒慢 | 草稿列表大 JSON 数组 | **C3**（拆 split） |
| `/api/me/score-nfts` 35 秒慢 | ✅ 已修（5/8 改 event_count generated column） | C4 audit |
| 首页 Archipelago 慢网"正在唤醒群岛..." 无 spinner | UX 像卡死 | **C5** |
| cron lease 5 分钟 × 5 步 = 25 分钟 | 影响"上链中"灰卡感知 | **A12**（Track A） |
| /score/[id] SSR 拉完整 events_data | 几十/几百音符 × 大 JSON | C3 顺手 |

---

## Step C1 — Lighthouse baseline（修前对照）

### 概念简报

Lighthouse 是 Chrome DevTools 内置工具，跑一遍能拿到 LCP / FCP / TTI / TBT 等 Web Vitals 指标。是优化的"出发线"。

**2026-05-13 修订**：C1 现在跑作为**修前 baseline**（不等 A3+A12），即使含 25min lease 影响"上链中"草稿状态感知，也反映当前用户真实体验。C8 修后对照报告对比这组数据 + 四个体感目标。

### 📦 范围
- `reviews/2026-05-XX-phase-7-perf-baseline.md`（新建，存 baseline 数据 + 标注"修前"+ 已知慢点清单）

### 做什么

在测试网 Vercel preview（或本地 dev）跑 4 个核心页面 Lighthouse：
1. `/`（首页 Archipelago）
2. `/me`（已登录 Privy 测试号）
3. `/score/12`（已上链的乐谱）
4. `/artist`（艺术家页）

每页跑两次（Chrome 隐身模式 + 清缓存）取平均。指标：
- LCP（Largest Contentful Paint）
- FCP（First Contentful Paint）
- TTI（Time to Interactive）
- TBT（Total Blocking Time）
- CLS（Cumulative Layout Shift）

每页同时跑桌面 + 移动两套（Lighthouse → Device 切换）。

### 验证标准

- [ ] baseline 报告产出
- [ ] 4 页 × 桌面/移动 = 8 组数据齐全
- [ ] 看出"哪页最慢"+"瓶颈在网络 / 解析 / 渲染哪一段"

---

## Step C2 — 四个体感目标 + ROI 准则

### 概念简报

Lighthouse 是仪表盘，用户体感是方向盘。P7 不追求把所有 Web Vitals 都刷到完美，只做能明显改善 demo 体验、且不大改框架的优化。

### 📦 范围
- 用户对话决策，无代码改动
- 本文件记录执行口径

### 已拍板目标

1. 从 `/` 进入 `/me` 到所有内容展示：目标约 2 秒。
2. 进入 `/me` 后待铸造项目"正在上传"：目标约 3 秒。
3. 点击某个唱片进入 `/score/[id]`：目标约 1 秒内有明确反馈。
4. 进入 `/`：目标约 0.8 秒内有明确反馈。

### 已拍板取舍

- **做 C3**：直接减少 `/me` 首屏等待，是 ①② 的主优化。
- **做 C5**：首页慢网立刻给 spinner / retry，是 ④ 的低风险体感优化。
- **做 C6 温和版**：只做 `display: 'swap'` / preload audit / 重复加载检查。
- **不做 C6 激进字体裁剪**：收益通常只有几十到一两百毫秒，但可能造成 UI 回归。
- **做 C7**：用 `loading.tsx` 让 `/me`、`/score/[id]`、`/artist` 切页立刻有骨架，尤其命中 ③。
- **做 C8**：重跑同口径 Lighthouse + 手动体感对比，不达标再判断是否挪 P8/P10。

### 验证标准

- [x] C2 不再阻塞 C3-C8
- [x] 四个体感目标写入 playbook
- [x] 高性价比做 / 低性价比不做的边界写入 playbook

---

## Step C3 — `/api/me/scores` 拆 split（A14 / A15 前置）

### 概念简报

`/api/me/scores` 当前联 `events_data` 是给 DraftCard 的 ▶ 按钮用（按 events.time 触发音效）。但 /me 首屏不需要 events，浪费 ~35 秒等大 JSON。

**ROI 判断**：C3 是 Track C 性价比最高项，直接命中 ① `/`→`/me` 2s 和 ② "正在上传"3s；改动集中在 1 个 route + DraftCard lazy fetch，风险低。

**⚠️ C3 是 A14（5s 假成功 polling）+ A15（useMintScore 失败回滚 polling）的前置**，因为这俩 step 的 polling 调用契约依赖 C3 拆分后的 `/api/me/scores` 主 endpoint。**顺序：C3 → A15 → A14**。

### 📦 范围（环境：本地）
- `app/api/me/scores/route.ts`（按 D-C5：新增字段不减字段，保留 drafts[].events 兼容旧 caller）
- `app/api/me/scores/[id]/events/route.ts`（新建，按需 fetch events）
- `src/components/me/DraftCard.tsx`（▶ 按钮点时 lazy fetch）

### 做什么

1. 主 endpoint：
   - 保留 `events` 字段（兼容现有 caller）
   - **新增** `eventCount` 字段（用 jsonb_array_length 或 generated column）
   - 加 query param `?light=1` → 不返 events（A14/A15 polling 用此模式）
2. 新建 `/api/me/scores/[id]/events` 单独返 events_data（A14/A15 polling 不需要，仅 DraftCard ▶ 用）
3. DraftCard ▶ 按钮 onClick 时 lazy fetch events endpoint（带 loading 态）
4. A14 / A15 polling 调用契约：`/api/me/scores?light=1` p95 < 1s

### 验证标准

- [ ] /api/me/scores?light=1 p95 < 1s
- [ ] /api/me/scores（不带 light）保持原行为，旧 caller 不破
- [ ] /me 首屏不阻塞（DraftCard 列表立刻渲染，events 按需加载）
- [ ] DraftCard ▶ 第一次点击有 200-500ms loading 后开始播放，符合预期
- [ ] verify.sh 全绿

---

## ~~Step C4~~ → 已删（合并 audit only）

见 Step 总览前的"C4 已删"说明。C1 baseline 阶段附带 curl audit `/api/me/score-nfts` p95 即可。

---

## Step C5 — 首页慢网占位 + spinner + 重试

### 概念简报

B5 #7 已实施"慢网→显示'正在唤醒群岛...' 占位文字"（commit `c7340d4`）。Phase 6 smoke test C2 子项发现 UX 像"卡死"，归 P3 `slow-network-no-spinner`。Track C 一起做。

**ROI 判断**：C5 不一定显著降低真实 LCP，但能让进入 `/` 后 0.8 秒内有明确反馈，直接改善 ④；改动小、风险极低，做。

### 📦 范围（环境：本地 + components/common 目录）
- `src/components/archipelago/Archipelago.tsx:133`（占位区改造）
- `src/components/common/LoadingSpinner.tsx`（**新建，纯原子组件，无业务逻辑**）
- `src/components/common/RetryButton.tsx`（**新建，纯原子组件，无业务逻辑**）
- 前置 ls：`src/components/common/` 不存在 → 新建目录；存在则 ≤ 6 个文件才能加 2 个

### 与 A10 / C7 复用边界

**只复用 2 个原子组件**（LoadingSpinner + RetryButton），**不复用业务壳**：
- A10 `/score/[id]` 灾备壳：用 LoadingSpinner + RetryButton 自己组合"乐谱临时不可用 + 重试"
- C7 路由 transition：用 LoadingSpinner 自己组合骨架页布局
- C5 首页：用 LoadingSpinner + RetryButton 自己组合 3 段文案演进

每个壳的"数据形态 / 降级语义 / 文案"独立。

### 做什么

1. 原子 LoadingSpinner（SVG / Tailwind animate-spin / 可配 size 颜色）
2. 原子 RetryButton（onClick + loading 态 disable）
3. Archipelago 占位区组合：
   - LoadingSpinner + "正在唤醒群岛..."
   - 3 秒后追加"网络较慢，正在重试..."
   - 8 秒后 RetryButton "手动重试"
   - 失败 → 灰卡 + RetryButton

### 验证标准

- [ ] DevTools Slow 3G → 8 秒内出现 RetryButton（量化判据）
- [ ] DevTools Offline → 直接显示重试按钮
- [ ] LoadingSpinner / RetryButton 单独可复用（A10 / C7 import 无副作用）
- [ ] verify.sh 全绿

---

## Step C6 — 字体加载优化

### 概念简报

当前 layout.tsx 用 next/font 引入了 Modak（B6 球数字 badge）和 Azeret（基础字体）。检查是否：
- `display: swap`（fallback 字体先显示）
- `preload: true`（首页首屏字体早加载）
- 没有重复加载

**ROI 判断**：C6 只做温和版。字体优化通常只改善几十到一两百毫秒，但 audit + 参数修正改动极小；激进删除 / 裁剪字体需要视觉 smoke，收益小、回归风险中，不做。

### 📦 范围
- `app/layout.tsx`

### 做什么

audit + 优化 next/font 参数；只允许温和调整，不做未用字体激进裁剪。

### 验证标准

- [ ] Lighthouse "Avoid invisible text during webfont load" 通过
- [ ] LCP 不被字体阻塞
- [ ] verify.sh 全绿

---

## Step C7 — 路由 transition + loading.tsx 骨架

### 概念简报

Next.js App Router 支持 `loading.tsx` 文件做路由切换时的骨架页（自动显示 Suspense fallback）。当前 app/ 下没有任何 loading.tsx → 切页时白屏到 SSR 完成。

**ROI 判断**：C7 很难减少 `/score/[id]` SSR 必须读取的数据量，但能让点击唱片后 100-300ms 内出现骨架，体感上对齐 ③ "1 秒内进入"；改动小、风险极低，做。

### 📦 范围
- `app/me/loading.tsx`（新建）
- `app/score/[id]/loading.tsx`（新建）
- `app/artist/loading.tsx`（新建）

### 做什么

每个 loading.tsx 渲染对应页的骨架（灰色矩形 + spinner），切页瞬间显示，SSR 完成后自动替换。

### 验证标准

- [ ] / → /me 切换有 100-300ms 骨架显示（不白屏）
- [ ] / → /score/N 同上
- [ ] / → /artist 同上
- [ ] CLS 不退化（骨架尺寸近似真实页）
- [ ] verify.sh 全绿

---

## Step C8 — Lighthouse 对比报告

### 📦 范围
- `reviews/2026-05-XX-phase-7-perf-baseline.md`（更新，加 after 数据）
- `reviews/2026-05-XX-phase-7-perf-completion.md`（新建，完结报告）

### 做什么

重跑 C1 同样 8 组测试，对比 baseline + 对照四个体感目标：
- 全部达标 → Track C 完结
- 指标未完全达标但用户体感达标 → 记录为 downgraded-accepted
- 部分未达标且继续优化需要大改架构 → 挪 Phase 8 / Phase 10，不在 P7 硬啃

### 验证标准

- [ ] 报告产出
- [ ] 用户认可"打开页面比之前快"

---

## Track C 完结标准

- [ ] 8 个 step 状态 ∈ {fixed, downgraded-accepted}
- [ ] C8 对比报告显示四个体感目标明显改善；LCP / FCP 至少作为佐证，不作为唯一完结标准
- [ ] 用户实测体感快
- [ ] STATUS.md 悬空 TODO 里"/api/me/scores 35s 慢"已划掉

---

## 不在 P7 范围（明确挪走）

- **图片 / cover Arweave CDN 优化**：cover-arweave-map 已用 ario.permagate.io 网关。CDN 进一步优化挪 Phase 10。
- **bundle size 优化 / code splitting 深度**：需要拆视觉组件（archipelago 系），与 Phase 8 UI 重设计耦合，挪 P8。
- **SSR / ISR / Edge 改动**：架构层面调整，超 P7 范围。
- **激进字体裁剪 / 删除未用字体**：收益小且需要完整视觉回归，P7 只做 C6 温和版。

---

## 参考

- STATUS.md "悬空 TODO" — /api/me/scores 慢 / cron lease 25min / slow-network-no-spinner
- `reviews/2026-05-08-phase-6-completion-smoke-test.md` C2 子项 `slow-network-no-spinner` P3
- `reviews/2026-05-08-phase-6-strict-cto-review.md` P1-19 + P1-22 + slow-network 相关
