# P15-X 本地交接 — 20261002-night-01

## 交接字段

- lane: `p15-x`
- BASE_SHA: `e6985bec5ef6d6f191526e6f2e5b58caa5414357`
- headSha: `d076a6afc451471336474530c0aff4cb698bb1dc`（已验证的代码提交；本文件随后独立提交，最终交付 HEAD 在总控消息中列明）
- dependsOn: [`e6985bec5ef6d6f191526e6f2e5b58caa5414357`]；共享接线尚未交付，不列不存在的 SHA。
- completedSteps: `X0, X1, X2, X3, X4, X5-local, X6-ready-score, X7-local`
- nextStep: `K2：总控共享接线及一次组合视觉/焦点验收`
- status: `code_ready`
- changedFiles: 下方18个代码文件和本 handoff；未改公共状态/日志、依赖、链配置或播放引擎。
- verification: 项目类型与14个显式TS/TSX lint通过；6项行为测试通过；差异/行数/目录检查通过。
- pendingItems: `P15-X5-background`、`P15-X6-lifecycle`、首页曲目链接；K2真实布局/焦点/绘制、登录状态与媒体断言。

## X0：基线、实际路径与保护

工作目录只使用 `E:\Projects\nft-music-p15-verify`，分支 `codex/night-p15-20261002-night-01`。开始 HEAD 与 BASE 完整一致，工作区干净。未写入原工作区，未读取凭证或 `.env*`。

- 首页入口是 `app/page.tsx` 重导出 `/test3`，共享导航为 `PondHeader/PublicLinks`。
- `/me` 提示来自 `ArchiveSection` 的 conditional notice；`recordings.phase` 提供后台刷新，`materials.cached` 经 `warning='正在更新…'` 提供缓存未核实状态。
- Echo warning来自 `useOwnedEchoes` 的截断列表、来源状态不可用；未将这些真实性警告当普通刷新隐去。
- BASE 未命中完整“上次链上确认”文案，未新增该句凑测试。
- `LoginModal` 的 cleanup 会恢复之前控件焦点；`useKeyboard/isEditableTarget` 对按钮/链接过滤，因此指针关闭登录后会阻断演奏。
- Score 的立即退场来自 `ScorePondScene.isPlaying` 同步关闭 `flags.glSpheres`、卸载 `GlEclipse`；`use-score-pond-sim` 立即清真实播放 ref。共享背景消费者是 `PondGL → WaterDistort → renderFrame`，当前无 Score 可选混合目标接口。

| 已保护能力 | 本线结果 |
|---|---|
| `ScoreRecordAnchor` 的 `PlaybackSeekBar/onSeek={playback.seek}` | 文件未改，仍在第63行 |
| paused seek、暂停/继续、ended replay | 原 `playback.toggle/replay` 未改 |
| Score engine seek、资源加载、永久 Decoder | 全部只读未改 |
| 全局 Player、Echo/WalletRecipe seek | 全部未改 |
| 用户唱片 CSS与删除 Score loading | 原 `score-page.css` 未改，未新增 loading文件 |
| viem付款/关联钱包/鉴权/链能力 | 不改变任何调用或权限 |

静态路径已定位；本线不启动独立浏览器，不冒充实际复现通过。

## X1–X6 实现与决定

| Step / 需求 | 本地结果 | 未完成边界 |
|---|---|---|
| X1 / 1 | 选择器同格隐藏测量真实候选，标记/标签/箭头固定三列；窄屏account始终独立一行；MintChoice共享纯展示ledger测量层，隐藏层不可Tab且无重复副作用 | 桌面/390px锚点≤1px、标签200%缩放、真实双链会话待K2 |
| X2 / 2 | 标题下常驻44px状态格，polite announcement常驻；刷新完成只清文本；ownership缓存明确标“持有人核对中”，错误“暂无法核实”，警告/错误完整详情与重试可达 | 同一记录量下首记录/下一分区坐标及真实缓存响应待K2 |
| X3 / 3 | 移除desktop/mobile旧Echo导航及专用auth/useOwnedEchoes调用；首页进入/恢复仅清指针遗留的header焦点；第一次真实键盘/指针输入取消清理；登录关闭仅恢复键盘焦点 | 硬刷新、返回、后退、指针关闭登录、Tab焦点与真实A键待K2 |
| X4 / 7 | 自有登录界面统一“SEMI社区身份”“链上地址登录”；连接钱包、钱包签名、余额与auth/API语义保留 | 新名称窄屏排版待K2，未发送验证码或签名 |
| X5 / 6 | 独立idle→entering→active→exiting→idle模型；450ms入场/650ms退场；日食唯一实例与展示ref留存；唱片opacity/scale连续；只淡出第一SVG，P9余韵不被隐藏；generation取消旧回调、80ms超时兜底、卸载清理、reduced-motion立即落稳 | 共享球/背景接口待总控；真实Score结束、pause/replay/seek与绘制未验，不报整体完成 |
| X6 / 4 | 仅实现B作者/旁听者×X/微博四种文案；当前已认证地址与creator校验后才用作者；URLSearchParams编码一次；ready页使用buildScoreRoute身份 | 生命周期页caller作者/canonical需总控接线；真实按钮与复制待K2 |

非显然决定仅记录本份handoff，公共JOURNAL由总控维护：

1. `/me` 状态使用所有宽度一致的第二标题行。右侧收藏栏较窄，统一44px格可避免状态挤压标题/计数；长警告是可展开浮层，不插入正文。
2. 缓存核对判定沿用BASE已有warning协议，不改ownership查询或缓存格式；失败时继续显示缓存未确认说明。
3. MintChoice保持唯一交易/查询effect，非活动ETH层仅纯展示测量；合约链接隐藏时tabIndex=-1。费用/余额预留两行，其余ledger行48px，不给整个sheet巨大min-height。
4. Score展示采用独立ref，不将退场伪装成playing；固定glSpheres常驻依赖总控可选scoreVisual，否则未集成版本会显示静息球，此状态不能标integration_ready。
5. 第一SVG才是日食，另外两个SVG属于Showcase/P9，不以整个wrapper或Canvas透明度控制退场。
6. canonical缺失时不猜作品链或拼ETH legacy路径，分享明确禁用；总控给合法生命周期页补chain-aware/pending路径。

## X6 分享候选与接口

用户已选B“邀请回应”，运行时只有B。A/C保留在此供后续文案替换，未建立选择器或预览页。每条文案追加一行真实 `《trackTitle》`，链接作为平台独立参数。

| 候选 | 分享者 | X | 微博 |
|---|---|---|---|
| A 随手创作 | 作者 | 在水塘里随手弹了一段，录下来了。来听听。 | 本来只是想听首歌，后来跟着弹了一会儿，就留下了这段录音。分享出来，想听听你们的感觉。 |
| A 随手创作 | 旁听者 | 在水塘里发现一段即兴，想分享给你。 | 听到一段想分享的即兴演奏。有人在这首底曲上留下了自己的声音，你也来听听。 |
| B 已实现 | 作者 | 这是我今天留在水塘里的声音。换你，会弹成什么样？ | 同一首底曲，每个人都能留下不同的声音。这是我的这一版。你也可以进去弹一段，我很想听听你的版本。 |
| B 已实现 | 旁听者 | 听到这一段，很想知道换你会弹成什么样。 | 发现一段有意思的即兴演奏。同一首底曲，换个人会留下怎样的声音？把它分享给你，也想听听你的版本。 |
| C 留住片刻 | 作者 | 把刚才那段声音，留成了一张唱片。 | 有些声音当时觉得普通，回头听却很喜欢。我把这段即兴留成了一张唱片，分享给你。 |
| C 留住片刻 | 旁听者 | 有一段声音，想让你也听见。 | 今天听到这段录音，想把它留在这里，也分享给你。戴上耳机听听，看看你会想到什么。 |

纯接口在 `experience/share-copy.ts`：`isScoreAuthor(authenticated,address,creator)`、`scoreShareCopy(platform,title,author)`、`scoreShareUrl(base,path)`、`scoreShareIntent(platform,text,url)`。`scoreShareCopy`只适用于Score即兴，不可直接用于P17原曲；URL/intent编码工具可复用。currentHolder不参与作者判定。

## 总控精确接线请求

### P15-X5-background（已由总控接受，待实现SHA）

- 位置：`src/components/pond-gl-test3/PondGL.tsx/PondGLProps/PondGL`；其共享SphereInstances与WaterDistort/background消费者。
- 当前输入：Score过去由 `isPlaying` 切glSpheres并清 playingId。本线已固定glSpheres=true，并保留真实glSim状态即时清空；overlay单独消费保留展示ref。
- 最小接口：`scoreVisual?: { active: boolean; durationMs: number }`。调用位是 `ScorePondScene.visualProps`，typed spread传给PondGL，在BASE尚未声明接口时仍可类型检查。
- 输出：只在显式传入时为Score球和背景从当前显示值连续转向播放/静息目标；450/650ms或reduced-motion 0ms；不重挂Canvas、mesh，不淡出整个Canvas/P9余韵。
- 默认兼容：其他调用者不传参数时维持旧行为。不要延迟真实playingId或音频结束。
- 依赖子项：X5球体、背景恢复；页面日食与唱片CSS已经实现。
- 断言：idle不留可见GL球；停止日食保留至淡出；背景恢复无单帧切换；退出中重播连续；P9余韵仍绘制；单Canvas。

### P15-X6-lifecycle

- 位置：白名单外 `app/score/[id]/components/ScoreLifecycle.tsx` 的ShareActions caller。
- 最小修改：导入buildScoreRoute，传 `creatorAddress={score.creatorAddress}`；传 `canonicalPath={canonicalPath ?? (score.tokenId == null ? '/score/' + score.id : buildScoreRoute(score.chainId, score.contractAddress, score.tokenId))}`。
- 原因：legacy page没有给生命周期caller传canonicalPath；本线ShareActions拒绝未知canonical，避免ETH静默降级。已知pending id仍可用合法站内入口。
- 默认兼容：已有multichain caller传入canonicalPath时优先沿用；保留posterPath不变。
- 断言：processing/failed也有完整身份链接；只有可验证作者用author；当前持有者或未登录用listener。

### 首页曲目导航

- 位置：`src/components/pond-gl-test3/overlay/PondHeader.tsx/PublicLinks`，在“艺术家”旁加 `/tracks` 的“曲目”链接。
- 本线desktop/mobile共享PublicLinks，旧echo参数已删除；总控在本提交上接，不恢复useOwnedEchoes。
- 断言：无旧回声导航专属API请求；曲目/艺术家均可Tab；首键焦点不回归。

## X7 定向验证记录

| 命令 / 核验 | 退出码 / 结果 | 范围 |
|---|---|---|
| git rev-parse HEAD / status / branch（X0） | 0，BASE一致且干净 | 只读核对 |
| 源码rg/读取 | 已定位上述状态来源；不存在旧完整句 | 未读取凭证、原脏目录 |
| npm run check:quick -- 14个显式TS/TSX路径 | 0，项目增量TypeScript + 显式ESLint通过 | 改动代码，未build/verify/合约 |
| npx --no-install tsx app/score/[id]/components/experience/experience.test.ts | 0，6 tests / 6 passed | 退出/中断/重播/取消/卸载/reduced-motion、作者、B四文案、特殊字符编码、OP/ETH异合约 |
| npm run check:quick -- app/score/[id]/components/experience/use-score-visual-transition.ts（末次受影响增量） | 0，类型与该文件lint通过 | 收紧opacity事件只收第一SVG；事件起点duration从当前playing直接取值 |
| git diff --check、git diff --cached --check | 0 | 全部本线diff，无空白错误 |
| Python只读统计本线文件/目录 | 0 | 全部修改代码≤200行，相关单层目录≤8文件 |
| git diff BASE -- ScoreRecordAnchor/score-page.css/播放模块 | 无改动 | seek/用户CSS/永久资源受保护 |
| rg旧可见身份名称 | 无匹配 | auth/me，真实操作钱包词保留 |

类型/lint首轮对应路径：MintNetworkSelector、MintChoiceDialog、ArchiveSection、LoginModal、SemiLogin、WalletLoginOptions、PondHeader、use-home-entry-focus、ScorePondScene、ShareActions、visual-transition、use-score-visual-transition、share-copy、experience.test；路径均使用仓库内显式文件。

一次命令调用曾用PowerShell不支持的花括号路径展开导致ParserError，未执行读写；已换显式路径。一次 `tsx --test` 加方括号路径被Node当glob，输出0 tests，该输出不计通过；改为直接执行测试文件后真实6项通过。未为工具额外安装依赖或新建环境。

行为测试使用本地确定性调度器，不代替真实音频和绘制；未运行本线独立浏览器、生产build、全量verify、钱包交易或外部平台发布。静态审查发现GlEclipse有3个SVG，已将CSS/transitionend限定首个日食SVG，确保P9保持独立。

## K2 尚需一次验收

- 1440×900与390×844：OP→ETH→OP选择器/account/正文锚点≤1px、无横溢出；字体200%只补标签容器。
- `/me` 同一记录/页码的ready→refreshing→ready、cached→verified、cached→error→retry：首行/下一分区≤1px，完整详情与重试可达，隐藏内容不可Tab。
- 首页硬刷新、返回、后退、指针开关登录：真实A键一次动效；主动Tab焦点保留，输入不演奏，Escape正常；本线没有运行浏览器，不能称初始黄框已实测消失。
- 真实Score seek到末尾约3秒自然结束一次；pause/resume、退出中replay、paused seek、路由离开、reduced-motion，无双声/卡黑/旧回调；媒体无法读取则仅挂对应真实媒体断言。
- B版分享实际按钮及复制；核对生命周期caller补齐；不实际发帖。

本线不启动服务。整合后复用总控3115入口：`/`、`/me`、真实链感知Score路径；共享接线前只适合逻辑/静态核验，不作已完成视觉候选。

## 最终走读

1. `ScorePondScene` 的 `eclipseSim` 使用展示ref，真实glSim仍来自isPlaying；这条分离保证650ms退场不会延长声音或篡改按钮状态。
2. `visual-transition` 的generation/token使已取消的退出不能清掉新重播；只收预期opacity事件并有80ms兜底。
3. `share-copy/isScoreAuthor`同时要求认证与有效creator地址一致；收藏者与未知身份使用旁听者文案，链/合约身份完全由canonicalPath决定。

## K2 总控结果（替代未接线状态）

共享接线已归并，类型/lint、6项体验测试复用。K2入口/指针关闭登录/主动Tab/返回BODY/真实按键声音/3键实际动效通过；A键动效按既有FX01规则需要日食，未改P9映射。Privy当前app对3115来源的frame-ancestors未放行，已登录网络切换和/me异步坐标未验，未mock身份。Score #1链凭证可读，但永久音效-8QBKp_uxZdwyHF9CIgoBdFkAyipGys4krfEMLDA800在浏览器网络失败，原双网关有界重试后仍error；真实结束退场未通过，未替换资源。相关退场状态/连续fade逻辑测试通过不代表真实媒体通过。证据集中k2-browser.json。

## 2026-10-03 最终统一UI收尾

曲目馆标题/留白缩减，开始播放按钮置于唱片上方；桌面35曲列表独立滚动，手机改横向曲目条并保留标题/播放首屏。发行提示同步已批准ETH规则；新OP SBT未部署时不发状态请求、不引导用户登录收藏，旧版凭证明确标记旧版。未重写内容、播放引擎或永久音频，既有真实原曲2播放证据复用。

项目type、相关lint及diff检查通过。Edge启动被工具自动审批拒绝（blocked by policy），本次新布局的真实首屏/响应式视觉Gate待验；不将CSS检查当成页面验收。已登录网络选择和/me布局仍依赖允许的Privy来源/真实账号。

## 2026-10-03 — 总控共享导航接线

路由过渡现只在键盘激活链接时恢复入口焦点；鼠标点击和初始加载不会再把焦点强制移到菜单。Score档案行与通用Pond链接使用同一参数，原主动Tab键盘路径保留。4项视觉退场与1项分享文案测试、项目type和相关lint通过；曲目馆进一步审美打磨继续按用户要求延后，真实页面只在本轮唯一K2核对首屏入口与导航焦点。
