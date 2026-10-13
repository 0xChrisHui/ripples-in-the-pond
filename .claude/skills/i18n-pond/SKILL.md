---
name: i18n-pond
description: 给 Ripples in the Pond 做中英双语（默认英文，右上角 CN/EN 切换）。迁移任何页面/组件的中文文案、新增 UI 文案、检查语言泄漏或英文溢出时使用。
---

# i18n-pond：本项目的中英切换规范

> 状态（2026-10-13）：**依赖未获批**。`next-intl` 不在 `docs/STACK.md` 白名单，用户批准并登记前不得安装。
> 本文 §1–§2、§4–§6 与具体库无关，现在就能用；§3 是库相关，批准前只作为设计参考。

## 0. 铁律（来自 AGENTS.md / CONVENTIONS.md，i18n 工作同样适用）

- 一次只迁移**一个文件或一个组件**，验证后停下等用户说"继续"。不要批量铺开。
- 代码文件 ≤220 行（`.ts/.tsx/.js/.jsx/.css`）。迁移后文件变长就先拆，别硬塞。JSON 词典不受这个 hook 限制。
- 每层目录 ≤8 个文件。该 hook 是否计入 JSON **未验证**，建词典目录前先实测。
- 注释写中文；key 和变量名写英文。
- 本地 `.env.local` 连的是生产库：验收只读，别触发写操作。
- dev 开着时别跑 `build`/`verify`（`.next` 互踩，会出现假 404）。

## 1. 不翻译边界（动手前先对照）

| 类别 | 处理 | 依据 |
|---|---|---|
| 已上链 / Arweave 永久内容（metadata、snapshot、events、sounds） | **不改**，改了会和链上快照不一致 | STATUS：17 项永久资源已核验 |
| `src/data/score/*` 里 `throw new Error('中文')` 一类校验报错 | 开发者向，**不翻译**；已核实 `metadata.ts` 只有这类 | 2026-10-13 抽查 |
| 沙盒页 `/test` `/test1~4` `/score-lab` | **待用户确认**，默认不翻译 | 未确认 |
| 曲目名、艺术家简介（`src/content/artist.ts`、`src/types/tracks.ts`） | **待用户确认**双语字段还是保持原样 | 未确认 |
| `console.*`、代码注释 | 不翻译 | — |
| API 错误文案（`app/api` 约 220 行） | 最后阶段，改成错误码由前端映射，不在后端按语言返回 | 方案 |

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
   - **已有的双语标签**（如 `Identity record · 身份页`、`Permanent record · 永久档案`）：英文模式显示什么由**用户定**，别擅自拆。
3. **逐条判定**：翻译 / 跳过（对照 §1）。跳过的写一行原因，不要沉默跳过。
   - **术语表**：`Token`、`metadata`、`ScoreNFT`、`Token URI`、`hash` 这类中英混写的技术词，先问用户定一份术语表再迁移，否则各文件译法会不一致。
4. **起 key**：`命名空间.区块.元素`，如 `nav.main.artist`、`login.modal.title`、`mint.button.submit`。
   - 命名空间按功能：`common` `nav` `login` `home` `tracks` `me` `score` `mint` `share` `errors`。
   - 同一句话在多处出现，才进 `common`；别提前抽象。
5. **插值与复数**：用 `{name}`、ICU plural，**禁止拼接**翻译片段。
   - 反例：`t('a') + count + t('b')`。正例：`t('me.count', { count })`。
6. **日期 / 数字**：用当前语言，显式指定时区，避免 hydration 不一致。
7. **英文是默认**：先写 en，再写 zh；两边 key 必须一一对应。
8. **改完自检**：目标文件不再有未判定的中文；`bash scripts/verify.sh` 通过。

## 3. 基础设施（库相关，批准后才执行）

官方文档（已核对，next-intl 无路由模式）：

- 不用 `[locale]` 路由、不用 URL 前缀、**不需要 middleware**。现有 `middleware.ts` 的限流不用动。
- `src/i18n/request.ts` 里用 `cookies()` 读语言，cookie 名官方示例是 `locale`，缺省回退 `en`。
- `next.config.ts` 套 `createNextIntlPlugin()`；根 layout 用 `NextIntlClientProvider` 包住 children。
- 切换语言：写 cookie 后 `router.refresh()`。
- **代价**：读 cookie 会让用到翻译的页面变成动态渲染。
- `<html lang>` 要随语言变，不能再写死。
- OG 图 / 海报是服务端渲染，要单独读语言；Satori 里含多个子节点的 `div` 必须显式 `display:flex`，"变量+文字"混排会崩。

自写轻量版（不加依赖）的接口保持同形（`t('ns.key', vars)`），将来换库只改 provider。

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
