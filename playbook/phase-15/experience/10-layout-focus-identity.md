# P15-X — 布局、焦点与身份名称执行步骤

> 执行入口：[P15-X 总览](00-overview.md)。共同约束：[总控](../../parallel-2026-10/00-orchestration.md)、[共享合同](../../parallel-2026-10/10-shared-contracts.md)。
> X0–X4 为现有界面的局部修复；不改网络能力、铸造交易、身份关联或缓存真实性。

证据位置遵循 [总览第 5 节](00-overview.md#5-证据与恢复规则)：常规结果只追加到一份 lane handoff，不逐步生成报告。下文视觉断言统一交 X7，在 K2 的同一次集成会话完成；单独执行本线则使用本次必要会话，不要求总控全套。相关源码、依赖、环境不变时复用证据，失败只补相关断言。

## X0 — 基线与现状核验

**输入依赖**：并行时使用总控 K0 的 `BASE_SHA`、分配分支/工作树、隔离运行环境/端口、用户改动保留清单。单线时由执行者记录安全基线与保留清单，不要求另跑 K0；不能未经核对从本地旧 HEAD 覆盖已有进度。

**实际文件与符号**：总览所有权表；`MintNetworkSelector.displayName`、`ArchiveSection`、`PondHeader/PublicLinks`、`useKeyboard/isEditableTarget`、`LoginModal` 焦点恢复 effect、`ScorePondScene/isPlaying`、`ScoreRecordAnchor/perform`、`UseScorePlaybackResult.seek`。

**具体操作**：

1. 只读记录 `git rev-parse HEAD`、`git status --short`、`git branch --show-current`；核对处于总控分配目录和 BASE 后代。使用总控提供的生产对比证据，不另行 fetch/merge 改变起点。
2. 对照 K0 的保留清单检查 `ScoreRecordAnchor` 仍调用 `PlaybackSeekBar`，`onSeek={playback.seek}`、暂停/续播/结束重播和 Score engine seek 仍完整。若 K0 本身未纳入已确认用户进度，报告总控基线缺口，不自行抄脏目录。
3. 用 `rg` 在最终 BASE 找到两个 `/me` 提示与全部可见登录旧名称。调研目录存在刷新提示，但未命中用户提到的完整“上次链上确认”字符串；它可能在总控选入的新版或服务端响应中。追到真实 props/响应来源再处理，不能新增该旧句来凑测试。
4. 定位首页实际导出。调研时 `app/page.tsx` 重导出 `app/test3/page.tsx`，导航位于 `src/components/pond-gl-test3/overlay/PondHeader.tsx`。核对 BASE 是否仍如此。
5. 定位 Score 背景变黑的实际消费者、输入信号与复位路径，记录符号和文件。调研时 Score 依赖 `isPlaying` 条件挂载 `GlEclipse`、开关 `glSpheres`，并立即清 `playingIdRef`；这只是本地证据，不能直接认定生产根因。
6. 优先复用已有复现证据；只有静态定位与既有证据不足以确定问题时，在同一环境做一次必要复现，覆盖受影响的网络宽度、状态消失、焦点或 Score 结束场景，不重演已明确的问题。记录必要的视口、路由、真实数据标识（脱敏）和版本；数据不同造成的行增删不归因于提示文字。
7. 在统一 `p15-x-handoff.md` 的基线小节简记路径映射、需保护能力、问题证据/未复现项、文件白名单与接线项。仅需修改少量白名单组件，不顺手修历史债务。

**失败恢复**：目录/BASE 不符则停止代码写入，向总控报告该步骤 `blocked`，原因是共同基线尚未确认；源码路径迁移时读真实调用者更新本线定位表。没有登录权限或浏览器仅挂起对应复现，仍可做静态定位；不造账号数据、不发生产铸造。

**定向验证**：保留清单与相对总控记录的完整 BASE SHA 的路径级 diff 对照，确认没有意外删除 seek；命令中的 SHA 必须替换成运行清单的真实值，不把 `BASE_SHA` 当成已有分支名。确定每项问题至少有实际入口、状态来源和接收组件。文字搜索无结果要如实写未定位，不能等同问题不存在。

**完成证据**：handoff 的基线小节含 BASE、真实路径/符号、用户改动保护表、复现或 pending 原因，标 X0 完成；不另建基线报告。

**自动下一步**：X1。若 X1 的真实场景暂缺而静态路径可定位，照方案实现并把浏览器断言留 X7；不得宣称已实测。

## X1 — 网络切换布局稳定

**输入依赖**：X0 完成；OP/ETH 是否开放使用既有 capability，不能为了验收强行开放未部署 ETH 网络。

**实际文件与符号**：

- `src/components/mint/MintNetworkSelector.tsx`：`displayName`、`detailsRef`、summary/trigger/menu。
- `src/components/mint/mint-network-selector.css`：`.mint-network__trigger`、summary、option grid。
- `src/components/me/archive/ArchiveHeader.tsx`、`archive.css`：`.me-archive__nav`、`__account`、`__network-control`。
- 若 BASE 仍有可切双路线的弹层，检查 `MintChoiceDialog.tsx` 中 `choice === 'eth'` ledger 和 `mint-choice.css`；调研时 `/me` 主要 caller 传 `lockedChoice="eth"`，不能无证据改造全部弹层。

**具体操作**：

1. 将 trigger 内“标记 / 标签 / 箭头”改为稳定三列。标签列由本次可选最长标签决定宽度：优先同一 grid cell 中放真实候选的不可见测量文本，`aria-hidden`、不可聚焦；当前标签在同格显示。不要用“OP”变长“Ethereum”时再动态动画宽度的方案。
2. 测量文本只参与尺寸，不创建第二个交互控件，不给屏幕阅读器重复读网络。两状态都保留箭头、选中标记的列宽。
3. 页头按断点固定布局规则：窄屏允许 account 区从一开始就占独立一行；不能只在 ETH 被选中时才折行。地址可显示既有缩写，完整网络名称仍能读到。约束 `min-width:0` 和可用宽度，不以裁掉费用/合约信息换稳定。
4. 若同一弹层内部存在 OP/ETH 切换：两版说明置于共享 grid area，由最长版参与容器高度测量；非活动版禁用、不可聚焦、从 accessibility tree 隐藏，不运行它的 fetch/交易 effect。避免重复挂两个完整 `MintChoiceDialog`。底部操作区与费用行的“读取中→结果”使用预留行位。
5. 网络错误、余额不足、用户展开详情属于显式状态变化，可显示信息；常规切网不触发整页缩放、滚动位置重置。修布局时保留原 `onChange`、disabled、Escape 回焦和链选择状态。

**失败恢复**：若窄屏无法容纳完整标签，按固定断点改为两行页头，保留同一断点两链等高；不要不断加巨大的全局 `min-height`。若 ledger 层占位造成隐藏控件仍可 Tab，改为纯展示测量层，回归活动表单唯一实例。

**定向验证**：修改的 TS/TSX 做文件级 ESLint，已有结果留给 X7 复用。X7 在同一次会话用桌面 1440×900 与窄屏 390×844 对照 OP→ETH→OP 后 trigger、account、下一块正文边界。字体、视口与数据不变时锚点差值 ≤1 CSS px；菜单不挤正文，无横向溢出。200% 字体/缩放只补本次改变的标签容器，确认两网络换行规则一致、信息完整，不再扩成设备矩阵。

不要用 CLS 单独判定点击切换：`hadRecentInput` 的位移可能被 CLS 排除，必须核对锚点矩形。三次切换用于确定性检查，不计算 p95。

**完成证据**：handoff 的 X1 验证行记录选择器、两视口锚点差值、链能力未变化；BASE 没有可用 ETH 会话则真实钱包验证留 `external_pending`，组件条件覆盖不得冒充主网验证。

**自动下一步**：X2。

## X2 — `/me` 刷新与持有人核对提示

**输入依赖**：X0；实际 `ArchiveSlice`/Echo warning 的含义保持原样。读取数据 hooks 默认只读。

**实际文件与符号**：`ArchiveSection.tsx` 的 `(refreshing || error || warning)` 条件块、`MeArchivePage.tsx` 的 `warning={echoes.warning}` / `recordings.phase` / `materials.cached`、`archive.css` 的 `__header` / `__notice` / `__body`；读取 `src/hooks/me/useMeArchive.ts`、`useOwnedEchoes.ts` 定位来源。

**具体操作**：

1. 先分类：后台 refreshing 是非阻断进度；缓存 ownership 尚未核实是真实性说明；错误与不完整列表警告必须可见。不要将所有 `warning` 都当作可隐藏的“正在刷新”。
2. 默认将非阻断状态放入分区标题的固定状态格，标题/数量/状态都占稳定 grid 列，窄屏状态格固定在第二行；完成后清文字但保留该格尺寸。使用简短“更新中”“持有人核对中”，完整说明通过可聚焦说明入口或描述提供；不再插入、移除一整条正文行。
3. ownership 未核实期间保留简短标识及完整说明，核实失败保留“暂无法核实”与重试；缓存记录不能出现“当前持有已确认”假象。普通完成状态不在空格里不断播报。
4. `aria-live="polite"` 的 region 本身常驻，内容变化只播报一次；警告详情与真实 error 明確保留。错误恢复也应复用预留状态格；较长异常说明可由用户展开，展开属于有意布局变化。不能 opacity=0 后仍保留可 Tab 的重试按钮。
5. 调整 `.archive-section__header > span` 等旧选择器，避免新状态容器误用计数字体。首次加载的 section shell 和完成后的标题状态格等高；已有骨架只在真实数据到来时替换，不能通过空白遮罩掩盖档案。
6. 所有提示都消失后，正文的首条记录与下一分区位置保持不变。实际新增/删除资产、分页、用户展开错误详情可正常调整布局，证据中与“纯状态切换”分开。

**失败恢复**：遇到后端长文案不适合内联，保留短状态和完整详情入口；不得截断后丢失原因。若必须改变数据状态字段，则先写总控接线请求，不重写私人缓存或 ownerOf 查询流程。身份切换仍由原 hook 管理，不在 UI 留住上一用户数据。

**定向验证**：检查 ready→refreshing→ready、cached-owner→verified、cached-owner→error→retry 的可见语义与 `aria-live`；X7 在同一批记录、同一页码条件下测第一行 top 和下一 section top，纯状态变化差值 ≤1 CSS px。检查 390px 不遮住标题/数量，无隐藏可聚焦按钮；无缓存→骨架→真实数据作为单独加载场景，不把数据数量变化误报为状态回归。

**完成证据**：handoff 的 X2 验证行记录状态语义、占位和错误重试结果，复用同一会话锚点测量。若只能覆盖组件状态、未取得真实 ownership 响应，明确记录范围。

**自动下一步**：X3。

## X3 — 首页导航与焦点

**输入依赖**：X0 的入口定位和焦点来源证据。P17 曲目入口不在本 Step 接入。

**实际文件与符号**：`PondHeader.tsx` 的 `PublicLinks`、`useOwnedEchoes`、`echoLabel`、菜单；`LoginModal.tsx` 的打开/关闭 focus effect；只读 `useKeyboard.isEditableTarget`。如需新增页面级 helper，放 `src/components/pond-gl-test3/overlay/experience/use-home-entry-focus.ts` 并从 `PondHeader` 接入。

**具体操作**：

1. 删除 desktop/mobile 共同 `PublicLinks` 的 `/me#pond-echoes` 链接、`echoLabel` 参数/推导，以及只为导航运行的 `useOwnedEchoes`/`useAuth` 调用和 imports。保留 `LoginButton`；保留 `/me` 内 Echo 记录、hash 兼容和 ECHO 播放入口。
2. 复核 focus 来源：当前 header 没有显式 `.focus()`；不能把“删除第一链接”当作焦点 bug 已修。检查登录弹层 cleanup、路由进入、bfcache 恢复和运行时默认聚焦行为，记录哪条路径实际把 anchor 设为 `activeElement`。
3. 修在已定位源头：首次加载不聚焦导航；指针进入首页只清除可证明是旧页面/已关闭弹层自动恢复的焦点，或一次性把焦点还给现有非控件的页面容器，`preventScroll`。清理必须在用户第一次实际输入前、且仅针对此次进入发生；禁止每次 render/数据更新调用 `blur()`。
4. 若登录关闭需要区分输入方式，打开时记录 pointer/keyboard 来源：键盘打开后关闭恢复触发按钮，保留 Tab/Enter/Space 使用；指针打开并返回水塘时不强迫恢复会阻止演奏的按钮焦点。不得删除弹层内部 autofocus、验证码输入 focus 或 focus trap。
5. `focus-visible` 样式保留；不全局设 `outline:none`，不删所有 `tabIndex`，不将演奏快捷键透传到输入框、按钮、链接、dialog。用户主动 Tab 后按 Enter/Space 应执行控件行为。
6. 对当前首页第一下演奏键验证实际 handler 被调用且有动效，不要求额外 pointer 点击。记录键、event target 和 activeElement；仅 DevTools 合成事件不足以证明浏览器的真实键盘焦点行为。

**失败恢复**：若不明原因 focus 发生在本线以外共享 provider，提交路径和调用栈请求，不加入全局 blur 定时器。删除链接可以独立 `code_ready`，焦点断言保持 pending，继续 X4；不得用隐藏黄框冒充按键可用。

**定向验证**：X7 一次会话覆盖硬刷新首页、从 `/me` 返回、浏览器后退、指针打开登录再关闭、Tab 打开登录再关闭。自动场景进入后 `activeElement` 不为被自动选中的导航/按钮，直接 A 键触发一次；主动 Tab 焦点可见，输入框打字不演奏，菜单 Escape 正常。检查首页不再因该导航调用 Echo API，其他真正需要 Echo 的模块仍可正常调用。

**完成证据**：handoff 的 X3 验证行记录导航删除范围、焦点来源/修复点、各入口 activeElement 与按键结果，标明 `PondHeader` 最终状态。并行时先合入 P17 曲目链接，再在 K2 一次验证首页首键/Tab；若该链接在已验后才变动，仅补受影响断言。

**自动下一步**：X4。

## X4 — 登录名称统一

**输入依赖**：X0；用户已确认名称，无需再等待文案确认。

**实际文件与符号**：`SemiLogin.tsx` 的步骤标题、未注册提示和注册链接；`WalletLoginOptions.tsx` 的主按钮与说明；`LoginModal.tsx`、`LoginButton.tsx` 和 `MeArchivePage.tsx` 可见身份名称按实际命中调整。

**具体操作**：

1. 可见名称统一为“SEMI社区身份”“链上地址登录”；标题示例为“01 · SEMI社区身份”，按钮为“链上地址登录”。注册提示自然改为“尚未注册 SEMI社区身份”，链接为“注册 SEMI社区身份”。
2. 保留“连接钱包”“请在钱包中签名”“钱包余额”等描述真实操作的词，不机械将所有“钱包”替换成“身份/地址”。`authSource='semi'`、`loginEntry='external_wallet'`、env、API 和错误 code 均不改。
3. 检查窄屏按钮不会因新文案换行拉高周边区域；aria-label 如重复旧称谓一起更新。项目以外 SEMI 官方产品名/链接保持真实，不擅改外部域名。

**失败恢复**：若旧名称由 provider 外部 SDK 注入，本线只改自有界面，报告外部可见残留；不要扩展成登录 SDK 配置重构。UI 变窄按现有 button grid 调整，保留触控尺寸。

**定向验证**：`rg -n 'Semi.*钱包|SEMI.*钱包|链上钱包登录' src/components/auth src/components/me`，逐项判定剩余是否操作描述/代码注释；修改文件 lint 结果交 X7 复用。仅名称变更不独立开浏览器；已有 X7 会话顺带核对新文案排版即可。无需发送验证码或真实钱包签名。

**完成证据**：handoff 的 X4 验证行列旧→新可见文案与保留的操作词；无 API、权限或数据字段变更。

**自动下一步**：执行 [X5](20-playback-share-acceptance.md#x5--score-退场与背景恢复)，不转入旧 P15 全量计划。
