# P15-X — 唱片退场、分享与定向验收

> 前置：[X0–X4](10-layout-focus-identity.md)。共同约束：[总控](../../parallel-2026-10/00-orchestration.md)、[共享合同](../../parallel-2026-10/10-shared-contracts.md)。
> 本文件操作现有 Score 页面；P17 的单曲播放器与资产清单由 P17 实现，总控统一接线。

证据位置遵循 [总览第 5 节](00-overview.md#5-证据与恢复规则)：常规结果只记一份 lane handoff，必要附件可引用现有证据，不逐步另写报告。X5/X7 的视觉断言并入 K2 同一次集成会话；单独执行本线用本次必要会话即可，不要求启动总控全套。

## X5 — Score 退场与背景恢复

**输入依赖**：X0 最终 BASE 上的背景变黑路径、已保留 seek 进度、实际播放状态类型。X1–X4 的结果不是本 Step 的代码前提。

**实际文件与符号**：

- `app/score/[id]/components/ScorePondScene.tsx`：`isPlaying`、flags、条件挂载 `GlEclipse` 与 ScoreRecordAnchor。
- `use-score-pond-sim.ts`：`playingIdRef`；`ScoreRecordAnchor.tsx`：`anchorState`、`perform`、`PlaybackSeekBar`。
- `app/score/[id]/score-page.css`：Score 限定的 record/eclipsed 样式与 reduced-motion。
- 计划新增 `components/experience/use-score-visual-transition.ts`：视觉状态和退出清理；该模块不 import 音频引擎或修改其时钟。
- 只读 `src/components/pond-gl-test3/overlay/GlEclipse.tsx` 的 rAF/opacity、`src/components/p11/RecordAnchor.tsx` 的 `data-visual`、`src/styles/p11-primitives.css` 的 opacity/transform，以及 X0 定位的共享背景消费者。

### 具体操作

1. **分离真实播放状态与展示生命周期。** 音频继续使用 `playback.state`、`positionMs`、`durationMs`；展示使用 `idle → entering → active → exiting → idle`。将自然结束、暂停、错误、重播、路由卸载列成事件表。不得为了多留一段动画，把 ended 改回 playing、延长音频或延迟按钮状态。
2. **退场时保留可画对象。** 移除仅 `isPlaying && <GlEclipse>` 的立即卸载门。ready 页面可保留唯一 overlay 实例，退出完成后才回收相关显示资源；不能第二次挂 `GlEclipse`/Canvas。记录最后的合法投影/姿态，播放 id 消失时不让日食先消失再淡出。若需要独立展示 ref，页面侧提供只读展示用 `GlSim` 适配，保留真实播放 ref 给原逻辑；不能把“仍在退场”冒充“仍在播放”。
3. **统一过渡参数。** 默认入场 450ms、退场 650ms，允许用户早晨在 450–900ms 内调整退场。同一事件起点驱动日食 opacity `1→0`、唱片 opacity `0→1`，唱片 scale 连续回到 1，不改变布局盒。页面用 `data-score-visual-phase`/CSS 变量限定覆盖共享 primitive，保留真实 state/aria-pressed。reduced-motion 使用即时或 ≤100ms opacity，不做缩放运动。
4. **背景恢复。** 先复用最终 BASE 中首页已平滑工作的静息水塘/黑色混合通道。停止时将目标设为恢复水塘，让现有渐变值走完；混合未结束前不卸载消费者、切换 Canvas key、重建材质或把 flags 整块关掉。背景和日食退出从同一状态事件启动，背景在退出完成时到达静息值。
5. **需要共享改动时提前接线。** 若 Score 页面无法通过既有参数触发该混合通道，在实现独立显示 hook 后立刻向总控提交下表请求。不得给整个 WebGL Canvas 淡出，导致 P9 余韵一起消失；不得复制水塘渲染器或擅自修改共享 shader。对应背景子项写明等待共享接线、尚未验收，继续 X6，等待总控提供最小接线后补该子项。
6. **可中断过渡。** 退出期间再次播放，从当前混合值连续转向 active，取消旧的 transitionend/定时器。回调带 generation/token 防旧退出清理新会话；只处理本层预期的 `opacity` transitionend，附一个有界超时兜底。页面卸载立即清 rAF/listener/timeout，不等待 650ms；路由切换后不能回调旧 DOM 或把全局 P9 状态留脏。
7. **保留 seek。** `ScoreRecordAnchor` 继续使用原 `playback.seek`；运行中 seek 不触发错误的结束动画，seek 到结尾按真实 ended 退场，暂停后 seek 不应自行播放。结束后 replay 恢复现有会话行为，音频和 P9 不建立第二个调度时钟。

### 总控接线请求格式

| 字段 | 必填内容 |
|---|---|
| 请求 ID | `P15-X5-background` 或 `P15-X5-eclipse-retention` |
| 位置 | 最终 BASE 的实际文件和符号，不只写“PondGL” |
| 当前输入/问题 | 例如播放 id 置空导致静息混合立即复位，附调用链 |
| 最小接口 | 展示 active/target 及 exitMs；如果消费者已有混合时钟则仅传目标，不建立第二个竞争时钟 |
| 默认兼容 | 新参数不传时保持其他页面当前行为；P14-H、P17不直接写该文件 |
| 输出与断言 | 背景恢复连续、日食姿态保留、P9余韵可见、Canvas 实例数不增加 |
| 集成说明 | 本线哪个组件调用、哪些子项等待、定向验证入口 |

请求写入 `reviews/evidence/parallel-2026-10/<runId>/p15-x-handoff.md`，总控单写后返回完整 commit SHA 与接口，并进入本线 `dependsOn`。若最终 BASE 已提供接口，记录复用证据直接继续，不为格式制造等待。

### 失败恢复、验证与完成

**失败恢复**：若出现无声但“暂停”按钮、双声或 seek 回退，先回退本线对实际播放 state/handler 的误改，保留显示逻辑隔离；禁止修改 engine 或永久 manifest 救绿。共享渲染缺接口只挂起对应子项；无法读取 Arweave 真资源时不重传，记录媒体不可用并继续静态/状态转换检查。

**定向验证**：

- hook 行为检查覆盖 play→ended、play→pause→play、退出中 replay、seek 到结尾、卸载，断言旧回调不能覆盖新状态。复用现有测试方式；若需要测试文件，放 experience 子目录，用已有 `tsx`/Node 运行，不安装测试框架。
- X7/K2 的同一次会话使用真实可播放 Score，seek 到最后约 3 秒，等待一次自然结束；用一段短录屏或必要首/中/尾帧确认日食保留到淡出后、唱片 opacity 连续上升、背景无单帧整块替换。不要同时制作多套截图、录屏与逐帧报告，不能只看 React state 就声明视觉已通过。
- 同一会话完成 pause/resume、退场中 replay、paused seek、离开页面与 reduced-motion；本次触及 GL fallback 显示分支时才补该断言。确认音频数量、按钮、进度条与 BASE 一致；媒体无法加载则记 pending，不用假音频表示完成。不重听完整四分钟，也不为视觉修复重做网关/断站验收。

**完成证据**：handoff 的 X5 小节简记状态测试、参数、retention/cleanup 路径、绘制证据引用和 seek 保留结果。背景需要总控接线但未合入时，X5 不得写整体已通过或 `integration_ready`。

**自动下一步**：X6；若部分等待总控，带着明确依赖继续 X6，X7 统一列出。

## X6 — 分享文案与链接

**输入依赖**：X0；`ScoreReadyData.creatorAddress`、当前已认证身份地址、`canonicalPath` 的实际数据。仅文案最终选择可留到早晨，不阻塞实现。

**实际文件与符号**：`app/score/[id]/components/ShareActions.tsx` 的 `canonicalUrl`、`shareText`、`openIntent`、copy；`ScorePondScene.tsx` 已通过 `buildScoreRoute(score.chainId, score.contractAddress, score.tokenId)` 构造地址。按职责需要使用 `components/experience/share-copy.ts` 存 B 版文案与纯生成函数，不把候选库写入运行时；只读 `src/hooks/useAuth.ts`、`src/data/score-source.ts`、`src/lib/chain/chain-registry.ts`。

### 三组候选（仅文档供选，默认实现 B）

| 方案 | 分享者 | X／推特 | 微博 |
|---|---|---|---|
| A 随手创作 | 作者 | 在水塘里随手弹了一段，录下来了。来听听。 | 本来只是想听首歌，后来跟着弹了一会儿，就留下了这段录音。分享出来，想听听你们的感觉。 |
| A 随手创作 | 旁听者/收藏者 | 在水塘里发现一段即兴，想分享给你。 | 听到一段想分享的即兴演奏。有人在这首底曲上留下了自己的声音，你也来听听。 |
| B 邀请回应 | 作者 | 这是我今天留在水塘里的声音。换你，会弹成什么样？ | 同一首底曲，每个人都能留下不同的声音。这是我的这一版。你也可以进去弹一段，我很想听听你的版本。 |
| B 邀请回应 | 旁听者/收藏者 | 听到这一段，很想知道换你会弹成什么样。 | 发现一段有意思的即兴演奏。同一首底曲，换个人会留下怎样的声音？把它分享给你，也想听听你的版本。 |
| C 留住片刻 | 作者 | 把刚才那几分钟，留成了一张唱片。 | 有些声音当时觉得普通，回头听却很喜欢。我把这段即兴留成了一张唱片，分享给你。 |
| C 留住片刻 | 旁听者/收藏者 | 有一段声音，想让你也听见。 | 今天听到这段录音，想把它留在这里，也分享给你。戴上耳机听听，看看你会想到什么。 |

每条追加一行真实曲名 `《trackTitle》`，链接通过平台独立 URL 参数添加，不把同一链接重复写入 text。用户未明确拥有收藏时不能自称“我收藏了”。候选可按实际时长调整“几分钟”措辞，不能向几秒录音承诺数分钟；保守默认 C 作者短版可用“把刚才那段声音，留成了一张唱片”。

### 具体操作

1. 三组候选只保留在上表供用户选择；代码默认仅实现 B 的 `author/listener`、`x/weibo` 四种措辞。不做候选查询参数、开发/生产分支、运行时切换入口或三套预览测试。用户以后选 A/C 时只替换对应文案，不提前开发选择器。
2. `ShareActions` 接收 `creatorAddress` 或经过清晰定义的身份输入，复用现有 `useAuth` 的已认证当前身份。只有已知 creator 与已认证地址规范化后一致才用 author。未登录、地址未知、creator 缺失、只有 `currentHolder` 相同、持有转让得到的作品，都走 listener。钱包连接但没有认证不算作者身份；不要仅比 Token holder。
3. 两个平台使用各自文案；X intent 的 `text` 与 `url`、微博的 `title` 与 `url` 各编码一次。保留现有打开方式、复制反馈和可用的海报行为。测试只检查打开目标，不在外部平台实际发布。
4. 分享目标继续来自 `buildScoreRoute`。OP legacy 和多链 full route 使用其既有兼容规则；ETH 缺 `canonicalPath` 时不能静默降级成 `/score/{tokenId}`，应禁用相关分享并提示链接暂不可用。creator 身份只用于措辞，不能影响实际资产 URL。
5. `NEXT_PUBLIC_APP_URL`/origin 按现有部署策略生成规范绝对 URL，保护全路径、合约、Token；测试对同 tokenId、不同 chain/contract 生成不同 URL。禁止从钱包当前连接的链推断作品链，不能硬编码 OP 地址。
6. 本 Step 不修改 P17 原曲页面文案，也不另建音乐资产清单。handoff 写出可供 P17 后续复用的纯函数接口；若原曲调用，需独立 original 类型文案，不能把一首原曲称为分享者即兴。

**失败恢复**：作者字段不可验证时默认 listener 并继续；不新增服务端权限查询。BASE 的链感知路由助手不覆盖某种资产时写总控请求，保留其合法现有分享入口，未知资产不拼假链接。第三方平台不可访问只阻断实开结果，URL 编码与生成测试可先完成。

**定向验证**：只验证 B 的 2×2 文案、作者未知/holder≠creator、引号/中文/`&`/换行曲名编码一次；URL 用例保留 OP、ETH、同 tokenId 异合约。复用既有纯函数测试，必要时用已有 `tsx`，不新建测试框架。X7 的既有会话仅确认按钮实际接入正确目标与复制功能，不逐候选重复打开外部平台、不发帖。

**完成证据**：handoff 引用本页候选表，注明“默认实现 B，其余待用户选择”，附作者判定与链感知 URL 测试结果即可；不生成预览页、独立候选报告或私人身份凭证。

**自动下一步**：X7。等待晨验文案选择不阻断 code_ready。

## X7 — 验收与交接

**输入依赖**：X1–X6 的本线结果、总控共享接线状态、同一验证环境。若某子项外部条件不足，列清范围后完成其余可验项。

**实际文件与符号**：所有实际修改的白名单文件及唯一 `p15-x-handoff.md`；必要动态附件可放 `p15-x/` 或引用既有位置。不编辑全局状态或其他 Phase 报告。

### 具体操作

1. 对照 BASE 与 X0 保留表审查 diff，确认 `PlaybackSeekBar`、`playback.seek`、pause/replay、链路由、身份校验未被丢弃；确认未修改共享白名单外文件、未新增依赖/迁移/外部写入。
2. 只补缺失或受本次改动影响的 type check、修改 TS/TSX 文件的 ESLint 和行为测试。相关源码、依赖与环境未变时复用已有结果，无关 commit 不使证据失效。确有必要的命令示例：`npx --no-install tsc --noEmit`、`npx --no-install eslint "src/components/mint/MintNetworkSelector.tsx"`；lint 按实际修改列表展开，Bracket 路由正确引用。仅文案不重跑状态测试；CSS 用 diff 与相关视觉断言，不新增工具链。
3. `git diff --check`；代码硬线与单层文件数遵循执行时仓库规范，新模块优先 ≤200 行。原有全仓错误记录 BASE 对照，只修本线导致的失败，不删测试、不降规则。
4. 下方断言是 K2 同一次集成会话中的 P15-X 部分，与 H6 及同批其他页面视觉检查合用；不先跑本线全套再跑总控全套。等待集成时可交 code_ready，明确“视觉待 K2”，不可提前标通过。单独跑本线则在本次必要会话完成，无需总控全套。已有有效证据直接引用，失败只补相关断言；浏览器不可用则记 pending，不反复建立环境。
5. 汇总一个总控可消费的 handoff：改动与 commit 清单、每项状态、共享接线请求、实际启动端口与路由、真实媒体样例、分享候选、人工选项。若本线获准提交，只提交已核对的本线文件；不修改/提交最初脏目录，不执行部署。

### 一次组合 smoke 的断言

| 场景 | 操作 | 通过条件 |
|---|---|---|
| 网络 | 同一登录数据下 OP→ETH→OP | 页头/正文锚点 ≤1px；菜单不占文档流；未改变网络权限 |
| `/me` 刷新 | 原记录不变，等刷新提示出现再消失 | 状态格等高，首记录/下一分区 ≤1px，旧 ownership 仍被诚实标注 |
| `/me` 错误 | 真实失败或受控接口故障测试后重试 | 可读错误、可达重试；不串身份、不误显示空列表 |
| 首页直接进入 | 硬刷新与 `/me` 返回，直接真实 A 键 | 无导航被自动框选，首键触发动效一次 |
| 键盘可访问性 | Tab、Enter/Space、登录输入、Escape | 主动焦点可见；控件/输入不会误演奏；键盘关闭弹层恢复合法焦点 |
| 新名称 | 打开登录、查看注册提示 | 两个名称准确，网络钱包操作词仍有意义 |
| Score 结束 | 真实录音 seek 到末尾前约 3 秒后自然结束 | 水塘背景恢复、日食淡出、唱片淡入连续；按钮/进度反映真实结束 |
| Score 中断 | pause/resume、退出中 replay、paused seek、离开 | 无双声、旧回调、卡住黑屏；seek 能力保持 |
| reduced-motion/fallback | 同一页切偏好；本次影响 GL 兜底才补其显示断言 | 控件始终可用，无依赖完整动画才解锁；无需重建浏览器环境 |
| 分享 | 核对 B 版 X/微博按钮目标与复制链接 | 作者/旁听者正确，中文编码正确，完整链/合约链接；不实际发帖 |

主验证桌面 1440×900；窄屏 390×844 只补受影响的网络、状态格、名称与分享菜单布局，不在两视口复制整张表。无需专项性能采样、跨钱包铸造或 Foundry。布局观测同时看矩形与画面；CLS 只能作补充。只授权部分 Step 时仅验该范围及其直接回归，不扩成六项全测。

### 失败恢复与交付状态

**失败恢复**：定向检查失败时只重跑失败层。总控尚未合入共享接口时写明依赖 SHA/接线项，不标 `integration_ready`；缺真实会话、网关不可用导致未验则写该项 `external_pending`，具体到断言。需要用户审美或候选选择单列“待用户验收”，不要把“用户尚未看”说成代码失败。

**完成证据**：handoff 的六需求映射表不能有模糊“基本完成”；逐项注明代码、静态验证、浏览器证据、集成与人工状态。列 1–3 个最关键实现符号供总控最终走读，不要求用户夜间复述。

**自动下一步**：并行时交回总控，未验的视觉断言留 [联合验收](../../parallel-2026-10/30-acceptance.md) 的同一次 K2 会话；已经在 K2 验过的不再重跑。P17 曲目入口优先在该会话前合入，若后续变动只补首页首键/Tab。单线交付本次结果即结束；不自动启动旧 P15、其余 Phase、部署或 SEMI 消息。
