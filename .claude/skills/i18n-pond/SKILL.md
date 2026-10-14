---
name: i18n-pond
description: 给 Ripples in the Pond 做中英双语（中文默认、英文为译文，右上角 CN/EN 切换）。迁移任何页面/组件的中文文案、新增 UI 文案、检查语言泄漏或英文溢出时使用。
---

# i18n-pond：本项目的中英切换规范

> 状态（2026-10-14）：`next-intl@4.14.9` 已获批（2026-10-13）并在 P19 Step 1 安装、登记 `docs/STACK.md`。
> 阶段计划、待用户定的事（D0–D6）、待核对点（N1–N7）以 `playbook/phase-19/00-overview.md` 为准；本文只管单文件怎么迁。

## 0. 铁律（来自 AGENTS.md / CONVENTIONS.md，i18n 工作同样适用）

- 一次只迁移**一个文件或一个组件**，验证后停下等用户说"继续"。不要批量铺开。
- 代码文件 ≤220 行（`.ts/.tsx/.js/.jsx/.css`）。迁移后文件变长就先拆，别硬塞。JSON 词典不受这个 hook 限制。
- 每层目录 ≤8 个文件。hook 只数文件、不数子目录，**计入 `.json`**（playbook F10 已核对），词典目录同样受限。
- 注释写中文；key 和变量名写英文。
- 本地 `.env.local` 连的是生产库：验收只读，别触发写操作。
- dev 开着时别跑 `build`/`verify`（`.next` 互踩，会出现假 404）。

## 1. 不翻译边界（动手前先对照）

| 类别 | 处理 | 依据 |
|---|---|---|
| 已上链 / Arweave 永久内容（metadata、snapshot、events、sounds） | **不改**，改了会和链上快照不一致 | STATUS：17 项永久资源已核验 |
| `src/data/score/*` 里 `throw new Error('中文')` 一类校验报错 | 开发者向，**不翻译**；已核实 `metadata.ts` 只有这类 | 2026-10-13 抽查 |
| 沙盒页 `/test` `/test1~4` `/score-lab` `/me/test` `/v1` | 默认不翻译，**待用户定**（playbook D1）；`/test1` 任何情况都不改 | 未确认 |
| 曲目名、艺术家简介（`src/content/artist.ts`）、艺术家手记（`artist-notes.json`）、艺术家名英文写法 | **待用户定**（playbook D2）；**手记不机翻** | 未确认 |
| `public/music-catalog/catalog.v1.json` | 是否属于发行/永久清单待查（playbook N6），查清前不改 | 未确认 |
| `console.*`、代码注释 | 不翻译 | — |
| API 错误文案（`app/api` 约 220 行） | 最后阶段，改成错误码由前端映射，不在后端按语言返回（playbook Step 7）；之前先在展示层拦截服务器原文 | 方案 |

遇到表中"待确认"项，**停下问用户**，不要猜。

## 2. 单文件迁移流程

1. **扫中文**：Grep 正则 `[一-鿿]`，`output_mode: content` 作用到目标文件。
   ripgrep 默认引擎**不支持环视**，没法在正则里排除注释；人工跳过以 ` *`、`//`、`{/*` 开头的行即可（实测 `LoginModal.tsx` 14 处里有 6 处是注释）。
2. **扫语言泄漏**（没有中文也会漏，只扫中文不够）：
   - `lang="zh-CN"` 硬编码（已知至少 6 处：`app/layout.tsx`、`ScoreLifecycle`、`ScorePondScene`、`ScoreRouteLoading`、`FallbackShell`、`SingleSpherePond`）
   - `toLocaleDateString('zh-CN')` / `toLocaleTimeString('zh-CN'` / `toLocaleString('zh-CN'`（已知：`ScoreArchive`、`SelfMintOrderView`、`MintHistorySection`）
   - `new Intl.NumberFormat('en-US'`（`self-mint-copy.ts`，语言写死）
   - `aria-label`、`title`、`alt`、`placeholder`、`metadata.title/description`、`document.title`
   - 经 `catch` 后展示给用户的 `Error.message`、toast
   - **模块顶层常量与组件外的辅助函数里的文案**（如 `ScoreArchive.tsx` 第 7–25 行的 label 表、第 59 行 `'时间未记录'`）：这里不能调用 `useTranslations`。改成存 **key**，到渲染处再 `t(key)`；辅助函数改为接收 `t` 或返回 key。
   - **模板字符串里中文与 `${}` 混排**（`src/components` 下约 39 处 / 25 个文件，如 `` `Token #${id}` ``）：必须改成带插值的 key，别拼接。
   - **已有的双语标签**（如 `Identity record · 身份页`、`Permanent record · 永久档案`）：英文模式显示什么由**用户定**（playbook D3），别擅自拆。
3. **逐条判定**：翻译 / 跳过（对照 §1）。跳过的写一行原因，不要沉默跳过。
   - **术语表**：`Token`、`metadata`、`ScoreNFT`、`Token URI`、`hash` 这类中英混写的技术词，以及“铸造”“收藏”“唱片”“回声”“水塘”，按用户定的术语表（playbook D4）翻译；术语表没定前不迁移，否则各文件译法会不一致。
4. **起 key**：`命名空间.区块.元素`，如 `nav.main.artist`、`login.modal.title`、`mint.button.submit`。
   - 命名空间按功能：`common` `nav` `login` `home` `tracks` `me` `score` `mint` `share` `errors`。
   - 同一句话在多处出现，才进 `common`；别提前抽象。
5. **插值与复数**：用 `{name}`、ICU plural，**禁止拼接**翻译片段。
   - 反例：`t('a') + count + t('b')`。正例：`t('me.count', { count })`。
6. **日期 / 数字**：用当前语言，显式指定时区，避免 hydration 不一致（时区方案见 playbook N4 / Step 5）。
7. **中文是源语言**：zh 直接取现有原文（一字不改），en 为译文；两边 key 必须一一对应。
8. **改完自检**：目标文件不再有未判定的中文；`npm run i18n:check` 通过；`bash scripts/verify.sh` 通过。
9. **给用户审**：每批提交前列一张“key / 中文 / 英文”对照表，用户审过英文措辞再提交。

## 3. 基础设施（方案 C，P19 Step 0 实测成立、Step 1 落地）

不用 `[locale]` 路由、不用 URL 前缀、**不加 middleware**（现有 `middleware.ts` 的限流不动），**根布局与 `request.ts` 都不读 cookie**——读了页面就从静态变动态。

| 文件 | 作用 |
|---|---|
| `src/i18n/messages/zh.json` / `en.json` | 词典。中文是结构基准，英文必须同构（`tsc` 与 `npm run i18n:check` 双重检查） |
| `src/i18n/locale.ts` | 语言类型、cookie 读写、`<html lang>` 首帧内联脚本、英文按需加载并以中文兜底 |
| `src/i18n/LocaleProvider.tsx` | 客户端 provider（套在 `Providers` 最外层）；导出 `useLocaleSwitch()` 读当前语言、切换语言 |
| `src/i18n/request.ts` | 服务端配置，固定 `zh` |
| `src/i18n/next-intl.d.ts` | key 类型检查：`t()` 里写错 key，`tsc` 直接报错 |

- **客户端组件**：`const t = useTranslations('ns'); t('key', { name })`。切换语言时这类组件就地换字，不刷新、不重挂载。
- **服务端组件**：`getTranslations` 只能拿到中文。英文模式下要显示英文的文字，必须放进客户端组件（playbook F3），改造时逐页确认，别把整页改成客户端。
- **首帧一律中文**：浏览器第一次渲染必须与服务端 HTML 一致；**禁止在组件首次渲染时读 cookie / localStorage 决定语言**，否则 hydration 失败、整棵树在客户端重建（Step 0 阳性对照已证实）。
- 切换语言 = 写 cookie + provider 换词典，**不调用** `router.refresh()`。
- 英文缺 key 时显示中文原文（provider 以中文为底合并英文），不会显示 `ns.key` 路径。
- OG 图 / 海报是服务端渲染，爬虫不带 cookie，只能出固定语言（playbook D5、N5）；Satori 里含多个子节点的 `div` 必须显式 `display:flex`，"变量+文字"混排要合成模板字符串。

## 4. 布局溢出检查

固定尺寸区域优先目验（桌面 + 手机宽度各一次，两种语言各一次）：
首页圆形节点、登录弹窗、PIN 输入、铸造按钮、移动端导航、右上角 CN/EN 按钮本身、分享海报。

- 英文短标签常比中文宽；中文则要看字体 fallback 和断行。不要凭印象断言"英文一定更长"。
- 建一个**伪语言**（每个文案加长并加重音字符），一次性暴露所有截断，比逐个切换高效。
- 不用固定 `width`，改 `min-width` + padding，允许换行。

## 5. 一致性校验

- en / zh 词典 key 集合必须相同；缺失视为错误。
- 占位符 `{name}` 在两种语言里必须一致。
- 译文与英文原文完全相同的非专有名词，标记复核。
- 代码里 `t('...')` 引用的 key 必须存在；动态拼 key（`t(\`a.${x}\`)`）禁止，除非枚举全部取值。

## 6. 交付与记录

- 按 AGENTS.md §8 的 6 行格式汇报，列出：改了哪些文件、新增多少 key、跳过哪些中文及原因。
- 机器翻译一律视为**待用户审英文措辞**，不要自称"已校对"。
- 非显然决定（边界划定、key 命名变更）追加一行到 `docs/JOURNAL.md`。
- 说"完成"前分清：key 都进了词典（代码层）≠ 两种语言下版面都正常（效果层）。没目验就明说没目验。
