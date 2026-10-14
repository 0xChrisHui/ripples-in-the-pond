# P19 验收说明（2026-10-14；用户已验收 CN/EN 效果，D2、D5 已按用户指示补做）

> 分支 `feat/p19-i18n`，全部为本地提交，**未推送、未合并、未部署**。配套：`00-overview.md`（计划）、`01-review-table.md`（中英对照总表，待审英文措辞）。

## 1. 怎么在本地验收

1. `npm run dev`（或 `npm run build && npm run start`），打开首页。右上角出现 **CN / EN**（手机端在菜单里，和登录同一行）。
2. 点 EN：全站文字立刻变英文，页面不刷新；音乐不断、水面不重置。点 CN 切回。
3. 刷新、换页、关掉重开：语言保持（cookie `locale`，一年）。
4. 想关掉按钮：`src/components/pond-shell/navigation/LocaleSwitch.tsx` 里 `LOCALE_SWITCH_VISIBLE` 改成 `false`。
5. dev 开着时不要同时跑 `build` / `verify`。

## 2. 已实测（桌面 1440 / 手机 390，生产构建，无头 Edge）

- 静态路由：build 的路由表（含 API）和 prerender 清单与 P19 开工前**逐行一致**，`/`、`/artist`、`/me`、`/tracks`、`/score` 等仍是静态。
- 中文默认页面：与开工前逐项对比，屏幕文字逐字相同，仅新增 CN/EN 按钮及其无障碍标签。
- 英文模式：10 条路由（含 404、Echo/作品不存在页）无残留中文界面文案（D2 的艺术家内容除外）；控制台 React / hydration / next-intl 报错 0。
- 切换：lang、按钮选中状态、cookie 正确；整页刷新与站内换页后保持；**播放中切换，音频进度连续（3.15s→6.37s）、无 pause/emptied 事件、画布节点未重建**。
- 溢出：伪语言（每条 +40%）全站审计，桌面/手机 0 横向溢出；登录弹窗不溢出。
- 标签页标题：英文模式下替换中文片段（如 `Tracks — Ripples in the Pond`）。
- 单测：`material-error`（新增英文断言）、`share-copy`、`visual-transition`、`verify-me-archive`、`tracks-circle` 等通过。
- `verify.sh`：除下面 §5 的两项旧失败外全部通过，已接入词典一致性检查（2h）。

## 3. 我替你定的事（可推翻）

| 编号 | 决定 | 理由 |
|---|---|---|
| D2 | 你决定**全部翻译**：艺术家名（Ye Yuhan）、简介、项目介绍、照片说明、35 首手记已有英文版，英文模式显示英文；英文另存于 `src/i18n/content/`，**未改** `catalog.v1.json`（N6 仍未查） | 用户 2026-10-14 指示 |
| D5 | 你决定**翻译**：下载海报跟随语言（`?lang=en`）；OG 图因爬虫无 cookie、分享链接固定，做成**中英并列** | 无法获知读者语言 |
| D0 | 你已选 A：接受英文用户刷新时先见中文 | 不限速约 0.2–0.56s，Fast 4G 约 21.6s |
| D1 | 沙盒页（`/test`、`/test1~4`、`/score-lab`、`/me/test`、`/v1`）**不翻译** | 开发用；`/test1` 冻结 |
| D3 | 中英混写标签英文模式**只显示英文部分**（如 `Identity record · 身份页` → `Identity record`；`EditionStamp` 英文只留 `FINALIZED` 这类代码） | 避免英文页夹中文 |
| D4 | 术语见 §4，已写入词典 | — |
| D6 | 标签页标题：浏览器端替换 `document.title` 里的中文片段，服务端 metadata 不动 | 保持静态 |
| 手机 CN/EN 位置 | 放进菜单面板，不在顶栏 | 390px 顶栏放进去会截断品牌名“Ripples in the Pond”（实测需 262px 只剩 219px）；偏离计划“头部直接可见”的字面要求 |
| 英文切换写法 | `useState + startTransition`，不用 `useSyncExternalStore` | 理由见 JOURNAL 2026-10-14 |

## 4. 术语表（D4，英文为我的初稿）

| 中文 | 英文 | 说明 |
|---|---|---|
| 水塘 / 池塘 | the pond | 品牌名 Ripples in the Pond 不变 |
| 唱片（Score / 作品） | record（页面标题仍叫 Ripples #N） | |
| 回声（Pond Echo） | Echo / Pond Echo | 专有名不翻 |
| 原曲 | track | “35 首原曲”→ 35 tracks |
| 铸造 / 收藏 | mint / collect | 铸造指上链动作，收藏指首页的收藏动作 |
| 永久（档案/来源/凭证） | permanent | |
| Token、metadata、hash、Gas、ScoreNFT、Token URI、SBT、NFT、SHA-256 | 保持原写法 | 技术词中英相同 |
| 我的音乐 | My music | 导航里的“我的音乐”入口 |
| 登录 / 登出 | Sign in / Sign out | |
| 艺术家 | Artist | 仅指导航与页面标签；艺术家本人内容见 D2 |

## 5. 留给你定 / 已知遗留

**需要你定：**

- **英文措辞**：`01-review-table.md`（585 条）全部是机器初稿，你说先不改。**艺术家手记**（`src/i18n/content/artist-notes.en.json`，35 条）是第一人称的私人文字，原计划不机翻，这次按你的指示翻译了，**建议艺术家本人过目**。几处我拿不准、按字面处理的：#32“勺子”译为 Spoon（像是猫的名字？）、#26“比诺什”译为 Binoche、#11“定慧”保留拼音 Dinghui、#18“水中神楼”译为 a divine pavilion in the water、#14《恐龙蛋》译为 “Dinosaur Egg”。
- **OG 图只能中英并列**：爬虫不带 cookie，分享链接是固定地址，没法给英文读者出纯英文卡片。若要做，需要让分享链接带 `?lang=en` 并让页面 metadata 读它——会改分享链接规则和测试，没做。
- **海报**：英文模式下点“下载海报”得到英文海报（`/score/N/poster?lang=en`）；直接访问不带参数仍是中文，与原来一致。

**已知限制（不影响上线，但要知道）：**

- 第三方界面不随切换：Privy 邮箱弹窗、WalletConnect、钱包插件、Privy 验证码邮件。N7（Privy 是否支持界面语言）**只确认类型里有 `intl.textLocalization` 可覆盖文案，未实测、未接入**。
- 服务器返回的中文报错原文：中文模式照旧显示，英文模式一律改显前端文案（已覆盖登录、铸造、档案、播放器等展示层）；API 改错误码属 Step 7，延后。
- 服务端组件里的文字（如 `/artist` 静态 HTML）英文用户刷新时先见中文，再换英文（D0）。
- 日期：作品凭证日期用固定时区 `Asia/Shanghai`（服务端会渲染它，需一致）；铸造记录等只在浏览器渲染的时间用浏览器本地时区。USD Gas 金额两种语言都是 `en-US` 格式。
- 未迁移的中文（约 661 行 / 129 文件）：开发面板（视觉控制台、P9 调参、水面调试）、服务端报错、校验用 `throw new Error('中文')`、`console.*`、封存的 echo-resident。均属开发者向，按计划不翻译。
- 未测：真机、Safari / Firefox、手机视口下“播放中切换”（桌面已测）、真实登录后的“我的”页和铸造流程（无登录态，只测了未登录与静态/只读页面）、线上 HTTP/2 + CDN 环境。

## 6. 与 P19 无关的既有问题（未处理）

- `scripts/ui/tracks-experience.test.ts` 过期：断言的 `data-track-position` 在 P19 前的 a88db6e 就已不存在，且 `/tracks` 的曲目舞台 HTML 由客户端动态加载（`ssr:false`）。未改，建议另立任务更新测试。
- `verify.sh` 两项旧失败：`src/lib/self-mint`（9 文件）、`src/types`（10 文件）超 8 文件；Production snapshot Gate 期望 12 条记录。
- 首页 Fast 4G 下水面就绪测得 46–49s，高于 P15-J 记录的 26–28s，原因未查。
- P15-J 的测量脚本没有处理无头浏览器页面 `hidden` 导致动画帧被节流（ERRORS E067），其依赖动画帧的读数可能偏差。
