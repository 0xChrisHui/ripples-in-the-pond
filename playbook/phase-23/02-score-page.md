# Phase 23 第二轮 — `/score` 作品页 UI/UX 修复

> **2026-11-14：P23 改定位为“视觉维修”，本文是其中的 A 线**，总览见 `00-overview.md`（B 线封面池见 `03-cover-pool.md`）。

> 制定日期：2026-11-13。状态：**待开工**（用户说“开始”后才动手；本文只是方案）。\
> **执行方式（2026-11-13 用户定，开工后适用）**：“尽可能一次性执行完，自动 push to main，第二天早上验收。”因此开工后 §4 全部按推荐执行（开工前你可以改）；各步的 Gate 改为**次日统一验收**；每步单独 commit（方便逐个回滚）；全部完成后跑一次 `verify.sh`，通过再推送 `main`（会触发 Vercel 生产部署）。仍会停下的情况：要改合约、写生产库、装新依赖、动 `/test1`。\
> **隔离**：开工前先确认主目录没有其他会话的未提交改动；提交时只 stage 本轮自己的文件。是否另开工作区、是否与其他阶段并行，开工前由你定。\
> **追加需求（2026-11-13）**：手机双指缩放现在会放大整个网页；改成和桌面滚轮一样，让音乐圆圈整体切换层。见 Step 7。\
> 依据：2026-11-13 本地截图诊断（桌面 1440×900、手机 390×844；`/score/1` 定稿态、`/score/5` 降级态）。诊断截图暂存 `D:\Temp\Hui\claude\score-shots\out`，Step 0 正式存进 `reviews/evidence/p23-score/baseline/`。\
> 第一轮：STATUS、TASKS、playbook、git log 里都查不到 P23 第一轮的记录。如果有，请告诉我，我补上链接。\
> 基线：以开工时的 `main` 为准（立项时是 `4583a86`）。开工后按上面的执行方式逐步提交，全部通过后推送 `main`。\
> 本计划**不改合约、不改数据库、不改链上和 Arweave 永久内容，不新增依赖**。`/test1` 不动。`/score-lab/1`、`/echo`、`/me` 共用部分组件，只保证它们不坏。

---

## 1. 目标

让 `/score` 回到“一张唱片的展示页”：首屏只讲作品和播放，凭证退到第二层，按需展开。同时修好全站 P11 字体失效的根因。

---

## 2. 诊断（编号供后面各步引用）

| # | 问题 | 证据 | 哪一步修 |
|---|---|---|---|
| D1 | P11 字体令牌整条失效，标题层级被压平 | 计算样式：`.score-pond-page__identity h1` 为 16px / 400 / Azeret Mono；设计值是 `clamp(2.5rem, 7vw, 5.75rem)` / 300 / Cormorant。“作品凭证”h2 同样是 16px | Step 1 |
| D2 | 顶部有两层顶栏、三个出口 | 第一层是全站外壳顶栏（“← 返回水塘 / 艺术家 / 详情 / CN·EN / 登录”）；第二层是 `/score` 原来设计的自带顶栏（“← 返回档案”“回到水塘”、中间的链名和编号、右侧“分享”），两层并存，两个“回水塘”重复 | Step 2：整条删掉第二层 |
| D3 | 编号重复 | 中间行“OP MAINNET · TOKEN #001”、印章“Token #001”、标题“Ripples #1” | Step 2 |
| D4 | 手机首屏重叠 | 390 宽时中间行在 y=140–184，身份块在 y=116–213，压住标题（与字体问题无关） | Step 2 |
| D5 | 副标题难懂，术语不统一 | 显示“33 · 35 个永久事件”，“33”是底曲名但没有标注；分享卡和 OG 叫“音符” | Step 2 |
| D6 | 手机滚动时顶栏叠在正文上 | 截图 `ready-mobile-s1`：“返回水塘”压在说明文字上 | Step 2 |
| D7 | 唱片小，标题离唱片远 | 唱片最大 168px；桌面标题在左上 (58,132)，唱片中心在 (720,425) | Step 2、3 |
| D8 | 两个控件做同一个动作，说明框用工程语言 | 唱片按钮和“开始播放”胶囊按钮重复；黑底框写“永久音频只会在你主动点击后建立播放会话” | Step 3 |
| D9 | 进度条 1px，看不到时间 | `.score-record-anchor__progress` 高 1px；时间只写在无障碍属性里 | Step 3 |
| D10 | 凭证区太长 | 12 行等权重；手机上凭证卡高 1987px，占全页 3253px 的 61% | Step 4 |
| D11 | 正常定稿的作品显示 3 条橙色“未记录” | 创作者、铸造交易、定稿交易缺失时用了降级警示色 | Step 4 |
| D12 | 三个标题说同一件事 | “PERMANENT RECORD · 永久档案”“作品凭证”“永久凭证 12 项记录”；底部印章又重复一次编号 | Step 4 |
| D13 | 每行操作重复，手机上错位 | 每行都有“来源”“复制完整值”“查看外部记录”；手机上两个按钮上下错开 | Step 4 |
| D14 | 资产包排在最后 | `ScorePondScene.tsx:193-194`：持有人的主操作在 12 行凭证之后 | Step 5 |
| D15 | 制作中页面不会自动更新 | `ScoreLifecycle` 只有“刷新制作状态”按钮，点了是整页刷新 | Step 5 |
| D16 | 失败页标题重复，重试是整页刷新 | `/score/5` 的标题和副标题都是“Ripples #5”；`window.location.reload()` | Step 5 |
| D17 | 中英文泄漏 | `ScoreLifecycle` 写死 'Pending edition'，`ScoreRouteLoading` 写死 'Permanent record'；`EditionStamp` 的中文不在词典里 | Step 5 |
| D19 | 分享按钮样式和位置都不合群 | 金色描边胶囊，和全站其他按钮（登录是白色圆角）对不上；点开是直角黑色方框；手机上悬在标题旁边，压在身份块上方（截图 `ready-mobile-fold`、`ready-desktop-share`）；“下载海报”只在 OP 旧路由出现，多链作品页没有，菜单项数不稳定 | Step 2：移出顶栏，重做样式和位置 |
| D18 | 分享来的访客没有下一步 | 首屏没有“去弹一段”的入口；未登录访客点“返回档案”没有意义 | Step 6（可选） |

---

## 3. 已核对的事实（2026-11-13）

| # | 事实 | 位置 | 约束 |
|---|---|---|---|
| F1 | 字体变量类（`--font-cormorant` 等 5 个）挂在 `<body>` 上，而 `p11-tokens.css` 在 `:root`（即 `<html>`）定义 `--p11-font-display: var(--font-cormorant), …` 等三个令牌。`<html>` 上取不到 body 的变量，令牌在计算时失效。结果：用了这些令牌的 `font:` 简写整条被丢弃，字号、粗细、行高都回到继承值；`font-family:` 回落到 body 的 Azeret Mono。从 P11（`20c31c5`，2026-09-05）起一直如此 | `app/layout.tsx:72`、`src/styles/p11-tokens.css:27-29` | 修法：把变量类移到 `<html>`，改一行 |
| F2 | Tailwind 的字体工具类不受影响（`globals.css` 用 `@theme inline`，在使用处展开） | `app/globals.css:35-45` | 修复的影响面只在 `--p11-font-*` |
| F3 | 受影响面：42 个文件用到 `--p11-font-*` 或 `data-p11-theme`，其中 `font:` 简写有 81 处。覆盖 `/score`、`/me`、`/artist`、`/echo`、`/tracks`、404、错误页、铸造订单页、登录弹窗、底部播放器、全站顶栏（`header.css`、`navigation.css`）、**首页创作手记**（`PondNotes.tsx:73` 现在落到回退值 `serif`） | grep `p11-font` | Step 1 需要全站前后对比；首页手记和顶栏都是你目验过的 |
| F4 | 中文标题的回退字体是 `"Songti SC", STSong, serif`。Windows 默认没有前两个，会落到系统宋体（SimSun） | `p11-tokens.css:27` | Step 1 必须看中文大标题的效果 |
| F5 | 目录已满：`app/(pond)/score/[id]/` 8 个文件，`components/` 8 个，`experience/` 7 个 | — | 新组件放进新子目录 |
| F6 | 共用组件：`RecordAnchor`、`ScorePondHeader` 也被 `/score-lab/1` 用；`ProvenanceLedger` 也被 `/echo`（`EchoProvenance`）和 `/score-lab/1` 用；`EditionStamp` 也被 `/me` 列表行、404、错误页用；`PlaybackSeekBar` 也被底部播放器、Echo、素材播放器用；`record.state.*` 词典 `/score-lab/1` 也在用 | grep import | 只加可选参数（默认行为不变），或用 `/score` 作用域样式；词典只增不改 |
| F7 | 日食球的位置跟着唱片走：`pinToRecord` / `recordCenter` 读 `.score-pond-page__anchor .record-anchor__visual` 的实际位置；但半径写死为 `node.radius = 70` | `use-score-pond-sim.ts:19-39, 96` | 唱片挪位置没问题；**放大唱片必须同步改半径**。注意 `node.radius` 不等于日食的屏幕半径：`useEclipseTransition.ts:64` 实际算的是 `node.radius × 投影倍率 × (1 + 悬停×0.09) ÷ 50`，所以要先量中性层的投影倍率再换算（见 Step 3） |
| F8 | `/me` → `/score` 有唱片飞入过渡：`.score-pond-page__anchor` 带 `viewTransitionName` | `ScorePondScene.tsx:182-184` | 首屏改版后要重新验进入和返回两个过渡 |
| F9 | 加载骨架 `ScoreRouteLoading` 和正式页共用同一个首屏结构 | `ScoreRouteLoading.tsx` | 首屏改版必须同步改骨架，否则加载完成时画面会跳 |
| F10 | 页面在持久外壳里（`app/(pond)/layout.tsx`），外壳顶栏（返回水塘、艺术家、详情、语言、登录）全站共用 | `PersistentPondShell` | 外壳顶栏不改，`/score` 整条删掉自带的第二层顶栏 |
| F11 | 本地 `.env.local` 是生产 Supabase + OP Sepolia。`/score/1` 能看到定稿态；`/score/5` 本地是降级态（本地缺主网快照）；多链地址页 `/score/{chain}/{contract}/{id}` 本地停在加载；资产包面板本地不出现 | — | 资产包和多链页本地验不了，推送上线后由你在生产站验 |
| F12 | 本地 dev 必须带代理启动：`HTTPS_PROXY=http://127.0.0.1:7897 HTTP_PROXY=http://127.0.0.1:7897 NO_PROXY=localhost,127.0.0.1 NODE_USE_ENV_PROXY=1 npm run dev`。不带代理时 Supabase 读取失败，所有作品页都显示“已验证播放快照暂时不可用” | — | 截图前先确认 `/score/1` 的 `data-score-state` 是 ready |
| F13 | 无头 Edge（swiftshader）能渲染水面，但点播放后一直停在“正在准备”，拍不到播放中的画面 | — | 播放态只能由你在真浏览器里目验 |
| F14 | 分享文案已经用“音符”：OG 描述是“{n} 个音符构成的即兴演奏”，页面却叫“永久事件” | `page.tsx:22` | 见 Q3 |
| F15 | 还有一批脚本和样式依赖将被删改的旧结构：`scripts/p11/pond-continuity.mjs`、`score-entry-position.mjs`、`score-route-handoff/{flows,interactions,stress}.mjs`（如 `flows.mjs:88` 点击 `.score-pond-header__back`）、`scripts/p15-i/measure-score.mjs:68`（点击 `.record-anchor__action` 胶囊按钮）、`src/components/pond-shell/navigation/header.css:10` 的 `.score-pond-header` 规则。它们不在 `verify.sh` 里，但改版后会失效 | grep 旧选择器 | Step 2、3 的范围要包含它们；改成新结构的选择器，找不到对应元素的写进“待人工验证” |
| F16 | 双指缩放不只是 `pointer-fx.ts` 的事：`SphereHit.tsx` 用独立的指针捕获，第一指按在球上会拖球，抬指时（`onUp`，`SphereHit.tsx:75`）若没移动就触发播放；`EchoResidentHit.tsx` 也在 `onPointerUp` 激活，`Track36HitTarget.tsx` 在 `onClick`。浏览器缩放被拦住不会自动取消这些处理 | 三个命中层文件 | Step 7 必须把命中层纳入范围 |

---

## 4. 决策（推荐值；开工后默认全部采用，次日验收时可推翻，每项对应单独 commit）

| # | 问题 | 选项 | 推荐（开工后默认采用） |
|---|---|---|---|
| Q1 | 字体修复范围 | A 全站按 P11 原设计修（衬线标题 + 无衬线正文）／B 全站只恢复字号，字体保持现在的等宽 Azeret／C 只修 `/score` | **A**。根因只有一处，只修 `/score` 会和其他页面不一致。Step 1 先出 A、B 对比图，你看图再拍板 |
| Q2 | 完整凭证默认收起还是展开 | 收起／展开 | **收起**，只露 4 项摘要 |
| Q3 | 统一叫“音符”还是“事件” | 音符／事件 | **音符**，与分享卡一致 |
| Q4 | 桌面首屏构图 | 居中一列（身份块在唱片正上方）／左文右唱片 | **居中一列**，手机和桌面结构一致，日食也居中 |
| Q5 | 加不加访客入口“用同一首底曲弹你自己的一段 →” | 加／不加 | **加**（Step 6）。落点在 Step 6 开工前核对 |

目标版式（桌面；手机为同一结构纵向堆叠）：

```
← 返回水塘                            艺术家  详情  CN/EN  登录    ← 外壳顶栏，全页唯一的顶栏，不改

                  ← 返回档案                                   ← 小链接，只在从 /me 点进来时出现
                     ○ 已定稿 · OP Mainnet
                         Ripples #1                            ← 衬线大标题（D1 修好后）
               底曲《33》· 35 个音符 · 2026/9/21

                       （ 唱片 约 300px ）

                ▶   0:00  ━━━━━━━○──────  1:23
                        点唱片开始播放
                      分享     下载海报                         ← 两个文字按钮；点“分享”就地展开复制链接 / X / 微博
              用同一首底曲弹你自己的一段 →                     ← Q5，可选
────────────────────────────────────────────────────────────
 作品信息   创作者 0x…  ⧉ ↗ ｜ 持有者 0x…  ⧉ ↗ ｜ 铸造 2026/9/21 ｜ OP Mainnet · #1
 资产包     持有人：开通；已开通：查看
 作品凭证   一句人话说明                 [ 查看完整凭证（12 项）▾ ]
```

---

## 5. 步骤

> 每一步独立可验、单独 commit。**夜间执行时不在步骤间停下**（规则见 `00-overview.md` §3）；平时单独开工则每步做完停下等回复。\
> 每步自检：`tsc` + 改动文件的 ESLint + 用 Step 0 的脚本做前后截图对比。`verify.sh` 只在推送前跑一次（按你的“审查保持轻量”要求；dev 开着时不跑 build）。\
> 新增或修改的文案都按 i18n-pond skill 进中英词典。

### Step 0 — 截图工具与基线证据

- 📦 范围：新建 `scripts/ui/score-page/`（截图脚本，只用现有依赖和 `scripts/p15/browser/runtime-cdp.mjs`）；新建 `reviews/evidence/p23-score/baseline/`；本文件（勘误）。
- 脚本功能：桌面 1440 和手机 390 两种尺寸、中英两种语言；整页分屏截图；打开分享菜单截一张；导出关键元素的位置和计算出的字号、字体（JSON）。
- 页面清单：`/score/1`、`/score/5`、`/me`（未登录）、`/artist`、`/echo`（本地能打开的话）、`/tracks`、一个 404、`/`（只看顶栏和手记）。
- ✅ 验收：基线截图齐全；JSON 里有每页 h1 的计算字号和字体。

### Step 1 — 修字体根因 → 次日验收：看前后对比图（Q1 默认按推荐 A）

- 改动：`app/layout.tsx` 把 5 个字体变量类从 `<body>` 移到 `<html>`，`<body>` 保留 `antialiased`。
- 同时出 B 方案对比图：临时把 `--p11-font-*` 指向 Azeret，只截图，不提交。
- 中文大标题：如果系统宋体效果不好，提议把标题的中文回退改成正文无衬线（`"PingFang SC", "Microsoft YaHei"`），只改 `p11-tokens.css` 一行，由你定。
- 逐页查大字号会不会撑破版面：横向滚动、标题换行、`/me` 档案行标题、凭证卡头（2rem）、登录弹窗、首页手记。只在这些页面自己的 CSS 里做小修；需要改布局结构的列为遗留，本步不做。
- 📦 范围：`app/layout.tsx`；`src/styles/p11-tokens.css`（仅中文回退一行，且需你选择）；受影响页面自身 CSS 的溢出小修。
- ✅ 验收：`/score` 的 h1 计算字号在 1440 宽为 92px、390 宽为 40px，字体为 Cormorant；所有基线页面在 390 宽下没有横向滚动；你看过 A、B 对比并做了选择。
- 回滚：单个 commit，直接 revert。

### Step 2 — 首屏结构：只留一层顶栏，身份块重排，分享重做

- **整条删掉 `/score` 自带的第二层顶栏**（D2）：“回到水塘”、中间的“网络 · Token”行、右侧分享，一起移除。全页只剩外壳顶栏。
- “← 返回档案”降为身份块上方的小链接，**只在从 `/me` 点进来时出现**（读 score origin）；从分享链接、地址栏进来的访客看不到它（去 `/me` 本来就有登录入口）。
- **分享重做**（D19）：不再放顶栏。放在唱片和播放控件下方，两个并排的文字按钮：
  - “分享”：点击就地展开一行（复制链接 / 分享到 X / 分享到微博），不再弹直角黑框；样式用全站统一的按钮样式和圆角；点外面或再点一次收起；
  - “下载海报”：作品有海报路由时显示，没有就不显示（不再出现菜单项数不稳定）。
  - 复制反馈、分享文案、作者与旁听者区分的逻辑沿用 `ShareActions` 现有实现，只换外观和位置；热区不小于 44px。
- 外壳顶栏缺席时的兜底：现在 `ScorePondHeader` 里带着 `<PageNavigation />`，持久外壳里它不渲染（外壳自带顶栏）。去掉 `ScorePondHeader` 后，新的 hero 组件仍渲染 `<PageNavigation />`，保证无外壳时（如独立加载骨架）页面依然有顶栏。
- 身份块三行：
  - 印章写状态和链：“○ 已定稿 · OP Mainnet”。
  - 标题：“Ripples #1”。
  - 副标题：“底曲《33》· 35 个音符 · 2026/9/21”（术语按 Q3）。
  - 编号在首屏只出现一次。
- 构图按 Q4：身份块 → 唱片 → 控件，居中一列。
- 手机顶栏遮挡：在 `/score` 作用域加一层固定的顶部渐隐底（墨色到透明，高约 96px，位于外壳顶栏下层），不改外壳顶栏本身。
- `ScoreLifecycle`（制作中、失败）和 `ScoreRouteLoading` 同步改成同一结构（F9）：同样没有第二层顶栏，分享按钮也一样挪下来（制作中、失败页面仍有分享链接，沿用）。
- `ScorePondHeader` 被 `/score-lab/1` 共用，所以不改它；`/score` 改用新的身份块和分享组件，放进新子目录 `components/hero/`（F5）。`ShareActions.tsx` 本身在 `components/` 里已有，改它的外观和结构。
- 依赖旧顶栏结构的脚本和样式一并更新（F15）：`pond-continuity.mjs`、`score-entry-position.mjs`、`score-route-handoff/` 三个文件里点 `.score-pond-header__back` 的地方，改成新的“返回档案”小链接选择器；`header.css:10` 里已失效的 `.score-pond-header` 规则删除。
- 📦 范围：`ScorePondScene.tsx`、`ScoreLifecycle.tsx`、`ScoreRouteLoading.tsx`、`ShareActions.tsx`、`score-pond-page.css`（分享相关旧样式一并删除）、新建 `components/hero/`、词典 `score.*` 与 `share.*`（只增 key）、上面列出的旧脚本和 `header.css`。
- ✅ 验收：
  - 390 和 1440 两种宽度下，**只有外壳那一层顶栏**，页面里不再有自己的顶栏（脚本断言 `.score-pond-header` 不存在）；首屏元素互不重叠（脚本断言元素位置两两不相交）。
  - 分享：点开不再出现黑色直角方框；展开后三项都能点（复制链接写入完整地址、X 和微博跳转正确）；有无海报两种作品的按钮数量正确。
  - 首屏编号只出现一次（外壳顶栏不计）。
  - 中英切换没有泄漏。
  - `/me` → `/score` 的飞入和返回过渡正常（你目验，F8）。
  - `/score-lab/1` 截图不变。

### Step 3 — 播放区 → 次日验收：目验首屏（Step 2 + 3 一起看）

- 唱片放大：从 `clamp(200px, 34vmin, 320px)` 起步，目验后定。
- **日食半径同步（F7）**：不能把 `bounds.width / 2` 直接写进 `node.radius`。做法：①先量中性层（`depthOf` 默认深度）下 `project()` 的屏幕倍率 `pose.scale`（桌面透视开、透视关、手机各量一次）；②`node.radius = 唱片屏幕半径 ÷ pose.scale`（倍率≈1 时就是 `bounds.width / 2`）；③除初始化外，窗口尺寸变化、转屏、播放结束归位（`use-score-pond-sim.ts` 里已有的 resize 和归位回调）都重新计算。
- 依赖旧胶囊按钮的脚本更新：`scripts/p15-i/measure-score.mjs:68` 点击的 `.record-anchor__action` 改为点唱片本身（F15）。
- 只留一个主控件：唱片本身就是按钮。下方改成一行播放条 `[▶/❚❚] 0:42 ━━━○─── 1:23`，去掉胶囊大按钮和黑底说明框。
- 状态文字缩成一行短句，不用工程用语：

  | 状态 | 现在 | 改为 |
  |---|---|---|
  | 空闲 | 点击唱片，开始播放 ／ 永久音频只会在你主动点击后建立播放会话。 | 点唱片开始播放 |
  | 准备中（未点） | 正在准备永久录音… ／ 正在优先准备底曲与开场音效，现在点击即可排队播放。 | 正在准备，可以先点 |
  | 准备中（已点） | 正在准备永久录音… ／ 已记录播放请求，资源验证完成后会自动开始。 | 准备好就开始 · 取消 |
  | 播放中 | 正在播放 ／ 永久录音、日食与按键编舞保持同一时钟。 | 不显示文字，只留播放条 |
  | 暂停 | 播放已暂停 ／ 已暂停在 0:42 | 已暂停（时间显示在播放条上） |
  | 结束 | 播放已结束 ／ 已完整播放 1:23 | 播完了 · 再听一遍 |
  | 出错 | 播放暂不可用 ／ …；身份与凭证仍可核验。 | 暂时播放不了 · 重试 |

- 进度条：可见轨道 2px，点击和拖动热区至少 24px 高（手机 44px）；左右两端显示当前时间和总时长。`PlaybackSeekBar` 是共用组件，只用 `/score` 作用域的 className 改样式；时间标签在 `ScoreRecordAnchor` 里渲染。
- `RecordAnchor` 是共用组件：只加可选参数（如精简模式：不渲染说明框和胶囊按钮），默认行为不变。
- 📦 范围：`ScoreRecordAnchor.tsx`、`RecordAnchor.tsx`（只加可选参数）、`use-score-pond-sim.ts`（半径换算、resize、归位）、状态文案纯函数与其单测（放 `components/hero/`）、`scripts/p15-i/measure-score.mjs`、`score-pond-page.css`、`experience/score-visual-transition.css`（仅当唱片尺寸影响过渡时）、词典 `score.playback.*`（新增 key，不改 `record.*`）。
- ✅ 验收：
  - 首屏只有一个主控件。
  - 播放条显示时间，手机上可以拖动。
  - 空闲、准备、排队、暂停、结束、出错 6 种状态各只有一行文字。**怎么验**：把“状态 → 文案”抽成一个纯函数并写单测，6 种状态全覆盖（这是代码层验收）；截图脚本只能到达空闲和准备中（F13，无头浏览器点播放后停在准备中），暂停、结束、出错、播放中**不记为通过**，写进夜间报告“待人工验证”。
  - 日食与唱片的中心和半径吻合：脚本读日食焦点状态（`setPlaybackFocus` 的 x、y、scale）与唱片元素矩形，换算后中心偏差、半径偏差 ≤4px；覆盖桌面透视开、透视关、手机、转屏。无头浏览器播放不了时这项只能验静态位置，播放中的吻合由你目验。

### Step 4 — 凭证区：摘要 + 收起的完整凭证 → 次日验收：目验

- 新增“作品信息”摘要卡，紧接在首屏之后，四项：创作者、当前持有者、铸造时间、所在链（合约 · 编号）。地址短显，后面跟复制和区块浏览器两个图标按钮（热区各至少 44px）。
- 完整凭证用 `<details>` 包住，默认收起（Q2），标题为“查看完整凭证（12 项）”。展开后分三组：
  - 身份：合约、Token ID、创作者、持有者。
  - 链上交易：铸造交易、定稿交易、Token URI。
  - 永久文件：Metadata、事件、底曲、音效表、播放器。“在新标签打开永久播放器”移到这一组。
- 缺失值：来源本来就没有提供的，改成弱色“未记录”；只有真正读取失败（如持有者读不到）才保留警示色。
- 标题只留一个：“作品凭证”，加一句人话说明（例如：“这枚作品的内容都存在链上和 Arweave 上，任何人都能独立核对。”）。
- 去掉 eyebrow、卡片内“永久凭证 12 项记录”卡头、底部重复的印章；日期并入摘要卡。
- 每行的“来源：xx”改成小号标签；复制和外链改成图标按钮，手机上与值同一行、右对齐。
- `ProvenanceLedger` 是共用组件：只加可选参数（隐藏卡头、分组、图标按钮变体），默认行为不变。摘要卡放进新子目录 `components/archive/`。
- 📦 范围：`ScoreArchive.tsx`、`score-archive.css`、`ProvenanceLedger.tsx`（只加可选参数）、`p11-primitives.css`（只新增变体选择器）、新建 `components/archive/`、词典 `score.archive.*`、`ledger.*`（只增不改）。
- ✅ 验收：
  - 手机整页高度从 3253px 降到约 1900px 以内（收起状态）。
  - 定稿作品不出现警示色。
  - `/echo` 和 `/score-lab/1` 的凭证截图不变。
  - 复制写入的仍是完整值：加单测；你手动点一次确认。

### Step 5 — 资产包上移，补齐状态页

- `ScorePackPanel` 移到摘要卡之后、完整凭证之前。外观改成和摘要卡一致的卡片样式，只改 `/score` 作用域 CSS，`/pack` 页不变。
- 制作中自动更新：
  - 每 10 秒 `router.refresh()` 重取服务端数据，状态变成 ready 或 failed 时自动切换画面。
  - 标签页隐藏或离开页面时停止。
  - 显示队列步骤进度：pending 到 finalizing 共 7 步，高亮当前步。
  - “刷新制作状态”按钮保留，作为手动兜底。
- 失败和降级：副标题与标题相同时不显示副标题；“重试”改为 `router.refresh()`，不整页刷新、不重建场景。
- 语言泄漏：'Pending edition'、'Permanent record' 进词典。`EditionStamp` 的中文进词典；它被 404、错误页、`/me` 共用，只改取词方式，显示不变。
- 📦 范围：`ScorePondScene.tsx`（区块顺序）、`ScoreLifecycle.tsx`、`ScoreRouteLoading.tsx`、`EditionStamp.tsx`、`/score` 作用域 CSS、`src/hooks/score/` 下新建轮询 hook、词典。
- ✅ 验收：
  - 持有人在首屏往下一屏之内就能看到资产包。
  - 制作中的轮询有 fake timer 单测；真实效果在你下次铸造时观察。
  - 英文模式没有中文残留；中文模式只有设计内的英文（链名、Token ID 等）。
  - 资产包实物在本地看不到（F11），上线后在生产站验。

### Step 6 — 访客入口（Q5 选“加”才做）

- 在播放条下方加一个次级链接“用同一首底曲弹你自己的一段 →”，指向该底曲在首页的球。
- 开工前先核对落点：`/lens?track=N` 只选中不播放；还要确认有没有能直接进入创作的路径。
- 📦 范围：`components/hero/`、词典。
- ✅ 验收：未登录访客点一次就能到达这首底曲。

### Step 7 — 手机双指缩放 = 滚轮换层（追加需求）

- 现状：首页（含 `/lens`，同一场景）的滚轮由 `src/components/pond-gl-test3/pointer-fx.ts` 的 `usePointerFx` 接管，滚轮改变“集体深度偏移”，音乐圆圈整体升出水面或沉入水下。触屏没有对应手势，双指缩放落到浏览器默认行为，放大整个网页。
- 改法：在同一个 hook 里、与滚轮同一开关（`captureWheel` 且一点透视开）下，加双指手势：
  - 两指张开 = 滚轮上滚：圆圈升起、靠近、变大；两指捏合 = 滚轮下滚：圆圈下沉。
  - 位移按两指距离的对数比例换算，单次封顶沿用滚轮的 `scrollStep`，缓动沿用滚轮的弹簧（手感一致）。
  - 只在双指时 `preventDefault`（拦掉浏览器缩放；iOS 另拦 `gesturestart` / `gesturechange`）；单指拖球、点球不受影响。
  - 手势起点在界面元素（`[data-pond-ui]`，如顶栏、面板）上时不接管。
- **命中层必须配合（F16）**：只拦浏览器缩放不够，第一指按在球上时，球会被拖动、抬指还会触发播放。做法：
  - `pointer-fx.ts` 导出一个只读标志 `isPinching()`：任一时刻屏幕上出现两个触点时置位，**所有手指都离开后**才清除（`pointerup` 先于 `touchend`，所以最后一指抬起时标志仍有效）。
  - `SphereHit.tsx`、`EchoResidentHit.tsx`、`Track36HitTarget.tsx` 三个命中层：标志置位的瞬间取消当前拖动（`SphereHit` 走已有的 `finishDrag`）；标志有效期间 `onMove` 不拖球、`onUp` / `onClick` 不触发播放，也不触发 `/lens` 的 `activate`。
  - 单指行为（拖球、点球播放、`/lens` 轻点选中）在标志清除后完全照旧。
- 范围：只在首页和 `/lens`。`/score` 本来就把滚轮交还给页面滚动（只有一个球），双指缩放保持浏览器默认。
- 📦 范围：`pointer-fx.ts`（目录已满 8 个文件，不新建文件；换算函数与 `isPinching` 导出并单测）、上面三个命中层文件；单测放 `scripts/ui/pond-pinch/`。
- ✅ 验收：
  - 单测覆盖张开、捏合、封顶、零距离，以及 `isPinching` 的置位与清除（第二指加入、一指先抬、全部抬起、取消）。
  - 无头浏览器用 `Input.dispatchTouchEvent` 模拟：①两指张开 / 捏合 → 球整体升降（读 `getShift()`）、页面缩放比例不变；②第一指落在球上再加第二指、再抬指 → 没有播放、球位置没被拖动；③两指分别落在两个球上抬起 → 都没有播放；④单指点球、拖球照旧。
  - 手感和真实手机上的表现由你次日验（无头浏览器测不了惯性与手感）。

### Step 8 — 门禁与收尾 → **最终验收**

- 在 Step 0 脚本上加断言，作为门禁 `scripts/ui/score-page/gate.mjs`：
  - h1 字号；
  - 首屏元素不重叠；
  - 没有横向滚动；
  - 凭证默认收起；
  - 中英没有泄漏。
- 全量截图存 `reviews/evidence/p23-score/after/`，与 baseline 并排对比。
- 跑一次 `verify.sh`；更新 STATUS、TASKS、`docs/JOURNAL.md`；在本文件 §9 写执行记录。
- 变基到最新 `main`，`verify.sh` 通过后推送 `main`；次日由你统一验收。

---

## 6. 风险与取舍

- **字体修复会改变全站观感**：P11 以来你目验过的页面（包括首页顶栏和创作手记）都会变。所以 Step 1 单独设 Gate，单个 commit，可以直接回滚。
- **唱片放大牵动日食和过渡**：会影响日食半径（F7）和 `/me` 飞入过渡（F8），Step 2、3 必须目验。
- **共用组件只加可选参数**：`/echo`、`/score-lab/1`、`/me`、404 每步都截图对比，Step 1 除外。
- **收起凭证可能削弱“可核验”的感觉**：所以摘要卡保留核心四项，并给出明确的“查看完整凭证”入口。
- **本地验不到的部分**：资产包和多链页（F11）、播放态（F13），分别需要预览部署和你的目验。

## 7. 不在本轮

- OG 图（`opengraph-image.tsx`）、海报（`poster/route.tsx`）。
- `generateMetadata` 里写死的中文标题。
- 日食版 Score 封面重设计（P22 遗留，另开计划）。
- TASKS 里“未铸造成功的 `/score` 也能播放”的未决问题（意图未澄清）。

## 8. 每步检查清单

- [ ] 改动都在 📦 范围内
- [ ] 单个文件不超过 220 行，单层目录不超过 8 个文件
- [ ] 共用组件默认行为不变（`/echo`、`/score-lab/1`、`/me`、404 截图无差异；Step 1 除外）
- [ ] 新文案中英齐全
- [ ] `tsc` 和定向 ESLint 通过
- [ ] 前后截图已存

## 9. 执行记录

（开工后填写）

### 2026-11-14 夜间执行

A0–A8代码闭环已落地；32组截图和40项布局门禁通过，字体92/40px、手机正文1505/1529px。播放文案7态、制作轮询、完整复制与双指生命周期单测通过；双指浏览器5项及既有lens触摸播放门禁通过。字体A/B对比与全套before/after保存在`reviews/evidence/p23-score/`。因同文件调用关系，A2/A5/A6部分按文件小闭环合并提交，其余独立。最终整合verify交主代理在P25合入后执行；真实钱包、Score播放态日食与手机手感仍留人工验收。实际提交、取舍与完整证据见`05-night-report.md`。
