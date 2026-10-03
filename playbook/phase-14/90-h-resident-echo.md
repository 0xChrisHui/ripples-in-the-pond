# P14-H — ECHO #1 第 36 球驻留、随机轻运动与隐现

> **建立日期**：2026-10-02。状态：执行计划，尚未据此开发。
> **本轮完成线**：完成独立运动与呈现模块、定向验证和总控接线交付，使集成后的首页可在早晨本地验收第 36 球的新表现。
> **启动入口**：[四线总控](../parallel-2026-10/00-orchestration.md) → K0 冻结共同基线 → `H0 → H1 → H2 → H3 → H4 → H5 → H6`。
> **必读合同**：[共享合同](../parallel-2026-10/10-shared-contracts.md)、[启动提示词](../parallel-2026-10/20-launch-prompts.md)、[共同验收](../parallel-2026-10/30-acceptance.md)。发生文件所有权或接口冲突，以总控冻结的合同为准。
> **覆盖范围**：本文件替代 P14-G 中 #36 的跨屏入场、穿行、离场、重生、尺寸和隐现规则。ECHO 身份、永久内容、播放引擎、35+1、普通球和既有日食规则继续有效。
> **验证减负（2026-10-02）**：仅定向检查；相关源码、依赖和环境不变则复用证据，无关 SHA 不使结果失效。H6 与 X7/同批其他页面视觉共用 K2 一次集成会话；单独执行 H 使用本次必要会话，不要求总控全套。每线一份 handoff，失败只补相关断言。

## 1. 授权范围与并行边界

### 1.1 这是一条独立视觉线

- #36 是 OP Mainnet 上的既有 **ECHO #1**，不增加曲目、不创建新 NFT、不修改其 tokenURI、recipe、clips 或持有人。
- 常规音乐仍为 35 首；最多存在同一枚 ECHO 访客。隐藏期间保留一个控制器，不生成屏外候补实例，不把访客加入 d3 普通球或 links。
- 取消原“左上屏外飞入 → 穿过水塘 → 底部飞出”的运动。访客在屏幕安全区域缓慢活动，靠透明度淡入淡出完成间歇隐现。
- 用户已确认“大小扩大 100%”按**直径为原来的 2 倍**执行；各动态参数先采用第 3 节建议范围，早晨以可运行样板调整，不标记为最终审美定稿。
- 本轮只开发本地可验收结果。生产发布、主网交易、永久上传和外部联系不属于 H 的默认动作。

### 1.2 文件所有权

四线并行时总控先固定共同 `BASE_SHA`，并准备独立分支/worktree。**H worker 不在当前脏目录开发，不自行 stash、提交用户原有修改、创建额外 worktree 或合并别人的分支。** 开工记录含总控指派的路径、分支和基线 SHA；缺少时先报告基线未就绪。单独执行 H 时，由执行者核对当前安全工作目录、基线与用户改动保护，并在授权范围内负责必要接线，不为形式创建工作树或启动其他 Phase。

| 所有者 | 文件或目录 | H 的操作边界 |
|---|---|---|
| P14-H | 新的 `src/components/pond-gl-test3/echo-resident/`、`src/types/echo-resident.ts`、`scripts/p14-h/` | 独立运动、生命周期、命中、球体渲染适配和定向测试；H0 按实际首页目录重定位后由总控登记 |
| P14-H | `reviews/evidence/parallel-2026-10/<runId>/p14-h-handoff.md`、同一 run 下的 `p14-h/` 证据子目录 | 未来执行时生成的本线状态、非显然决定、验证证据、共享接线请求；本次计划编写不代表这些证据已经存在 |
| 总控 | `app/test3/page.tsx`、`PondGL.tsx`、共享 `spheres/*`、`water/*`、`pointer-fx.ts`、`sphere-projection.ts`、共享日食/场景桥 | H 只读并交接线请求；总控最后单写接入 |
| 总控 | `PlayerProvider.tsx`、chain registry、全局状态文档、架构/技术栈、`package*`、部署配置、迁移编号 | H 不写；本线不需要新依赖、迁移或链配置 |
| P15 | `PondHeader.tsx`、auth 标签、`/me`、网络面板、原 Score 视觉与分享 | H 不写；删除 echo 文字入口不会删除本线的第 36 球 |
| P17 | `src/lib/music-catalog/asset-registry.ts` 及公开生成数据、曲目馆、原曲接口/合约 | H 不写、不增加第二份地址清单；如需公开 collection 描述，提交给 P17 归并 |
| P13 | `docs/integrations/semi/` | H 只提供既有 Echo 身份与播放说明，不手写 SEMI 合约清单 |

上表路径是本次检查的定位参考，不代表它们必然存在于 K0 的基线。新的子目录直接归 H；若实际已有独立 guest 模块，H0 先登记精确路径，复用并替换现有控制器，不能保留两个运行入口。跨所有权编辑必须交总控处理。

## 2. 开工前事实与源码定位

2026-10-02 在当前工作目录只读检查得到以下事实。该目录 HEAD 与生产分支存在分叉，且含大量未提交内容；**这些事实只帮助搜索，实际执行必须在 K0 基线上重新核对**。

| 现有参考位置 / 符号 | 对 H 有用的事实 |
|---|---|
| `app/page.tsx` → `app/test3/page.tsx::Test3PageInner` | 当前首页复用 test3 GL 树；不能误改旧 `src/components/pond-gl/` 或 SVG 首页 |
| `.../spheres/use-gl-sim.ts::GlSim/useGlSim` | 普通节点来源是 `/api/tracks`；重建跟随 tracks/group；访客生命周期不能挂到这个重建周期 |
| `.../spheres/gl-sim-setup.ts::GlPhysNode/buildGlNodes` | 节点带 Track、d3 和生命周期字段；不应伪造 Track 来容纳 Echo |
| `.../spheres/sphere-frame.ts::writeFrame` | 普通节点每帧受到漂移、浮动、wake、glide、透明度等多条更新；Echo 必须绕开这些更新 |
| `.../sphere-projection.ts::project/unproject/applyFloat` | GL、DOM、水面共用投影；不能只给 DOM 用 CSS 放大或位移 |
| `.../water/water-level.ts::getEffectiveWaterLevel/getSubmerge` | 深度为归一化域，水面不是 CSS y；水上为 `z > surface`，水下相反 |
| `.../spheres/sphere-shader.ts::HALO_R/uWaterPass` | 当前 `HALO_R=1.16`；水上 pass 会恢复实体主体 alpha，仅写 `aLifeDim` 无法让整颗球消失 |
| `.../water/water-distort-setup.ts::applySpheres` | 水面遮罩读节点位置、半径、深度、`_visualDim`；需要总控接入同一份 Echo pose |
| `.../water/composite/render-passes.ts::SPHERE_LAYER/renderFrame` | 已有水上、水下两次球 pass；可复用同一 Canvas、shader 和 FBO |
| `src/data/echo/source.ts::getEchoByTokenId/getEchoByTokenIdCached` | server-only，读取链上 tokenURI 并校验永久 metadata；不能在客户端 import |
| `src/features/wallet-recipe/player/use-wallet-recipe-player.ts::useWalletRecipePlayer` | 已有播放器控制器；挂载不应自动创建音频上下文，播放仅由用户手势触发 |
| `src/features/wallet-recipe/player/types.ts::WalletRecipePlayerSnapshot` | 已有 `loading/ready/playing/paused/ended/error` 状态，可适配，不另造音频时钟 |

当前目录未检出首页 Echo guest/featured 运动实现；旧 G 文档却记录了实现进度。H0 必须搜索实际基线中的 guest/featured/Echo 文件并读取其调用链，不能凭文档状态断言已实现，也不能因此重跑 G0–G7。仅只读核对既有 ECHO 数据入口是否可用：

- 输入已存在且通过既有身份校验：直接使用，继续视觉线。
- 输入解析器存在、首页桥接缺失：H 完成独立模块；总控负责传入已验证数据和播放控制。
- 永久资源暂不可取：继续纯运动与生命周期验证；真实播放和浏览器对应断言记为 `external_pending`，不得用假 NFT、短音频或本地 MP3冒充。
- 只读检查发现历史生产事故仍未解决：记录证据交总控。H 不修改 cron、cursor、生产数据库，也不自行开启恢复流程。

## 3. 第一版运动与视觉参数

所有值集中到 `echo-resident/config.ts`。以 `residentConfigVersion=1` 记录，运行时做有限值和上下界校验。测试可注入种子与时钟，生产不暴露可任意改写范围的 query 参数。

| 参数 | 建议初值 / 范围 | 单位与约束 |
|---|---|---|
| 尺寸 | `diameterMultiplier = 2` | 同深度、同投影、无 hover 时，相对旧 #36 直径；不能把面积翻倍当成直径翻倍 |
| 缩放 | `0.90–1.10` | 相对放大后的尺寸；完整呼吸周期 `14–28s`，与位移/深度独立采样 |
| 每段漂移距离 | 安全区域短边的 `3%–8%`，上限 `80px` | CSS px，区域太小时缩小位移，不设置强制最小距离 |
| 每段漂移时间 | `10–25s` | 位移最大速度 `6 CSS px/s`；必要时缩短距离，避免越界或突然加速 |
| 漂移方向 | `[0, 2π)` | 每段最多 8 次有界候选；无可行方向时向安全区域中心缓移，不无限重抽 |
| 浮沉上端 | `surface + U(0.04, 0.10)` | 归一化深度，不是 px；`surface = getEffectiveWaterLevel()` |
| 浮沉下端 | `surface - U(0.04, 0.12)` | 每个完整周期 `10–25s`，最终 `z` 约束在 `[0.02, 0.98]` |
| 稳定可见时长 | `20–45s` | 不含淡入、淡出；交互与播放会延长，不强制抢走目标 |
| 完全隐藏时长 | `8–20s` | 透明度为 0、无命中、无 Tab；继续使用同一控制器 |
| 淡入 / 淡出 | 各 `1.5–3s` | 独立抽样；从当前位置改变透明度，不移到屏外 |
| 首次出现 | 场景与真实输入 ready 后 `0–1.5s` 延迟，再正常淡入 | 不等待其他链路重复读取，不自动聚焦、不自动播放 |
| 松开 hover/focus 后保护 | `1.5–3s` | 完全可见；保护结束再续剩余可见时间，至少另留 `3s` 才能淡出 |
| 播放结束后的保护 | `3–6s` | 从冻结的位置、深度和缩放恢复；先等既有场景回归，再渐进恢复运动 |
| 恢复运动缓冲 | `0.6–1.0s` | 对逻辑时钟速度从 0 平滑升到 1，不重抽整组参数 |
| 安全边距 | 视口边缘 `16px` + safe-area，重要 UI 再外扩 `12px` | 以完整球体、光晕和焦点环最大包围半径计算 |

### 3.1 尺寸与安全区域的数学口径

1. H0 记录旧访客的基础半径 `R0`、投影倍率和对应代码符号。新主体半径为 `Rbody = 2 × R0 × breathScale × projectionScale`；同状态下新旧直径比为 2。光晕半径另乘实际 shader 的 `HALO_R`，焦点环边距也计入安全包围盒。
2. 如果实际基线根本没有旧访客尺寸，由总控核对已有 G 参数或此前截图；暂以相同深度下普通球基础半径中位数为 `R0` 生成本地样板，并明确记 `size_reference_pending`，不能宣称精确翻倍已通过。
3. 安全区域输入来自首页实测 viewport、safe-area、Header/导航/Jam/BottomPlayer 等可见控件矩形。主线程只在布局变化时测量；H 的纯函数接收这些矩形，不每帧 `getBoundingClientRect()`。
4. 按最大呼吸、实际透视上限和光晕计算包围半径，对视口边缘内缩、对 UI 矩形外扩。从这些矩形边界组成的有限候选中选可容纳球心的安全矩形，优先保留当前区域；区域选择必须有界、可重复。
5. 漂移起终点及控制点均落在同一安全矩形内，保证整段路径不穿过控件。不得只 clamp 终点，而让途中轨迹划过 Header。
6. 正常桌面与手机尺寸优先通过换安全区域、减少漂移满足 2 倍尺寸。极端短屏仍容纳不下时，停止运动并启用最大可容纳尺寸，明确输出 `sizeClamped` 及比例；这是响应式保护，验收报告不能把它记作原尺寸目标通过。
7. resize 后按旧安全矩形中的归一化位置映射到新区域，保留段剩余时间和随机状态；必要时立即把包围盒约束到新视口，再平滑接续。实际窗口收缩造成的必要限位单独记录，不用重生/飞入遮掩。

### 3.2 随机与连续性的实现口径

- 创建控制器时获取一次种子；位移、深度、缩放、显隐用四条独立随机流。生产种子只服务视觉，不从用户钱包派生，不改变 recipe。
- `u∈[0,1]`，随机范围使用 `min + u × (max - min)`。只在进入新段或新周期时取随机数；每帧只采样已保存的段，禁止每帧 `Math.random()`。
- 首版采用五阶缓动 `S(u)=6u⁵−15u⁴+10u³`，从上一段终值平滑走向本段目标。端点位置、一阶和二阶导数连续；深度上下端与缩放极值交替，周期、幅度独立抽样，避免固定节拍。
- 位移若采用 `p = p0 + (p1-p0) × S(u)`，峰值速度为 `1.875 × distance / duration`，据此满足 `6px/s` 上限。允许短暂速度接近 0，不加入随机瞬移。
- 逻辑时间使用 active elapsed seconds；后台、播放、交互锁期间不累计对应时钟。恢复后重置真实时间采样点；单次增量封顶 `50ms`，不补跑后台几个小时的显隐循环。
- 球心以 CSS 屏幕坐标定义；需要 sim 坐标时用同一帧 `unproject()`。投影、深度、半径、透明度生成一份 `ResidentEchoPose`，供所有消费者读取，不能 GL、DOM、水面各算一套。

## 4. 状态与接线合同

### 4.1 独立状态，不改音频事实

推荐视觉状态为 `waiting → fading_in → visible → fading_out → hidden → fading_in`。另记录 `hovered/focused/pointerDown/playbackHeld/documentHidden/reducedMotion`，不要把所有组合展开为几十个字符串状态。

- 交互锁：hover、focus 或 pointer down 时，位移/深度/缩放平滑减速至停止；暂停显隐倒计时，把透明度从当前值连续恢复到 1。focus 留在用户主动选中的按钮；不调用 `autofocus` 或主动 `.focus()`。
- 播放锁：用户按下播放后先保留位置和可见性，加载/开始失败时解除锁并提供可重试状态。`playing` 和本 Echo 的 `paused` 均保持 pose；只有明确 stop、ended、播放失败或用户改播其他作品才进入恢复。
- 本 Echo 在日食中可以按原场景规则隐去实体，由既有日食及播放控制承接。不能因为视觉隐去就移除唯一停止入口，也不能让专用显隐定时器在后台到期。
- stop/ended 后保留冻结的各段进度和剩余时长，等待场景恢复完成信号，执行 `3–6s` 可见保护后接续运动。音频 positionMs 归零不代表视觉相位归零。
- 原曲或 Score 正在播放时，遵守总控既有场景 focus 规则；Echo 不抢焦点、不主动播放，场景隐藏期间暂停自己的显隐/运动时钟。
- `document.hidden` 暂停视觉时钟，不擅自暂停或重启用户音频。回到前台以播放器最新 snapshot 决定是否仍需冻结；不批量补发 fade、wake、播放动作。
- reduced-motion 时保持一枚静止、完全可见、可操作的 Echo，关闭自动漂移、浮沉、缩放、周期消失和自动尾波；遵守既有日食场景可见性。运行中切换该偏好也不能瞬移。
- 隐藏、数据失效、路由卸载或 context lost 时清理监听、ref、命中和订阅。无有效画面不保留透明按钮；需要停止正在播放的音频时，复用仍可见的播放控制。

### 4.2 共享接口的最小形状

类型由 H 在独占文件 `src/types/echo-resident.ts` 定义，再由总控映射到实际共享类型；不得改写 [共享合同](../parallel-2026-10/10-shared-contracts.md) 的资产或播放器协议。

| 输入 / 输出 | 最小字段与语义 |
|---|---|
| 身份输入 | 已验证 `chainId=10 + contract + tokenId='1'`、既有永久数据引用；状态为 available/unavailable/error。来源由总控注入，无客户端 server-only import |
| 播放输入 | 既有 Echo snapshot、普通播放焦点、异步播放结果、scenePresence/恢复完成信号；明确区分暂停与结束 |
| 布局输入 | CSS viewport、safe-area、控件占位、有效水位、同帧 projection context、场景健康状态 |
| `ResidentEchoPose` | `instanceId`、`frameId`、`sx/sy`、`depth`、`bodyRadiusPx`、`haloRadiusPx`、`presence`、`effectivePresence`、`interactive`、`sizeClamped` |
| 命令 | 用户手势触发的 play/pause/resume/retry，由既有控制器执行；视觉控制器不生成 Track、不调用 mint/upload |
| 生命周期 | create/step/setInteraction/setVisibility/destroy；一个首页宿主只有一个实例，destroy 可重复调用 |

`effectivePresence = presence × scenePresence`，再结合数据有效性、GL 健康状态决定是否呈现。专属显隐只应用一次，不在父 DOM、材质、composite 三处重复相乘导致过快变暗。

## 5. 分步执行

每步把结果追加到本线 handoff。成功后自动进入下一步；共享接线尚未完成时继续独立工作，最终把未接线部分明确留给总控，不能用假通过填表。具体实现单文件目标不超过 200 行，每层最多 8 个文件。

### H0 — 核对实际基线、输入和文件所有权

**输入依赖**：并行时使用总控 K0 的 `runId`、完整 `BASE_SHA`、H 分支/worktree、必要 WIP 保留清单与共享合同版本，读取总控 handoff 的基线段落/已有记录；不要求另建 `coordinator-baseline.md`。单线由执行者登记对应最小信息，不要求 K0 全套。当前 `STATUS.md` 仅提供历史，不触发 G0。

**实际文件 / 符号**：第 2 节表中入口、guest/featured 候选、`getEchoByTokenIdCached`、`useWalletRecipePlayer`、scene focus 桥；本步只写本线 handoff。

**具体操作**：

1. 记录 `git rev-parse HEAD`、`git status --short`，与 K0 校验。既有用户脏文件不整理、不提交；BASE 不匹配时交总控解决，不能自行取缓存 origin/main 当基线。
2. 从真实 `app/page.tsx` 顺着 import 找到首页树，使用 `rg -n 'guest|featured|Echo|ECHO|resident' app src/components` 定位实现，再逐个读调用处。记录“旧运动入口、旧尺寸符号、输入入口、场景恢复信号、当前帧驱动”的路径和符号。
3. 核对 G 资产身份合同与既有只读数据源。记录可用/不可用原因、当前网络、tokenId、永久引用校验结果；不改变任何地址，不重复上传素材。
4. 把 H 的独占路径和总控接线文件列成准确清单；若基线已移动 GL 根目录，仅重定位 H 新子目录和测试 import，不新建第二棵水塘。
5. 在 handoff 提交首版接线请求 `H-WIRE-01`，使总控能同步准备宿主插槽。列出接口、消费者和移除旧控制器的确切位置。

**失败恢复**：分支/基线不一致只阻断实际开发；旧 G 状态冲突按源码和只读输入核对处理。没有首页 Echo 桥时继续 H1–H5，把桥标为 `integration_pending`。

**定向验证**：路径/符号存在性、HEAD 身份、写入白名单与唯一实例入口；本步不启动服务器、链写入或完整测试。

**完成证据**：handoff 的 baseline/ownership 表、旧半径 `R0` 依据、输入可用性、`H-WIRE-01`。

**自动下一步**：基线与独占目录确认后进入 H1；数据暂不可用不阻断数学与状态实现。

### H1 — 固定类型、建议参数和可复现随机源

**输入依赖**：H0 的路径和旧尺寸记录；第 3–4 节参数与接口。

**实际文件 / 符号**：新建 `src/types/echo-resident.ts`；独占子目录 `config.ts::RESIDENT_ECHO_DEFAULTS/validateResidentConfig`、`random.ts::createResidentRandom`。名称为本计划的新符号，非已有实现的完成声明。

**具体操作**：

1. 定义带单位的配置字段、pose、布局、视觉状态、各段起点/终点/开始逻辑时间/时长，以及独立随机流状态。
2. 所有 `min <= max`、正时长、有限数、透明度/缩放/深度范围先校验。非法持久参数回到默认配置并报告原因，不能产生 NaN 或无限重抽。
3. 默认只保存在本模块。若实际基线有现成 guest 调参面板，则提交总控接线请求；否则早晨通过集中配置调参，不新建一整套面板或改全局 LifePanel。
4. 生产创建实例时抽一个视觉种子；测试显式传 seed。创建时分出四条随机流，避免显隐重采样连带改变漂移方向。
5. 保存参数版本和来源，在 handoff 明确“初版建议参数，尚待用户体感验收”。

**失败恢复**：随机实现无法稳定回放时先修纯函数；不得退化为每帧随机。无法取得旧尺寸则保留 H0 的 `size_reference_pending`，其他功能继续。

**定向验证**：固定 seed 可复现；不同流互不消耗；范围端点、反向区间、NaN/Infinity、重复初始化、configVersion 不匹配。

**完成证据**：handoff 参数表、默认值、非法输入策略与 seed 测试结果。

**自动下一步**：进入 H2。

### H2 — 实现安全区域、漂移、浮沉和缩放

**输入依赖**：H1 配置/随机源；H0 定位的 projection/water 只读接口。

**实际文件 / 符号**：独占 `motion.ts::createMotionState/stepMotion`、`render/bounds.ts::resolveResidentBounds`、`render/pose.ts::resolveResidentPose`；只读复用 `project/unproject/getEffectiveWaterLevel`。

**具体操作**：

1. 实现纯函数安全区域计算，包含完整 2 倍尺寸、最大呼吸和光晕。预先确定一段运动的安全矩形，不能让每帧选区把球吸到另一边。
2. 漂移分段采用第 3 节五阶缓动，方向与距离各自抽样；按峰值速度公式限制距离。无可用候选时走确定性的中心回退。
3. 深度与缩放使用各自的分段周期及逻辑进度。深度读实时 surface，使用缓变目标衔接；不能把归一深度当 px 或直接叠普通球滚轮/暗流位移。
4. 以单一 pose 给出最终 CSS 球心、主体/光晕半径与深度。需要 GL sim 坐标时逆投影；Echo 的普通 `applyFloat`、jelly、flicker、wake、d3 力必须为中性或不参与。
5. resize 重算区域，映射当前位置并保留进度；记录必要的响应式限位。隐藏期间也保留一个有界状态，不创建屏外节点。

**失败恢复**：有越界或速度尖峰时减小默认位移/修正连续性，不能把球设成透明或隐藏控制来假通过。投影不匹配先交总控核对共享 context，不改整套投影实现。

**定向验证**：用固定种子与虚拟时间覆盖段首/尾、一次换段、边界回退、resize 和极端几何输入，检查控件避让、速度、深度/缩放范围、有限值、连续性与不同帧步长的同时间结果。覆盖关键边界和确定性重放即可，不设小时数或大量种子门槛；结果纳入 H5 同一组测试，不再重复跑一轮，不需要浏览器或真实长时间等待。

**完成证据**：最大边界误差、峰值速度、resize 结果、2 倍尺寸计算、`sizeClamped` 场景明细。

**自动下一步**：进入 H3。

### H3 — 实现显隐、交互锁和播放相位恢复

**输入依赖**：H2 pose；既有 Echo 播放状态和总控场景恢复信号合同。

**实际文件 / 符号**：独占 `presence.ts::stepPresence`、`runtime.ts::createResidentEchoRuntime`；只读 `WalletRecipePlayerSnapshot`、`prefersReducedMotion`。

**具体操作**：

1. 实现一套显隐状态机和 active clock，保存每段抽到的时长。进入新状态时只转换一次，不在 rAF 中注册 setTimeout，不积累待生成实例。
2. hover/focus/pointerDown 到来时暂停显隐期限，连续恢复可见性并减速冻结；离开后先保护，再续剩余可见期。
3. 将播放意图、loading、playing、paused、ended、error 映射到第 4 节规则。用户单击只发一次命令，等待中的多次 click 去重；不把暂停当成结束。
4. stop/ended 保存旧段相位，等待场景归来再恢复运动。若 shared snapshot 缺“停止/恢复完成”信号，补充 `H-WIRE-02` 请求总控传入，不能凭音频 positionMs 或任意 timeout 猜测。
5. 后台与 reduced-motion 使用独立暂停原因集合；解除一个原因不能解除仍存在的播放/focus 锁。偏好改变、路由离开和 StrictMode mount/unmount 均释放对应资源。

**失败恢复**：返回前台发生跨段追赶时修正时钟，而不是扩大 delta 上限。播放错误不销毁真实数据；解除等待锁、显示重试反馈并恢复安全姿态。已有全局音频问题交总控，不改 PlayerProvider 救绿。

**定向验证**：虚拟时钟覆盖各状态边界、淡出中 hover/focus、播放暂停/恢复、自然结束、加载 reject、另一作品接管、后台长间隔跳时返回、运行时 reduced-motion 切换、重复 destroy；断言 0 次自动播放与 0 次重复实例创建。这些核心状态测试保留，用注入时钟直接推进，不真实等待后台时长；H5 复用同组有效结果。

**完成证据**：状态用例表、恢复前后 pose/相位差、随机抽样次数、监听/定时资源回收结果。

**自动下一步**：进入 H4；共享信号尚待总控补入不阻断独立 runtime 测试。

### H4 — 完成独立球体、命中与宿主适配，交共享接线

**输入依赖**：H1–H3；H0 的实际 shader/scene/输入接口。总控 `H-WIRE-01` 可并行执行。

**实际文件 / 符号**：独占 `use-resident-echo.ts::useResidentEcho`、`EchoResidentHit.tsx`、`render/EchoResidentSphere.tsx`、`render/pose.ts`。可复用基线中已有独立 guest 壳；共享文件由总控修改。

**具体操作**：

1. 独立 hook 只组装 runtime 和宿主注入的已验证资产、播放命令、布局/健康状态。数据 fetch/cache/全局互斥仍沿用现有桥；不要把 `getEchoByTokenIdCached` 打包到客户端。
2. GL 适配优先替换现有独立 guest 渲染模块；若基线缺失，则在现有 Canvas 内增加一个单实例球 mesh，复用 shader、球 layer 和 water pass，不再建 Canvas/FBO。独立球不进入普通 sim。
3. 把 `effectivePresence` 写入材质完整主体和光晕都消费的最终 alpha。当前参考 shader 需走 `aParams.z/playDim`，单改 `aLifeDim` 会残留水上主体；以实际基线 shader 核对。
4. 专用 DOM 使用单个真实 button，label 标明“播放/暂停 ECHO #1（第36枚音乐圆圈）”。支持原生 click/Enter/Space，不重复绑定 keydown 再执行 click；不支持 d3 拖拽，不加自动焦点。
5. GL 与命中层读取同一帧 pose；button 的中心/主体半径与可见球一致，容差不超过 2 CSS px。不把光晕整块作为额外遮挡普通球的大按钮。
6. 完全隐藏或数据失效时 `pointer-events:none`、`tabIndex=-1`、`aria-hidden=true`；淡入达到 `effectivePresence >= 0.15` 才启用命中。淡出时先停用新的 Tab 进入，若已有 hover/focus 则回到交互锁，不能在 focused 元素上设 aria-hidden。
7. 禁止浏览器给刚出现的按钮自动焦点；H 不操作页面初始焦点。首页导航焦点修复归 P15，交界条件由总控统一验证。
8. 把所有共享编辑整理为下表接线请求，引用 H 导出的真实类型和符号，包含预期断言。总控确认接入后，H 才能报告首页实际生效。

| 接线点（由总控单写） | 必须完成的最小接入 |
|---|---|
| 真实首页宿主，参考 `app/test3/page.tsx::Test3PageInner` | 单次挂载 runtime/DOM 控件；输入来自既有 ECHO 严格数据源；A/B/C 切换不重建 Echo |
| `PondGL.tsx` / 既有 guest 渲染插槽 | 挂载 H 独立球模块；复用当前帧/投影 context；旧跨屏控制器停用并清理 |
| 共享 spheres 接口（如基线使用 renderNodes） | render-only Echo 与 35 个 sim nodes 分离；普通 d3/漂移/flicker/wake 不处理 Echo；不伪造 Track |
| `WaterDistort.tsx` / `applySpheres` 或实际等价接口 | 水面遮罩、阴影、折射读同一 pose 的位置/半径/深度/alpha；隐藏时移出有效遮罩，无残余孔洞 |
| 现有日食/场景焦点桥 | Echo 播放冻结 pose，保留可停止控制；stop/ended 后保留 pose 到退场完成，再通知恢复 |
| 现有播放器互斥桥（必要时 PlayerProvider） | Echo 与普通 Track/Score 互斥；H 不创建另一套音频或录制链路 |

默认不新增连续尾波。基线若已有穿水涟漪，复用原有有界队列，只在跨越水面时按实际位移生成稀疏事件，设置 2s 冷却；隐藏、冻结、reduced-motion 时不生成。不能通过共享 `bg-ripple:wave` 高频广播推动普通球。

**失败恢复**：共享接口不具备时保留完整独立实现和准确接线请求，记 `integration_pending`；不能在 H 分支抢改共享模块。发现两个 guest 入口时由总控移除旧挂载，H 不用互相隐藏的办法保留双实例。

**定向验证**：独立模块 lint/类型、零 Track cast/自动音频/钱包写入、单击仅一次命令、pose 传播与 shader alpha 静态检查；此时不单开浏览器做未接线的假首页演示。

**完成证据**：实际导出接口、按文件/符号列出的接线请求、哪些已被总控接入及对应 SHA、哪些仍待接入。

**自动下一步**：进入 H5；总控处理共享文件，H 继续定向验证与收尾。

### H5 — 定向测试与可交接代码闭环

**输入依赖**：H1–H4；实际分支的已安装依赖，不改 package/锁文件。

**实际文件 / 符号**：优先扩展基线已有相关测试；确无入口才用 `scripts/p14-h/verify-resident-echo.ts`，按规范限长拆分。复用 Node assert 与现有 tsx，不安装测试框架、不建设长跑或可视化测试平台；常规结果只记本线 handoff。

**具体操作**：

1. 把 H1–H4 中的数学、生命周期、几何和副作用断言纳入可执行定向测试。数学输入可人工构造；产品资产可用性测试必须来自既有真实输入，不能把测试数据写入生产接口。
2. 固定种子重放与定向极值覆盖 H1–H4 的随机范围、换段、几何边界、状态恢复；随机数调用只随段数增长，不能随帧数增长。核对后台恢复、group 变化和 StrictMode 不增实例。不固定种子数或虚拟小时数；仅发现无法解释的波动/失败才有界增补种子与跳时用例，这不是十小时真实运行任务。
3. 下列为可用的定向检查示例，按 H0 的实际测试入口与修改列表调整；只补缺失或失效部分。相关源码、依赖和环境未变的 H1–H4 结果直接复用，无关 commit 不重测；类型检查只在确有未覆盖类型变更时运行，保留可用增量缓存。

```powershell
npx --no-install tsx scripts/p14-h/verify-resident-echo.ts
npx --no-install eslint src/components/pond-gl-test3/echo-resident src/types/echo-resident.ts scripts/p14-h
npx --no-install tsc --noEmit
git diff --check
git diff --name-only
```

4. diff 路径必须落在 H 独占清单。当前基线的既有 lint/type 错误独立记录，先判断与 H 的关系；不改 P15/P17/共享文件救绿。
5. 夜间正式实施时按总控 worker 规则，定向验证后只 add 本线精确路径并创建中文提交；本次仅编写计划不执行 commit。禁止 `git add .`、stash、把用户原有工作夹入提交或自动 push。

**失败恢复**：三轮同类修复无改善时保留最小失败输入、日志和源码交总控；其余独立用例继续。网络资源失败不重跑纯数学或 unrelated checks；不运行 forge、全站 build、全 P9 扫描或旧 G 的 30 分钟矩阵。

**定向验证**：记录实际运行命令或已复用结果、文件归属与退出码；不为凑齐命令重新运行。缺旧尺寸依据、资源或共享接线必须明确保留 pending，不能写全绿。

**完成证据**：测试计数/结果、最大误差、实际 diff 路径、完整 HEAD/测试 SHA、`status=code_ready` 是否成立和 `integration_pending` 列表。

**自动下一步**：共享接线已经落在总控集成版本则进入 H6；尚未落地则完成 handoff，由总控接线后执行 H6，不反复起测试服务等待。

### H6 — 一次必要浏览器验收与早晨交付

**输入依赖**：集成版本、现有本地验证 URL、真实 ECHO 输入可用、H5 有效证据；并行由总控提供，单线使用本次版本，不需另起总控流程。无需生产发布或新钱包交易。

**实际文件 / 符号**：实际首页的 runtime、专用 button、sphere mesh、水面/日食接线；执行结果直接记本线 handoff 的 H6 小节，必要动态附件引用现有证据，不额外生成 browser 报告，不为验收搭第二套应用。

**具体操作**：

1. 并行时总控将 H6 与 X7/同批其他页面视觉断言合在 K2 同一次集成会话，不先逐线全测再总控重测。单独执行 H 直接使用本次必要会话，不要求总控全套。真实视觉/命中依赖 WebGL；纯参数和生命周期复用 H5。相关源码、依赖、环境不变的已有画面证据也可复用。
2. 桌面 1440×900 观察一次“显现→淡出→隐藏→再次显现”，取得必要短动态证据即可，不按固定时长循环录制；确认无屏外飞入/飞出、尺寸符合 2 倍基准、轻运动连续。最多一次必要复现，已有明确证据不为形式重演。
3. 在同一会话 resize 到 375×844，检查安全边界、UI 避让、球/命中/水面位置一致。不要另开浏览器或 profile 复制矩阵。
4. hover、Tab 聚焦、触摸/点击各验证目标保持可操作；出现/重新显现不主动抢焦点，隐藏时没有透明命中或 Tab 陷阱。
5. 使用实际 ECHO 检查 loading/play、暂停/恢复、停止及自然结束。自然结束通过已有 seek 跳到尾段，不强制重播完整 4 分钟；未改的 36 段永久资源、引擎、网关/断站证明全部复用。真实媒体不可用记对应 pending，不能以纯状态测试或假音频替代真实播放结论。
6. stop/ended 后球保留冻结位置，场景恢复后自然接续运动，无重生和第一帧跳变。再播放一首普通曲目，确认单一播放焦点、35 普通球数量不变；切组后 Echo 仍只有一个。
7. 同一会话验证后台恢复、reduced-motion、离开/返回首页的资源清理。复用现有 frame/HUD 或 trace 判断是否引入明显长任务、持续新增 DOM/rAF/mesh；不新增遥测或审计平台。
8. 若确有视觉时序缺陷，修复后只补一次受影响断言的 smoke；工具环境自身失败记为验收未完成，不反复搭浏览器环境，也不冒记产品失败或通过。

**失败恢复**：水上主体不隐去优先检查完整 alpha；命中错位查单一 pose 与 DPR/CSS 单位；后台跳跃查 active clock；停播瞬移查相位/场景恢复信号。共享层问题交总控在同一集成环境修复，H 不越界改其他线。

**定向验证 / 完成证据**：记录集成 SHA、视口、浏览器、参数版本/种子、实际断言结果，以及一段必要动态证据。真实网关或播放被外部依赖阻断时，已验证视觉与未验证音频分别列出。

**自动下一步**：更新本线 handoff，交总控归并和早晨验收；本线到此结束，不进入 G7/F8，不自动发布或启动观察任务。

## 6. 最终验收表

| 编号 | 必须结果 | 证据来源 |
|---|---|---|
| H-A1 | 普通 Track/d3 节点仍为 35；Echo 逻辑实例最多 1，不随 A/B/C 增生 | H5 生命周期断言 + H6 场景检查 |
| H-A2 | 相同投影状态下主体直径为旧值 2 倍；呼吸在新尺寸 0.9–1.1 范围 | H0 旧尺寸依据 + H2 数学结果 + H6 画面 |
| H-A3 | 从安全区域内部淡入/淡出，无屏外穿行、突变或每帧随机 | H2 测试 + H6 一个完整周期 |
| H-A4 | 位置、深度、缩放、显隐独立随机且有界；停播恢复保存相位 | H2/H3 定向测试 + H6 停止/ended |
| H-A5 | hover/focus/按下/加载/播放/暂停期间不被专属隐现移除，可停止 | H3 测试 + H6 操作 |
| H-A6 | GL 主体/光晕、水面遮罩和 DOM 同步；隐藏无幽灵球、透明按钮或遮罩孔洞 | H4 接线 + H6 |
| H-A7 | 后台不追赶、不增实例；reduced-motion 静止可见；resize 保持安全 | H3/H5 + 同会话 H6 |
| H-A8 | 不改变永久资产，不新增播放时上传/铸造/录制，不增加 Canvas/FBO | diff/网络动作检查 + H6 |
| H-A9 | 新代码落在独占路径；共享修改由总控归并，未提交用户工作保持原状 | H0/H5 diff 清单 + 总控接线记录 |

`status=code_ready` 仅表示 H 独立代码及可运行定向测试完成。共享接线完成且 H6 必要断言通过后，可报告 `status=integration_ready` 与本地验收通过；若只有外部资源阻断真实播放，按总控使用 `external_pending` 并保留已通过项。用户是否喜欢建议参数是早晨的体验确认，不能由自动测试替用户拍板。

## 7. Handoff 必填内容与恢复入口

报告路径固定为 `reviews/evidence/parallel-2026-10/<runId>/p14-h-handoff.md`，并行时 runId 由总控分配，单线由执行者登记；这是未来执行产物，本次不创建假证据。每步常规结果、状态与非显然决定只写这一份，不另要求 baseline/verification/browser 等普通报告。全局 STATUS/TASKS/JOURNAL 按公共单写规则处理。

报告必须包括：

1. `lane=p14-h`、完整 `BASE_SHA`、`headSha`、`dependsOn`（具体完整 SHA）、工作路径/分支、`completedSteps`、`nextStep`、最后验证 SHA。`status` 只用 `working / code_ready / integration_ready / external_pending / blocked`。
2. H0 重定位表、独占文件、已修改/新增文件、旧访客与新控制器唯一挂载关系。
3. `R0` 依据、完整配置版本/范围、临时尺寸依据或响应式限位，不把建议参数写成用户定稿。
4. 所有接线请求的文件、符号、输入输出、预期断言、总控状态/集成 SHA；不能只写“需接播放器”。
5. 定向检查与 H6 结果、证据路径、已知限制。除统一 `status` 外，分别列本线代码、共享接线、本地验收的实际完成项，以及 `integration_pending`、`external_pending` 的逐项原因。
6. 外部阻塞的准确原因、已做的有界只读重试、恢复所需输入；无外部动作也明确写“本线未部署、未上传、未交易”。
7. 早晨建议用户只看三点：球是否过大、轻运动是否舒适、显隐节奏是否合适；对应调哪个配置范围。

进程重启后读取本线 handoff 和最新接线状态，从第一个未完成 Step 继续；不依据 STATUS 的历史 G0 文案重开事故恢复。相关源码、依赖与环境不变则复用已通过结果，无关 SHA 变化不重测；失败只补相关断言。需要撤回本线代码时保留证据，以本线修复提交或总控批准的 revert 处理，不删除用户文件或回退整个脏工作树。
