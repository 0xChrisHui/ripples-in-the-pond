# P15-X — 布局、焦点与唱片退场体验修复

> 计划日期：2026-10-02。状态：执行计划，尚未执行本批次功能开发。
> 交付终点：六项体验需求有可独立集成的代码、定向证据和早晨验收入口；三套分享候选只留在文档，默认只实现 B“邀请回应”。
> 本批次属于 P15 的局部修复，不代表原 P15 七轨完成。

## 1. 启动前合同

四线并行时先读 [四线总控](../../parallel-2026-10/00-orchestration.md)、[共享合同](../../parallel-2026-10/10-shared-contracts.md)、[启动提示词](../../parallel-2026-10/20-launch-prompts.md) 和 [联合验收](../../parallel-2026-10/30-acceptance.md)。单独执行本线时，只核对安全工作目录、必要基线及已有改动保护，不要求启动其余三线或完成总控全套；下文总控接线由本次执行者在授权范围内负责。

- 四线并行时，只有总控完成 K0、交付共同 `BASE_SHA` 和本线独立 worktree/branch 后，worker 才开始开发。worker 不在原脏目录施工，不自行创建 worktree、stash 或搬运未提交文件。单线执行记录当前安全基线即可，不为形式额外创建工作树。
- 调研时本地 HEAD 为 `3c5fa6f`，与缓存 `origin/main` 分叉 15/155；缓存远端不是实时生产证明。下列路径是定位线索，必须在 K0 最终基线上复核，不能把本地文件、HEAD、生产实现当成同一份。
- 总控必须给出已保留的用户改动清单，特别是 Score seek、播放引擎、全局播放器、唱片控件和 CSS。缺失时在受影响项写 `blocked` 和“共同基线尚未确认”的原因，不从旧版本覆盖这些功能；独立文案/方案整理仍可继续。
- 默认夜间终点是本地可验收。发布、生产写入、主网交易、永久上传、外部联系都不是本批次必要操作。
- `STATUS.md`、`TASKS.md`、`docs/JOURNAL.md`、`docs/ARCHITECTURE.md`、`docs/STACK.md`、`package*`、部署配置和 migration 分配由总控单写。本线状态、决定、错误记录到 `reviews/evidence/parallel-2026-10/<runId>/p15-x-handoff.md`，不修改这些全局文件。
- 本计划撰写任务只生成 Markdown。本计划中的代码文件、测试和证据目录是未来执行产物，不能把它们的存在或通过当成本次编写结果。

## 2. 产品范围与默认值

| 需求 | 本批次结果 | 关键约束 |
|---|---|---|
| 1：OP/ETH 切换跳动 | 切换选项、说明和按钮不因文字长短伸缩 | 完整保留费用、网络、接收地址与错误信息 |
| 2：`/me` 刷新提示跳动 | 状态文字退出时不收回正文占位 | 不能把旧持有记录误写成当前已核实 |
| 3：首页回声入口与焦点 | 移除导航及该处专属请求，首页初始无被框选控件，第一下演奏按键有效 | 保留 `/me` 的回声档案、主动 Tab 焦点和弹层内键盘操作 |
| 4：分享文案 | 三套候选在文档供选择；代码仅实现 B 的作者/旁听者、X/微博文案 | 不做候选切换或开发预览功能；后续选择只替换文案，链接保留链与合约身份 |
| 6：Score 结束突变 | 背景恢复、日食退场、唱片出现协调渐变 | 只改显示生命周期，音频状态、seek、配方与永久资源不变 |
| 7：身份命名 | “SEMI社区身份”“链上地址登录” | 保留 auth source、连接、签名与权限语义 |

P14-H 管第 36 枚访客运动，P17 管曲目馆/原曲资产，P13 管 SEMI 接入。本线不重做这些功能。P17 的“曲目”导航由总控在本线完成 `PondHeader` 后接入；本线交接时保留该接线项。

## 3. 文件所有权

所有代码路径相对仓库根；本仓库页面在 `app/`，不要新建平行的 `src/app/` 页面。

### 本线可直接修改

| 领域 | 文件/范围 |
|---|---|
| 网络布局 | `src/components/mint/MintNetworkSelector.tsx`、`mint-network-selector.css`、`MintChoiceDialog.tsx`、`mint-choice.css`，以及下列 `/me` 组件中的布局接线 |
| `/me` 呈现 | `src/components/me/archive/ArchiveSection.tsx`、`ArchiveHeader.tsx`、`MeArchivePage.tsx`、`archive.css`；必要时 `app/me/loading.tsx`、`app/me/me-pond.css`，仅调整已定位的状态区域 |
| 导航、身份 | `src/components/pond-gl-test3/overlay/PondHeader.tsx`；`src/components/auth/{SemiLogin,WalletLoginOptions,LoginModal,LoginButton}.tsx`；`src/components/auth/auth-dialog.css` |
| 现有 Score 显示 | `app/score/[id]/components/{ScorePondScene,ScoreRecordAnchor,ShareActions}.tsx`、`use-score-pond-sim.ts`、`app/score/[id]/score-page.css` |
| 本批次独立辅助模块 | `app/score/[id]/components/experience/`：计划新增 `use-score-visual-transition.ts`、`share-copy.ts`、对应必要测试；导航辅助放 `src/components/pond-gl-test3/overlay/experience/`，不占满已有目录 |
| 证据 | `reviews/evidence/parallel-2026-10/<runId>/p15-x-handoff.md` 与该 run 下 `p15-x/` 子目录，本线独占 |

调研时 `ScoreRecordAnchor.tsx` 与 `score-page.css` 已有用户未提交修改。本线拥有修改权不等于可覆盖这些修改，必须先完成 X0 的保留清单与语义核对。

### 只读或通过总控接线

- `src/components/player/PlayerProvider.tsx`、`src/lib/chain/chain-registry.ts`：总控单写。
- `src/components/pond-gl-test3/PondGL.tsx`、`spheres/`、`water/`、`overlay/GlEclipse.tsx`、P9 runtime：共享渲染边界，总控单写；本线先用页面侧组合，必要变更按 X5 的接线格式提交。
- `src/components/p11/RecordAnchor.tsx`、`src/styles/p11-primitives.css`：共享 primitive，本线默认只读；使用 Score 页面限定 CSS。若必须加可选展示属性，提交总控，不让新原曲播放器受隐式行为变化影响。
- `src/hooks/useKeyboard.ts`：只读调查输入过滤，不能全局取消链接/按钮的键盘保护来修焦点。
- `src/features/score-playback/`、`src/components/common/PlaybackSeekBar.tsx` 及样式、`src/score-decoder/index.html`：本批次只读，保护已存在的 seek、资源加载与永久播放行为。
- P17 唯一维护 `src/lib/music-catalog/asset-registry.ts`。本批次分享现有 Score 使用既有 `buildScoreRoute`，不创建第二份地址表，不修改新原曲路由。

发现必要文件超出白名单：在 handoff 写“接线请求”，包含路径、符号、输入输出、依赖 Step、验证断言。worker 不抢写；继续其他不依赖步骤。总控回传接线 commit 后，按总控规定的增量方式接收，禁止整枝互相 merge。

## 4. 执行顺序

| Step | 任务 | 依赖 | 执行文档 |
|---|---|---|---|
| X0 | 校准基线、保护既有进度、建立定向证据入口 | K0 | [布局与焦点](10-layout-focus-identity.md#x0--基线与现状核验) |
| X1 | 稳定 OP/ETH 切换区域 | X0 | [布局与焦点](10-layout-focus-identity.md#x1--网络切换布局稳定) |
| X2 | `/me` 非阻断状态不再收缩布局 | X0 | [布局与焦点](10-layout-focus-identity.md#x2--me-刷新与持有人核对提示) |
| X3 | 首页入口删除与焦点修复 | X0 | [布局与焦点](10-layout-focus-identity.md#x3--首页导航与焦点) |
| X4 | 身份名称统一 | X0 | [布局与焦点](10-layout-focus-identity.md#x4--登录名称统一) |
| X5 | Score 退场与背景过渡 | X0；共享接线仅阻断相关子项 | [播放、分享与验收](20-playback-share-acceptance.md#x5--score-退场与背景恢复) |
| X6 | 分享候选、作者区分和链接 | X0；现有 Score 路由/作者数据可用 | [播放、分享与验收](20-playback-share-acceptance.md#x6--分享文案与链接) |
| X7 | 一次定向验收、可集成交接 | X1–X6 已完成或逐项列明阻塞 | [播放、分享与验收](20-playback-share-acceptance.md#x7--验收与交接) |

默认顺序 X0→X1→X2→X3→X4→X5→X6→X7。普通选择按文档默认值完成，不等待逐 Step“继续”。共享接线或真实登录会话不足时只挂起该断言，继续独立步骤；不要把原 P15 的专项性能统计、媒体缓存、CDN、生产观察并入本批次。

## 5. 证据与恢复规则

- 本线只维护一份 `reviews/evidence/parallel-2026-10/<runId>/p15-x-handoff.md`，以基线、实现、验证、待验项几个小节承载常规结果，不要求逐 Step 独立报告。分享候选直接引用 X6 的文档表格，不复制三份预览材料。确有必要的图片/短录屏/trace 可放同一 run 的 `p15-x/`，复用既有附件即可；不为凑证据创建文件，不提交账号数据或凭证。单线执行者自行记录本次 runId，不需等待总控流程。
- 本线 lane 固定为 `p15-x`；其他 lane 为 `p14-h`、`p17`、`p13`，不得写入它们的证据。所有 `coordinator*` 文件均由总控单写。
- `handoff` 按总控字段写 `lane=p15-x`、完整 `BASE_SHA`、`headSha`、`dependsOn`（具体完整 SHA）、`completedSteps`、`nextStep`、`status`；补充已保护功能、实际改动文件、定向命令/退出码、接线请求、剩余人工选择、最短本地打开路径。采用共享补丁时把其 SHA 加入依赖，不只写“已用最新版”。
- 进度状态只用总控约定的 `working / code_ready / integration_ready / external_pending / blocked`；测试结果另列通过/失败/未执行，`code_ready` 不代替浏览器实测。等待共享接线写入依赖项，不把它冒充 `integration_ready`；用户文案与审美确认单列“待用户验收”，不得写成已确认。
- 开发中只检查受影响代码；复杂状态转换保留有行为意义的测试。相关源码、依赖和验证环境未变时复用类型、lint、测试与视觉证据，不因无关 commit 或仅文档修改重测；闭环末尾只补缺失/失效的定向检查。无本批次理由不运行 build、Forge、全站矩阵或全套 `verify.sh`。
- 视觉/焦点问题最多一次必要复现；修复后 X7、H6 及同批其他页面视觉断言合并到 K2 的同一次集成会话，不先跑 lane 全套再跑总控全套。单独执行本线就用本次必要会话完成，不等待 K2；失败只补相关断言。没有浏览器、真实会话或媒体时如实标 pending，不伪造通过、不为测试工具建立额外环境。
- 失败只修本线引入的根因。同一文件三轮无改善则保留差异和证据，挂起该路径继续独立步骤。恢复用反向撤销本线具体 hunk 或总控指定的 lane commit；禁止 reset、checkout、stash 原用户工作。
- 提交行为遵循总控本次运行授权，只提交本线已核对文件，不使用 `git add .`，不推送、合并生产。当前“只写 playbook”任务不提交。

## 6. 早晨验收终点

用户能在一个集成环境依次体验：`/me` 切网络不跳、状态更新不吞占位、首页第一下按键直接有效、登录新名称、Score 结束和 seek 连贯、B 版分享；A/B/C 候选在 X6 文档表格中阅读选择。无论外部项是否完成，handoff 都明确列出哪些可以验、哪些仍待条件；本线不得以“整夜运行”作为完成证据。
