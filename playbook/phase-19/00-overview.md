# Phase 19 — 中英双语（中文默认，右上角 CN/EN 切换）

> 制定日期：2026-10-13（同日按代码审核结果修订）。状态：执行计划，尚未开发。\
> 基线：开工时从 `main` 最新提交新开分支 `feat/p19-i18n`，**不在** `feat/p19-seamless-loading` 上做（那是 P15-J 的旧分支，原 P19 已并入 P15）。\
> 本计划**不改合约、不改数据库、不改任何链上/Arweave 永久内容**。唯一新增依赖是 `next-intl`，用户已于 2026-10-13 批准，登记 `docs/STACK.md` 在 Step 1 做。\
> 配套项目 skill：`.claude/skills/i18n-pond/SKILL.md`（单文件迁移的操作规范）。其中“默认英文”“依赖未获批”两处与本计划不符，以本计划为准，Step 1 时修正。

---

## 1. 已定的决策

| 决策 | 结论 | 理由 |
|---|---|---|
| 源语言 / 默认语言 | **中文默认，英文为译文** | 默认用户所见与线上一致，可逐文件迁移；中文词典直接取现有原文 |
| 切换入口 | 右上角 **CN / EN**，点击即切 | 用户要求 |
| 渲染方案 | **方案 C**：服务端始终输出静态中文页，浏览器按 cookie 切英文 | 服务端读 cookie 会让现有静态页全变动态，拖慢首帧（见 §3 F1） |
| 库 | `next-intl` | 复数、日期时区、key 类型检查现成；将来可原地升级为服务端读 cookie |
| 不做 URL 前缀 | 无 `/en`、`/zh`，**不新增 middleware**，现有限流 `middleware.ts` 不动 | 官方“无路由”模式 |
| cookie | 名 `locale`，值 `zh` / `en`，`path=/`，一年，`SameSite=Lax` | 不用 localStorage，给以后升级服务端读取留路 |

### 1.1 切换机制的硬规则

1. **浏览器第一次渲染必须是中文**，与服务端 HTML 一致；水合完成后再按 cookie 换成英文。实现用 `useSyncExternalStore` 提供服务端快照 `zh`（本项目已有同类先例，见 `docs/JOURNAL.md` Portal 挂载一节）。否则全站 hydration 报错，React 可能在客户端重建整块页面。
2. **切换语言不刷新页面、不调用 `router.refresh()`、不重挂载任何组件**：只换 provider 里的词典，正在播放的音乐与水面不得中断。
3. 英文词典按需加载（选了英文才下载），中文词典随页面下发。
4. 缺 key 时**回退中文**，不得显示 key 路径（next-intl 默认会显示 `ns.key`，必须改配置）。

### 1.2 代价与限制（需在 Step 0 实测后由用户再确认，见 D0）

- **英文用户刷新时会先看到中文**，持续到 React 水合完成。时长**未知**：P15-J 实测 Fast 4G 首次绘制约 2.7s，最大两个 JS 文件约 22s 才下完，水合是否要等它们没测过。不能预设为“一瞬”。
- 静态 HTML、搜索收录、分享预览均为中文；分享卡语言另定（D5）。
- **第三方界面不随切换**：Privy 邮箱登录弹窗、WalletConnect、钱包插件、Privy 邮件验证码模板（在 Privy 后台）。
- 服务端组件里的文字在英文模式下仍是中文，除非改造（见 §3 F3）。

---

## 2. 用户可验收的结果

1. 默认打开任何页面，与现在完全一致；build 清单中原有静态路由一个不少。
2. 右上角 CN / EN 在所有生产页面头部都可见（§3 F4 的 4 处），点击后当前页立即切换；刷新、换页、重开浏览器后保持。
3. **切换时音乐不断、水面不重置、页面不刷新。**
4. 英文模式下，§5 Step 4 列出的全部页面**没有残留中文界面文案**（艺术家手记、曲目名按 D2 处理）。
5. 英文模式下，界面不直接显示服务器返回的中文报错。
6. 英文模式下固定尺寸区域（首页圆形节点、登录弹窗、PIN、铸造按钮、移动端导航、CN/EN 按钮本身）桌面与手机均不溢出、不截断。
7. `<html lang>`、日期、数字格式随语言变化；标签页标题按 D6 处理。
8. 链上与 Arweave 永久内容、合约、数据库未被改动。

---

## 3. 已核对的事实（2026-10-13，代码实查）

| # | 事实 | 位置 / 证据 | 对实施的约束 |
|---|---|---|---|
| F1 | `/`、`/artist`、`/me`、`/me/material`、`/tracks`、`/tracks/pond`、`/score` 为静态预渲染 | `.next/prerender-manifest.json`（当日 build） | 根布局不得读 cookie |
| F2 | 含中文的界面文件中，绝大多数是 `'use client'` 或被客户端组件引入（如 `ScoreArchive` 由 `ScoreLifecycle` / `ScorePondScene` 引入） | 引用链逐个核对 | 这些可直接用客户端翻译 |
| F3 | **真正在服务端渲染的含中文界面**：`/echo/[id]`、`/echo/origin/[address]`（`EchoPage` → `EchoProvenance`）、`/artist`、`/tracks/archive`、`TokenOneArchive` → `ArchiveRow`、各 `loading.tsx`、`app/not-found.tsx`、所有页面 `metadata` | 同上 | 需改成客户端组件或拆出客户端文字片段；Echo 页是对外分享页，工作量不可忽略 |
| F4 | **右上角头部有 4 处，各自独立**：`src/components/pond-gl-test3/overlay/PondHeader.tsx`（首页及水塘路由）、`src/components/p11/ScorePondHeader.tsx`（`/score`）、`src/components/echo/EchoPage.tsx` 内的 header、`src/components/music-catalog/TrackCatalog.tsx`（`/tracks/archive`，自带登录按钮） | Grep | `PondNavigation.tsx` 的默认导出**全站无引用**，不是挂载点 |
| F5 | 服务器报错原文直接显示：`SemiLogin.tsx:76`、`:111`（`throw new Error(data.error \|\| …)`）、`useEthereumScoreMint.ts:36`、`MeArchivePage.tsx:147`（拼接 `useOwnedEchoes`、`useScoreNftPolling` 的 `error.message`） | Grep | 英文模式下展示层须改用前端文案，登录是主路径 |
| F6 | 写死语言：`lang="zh-CN"` 6 处；`toLocaleDateString('zh-CN')` 等 3 处；`Intl.NumberFormat('en-US')` 1 处（`self-mint-copy.ts`） | Grep | Step 5 处理 |
| F7 | CSS `letter-spacing` 44 处、Tailwind 宽字距（`tracking-[..em]`、`tracking-widest`）27 处、`text-transform` 8 处；无 CSS 伪元素中文、无竖排 | Grep | 宽字距为中文所调，英文需 `:lang(en)` 单独调 |
| F8 | 测试含中文断言：`share-copy.test.ts`、`visual-transition.test.ts`、`scripts/ui/` 下多份；冒烟脚本按中文按钮文字定位：`scripts/p14/browser-track36-smoke.mjs`（“收藏”“暂停”“继续”“停止”）、`scripts/ui/tracks-circle/integration-gate.mjs`（“登录”） | Grep | 中文默认下应仍通过；改常量为 key 时单测会挂，每批须跑；这些脚本只覆盖中文 |
| F9 | 艺术家手记：`src/lib/music-catalog/data/artist-notes.json`，35 首曲目的诗性文字；同内容另见 `public/music-catalog/catalog.v1.json`（由 `scripts/p17/catalog/` 生成并校验，含部署核验记录） | 读文件 | 不宜机翻（D2）；`catalog.v1.json` 能否改须先确认（N6） |
| F10 | 目录 hook 只数文件、不数子目录，`.json` 计入 | `.claude/hooks/check-folder-size.js` | 词典每个目录 ≤8 个文件 |
| F11 | `next-intl@4.14.9` 的 peer 依赖声明支持 Next 16、React 19 | `npm view` | 仅纸面兼容，运行时须 Step 0 验证 |
| F12 | 前端没有用户签名的文字（签名只在服务端 `signTypedData`）；`Providers.tsx` 无 Privy 文案配置 | Grep | 无“翻译签名文本导致验签失败”风险 |
| F13 | 生产路由（不含 API）：`/`、`/artist`、`/echo/[id]`、`/echo/origin/[address]`、`/me`、`/me/material`、`/me/material/[orderId]`、`/me/mint/[orderId]`、`/score/[id]`、`/score/[id]/[contract]/[tokenId]`、`/score/[id]/poster`、`/score/material/[chainId]/[contract]/[tokenId]`、`/tracks`、`/tracks/pond`、`/tracks/archive`；`/score` 仅跳转 `/tracks` | `find app -name page.tsx` | Step 4 的覆盖清单以此为准 |

---

## 4. 待核对点（开工前或对应步骤前查，不得凭猜测改）

- **N1（决定成败）**：§1.1 的机制在 `next-intl` 下能否成立——服务端固定 `zh` 且页面保持静态；客户端 provider 首次渲染 `zh`、水合后换 `en`；切换不重挂载、不报 hydration 错误；缺 key 回退中文的配置方式。Step 0 验证。
- **N2（决定代价）**：英文用户看到中文的实际时长。桌面 / 手机 × 不限速 / Fast 4G 四档，记录“首次绘制 → 切换为英文”的毫秒数。Step 0 测量。
- **N3**：`<html lang>` 首帧前用内联脚本按 cookie 修正，是否与 `suppressHydrationWarning` 及 P15-J 的首帧底色内联冲突。Step 0 验证。
- **N4**：日期时区。客户端组件用浏览器本地时区；服务端静态页里的日期须避免 hydration 不一致。Step 5 前查。
- **N5**：分享海报、OG 图生成入口（`/score/[id]/poster`、两个 `opengraph-image.tsx`）。爬虫不带 cookie，只能出固定语言。Satori 注意：含多个子节点的 `div` 必须显式 `display:flex`，“变量+文字”混排合成模板字符串。Step 7 前查。
- **N6**：`public/music-catalog/catalog.v1.json` 是否属于发行/永久清单。是则不改，英文手记另存。涉及曲目页的批次前查。
- **N7**：Privy 是否支持界面语言配置。支持则跟随切换，不支持则记入已知限制。Step 2 前查，不得猜。

---

## 5. 用户需先定的事（对应步骤前不得开工）

| # | 问题 | 阻塞 |
|---|---|---|
| D0 | Step 0 测出英文用户看到中文的时长后：接受 / 加“切换前文字先隐藏再淡入（带超时兜底）” / 改方案 | Step 1 |
| D1 | 沙盒页是否翻译：`/test`、`/test1~4`、`/score-lab`、`/me/test`、`/v1`（默认不翻译） | Step 4 |
| D2 | 曲目名、艺术家简介（`src/content/artist.ts`）、**艺术家手记**（`artist-notes.json`）、艺术家名“叶禹含”的英文写法：由艺术家/用户提供英文，还是保持中文。**手记不做机翻** | Step 4 第 3、6 批 |
| D3 | 中英混写标签（如 `Identity record · 身份页`）在英文模式下的显示 | Step 3 |
| D4 | 术语表：`Token`、`metadata`、`ScoreNFT`、`Token URI`、`hash`、“铸造”“收藏”“唱片”“回声”“水塘”等的英文 | Step 3 |
| D5 | 分享卡 / OG 图语言：中文 / 英文 / 双语 | Step 7 |
| D6 | 英文模式下标签页标题：浏览器端改 `document.title`，还是保持中文 | Step 5 |

---

## 6. 步骤

> 每步独立可验、独立 commit，做完停下等用户确认。每批文案提交前，给用户一张“中文 / 英文”对照表审英文措辞，审过再提交。

### Step 0 — 方案验证与代价测量（不进主线）

- 📦 范围：一次性实验分支，结论写入 `docs/JOURNAL.md` 后丢弃分支；解答 N1、N2、N3。
- 做法：
  - 临时装 `next-intl`，造一个客户端组件与一个服务端组件，按 §1.1 跑通；故意删一个英文 key，确认回退中文。
  - 关掉 dev 后 `next build`，比对静态路由清单与 F1。
  - 切换时观察：控制台无 hydration 报错；播放中的音乐不断；水面不重置。
  - 按 N2 四档测“首次绘制 → 显示英文”的时长，录屏存档。
  - 结束后切回原分支并 `npm ci`，确保 `node_modules` 里不残留 `next-intl`。
- 完成标准：N1“成立 / 不成立”附证据；N2 有四档数字；N3 有结论。
- 若 N1 不成立：停止，向用户汇报并给替代方案，不进入 Step 1。
- 交用户做 D0。

### Step 1 — 地基

- 📦 范围：`package.json`、`docs/STACK.md`（登记 `next-intl`，注明用户 2026-10-13 批准）、`next.config.ts`、`src/i18n/`（配置、客户端 provider、切换函数）、`app/layout.tsx`（挂 provider、`lang` 内联修正）、词典目录、`.claude/skills/i18n-pond/SKILL.md`（修正与本计划矛盾处）、一个 key 一致性检查脚本。
- 做法：
  - 按 Step 0 验证过的写法落地，provider 放在现有 `Providers` 内部；只放一两个示例 key。
  - 一致性检查：中英 key 集合相同、`{占位符}` 一致；类型上让英文词典必须满足中文词典的结构。接入 `scripts/verify.sh` 前先问用户。
  - 若 D0 选了“先隐藏再淡入”，在此实现。
- 完成标准：`npx tsc --noEmit` 通过；build 后静态路由与 F1 一致；默认页面视觉无变化；量一次包体积增量并记录。
- 回滚点：还原上述文件并卸载依赖。

### Step 2 — 切换组件（默认隐藏）

- 📦 范围：新建一个共用的 CN/EN 组件；挂到 F4 的 4 处头部；露出开关常量。
- 做法：
  - 默认**隐藏**，由一个代码常量控制，Step 8 才打开；开发时本地改常量或手动写 cookie `locale=en` 测试。
  - 无障碍：`aria-label`、`aria-pressed`，标签文字带各自的 `lang`。
  - 涉及 `pond-gl-test3` 时先确认 `/test3` 引用面；`/test1` 不得改动。
- 完成标准：隐藏状态下线上零变化；打开常量后 4 处都能切换，刷新、换页保持，音乐不断。

### Step 3 — 试点：登录弹窗

- 📦 范围：`src/components/auth/` 的登录弹窗与 `SemiLogin.tsx`（含 F5 的报错展示）、对应词典。
- 前置：D3、D4 已定。
- 做法：严格按 skill 单文件流程；同时检验 skill，把 skill 未覆盖的情况回写进 skill。
- 完成标准：英文模式下弹窗无中文、登录失败不显示服务器中文原文；两种语言下桌面与手机不溢出。

### Step 4 — 页面迁移（按批，一批一验）

每批：迁移 → 跑相关测试（F8）→ 英文模式目验该批页面 → 交对照表审 → 提交。

1. **全局与报错展示层**：F4 的 4 处头部文字、`app/error.tsx`、`app/not-found.tsx`、各 `loading.tsx`、`LoadingState`、`RetryButton`；F5 剩余位置改为“英文模式用前端文案”。
2. **首页**：`/` 与 `src/features/home-pond/`。
3. **曲目**：`/tracks`、`/tracks/pond`、`/tracks/archive`（服务端页面，需改造）；曲目名与手记按 D2。
4. **我的**：`/me`、`/me/material`、`/me/material/[orderId]`、`/me/mint/[orderId]`。
5. **作品**：`/score/[id]`、`/score/[id]/[contract]/[tokenId]`、`/score/material/[chainId]/[contract]/[tokenId]`、分享文案（`share-copy.ts` 及其测试）。
6. **Echo 与艺术家**：`/echo/[id]`、`/echo/origin/[address]`、`/artist`（以服务端组件为主，按 F3 改造）；艺术家内容按 D2。

- 规则：模块顶层常量里的文案改存 key；模板字符串里中英混排改带插值的 key；改常量导致单测失败时同步更新测试。

### Step 5 — 日期、数字、`lang`、标签页标题

- 📦 范围：F6 列出的全部位置；按 D6 处理 `metadata` 标题。
- 做法：统一走 `next-intl` 的格式化；时区按 N4 的结论。

### Step 6 — 排版与溢出

- 📦 范围：只改样式，不改文案。
- 做法：
  - 建伪语言（每条英文加长并加重音字符），一次性暴露所有截断。
  - 用 `:lang(en)` 调整 F7 中为中文设定的宽字距。
  - 对 §2 第 6 项的区域，桌面与手机各目验一次。

### Step 7 — 分享卡、OG 图、API 错误码

- 📦 范围：分享海报与 OG 图（按 D5、N5）；`app/api` 报错改为返回错误码，前端映射。
- 因 Step 4 第 1 批已在展示层拦截服务器原文，本步可延后，不阻塞露出按钮；延后须在 STATUS 注明。

### Step 8 — 露出按钮与收尾

- 📦 范围：打开 Step 2 的常量；更新 `STATUS.md`、`TASKS.md`、`docs/JOURNAL.md`。
- 做法：线上实测默认语言、切换、刷新与换页保持、切换时音乐不断；确认 F1 的静态路由仍为静态。
- 完成标准：§2 全部 8 项通过，或明确列出未通过项与原因。

---

## 7. 风险与取舍

- **N1 不成立**是最大风险，放在 Step 0，先于任何依赖与业务改动。
- **英文用户看到中文的时长**可能远超“一瞬”（见 §1.2），由 D0 决定是否接受或加缓解。
- **服务端页面改造**（F3）会把部分页面变成客户端渲染，可能影响这些页面的首屏；改造时逐页确认，不整页改成客户端。
- **漏翻**：写死语言但无中文的地方（F6）只扫中文发现不了，须专项扫描。
- **英文措辞**为机器翻译，一律待用户审，不得自称已校对；艺术家手记不机翻。
- **共享组件**：`/test1` 为冻结基线，不得改动；改 `pond-gl-test3` 下组件前确认 `/test3` 引用面。
- **测试**：冒烟脚本只覆盖中文模式（F8），英文模式靠每批目验。

---

## 8. 全程检查清单

- `npx tsc --noEmit`
- 改动文件的定向 ESLint
- 相关单测与冒烟脚本（F8）
- key 一致性检查（Step 1 起）
- 单个代码文件不超过 220 行；每个目录文件数不超过 8（含 JSON）
- 本地 dev 开着时不要跑 `build`/`verify`（`.next` 会互踩）
- 本地 `.env.local` 连生产库，只做只读验收
- 说“完成”前分清代码层（key 进了词典）与效果层（两种语言、桌面与手机版面都正常）；没目验就明说

---

## 9. 不做的事

- 不改合约、数据库、链上与 Arweave 永久内容（metadata、snapshot、events、sounds）；`catalog.v1.json` 按 N6 结论处理。
- 不做 URL 语言前缀，不加 middleware。
- 不翻译代码注释、`console.*`、开发者向的 `throw new Error('中文')`。
- 不处理第三方界面（Privy、WalletConnect、钱包插件）的语言，N7 证实可配置的除外。
- 不机翻艺术家手记。
- 不动 `/test1`。
- 不在本阶段加第三种语言。
