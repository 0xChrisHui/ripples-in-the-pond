# P10-A — /score/[id] 分享转发 + 海报 / link 下载

> 对应用户指定的两块："`/score/[id]` 加便捷转发（Twitter/X、微博、复制链接）" + "海报 / link 下载方案"。
> 上层：`playbook/phase-10/00-overview.md` §2；执行契约见 §8（**不到 🛑 停点默认不停**）。
> 本 track 停点：A2.1 并入 🛑 停点 0（开工拍板包）；A2.2 出图后 🛑 停点 2（视觉验收）。**A1 全程无停点，自动连跑**。
> **红线**：不碰首页（Archipelago / pond-gl*）任何文件；不做 `/score/[id]` 整页视觉重设计（那是 P11）。本 track 在现有黑底页上加控件，视觉够用即可。

---

## 现状（施工前必读，2026-07-05 已核验）

- `app/score/[id]/page.tsx` — Server Component，数据走 `src/data/score-source.ts` 的 `getScoreById(id)`；ShareBar 需要的字段全有：`score.id`（tokenId/UUID 双兼容）、`score.trackTitle`、`score.tokenId`、`score.coverUrl`
- `app/score/[id]/ScorePlayer.tsx` — 客户端 inline 播放；`FallbackShell.tsx` — DB miss 降级壳
- `app/score/[id]/opengraph-image.tsx` — 动态 OG 图已存在（`next/og` ImageResponse，**`runtime='nodejs'`**，147 行）；其"封面先 fetch 成功才传 src、失败降级色块"模式（:27-37）是海报路由要照抄的核心
- `generateMetadata`（page.tsx:17-37）已输出 openGraph + twitter `summary_large_image`，Next 自动把 opengraph-image 接到 `og:image` → **分享链接的卡片展开今天就是通的**，A1 不需要动 metadata
- 页面目录当前 5 个文件（page/ScorePlayer/FallbackShell/opengraph-image/loading），+ShareBar +poster 后 7 个，8 硬线内不用建子目录

---

## A1 — 分享按钮组

**新建** `app/score/[id]/ShareBar.tsx`（`'use client'`），在 `page.tsx` 的信息区上方或播放器下方挂载。

三个动作（全部零依赖、零新 API）：

| 动作 | 实现 |
|---|---|
| **Twitter/X** | `window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url))` |
| **微博** | `window.open('https://service.weibo.com/share/share.php?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(title))` |
| **复制链接** | `navigator.clipboard.writeText(url)` + 降级（不支持时用 `document.execCommand('copy')` 或提示手动复制）+ 成功后 toast/文字反馈 |

**URL / 文案口径**：
- 分享 URL：`(process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin) + '/score/' + score.id`
  - `NEXT_PUBLIC_APP_URL` 生产已配（cron F3 在用），但 **`.env.example` 缺这个键**（review P3-3）——本地开发 fallback 到 `window.location.origin` 即可，别因它硬依赖
  - **canonical 规则**：`score.tokenId != null` 时优先用 `/score/${tokenId}`（数字路由永久有效、更短）；未上链只有 UUID 时用 UUID（上链后 UUID 路由依旧兼容，旧分享链接不死）
- 文案：`在 "${trackTitle}" 上的即兴演奏 · Ripples #${tokenId}`（未上链省略 `#${tokenId}` 段）；微博 `pic` 参数可带 OG 图 URL（`/score/${id}/opengraph-image`）
- props 接口：`{ id: string; tokenId: number | null; trackTitle: string }`，由 page.tsx 服务端传入，ShareBar 内不 fetch

**复制反馈**：页面没有 toast 系统（也不为此引依赖）——按钮文案原地切换 `复制链接 → 已复制 ✓`（2s 后复位）即可；`navigator.clipboard` 不可用（非 https / 旧浏览器）时降级 `document.execCommand('copy')`（隐藏 textarea 选中法），再不行按钮变为显示完整 URL 让用户手动复制

**Step 拆分**：
- A1.1 ShareBar.tsx 骨架 + 三个按钮（先只 console.log，验证挂载与布局）
  - 挂载点：page.tsx `<ScorePlayer />` 与链上信息 `<section>` 之间；风格对齐现页（`font-mono text-xs text-white/30` 底色系，hover 提亮，不做新视觉——P11 再统一）
- A1.2 接三个真实动作 + 复制降级 + 文案反馈
- A1.3 移动端布局（现页面 `max-w-xl` 单列，按钮组横排 + `flex-wrap` 够用）

**验收**：三个按钮浏览器实测（X/微博弹窗被拦截时 `window.open` 返回 null → 降级当前页跳转）；复制在 http/localhost 走降级路径实测；X/微博真机贴链接验 OG 卡片展开（今天已通，回归确认没改坏）。

**回滚点**：纯新增文件 + page.tsx 一行挂载,revert 单 commit 即回。

---

## A2 — 海报 / link 下载

**启动时先拍板方案**（用户定，三选一）：

| 方案 | 实现 | 优点 | 缺点 |
|---|---|---|---|
| ① 复用 OG 图管线（**推荐**） | 新建 `app/score/[id]/poster/route.tsx`（Route Handler 返回 ImageResponse），竖版海报 PNG，前端 `<a download>` 触发下载 | 与 `opengraph-image.tsx` 同技术栈同 `runtime='nodejs'`（**无 Edge 顾虑**，2026-07-05 核验）、内置零依赖、封面预取降级逻辑直接搬 | 中文字体若要品牌字需内嵌字体文件（现 OG 图走 `system-ui` 可回避） |
| ② 前端 canvas 合成 | 客户端 canvas 画海报 → `toBlob` → 下载 | 无服务端成本 | 封面在 Arweave，跨域图片易污染 canvas 导致 `toBlob` 抛安全错 |
| ③ 只做 link 卡片 | 不出图，复制带 OG 的链接由平台自动展开 | 最小实现 | 无"下载海报"实体 |

**推荐 ①**：海报内容元素待用户定，候选：封面、曲目标题、作者短地址、二维码（指向 /score/[id]）、Ripples in the Pond 标识、Token ID。

**方案① 实施细节**：
- 尺寸建议 1080×1920（9:16 手机全屏/朋友圈友好）或 1080×1440（3:4），拍板时一起定
- 结构照抄 `opengraph-image.tsx`：`getScoreById(id)` → 封面手动 fetch（`AbortSignal.timeout(4000)`）成功才传 src、失败降级色块 → JSX flex 布局
- 强制下载：route 里设 `Content-Disposition: attachment; filename="ripples-${id}.png"`（ImageResponse 的 headers 参数），`<a>` 的 `download` 属性做双保险
- 缓存：加 `Cache-Control: public, max-age=3600`（同一 score 海报不变，省重复渲染）
- **二维码**：JSX 里没法零依赖生成（QR 编码算法不值得手写 200 行）。两条路拍板时一起选：(a) 装 `qrcode`（生成 dataURL 传给 `<img>`）→ **先查 `docs/STACK.md`，未登记则装包前报批**（AGENTS.md 铁律）；(b) 首版省略二维码，海报底部印短链文字。**建议 (b) 先出首版**，二维码看真实分享反馈再加

**Step 拆分（按方案①）**：
- A2.1 方案拍板 —— 已并入 🛑 **停点 0**（开工前拍板包：方案①/②/③ + 元素/尺寸 + 二维码 a/b），不单独停
- A2.2 `poster/route.tsx` 出图（复用 opengraph-image 的封面加载逻辑；未上链 UUID 的 score 同样要能出图）→ 🛑 **停点 2：出 2-3 版后停，用户浏览器直开 `/score/<id>/poster` 挑版式/提修改**，验收通过才进 A2.3
- A2.3 ShareBar 加"下载海报"按钮接 route + 下载文件名验证
- A2.4 "复制链接"已在 A1 覆盖；若方案③则本 track 到此为分享卡片收尾

**验收**：海报可生成、可下载（含移动端长按保存路径）；封面加载失败时有降级底图（不白屏）；`FallbackShell` 场景（score 查不到）route 返 404 而非 500。

**回滚点**：纯新增 route 文件 + ShareBar 一个按钮，revert 单 commit 即回。

---

## A track 完结标准

- [ ] `/score/[id]` 三个分享入口（Twitter/X、微博、复制链接）浏览器实测可用
- [ ] 海报可生成 + 可下载（或方案③的 link 卡片跑通）
- [ ] `bash scripts/verify.sh` 全绿
- [ ] 未触碰首页任何文件（与 P8/P9 零冲突）
