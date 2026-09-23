# Track I — P11-G/H 主线重放与效果对齐

> **状态**：计划已冻结（2026-09-24），尚未施工
> **归属**：P11-G/H 的交付轨。`70-g`、`80-h` 仍是产品与架构真值；本轨只负责把 G/H 安全、可核验地落到最新 `main`，不新增视觉设计
> **工作目录**：`E:\Projects\nft-music-p11-i`，分支 `claude/p11-i-replay`，起点 `origin/main@9324386`（2026-09-22）
> **只读参考**：`codex/p11-main-baseline@2671a4a`（首选）、`codex/p11-gh@51c9416`（旧版，含未提交改动）
> **执行方式**：Claude Code 新会话；每个 Step 结束按 AGENTS §4、§8 停下汇报，用户说“继续”才进入下一步

---

## 1. 三句话概念简报

1. G/H 的代码已经在两条本地分支上写过一遍，但它们的完成证据只证明“水面没有重建”，没有证明 main 上精修过的效果（作品页日食、#36 访客、播放器等）还在。
2. 本轨从干净的 `origin/main` 出发，先把 main 的现有效果记录成“标准答案”，再按功能一小步一小步把 G/H 搬进来；每一步都要和标准答案逐项对照一致才提交。
3. 旧分支只是参考材料，不是合并来源：每个文件进来前都要重新读懂、说清改动目的，并在浏览器里重新验证。

---

## 2. 起因与现状真值（2026-09-24 核对）

| 对象 | 事实 |
|---|---|
| `origin/main` | `9324386`（2026-09-22）；GitHub 上其余 9 个远端分支都已合入 main |
| `codex/p11-gh` | 9/22 首版 G/H：15 个提交未推送，另有 15 个已修改文件和 2 个未跟踪目录。已修改的代码最后改于 9/23 15:50–16:16，已被 baseline `2671a4a`（9/23 22:33）完整覆盖或取代。**独有且要保留的只有文档知识**：`docs/ERRORS.md` E053–E056 与 `docs/JOURNAL.md` 的 9/22–9/23 条目。两个 Edge 临时资料目录（约 140MB）只是测试残留 |
| `codex/p11-main-baseline` | 9/23 在 main 上重做：领先 15、落后 0，未推送，工作区干净 |
| baseline 的完成证据 | `D:/Temp/Hui/p11-main-integration-gate-fixed-20260923.json`（未入库）只断言 mountId、Canvas 数量、Scene owner 与横向溢出；**没有覆盖日食、音频、P9 与视觉一致性**，也没跑完整 `verify.sh`、没做真实账号目验 |
| 已知回归 | 用户实测：P11 线的 `/score` 点击唱片后，不出现 main 上精修过的日食（见 I6 风险分析） |
| 混入的独立修复 | 3 个与 G/H 无关的修复（见 I1） |

### 已由用户拍板、执行时不再重新讨论

- **首页提前准备私人档案**（2026-09-23，旧分支 JOURNAL「P11 私人档案预备层试验」）：推翻 G-D4 的“仅进入 `/me` 后请求”边界；在共享水塘内后台挂载唯一的档案实例，身份隔离与既有缓存不变。I5 按此实现，I8 同步修订 70-g 的 G-D4 文字。
- **Score 返回按钮回档案**（H-D6）：有来源时恢复原位置，没有来源（直接访问）时回 `/me` 默认首屏。
- **进入 Score 时全局播放器的停止时机**（H-D4）：main 是“进入 Score 立即停止”；G/H 改为“Score 真实播放接管时才停止”，避免点击后的无声空窗。
- **#36 的两个未合入修复悬置**（2026-09-24）：`codex/p14-eclipse-main-integration` 上的 `65a0261`“让首页 #36 完整飞出屏幕”、`ac8f1f9`“让首页 #36 随层级远近缩放”不纳入本轨，也不在本轨讨论；#36 一律以 main 现状为准。
- **唱片档案关联修复不单独热修**（2026-09-24）：I1-a 随本轨正常进入 main，不另开热修分支，也不做线上影响排查。

### 本地环境真值（执行前必须知道）

- `.env.local` 的 Supabase 指向**生产库** `uupobbgnhpattyxhxvmc`，链配置却是 OP Sepolia（`NEXT_PUBLIC_CHAIN_ID=11155420`）。本地读到的是生产数据；**本地任何写操作都会写进生产库**。
- `.env.local` 不入库。新 worktree 从 `E:\Projects\nft-music-release-me-20260922\.env.local` 复制，这是 P11 验收时用的那份，含 `NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL`。
- 只核对公开键（`NEXT_PUBLIC_CHAIN_ID`、`NEXT_PUBLIC_SCORE_NFT_ADDRESS`、mirror URL 是否已设置）；任何密钥值都不输出到终端或聊天。
- 本机访问 Google Fonts 可能超时并回退字体：本地两棵树之间比较时字体一致即可；和线上比较时忽略字体差异。

---

## 3. 冻结决策

### I-D1｜唯一基底

- 只在 `claude/p11-i-replay` 上工作。每个 Step 开始前、每次提交前执行：

  ```bash
  git fetch origin
  git merge-base --is-ancestor origin/main HEAD && echo BASE_OK
  git rev-list --count HEAD..origin/main   # 必须为 0
  ```

- `origin/main` 前进时，先停下告知用户；经同意后把最新 main 合入本分支（普通 merge），再重跑受影响的对照项。
- 禁止改动其他 worktree 的任何文件，尤其是 `E:\Projects\nft-music`（P16 工作区）。

### I-D2｜旧代码只作参考

- 用 `git show <分支>:<路径>` 或 `git diff origin/main <分支> -- <路径>` 阅读；**不 checkout、不 cherry-pick 整个提交、不整目录复制**。
- 可以大段沿用旧代码，但每个文件都要能说清每处改动的目的；说不清的改动不搬。
- 旧代码与 main 的精修冲突时，以 main 的效果为准；只有偏离 G/H 设计才能保住效果时，停下问用户。

### I-D3｜main 效果是验收真值

- I0 产出“效果基准表”（§5），之后每个 Step 的 Gate 都要对照表中受影响的条目。
- 任何偏差只有两种结局：修到一致；或由用户明确批准为有意变化，并写进 `docs/JOURNAL.md`。§2 已拍板的三项属于预先批准的差异。
- 结构类自动断言（mountId、Canvas 数量）是必要条件，不是充分条件，不能替代效果对照。

### I-D4｜独立修复与架构改造分开

- I1 的修复各自单独提交，不与 Water Core 改造混在同一个提交里。

### I-D5｜本地只读

- 浏览器测试中不点击：铸造唱片、保存乐谱、注册或修改资料、删除，以及任何 cron 或管理接口。
- 登录由用户本人在浏览器里完成；AI 不输入任何账号、验证码或密钥。
- 需要写库、上链、推送、部署或修改 Vercel 环境变量时一律停下，等用户明确授权。

### I-D6｜小步提交、及时备份

- 每个 Step 通过 Gate 后，用户说“commit”才本地提交（AGENTS 与 P11 全局规则 8）。
- 用户授权后把本分支推到 GitHub 同名分支做备份；不推 `main`、不部署，除非用户明确说。

### I-D7｜与 P16 隔离

- 不改 P16 独有区域：自付 Gas 铸造、钱包登录、链注册表、多合约作品路由、`supabase/migrations/phase-16/`。
- I1 的“旧唱片固定 OP 主网身份”必须和 P16 设计一致：数字链接 `/score/N` 永远指 OP 主网旧合约；P16 的新合约走 `/score/[id]/[contract]/[tokenId]`。

---

## 4. 参考提交 → 新步骤映射

| 新 Step | 参考提交（`codex/p11-main-baseline`） | 主要文件 |
|---|---|---|
| I1 独立修复 | `5585d64`、`3b26976`、`f01ef6c`；`2671a4a` 中的 `app/globals.css`、`.gitignore` | 见 I1 📦 范围 |
| I2 共享外壳 | `8603008` | `app/(pond)/layout.tsx`、`pond-shell/PersistentPondShell.tsx`、`PersistentWaterCore.tsx`、`PondExperience.tsx`、`use-gl-sim.ts` |
| I3 路由转场 | `3043879`；`pond-transition.tsx` 在 `fb69224`、`b4d76a7`、`2671a4a` 中的后续修正 | `pond-transition.tsx`、`PondRouteLink.tsx`、`PondHeader.tsx`、`ArchiveHeader.tsx` |
| I4 圆圈进退场 | `d6e0dd0`、`f693017` | `PondGL.tsx`、`SphereOverlay.tsx`、`SphereInstances.tsx`、`sphere-frame.ts`、`Track36Visitor.tsx`、`use-scene-presence.ts` |
| I5 档案前景 | `db44386`、`f616b74`、`2671a4a` | `app/(pond)/me/**`、`MeArchivePage.tsx`、`use-prepared-archive.ts`、`TestJam.tsx`、`WaterDistort.tsx`、`ripple-feed.ts` |
| I6 作品页接入 | `c691884`；`2671a4a` 中的 Score 布局与 CSS | `app/(pond)/score/[id]/**`、`scene-slot.tsx`、`ScorePondScene.tsx`、`use-score-pond-sim.ts` |
| I7 档案↔作品锚点 | `46fe432`、`b4d76a7` | `score-origin.tsx`、`ScoreArchiveRow.tsx`、`ArchiveSection.tsx`、`ScorePondHeader.tsx`、`FallbackShell.tsx`、`ScoreLifecycle.tsx` |
| I8 总验收 | `fb69224`、`1106746`、`b4d76a7`（自动脚本与证据）；`codex/p11-gh` 未提交的 ERRORS/JOURNAL 条目 | `scripts/p11/pond-continuity.mjs`、`reviews/`、`docs/` |

`codex/p11-gh` 上的 `ff9e953`、`92b231e`、`51c9416` 是 I1 三个修复的旧版，只在对照时参考。

---

## 5. 效果基准表（I0 产出，之后每步对照）

每条记录：路由、操作步骤、期望现象、证据（截图、时间点序列、控制台）、来源提交，以及本地和线上是否一致。

| ID | 页面 | 条目 | main 上的来源 |
|---|---|---|---|
| B01 | `/` | 冷启动：加载提示 → 水面接管，没有原始球层或备用圆闪现 | `05e7e9a`、`59aec3d` |
| B02 | `/` | 35 个音乐圆、标签、悬停、拖拽、点击播放、分组切换 | P8、P11 |
| B03 | `/` | 水面：鼠标涟漪、拖球尾迹、花瓣、月光、滚轮水位 | P8 |
| B04 | `/` | 播放：播放球的日食焦点、其他球隐去；暂停或结束后归位 | P8、P11 |
| B05 | `/` | P9：日食态 33 键动画与音效；非日食态按契约拒绝 | P9 v4.2 |
| B06 | `/` | #36 水中访客（Pond Echo）出现与退场；ECHO 日食黑场与恢复 | `327c40c`、`2839200`、`c8e59d2` |
| B07 | `/` | “我的音乐”入口、登录与 Semi 注册入口 | `d35ec0f`、`3dddf52` |
| B08 | 全局 | 底部播放器与进度拖动；进入 Score 时的停止时机（预期差异，见 §2） | `9324386` |
| B09 | `/me` | 未登录与认证中状态 | P11-C |
| B10 | `/me` | 静水档案：三块音乐区域、鼠标涟漪、待铸造倒计时、收藏整行播放、铸造入口（只看不点） | `8523600`、`43d7543`、`6cd3926`、`0b2fdb3`、`ec75d0a` |
| B11 | `/me` | 唱片档案列表能读出来。main 上可能已因 I1-a 的故障报错：记录现状，不算回归 | `8ce2514` |
| B12 | `/score/1–4` | 首屏：唱片居中并露出永久档案；分享入口收束，点击外部收起；没有加载中间页 | `47a1a19`、`cf4ce9f`、`bcc189f`、`f757024` |
| B13 | `/score/1–4` | **点击唱片 → 日食**：与首页日食对齐，自然流动并归位；暂停或结束后回到唱片 | `fba765a`、`d53d715` |
| B14 | `/score/1–4` | 播放：加载中可以排队播放；首播音效、底曲流式、P9 事件动画 | `67fa3fc`、`3d249a5`、`00293d9` |
| B15 | `/score/1–4` | 滚动：保留鼠标视差，滚轮交还页面；凭证账本可读、可复制 | P11 滚动热修 |
| B16 | `/score/1–4` | 返回按钮：main 回首页；G/H 改为回档案（预期差异，见 §2） | P11-B |
| B17 | 全部 | 375 / 768 / 1024 / 1440 四视口；reduced-motion；无 WebGL 兜底 | P11-F |
| B18 | 全部 | 控制台 0 error；无横向滚动 | — |

- 日食、#36、转场这类动态效果，至少记录 0 / 150 / 450 / 1500ms 四个时间点的截图，再加用户肉眼目验。
- B06 的 #36 依赖主网 ECHO 数据，本地 Sepolia 链配置下可能不出现：以线上表现为准，在表中标“环境差异”，不算代码回归。
- 基准表写入 `reviews/2026-09-24-p11-i-baseline.md`，截图与 JSON 放 `reviews/evidence/p11-i/baseline/`。

---

## 6. 施工顺序

## I0｜基底、环境与效果基准表

### 📦 范围

- 只建立环境与证据：`reviews/2026-09-24-p11-i-baseline.md`、`reviews/evidence/p11-i/baseline/**`。
- 经用户同意后，把 `STATUS.md` 的“当前权威下一步”和 `TASKS.md` 的 Now 改为 P11-I。
- 不修改任何产品代码。

### 步骤

1. 执行 I-D1 的基底断言，把 `origin/main` 的哈希写进基准文档。
2. 在本 worktree 里真实执行 `npm ci`。**禁止**用 junction 或符号链接借其他树的 `node_modules`（P8 教训：清理 junction 时会删掉主树的依赖）。
3. 复制 `.env.local`（见 §2 本地环境真值），只核对公开键。
4. 准备 main 对照树：`E:\Projects\nft-music-progress-release`（分支 `codex/playback-seek-final`，恰好等于 `origin/main@9324386`，工作区干净）。同样执行 `npm ci`、复制同一份 `.env.local`，保证两棵树的差异只来自代码。对照树只读，永远不在里面提交。
5. 启动两个 dev 服务器：重放树用 `.claude/launch.json` 的 `dev`；对照树在 `launch.json` 里临时加一条 `main-ref`（`npm --prefix E:/Projects/nft-music-progress-release run dev -- -p 3011`，端口 3011）。这条配置含本机路径，不进入任何提交。
6. 线上核对：确认 `pond-ripple.xyz` 当前部署对应 `origin/main`；无法确认就在基准文档里写明。
7. 按 §5 逐条记录。以本地对照树为主，B06、B11、B13 同时记录线上表现。需要登录的 `/me` 由用户本人操作。
8. 用户逐条确认基准表后，I0 才算完成。

### Gate

- 基准表 18 项齐全，每项都有证据，或写明无法取得的原因。
- 用户确认“这就是 main 应有的样子”。
- 本步没有产品代码 diff。

---

## I1｜独立修复先行

### 📦 范围

- **I1-a 唱片档案关联歧义**：`app/api/me/score-nfts/route.ts` 的 `tracks(title)` 改为显式外键 `tracks:tracks!score_nft_queue_track_id_fkey(title)`。
- **I1-b 旧唱片固定 OP 主网身份**：新建 `src/data/score/legacy-identity.ts`；修改 `src/data/score-source.ts`、`src/data/score-fallback.ts`、`src/data/score/metadata.ts`、`src/data/score/snapshot-source.ts`、`app/score/[id]/page.tsx`、`app/score/[id]/components/ScoreArchive.tsx`、`ScoreLifecycle.tsx`、`app/api/scores/[id]/owner/route.ts`、`next.config.ts`、`package.json`（`p15:h5:verify`）；新建 `scripts/p15-h/snapshot/legacy-identity.test.ts`。注意：这时 Score 还在 `app/score/[id]/`，不在 `(pond)` 下。
- **I1-c 首播音效默认走高速镜像**：`src/features/permanent-media/resolver.ts`、`scripts/p15/checks/mirror-race.ts`。
- **I1-d 样式扫描范围**：`app/globals.css` 改为只扫描 `app/`、`src/`；`.gitignore` 忽略 `/.edge-baseline-profile/`、`/.next-*/`。

每一项单独提交。

### I1-a：原因

- P15 migration `052` 新增了 `score_nft_queue → tracks` 的复合外键 `score_queue_base_identity_fk`。两张表之间于是有两条外键关系，PostgREST 嵌入 `tracks(title)` 时无法判断用哪条，会报歧义错误；本地连接的库已有这条外键，所以不修的话本地 `/me` 唱片列表读不出来。
- 全仓只有这一处从 `score_nft_queue` 嵌入 `tracks`。
- 按 §2 的决定，本项不做线上影响排查、不单独热修。

### I1-b：部署风险

- `next.config.ts` 会在 `VERCEL_ENV=production` 时断言链号为 10、ScoreNFT 为 `0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA`；不一致会**直接让生产构建失败**。合入 main 前，必须请用户确认 Vercel Production 的环境变量与此相符。
- 这条断言只在生产构建时生效，本地和 Preview 不受影响。

### I1-d：防止样式丢失

- 改扫描范围后，逐页对照基准表确认没有样式消失；main 上 `app/`、`src/` 以外没有使用 Tailwind 类名的页面源码。

### Gate

- `bash scripts/verify.sh`、`npm run p15:h5:verify` 和镜像竞速检查全部通过。
- 本地 `/me` 唱片列表可以读出（用户登录后目验）；`/score/1–4` 的凭证账本显示 OP 主网合约和浏览器链接。
- B01–B18 与基准一致：这一步不应改变任何视觉。

---

## I2｜共享水塘外壳（只搭架子）

### 📦 范围

- `app/(pond)/layout.tsx`、`app/(pond)/page.tsx`；删除 `app/page.tsx`；`app/me/**` 迁入 `app/(pond)/me/**`（URL 不变）。
- `src/components/pond-shell/PersistentPondShell.tsx`、`PersistentWaterCore.tsx`、`pond-shell.css`。
- `src/features/home-pond/PondExperience.tsx`、`src/components/pond-gl-test3/spheres/use-gl-sim.ts`。
- `/score` 这一步仍留在共享外壳之外。

### 要求

- 按 G-D1：Water Core 持有水面、花瓣、pointer 与 health；首页 `glSim` 留在首页 Scene；不把 PondGL 放进根 layout。
- 提供只读诊断属性（mountId、scene owner）；生产不显示调试面板。

### Gate

- **首页 B01–B08 与基准逐项一致**：这一步首页必须看不出任何变化。
- `/ → /me → /` 往返三次，mountId 与 Canvas 引用不变；直接访问、刷新 `/me` 正常；无 WebGL 兜底正常。
- `bash scripts/verify.sh` 通过。

---

## I3｜`/ ↔ /me` 可逆路由转场

### 📦 范围

- `src/components/pond-shell/pond-transition.tsx`、`PondRouteLink.tsx`、`pond-shell.css`。
- `src/components/pond-gl-test3/overlay/PondHeader.tsx`、`src/components/me/archive/ArchiveHeader.tsx`、`PondExperience.tsx`。

### 已知坑（来自旧分支的 ERRORS E053–E055、JOURNAL 与 ChatGPT 总结）

- 导航意图、地址落地、动画结束三者会竞态。只有目标路由和内容都就绪后才收场；旧地址上的兜底计时器和子元素冒泡上来的透明度事件，都不能结束转场；浏览器历史导航要清除过期意图。
- 档案预备层在 `/me` 稳定之前必须保持 `inert`，否则冷路由快速返回会卡在 `leaving-home`。
- Suspense 只能包住前景，不能包住 Water Core 或转场控制器，否则并发导航会冻结持续水面。
- 渲染时不能读 `ref.current`（ESLint `react-hooks/refs`）：控制流用 ref，视觉层用 state。
- `PondHeader` 改品牌链接时要保留 `next/link` 的导入，艺术家导航还在用。

### Gate

- 70-g G2 的全部 Gate：10 次快速往返、动画中反向、前进与后退、焦点落点。
- B07 入口和 B08 播放器行为与基准一致。
- `bash scripts/verify.sh` 通过。

---

## I4｜音乐圆圈连续进退场

### 📦 范围

- `src/components/pond-gl-test3/PondGL.tsx`、`overlay/SphereOverlay.tsx`、`overlay/GlLoading.tsx`、`spheres/SphereInstances.tsx`、`spheres/sphere-frame.ts`、`visitor/Track36Visitor.tsx`。
- `src/components/pond-shell/motion/use-scene-presence.ts`、`PersistentWaterCore.tsx`、`PondExperience.tsx`。

### 重点

- 这一步会改 `Track36Visitor.tsx` 和圆圈透视（`f693017`“对齐圆圈透视与转场稳定态”）：**B06 的 #36 访客，以及圆圈稳定态的尺寸与透视，都必须与基准一致**。
- #36 的两个未合入修复已悬置（§2）：不要顺手带入，对照一律以 main 现状为准。
- 稳定终态（完全在首页）下，圆圈的位置、大小、透视和光晕要能和 main 的截图逐帧对比。
- 圆圈与档案前景必须用同一条缓动曲线：旧分支实测 CSS 用 `cubic-bezier(0.16, 1, 0.3, 1)`、圆圈 RAF 用平滑步进时，档案已显现约 98% 而圆圈仍有约 40% 可见度。

### Gate

- 70-g G3 的全部 Gate：0 / 120 / 260 / 520ms 逐帧、导航前的涟漪继续扩散、返回时不重新散射、reduced-motion。
- B02–B06 与基准一致；播放中往返后播放状态正确。
- `bash scripts/verify.sh` 通过。

---

## I5｜档案前景合并与预备

### 📦 范围

- `app/(pond)/me/**`（`MePondArchive.tsx`、`me-pond.css`、`page.tsx`、`test/`）、`src/components/me/archive/MeArchivePage.tsx`。
- `src/components/pond-shell/use-prepared-archive.ts`。
- `src/components/jam/TestJam.tsx`、`src/components/pond-gl-test3/water/WaterDistort.tsx`、`water/ripple-feed.ts`。

### 要求

- 按 §2 已拍板的决定实现“首页提前准备私人档案”：共享水塘里只有唯一一个档案实例；账号切换或登出时预备数据立即失效；未登录时不请求私人数据。
- 首页点击入口时，只在档案内容就绪或明确失败后才完成切换，不显示半空的档案。

### Gate

- 70-g G4 的全部 Gate；`/me` 不响应首页演奏键，输入框和滑块不制造水波。
- B09–B11 与基准一致：三块区域、鼠标涟漪、倒计时、收藏播放、铸造入口。
- 首页首屏性能不因预备档案明显变差：记录预备前后首页的首个水面可见时间和长任务。
- `bash scripts/verify.sh` 通过。

---

## I6｜作品页接入共享水面（日食重点）

### 📦 范围

- `app/score/[id]/**` 迁入 `app/(pond)/score/[id]/**`（URL、canonical、OG、poster 不变）；新增 `layout.tsx`，样式改名为 `score-pond-page.css` 并由 Score 布局导入。
- `components/ScorePondScene.tsx`、`components/use-score-pond-sim.ts`。
- `src/components/pond-shell/scene-slot.tsx`、`PersistentPondShell.tsx`、`PondExperience.tsx`。

### 日食回归风险分析（先读懂再动手）

main 上精修过的日食（`fba765a`、`d53d715`）代码，baseline 基本原样搬进了新路径，但运行条件变了：

1. 作品页不再自己挂 PondGL，而是向共享水面注册 Scene；日食由 `health === 'healthy' && sceneReady && visualActive` 门控。只要共享水面没把 `sceneReady` 报给 Score，日食就会**静默不出现**，页面也不报错。
2. 去掉了进入作品页时的 `resetWaterLine()`：水位沿用首页留下的状态，可能改变日食的样子。如果确实因此不一致，优先方案是进入 Score 时把水位**平滑**回到默认值，而不是瞬间重置；这个方案需要用户确认。
3. `GlEclipse` 在 `z-35` 的无变换层；`.score-pond-page` 必须是透明背景，才不会盖住持续水面。
4. 直接访问 `/score/N` 和从 `/me` 进入是两条路径，Scene 注册的时序不同，两条都要测。
5. 本地编译曾把迁移后的 Score CSS 错指到水塘外壳的样式块：Score 样式用独立文件名，并由 Score 布局导入。

诊断顺序：先看页面上的 `data-gl-health` 与 Scene 就绪状态，再看日食的挂载条件，最后才调视觉参数。

### Gate

- **B13 必须与基准逐时间点一致**；直接访问和从 `/me` 进入两条路径都测，并由用户肉眼确认。
- B12、B14、B15 与基准一致；B08、B16 符合 §2 的预期差异。
- Score 真实播放时停止并隐藏全局播放器；离开后没有 Score 的音频、P9、日食、timer 或 RAF 残留。
- 80-h H1、H2 的全部 Gate。
- `bash scripts/verify.sh` 通过。

---

## I7｜档案条目 ↔ 作品唱片锚点

### 📦 范围

- `src/components/pond-shell/score/score-origin.tsx`、`pond-shell.css`、`pond-transition.tsx`。
- `src/components/me/archive/ScoreArchiveRow.tsx`、`ArchiveSection.tsx`、`MeArchivePage.tsx`。
- `src/components/p11/ScorePondHeader.tsx`、`app/(pond)/score/[id]/FallbackShell.tsx`、`components/ScoreLifecycle.tsx`、`components/ScorePondScene.tsx`。

### 要求

- 只有拥有稳定 Token 身份的 ready 唱片才启用锚点变形；processing、failed、直接访问和来源失效都退回普通淡入，不伪造唱片身份（H-D2）。
- 返回按钮与浏览器 Back 走同一个转场控制器（H-D6）。

### Gate

- 80-h H3、H4 的全部 Gate：热路径与冷路径、双击、Back、目标失败、换目标、新标签打开、键盘 Enter。
- 返回档案后恢复原分区、分页和滚动位置；B10 的行内播放与倒计时不回退。
- `bash scripts/verify.sh` 通过。

---

## I8｜总验收、交付与清理

### 自动验证

- 先停掉所有 dev 服务器，再跑 `bash scripts/verify.sh`：同一棵树的 dev 与 build 共用 `.next`，同时运行会互相干扰，出现假的 404。
- 连续性脚本：沿用或改写 `scripts/p11/pond-continuity.mjs`。首页和 Score 各往返 20 次，覆盖四视口、Back/Forward、快速反向、reduced-motion、无 WebGL；证据放进 `reviews/evidence/p11-i/` 并入库，不再放临时目录。
- 70-g G5/G6、80-h H6 的生命周期与音频隔离断言：AudioContext 数量、音源、P9 voice、listener、RAF 都回到基线。

### 效果终验

- 基准表 18 项全部重跑：一致，或属于已批准的有意变化。
- 用户用真实账号完成 `/ → /me → /score/<ready Token> → /me → /` 的体感目验。

### 文档

- `docs/ERRORS.md`：搬入 `codex/p11-gh` 未提交的 E053–E056，按合并时 main 的最大编号顺延重编（P16 也在新增 ERRORS 条目，注意避让）。
- `docs/JOURNAL.md`：搬入两条旧分支的 9/22–9/23 条目，再记录本轨所有被批准的偏差，以及 2026-09-24 的 D-3、D-4 决定。
- `playbook/phase-11/70-g-persistent-pond-transition.md`：把 G-D4 改成用户 9/23 的新决定。
- `docs/ARCHITECTURE.md`：写入“Water Core 跨三条路由持久”的边界。按 AGENTS §5，改之前要用户单独授权（D-5）。
- 新建 `reviews/2026-09-XX-p11-i-completion-review.md`；勾选 70-g §6、80-h §6 的完成定义；更新 STATUS、TASKS。

### 交付（每一项都要用户明确授权）

1. 推送 `claude/p11-i-replay` 到 GitHub。
2. 合入 `main`（main 没有前进时直接快进）；合入前确认 I1-b 所需的生产环境变量。
3. Vercel Production 部署后，在 `pond-ripple.xyz` 复测 B01–B18。

### 清理（用户授权后）

- 确认 ERRORS/JOURNAL 已搬完、没有独有内容后，删除 `codex/p11-gh`、`codex/p11-main-baseline` 两个 worktree 和分支，以及两个 Edge 临时资料目录。
- 对照树 `nft-music-progress-release` 按需保留或删除。

---

## 7. 与其他工作线的关系

- **P16**：在 `E:\Projects\nft-music`（`feat/p12-mainnet-prep`），121 个未提交文件，基底是 9/12 的 main。P11-I 合入 main 之前不迁移 P16。迁移时注意：`/me`、`/score` 已搬到 `app/(pond)/`；P16 的 migration 要从 `051–055` 改号，从 `053` 起（main 上 P15 已占用 `051`、`052`），并在隔离测试库重跑迁移 Gate；数字 `/score/N` 固定指 OP 主网旧合约。建议在 P11-I 开工前，先把 P16 的未提交改动存档推送到备份分支（独立任务）。
- **P15-I5 收尾**与 **P14-G**：不在本轨范围。
- **#36 的两个未合入修复**：用户已决定悬置（§2），不在本轨处理。

---

## 8. 额外停止条件（AGENTS §5 之外）

- 基底断言失败，或 `origin/main` 前进。
- 某个基准项无法对齐，而对齐需要偏离 G/H 设计。
- 需要写生产数据库、上链、推送、部署，或修改 Vercel 环境变量。
- 同一个文件改了 3 次仍无法与基准对齐：停下，建议回到上一个 Step 的提交。回滚走 `scripts/checkpoint.sh`，禁止 `git reset --hard`。
- 需要新依赖。

---

## 9. 工作方式

- 每个 Step 是一个小闭环：开工前说明 📦 范围，完成后按 AGENTS §8 汇报，等用户说“继续”或“commit”。
- 默认 slow mode；用户说 `/fast` 才跳过概念简报与复述。
- 浏览器验证优先用 Claude Code 内置浏览器；动态效果按 §5 的时间点采样截图。
- 每天结束前，经用户授权至少推送一次本分支。

---

## 10. 待用户拍板

| ID | 问题 | 选项 | 建议 |
|---|---|---|---|
| D-5 | I8 更新 `docs/ARCHITECTURE.md` | 授权 / 不授权 | 到 I8 时再问 |

D-3（#36 两个修复）与 D-4（I1-a 是否单独热修）已于 2026-09-24 拍板，见 §2。

---

## 11. Track I 完成定义

- [ ] 本分支从最新 `origin/main` 出发；合并前 `HEAD..origin/main` 为 0。
- [ ] I0 基准表经用户确认；I8 全量复测一致，或差异已获批准。
- [ ] I1 的修复各自单独提交。
- [ ] 70-g §6 与 80-h §6 的完成定义全部勾选，证据入库。
- [ ] **作品页日食（B13）在直接访问和从档案进入两条路径下都与 main 一致，用户肉眼确认。**
- [ ] 完整 `verify.sh`、自动连续性、音频隔离与真实账号目验全部通过。
- [ ] 旧分支的 ERRORS/JOURNAL 知识已搬入；旧 worktree 与临时目录已清理（用户授权）。
- [ ] 推送、合入 main、部署都经过用户明确授权。
