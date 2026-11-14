# 2026-11-14 全仓代码审核 — P26 维修依据

> 原审核只读完成；本文件持久归档其结论，不表示已实施修复。后续状态统一见 [P26 维修清单](../playbook/phase-26/01-review-backlog.md)。

## 覆盖与限制

45 组、1,915 个代码/配置文件；源码审读与大型生成文件/账本全量结构校验的方法见逐文件备注。基线提交 `8d9fd727af14b74bd733c605450b862e7792470b`，审查截止 2026-11-14；并行改动按 SHA-256 指纹记录。文档、媒体、生成证据、安装产物和构建缓存不计入源码覆盖率。

共 42 项：P1 3、P2 37、P3 2。旧版 pond-gl 的聚类目标缓存问题已并入 R31；两项未调用的第三方测试工具边界另列附录。未做真实支付、生产写入或所有真实钱包/真机分支验证。

原审核 verify 整体退出 1（目录超限、H7 活跃旧队列）；执行时类型、构建、Forge 139/139 通过，P24 20/20、P25 12/12。此处记录原审核时点，不覆盖其后其他会话改动。

## 原始证据

- [逐文件覆盖 CSV](evidence/full-review-20261114/coverage.csv) / [完整指纹 JSON](evidence/full-review-20261114/coverage.json)。
- [原始问题 JSON](evidence/full-review-20261114/findings.json) / [范围与合并记录](evidence/full-review-20261114/audit-status.json) / [交付核对](evidence/full-review-20261114/delivery-check.json)。
- [主要离线复现结果](evidence/full-review-20261114/repro-primary.json) / [原审核验证日志](evidence/full-review-20261114/review-baseline-verify.log)。

## 问题详情

### R01 · P1 · 失败交易不能作为释放跨链铸造占用的充分证据

- 位置：`src/lib/self-mint/reconcile.ts:62`。
- 范围：当前产品与发布流程。
- 触发：ETH授权仍在15分钟有效期内，登记一个失败交易哈希；后台查询orderId映射仍为0。即使该哈希确实来自一次失败redeem，也不会使原签名失效。
- 影响：已获ETH功能权限且持有本人有效凭证的用户，可释放本人草稿占用、改走OP代付，而旧ETH授权仍可执行，破坏同一录音跨链互斥。不是盗取其他用户NFT的漏洞。
- 证据：repro-primary.json：无映射+失败回执返回reverted且voucherStillValid=true。server/reconcile-job.ts41–53清空发送标记并写release_verified_at；055_self_mint_rpcs.sql135–146随后允许release；EthereumScoreNFT.redeem只检查签名期限/链上映射，不读取数据库占用。未实施真实双链铸造。
- 维修方向：不能仅凭单笔失败回执释放占用；核对订单交易身份，并等待所有已签授权到期或完成链上撤销，再查询映射并释放。

### R02 · P1 · 长期未结束的开包订单会一直占住对账队首

- 位置：`app/api/cron/process-score-pack/cycle.ts:14`。
- 范围：当前产品与发布流程。
- 触发：最早的ETH submitted_unknown/confirming订单因交易丢失、取消或异常而持续waiting；每分钟入口batch=1。
- 影响：batch=1入口每轮都处理同一旧订单，后续订单不能通过该入口对账收口；独立batch=5入口需五个持续等待旧单才会完全阻塞。OP排队发送有独立查询、状态API也直接读链，因此不是所有开包停摆；受影响的是后台终态和失败/取消后的恢复。
- 证据：repro-primary.json调用真实runScorePackCycle三轮，处理序列old/old/old；steps.ts仅为OP缺失回执提供超时回退，rules.ts对submitted_unknown/confirming不执行超时放弃。active查询按created_at排序且未轮换。
- 维修方向：按last_reconciled_at/next_attempt_at公平轮询，隔离长期未知状态，让后续订单继续对账；不要为解决队首阻塞直接重发未知交易。

### R03 · P1 · 升级固定在已知漏洞范围内的Next版本

- 位置：`package.json:50`。
- 范围：当前产品与发布流程。
- 触发：当前16.1.6在Windows文件系统启动App Router服务且请求方能访问服务；next.config没有Cache Components。
- 影响：符合官方GHSA-p293-qw3h-jr36描述的Windows未认证远程执行影响范围。这里只确认版本/配置条件，没有执行攻击，也不能据此宣称Vercel Linux线上已可利用。
- 证据：锁文件next16.1.6，package脚本next start默认监听所有地址（本地node_modules/next/dist/bin/next:125）；npm audit命中，官方公告2026-08-25明确16.0至16.3.3前受影响。另sharp0.34.5需随升级处理Linux图像优化公告，但远端恶意SVG输入未证明可达。
- 维修方向：在独立修复中升级到包含相关安全补丁的兼容版本、更新锁文件并回归构建和业务测试，不直接npm audit fix --force。
- 来源：[官方公告](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
- 来源：[官方公告](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw)

### R04 · P2 · 不要用当前持有人否定已经成功的铸造

- 位置：`src/lib/self-mint/reconcile.ts:82`。
- 范围：当前产品与发布流程。
- 触发：ETH铸造成功后、后台对账前，合法接收人将NFT转给其他地址。
- 影响：已匹配orderId、tokenURI和铸造事件的成功订单被判链上不一致，进入manual_review，播放快照和档案完成状态无法正常收口。
- 证据：repro-primary.json用正确映射/URI/ScoreRedeemed事件但转出后的owner运行真实inspectSelfMintOrder，抛出owner不一致；合约允许正常ERC721转让。
- 维修方向：以成功铸造交易和ScoreRedeemed中的原接收人为凭据；将当前owner作为独立的可变持有关系。

### R05 · P2 · 录音预览需绑定具体录音和可见页面

- 位置：`src/hooks/useEventsPlayback.ts:26`。
- 范围：当前产品与发布流程。
- 触发：个人档案预览过录音后切回首页，再播放同一原曲；或同曲多条录音的events已加载。
- 影响：隐藏但仍挂载的录音行只按trackId判断归属，会同时触发旧录音音效，原曲播放混入草稿，多个草稿也可能叠播。
- 证据：RecordingArchiveRow.tsx69调用本hook；PersistentRouteSurfaces.tsx118–123用aria-hidden/inert保留PreparedArchive挂载；hook只读playing/currentTrack.id，未识别recordingId或当前预览会话。静态调用链核验，未做真实登录浏览器演练。
- 维修方向：增加唯一预览会话/录音标识，只有当前选中的预览实例可触发事件；离开预览或播放原曲时取消事件源。

### R06 · P2 · 预览前按按下时间排序录音事件

- 位置：`src/hooks/useEventsPlayback.ts:41`。
- 范围：当前产品与发布流程。
- 触发：先按住A，在松开A前按下并松开B，录制数组按松键顺序保存为B在前、A在后。
- 影响：顺序游标等到B的时间才播放A，预览节奏与原录制不一致；永久播放路径另有排序，所以两处听感也不一致。
- 证据：useRecorder.ts131–135按keyup追加。repro-primary.json真实useEventsPlayback：A时间100ms、B时间1000ms且数组[B,A]，100ms无声音，1000ms同时播放B/A。
- 维修方向：在录制完成或预览输入边界按time稳定排序，确保同刻事件保留确定顺序。

### R07 · P2 · 拒绝钱包后保留ETH开包重试入口

- 位置：`src/components/score-pack/ScorePackPanel.tsx:45`。
- 范围：当前产品与发布流程。
- 触发：用户点击ETH开通，后端先创建awaiting_wallet订单，随后切链失败或用户拒绝钱包交易。
- 影响：刷新状态后显示等待钱包，隐藏唯一开通按钮；重新进入页面仍无法继续，只能等待约30分钟后的后台放弃或人工处理。
- 证据：useScorePack.ts98先取voucher，102才switchChain，108才writeContract；finally调用refresh。issueSelfPaidVoucher先reserve订单。STATUS_KEY包含awaiting_wallet而progress分支没有恢复操作。静态核验，未签真实钱包。
- 维修方向：为awaiting_wallet提供继续/重试按钮，复用现有订单重新签发凭证，并保留用户拒绝后的恢复路径。

### R08 · P2 · 补足球数时不要重写正式曲目身份

- 位置：`src/components/archipelago/sphere-config.ts:129`。
- 范围：特定配置或数据条件。
- 触发：当前 / 首页或 /lens 获取非空但少于35首的列表，或A组因published筛选不足35首。
- 影响：真实曲目的week被改成数组位置，重复球拿到不存在的-fill-曲目ID；这些球仍播放复制音频，但 /lens 用node.id查正式原曲注册表，找不到详情和收藏面板，颜色也不再对应原曲。当前完整35曲数据不触发。
- 证据：真实源码转译断言：输入id=track-two/week=2与id=track-three/week=3，padTracksToTarget(...,35)输出前两项week=1,2，第三项id=track-two-fill-2/week=3。当前pond-gl-test3/spheres/use-gl-sim.ts:132-133仍调用该函数，simulation/nodes.ts:58-62直接把t.id设node.id；src/features/lens/LensLayer.ts:96-100通过getOriginalTrack(node.id)决定面板渲染。
- 维修方向：正式Track的id/week保持不变。部分列表直接渲染实际曲目数量；若产品必须补视觉圆，将renderNodeId与原曲身份分离，并让播放、详情和收藏始终引用原始Track。

### R09 · P2 · 动态导入完成后注册按键前检查组件是否仍挂载

- 位置：`src/components/animations-svg/SvgAnimationLayer.tsx:26`。
- 范围：旧实验页面、原型或手动样式。
- 触发：旧版 /v1 或 /test 首次挂载，在engine动态导入完成前卸载；开发StrictMode的setup→cleanup→setup必现同类竞争。
- 影响：cleanup运行时尚未赋值，稍后仍注册全局keydown；StrictMode后每按一键生成两份动画，卸载后旧监听残留，反复进入会继续累积。该问题不在当前首页GL动画入口。
- 证据：对真实TSX源码transpile后执行捕获的useEffect：setup、cleanup、setup，再排空动态import微任务，得到2个keydown监听；按q产生2次trigger；最后cleanup后仍剩1个监听。effect没有cancelled变量或导入后的存活检查。
- 维修方向：同步创建取消标记，cleanup立即标记取消；动态import返回后先检查标记，再设置状态和注册事件；cleanup同时解除已注册的监听。

### R10 · P2 · 按最终屏幕坐标剔除平移或缩放后的旧版球体

- 位置：`src/components/archipelago/hooks/use-sphere-sim.ts:168`。
- 范围：旧实验页面、原型或手动样式。
- 触发：在 /v1 或 /test 放大后拖动空白区域平移画布，把已被剔除的球移回可视区域；手机非perspective模式下缩放/平移也受影响。
- 影响：剔除仍比较父zoomG变换前的x/y，已移回屏幕的球仍display:none，形成空洞；反方向移出屏幕的球又不能正确剔除。当前首页GL渲染未使用此hook。
- 证据：同文件x/y仅经过persp，剔除直接与svg.clientWidth/Height比较；use-sphere-zoom.ts:91-98在父zoomG额外设置translate或完整scale+translate。例：视口宽800，球x=1200/r=20，父层translateX=-800后实际屏幕x=400，但判定1200-23.2<850为false，始终隐藏。
- 维修方向：将父zoomG的当前平移/缩放合并进屏幕坐标和半径后再剔除，或将视口反变换到球坐标系。验证鼠标平移及手机双指缩放后球可重新入屏。

### R11 · P2 · 持有人快照读取失败时应停止创建可分发空投

- 位置：`app/api/airdrop/trigger/route.ts:108`。
- 范围：特定配置或数据条件。
- 触发：管理员触发空投时chain_events查询返回Supabase error、data=null。
- 影响：失败被当成无持有人，接口返回200成功并将轮次标为ready；分发器没有收件人可处理，合法持有人整轮漏发且同一round再次触发会409。
- 证据：真实路由离线复现repro-auth-api.cjs：注入chain_events读取失败后，响应recipientCount=0、result=ok，且写入status=ready。snapshotOwners仅解构data并使用events??[]。
- 维修方向：检查快照查询error并在失败时拒绝发布；将创建轮次、可靠快照和ready提交置于可重试事务/状态流程。

### R12 · P2 · 把已计算的唱片队列分布写入健康响应

- 位置：`app/api/health/route.ts:69`。
- 范围：当前产品与发布流程。
- 触发：调用/api/health时score_nft_queue有pending/failed/success记录。
- 影响：result.scoreQueue始终保持初始化{}，监控和运维无法从该接口看到唱片队列积压/失败分布。
- 证据：dist逐项累计后从未赋给result.scoreQueue。真实路由离线复现repro-auth-api.cjs注入pending=1、failed=2，响应仍scoreQueue={}、HTTP200。
- 维修方向：查询成功后写result.scoreQueue=dist，查询失败应明确标注不可用；增加非空状态分布响应回归。

### R13 · P2 · OP收藏完成后同步更新本地等待状态

- 位置：`src/components/music-catalog/claim/MaterialMintPanel.tsx:94`。
- 范围：当前产品与发布流程。
- 触发：登录后首次领取一首OP原曲，POST返回pending，随后队列成功；同一曲目/身份的面板继续挂载。
- 影响：本地pending永久优先于缓存的新success，按钮一直禁用并显示等待/核对；即使进入lens触发状态刷新也不能显示已收藏入口。请求结果未知的本地needsReview同样无法被后续核验解除。
- 证据：collect第84-88行把POST结果写入local；第94行local ?? cached。后端op/service.ts在prepare_op_sbt_job之后读取状态，062_material_op_snapshot.sql:48-49首次明确插pending。MintStatusPrefetch的事件只更新共享cache，组件没有local清除或pending轮询。静态闭环核验，未发生产请求。
- 维修方向：以共享cache为唯一状态源，或收到新核验结果时替换/清除local；pending及不确定状态增加有界状态查询或明确刷新入口。

### R14 · P2 · 代码约束钩子需要识别实际app目录

- 位置：`.claude/hooks/check-forbidden-imports.js:41`。
- 范围：运维、验收或开发工具。
- 触发：在根app下编辑客户端页面或非cron API。
- 影响：前端私钥模块引用与API同步等待链上确认都被该钩子放行；这是开发防线缺口，不代表目前已泄露私钥。
- 证据：hooks-repro.json：真实hook的Write输入，两种违规内容均exit0；实际路由位于app而非src/app。
- 维修方向：按项目根相对路径统一识别app与src/app，配套修改行数/目录钩子的同类路径。

### R15 · P2 · 快照发布的 INSERT 触发器拒绝所有第二次修订

- 位置：`supabase/migrations/phase-15/052_permanent_core_queue_and_snapshots.sql:385`。
- 范围：当前产品与发布流程。
- 触发：已有某坐标revision1后，用publish_score_playback_snapshot发布不同snapshot_sha256内容；release/apply-release.ts 102–115调用支持此更新路径。
- 影响：第二次发布恒以FIRST_SNAPSHOT_REVISION_MUST_BE_ONE失败，revision历史插入及active更新一并回滚，无法通过既定RPC修正已发布播放快照。首次发布与相同内容幂等重试不受影响。
- 证据：459行明确计算current+1；470–474行使用INSERT VALUES(revision2) ON CONFLICT DO UPDATE。PostgreSQL逐行BEFORE INSERT先于冲突UPDATE执行，故387行先抛错；未发现后续迁移替换该触发器。官方语义：https://www.postgresql.org/docs/15/trigger-definition.html 。未在真实PostgreSQL运行。
- 维修方向：在已持有坐标事务锁时分别执行首次INSERT和后续UPDATE，使触发器按实际操作验证首版/递增；补充revision1→2、旧内容回滚及幂等重复发布数据库测试。

### R16 · P2 · ETH 自付准备的每小时限额可被不同草稿并发穿透

- 位置：`supabase/migrations/phase-16/058_score_token_counters.sql:87`。
- 范围：当前产品与发布流程。
- 触发：同用户已有4单时同时准备两个不同pending_score_id，且封面池有至少2个可领取项；两个事务都在任一新订单提交前完成计数。
- 影响：两次请求均通过每小时5单限制，创建第5和第6单；更多草稿可同样并发。prepare API返回后自动运行平台承担的Arweave资产上传，超出原有限额保护。
- 证据：62–64只按pending_score_id加锁，不同草稿不互斥；87–90读取用户计数后，121行才锁共享token counter，后续insert不重查额度。因此counter只保证token唯一，不保护先前计数。app/api/self-mint/prepare/route.ts 25调用此RPC，51–54 after自动执行资产任务；未找到后续函数覆盖。未在真实PostgreSQL执行并发测试。
- 维修方向：在计数前按user_id获取事务锁并覆盖到订单插入，保持统一锁顺序；增加不同草稿并发请求只能剩余配额数成功的真实数据库测试。

### R17 · P2 · 订单弹窗应在异步内容挂载后接管键盘焦点

- 位置：`src/components/mint/hooks/useMintDialogFocus.ts:8`。
- 范围：当前产品与发布流程。
- 触发：从档案用键盘打开自费订单；SelfMintOrderView 首次渲染 order/error 都为空，返回 null，读接口完成后才出现 dialog。
- 影响：焦点仍停在被遮住的档案按钮，Tab 可继续操作背景内容；屏幕阅读器也不会被引导到订单，aria-modal 的键盘边界不成立。
- 证据：SelfMintOrderView.tsx:30,47,147 的初次 effect 运行时 ref 为 null；本 effect 依赖三个稳定 ref，异步 setOrder 不触发重跑；13-24 的 Tab 拦截仅在焦点已经是弹窗首/末元素时生效。静态生命周期验证。
- 维修方向：将聚焦副作用绑定实际 dialog 挂载/可见状态，并将弹窗外焦点收回、实现首尾循环。

### R18 · P2 · 充值后应重新读取余额而非复用永久交易计划

- 位置：`src/hooks/useEthereumScoreMint.ts:40`。
- 范围：当前产品与发布流程。
- 触发：首次打开 ready_to_sign 订单时钱包 ETH 不足，随后用户给同一钱包充值。
- 影响：plan.hasEnoughBalance 永远沿用首次 false；当前弹窗即使刷新订单也保持确认按钮禁用，重新估算也仅复用旧计划，用户需关掉再开弹窗才能继续。
- 证据：成功 plan promise 仅以 orderId:walletAddress 缓存，无TTL/余额失效；prepareOrder 56-64重新取美元价格但读取缓存 enough；SelfMintOrderView 143-145 仅canSend变化触发，195-196 仅gasError提供重算，206-207 refresh只load订单；sendOrder84也拒绝旧false。
- 维修方向：为重新估算提供强制刷新计划的路径，并允许余额不足状态主动重估；对余额/Gas添加有效期。

### R19 · P2 · 开包详情与操作面板应共享同一份状态

- 位置：`src/components/score-pack/PackView.tsx:17`。
- 范围：当前产品与发布流程。
- 触发：首次进入尚未创建开包订单的 pack 页面，并直接在该页底部点击开通。
- 影响：子面板轮询后显示已开通，但父级永久显示账户未部署、包未打开、素材为空，直到整页重载。
- 证据：PackView17与ScorePackPanel26分别创建useScorePack；hook63-68仅status.order活跃时轮询，父实例初始order=null所以不轮询；操作后的refresh125仅更新子实例；父无共享缓存/事件或刷新回调。
- 维修方向：在父级建立单一useScorePack实例并向子级传递状态和操作，或开通后通知父级刷新并跟踪该订单。

### R20 · P2 · 恢复录音行时应还原已保存的自动开包选择

- 位置：`src/components/me/archive/RecordingArchiveRow.tsx:55`。
- 范围：当前产品与发布流程。
- 触发：勾选自动开包使POST成功后，刷新页面或翻页使录音行重新挂载，然后在未勾选的显示下铸造该录音。
- 影响：界面显示未选择自动开包，数据库却仍保留原意图，后续会自动提交开包订单；用户无法从当前显示判断实际选择。
- 证据：wantPack始终初始false，组件没有读取已有intent；POST intent/route.ts23-28持久化upsert/delete；cron/process-score-pack/intents.ts53-56直接消费已保存意图。与已知队首阻塞不同。
- 维修方向：在录音数据中返回并初始化持久化的wanted状态，提供加载/保存状态，提交铸造前确认最新选择已保存。

### R21 · P2 · 不要把 noopener 的空返回值当成分享窗口被拦截

- 位置：`app/(pond)/score/[id]/components/ShareActions.tsx:64`。
- 范围：当前产品与发布流程。
- 触发：在任意作品页点击「分享到 X」或「分享到微博」，浏览器正常支持并允许新标签页。
- 影响：新标签页已经打开后，当前作品页仍会被替换成同一个外部分享页；用户会同时得到两个分享页面，作品播放与当前页面状态被中断。
- 证据：openIntent 调用 window.open(target, '_blank', 'noopener,noreferrer') 后立即执行 if (!popup) window.location.href = target。MDN Window.open 的 noopener 定义明确说明此选项会返回 null，即使新页面已成功创建；noreferrer 同样隐含 noopener。已逐行追踪ShareActions调用，规则来源：https://developer.mozilla.org/en-US/docs/Web/API/Window/open#noopener 。本项为源码与浏览器API合同核对，未冒称生产浏览器实测。
- 维修方向：使用带 target='_blank' 和 rel='noopener noreferrer' 的真实分享链接，或取消这个依据返回值的同页跳转分支；需要备用入口时显式展示可点击链接。

### R22 · P2 · 窗口缩小时同步 Score 播放球的物理边界和锚点

- 位置：`app/(pond)/score/[id]/components/use-score-pond-sim.ts:113`。
- 范围：当前产品与发布流程。
- 触发：作品正在播放，保持相同指针能力（例如桌面用鼠标）将窗口从1440px缩窄到390px；手机横竖屏切换同样不重建模拟。
- 影响：resize只改视口记录和球半径，未更新物理模拟捕获的旧宽高及cluster锚点；播放球/日食仍会向旧画面坐标漂移并被允许留在新视口之外，导致视觉主角部分或完全消失。暂停后归位会掩盖问题。
- 证据：该hook仅在generation/track/perspective变化时setupGlSimulation。resize的播放分支只调用recordCenter，未修改node.x/y；setupGlSimulation在src/components/pond-gl-test3/spheres/gl-sim-setup.ts闭包捕获width/height，cluster-x/y也保存旧anchorMap。已用本地tsx导入真实buildGlNodes/setupGlSimulation，按该hook播放分支解除固定并关闭center强度，在1440×900初始化后模拟缩窄到390×844；600次真实物理tick后x=707.185，旧clusterTarget=707，仍超过390。共享resizeGlSim已有同步anchors、center和tick边界的实现，而此hook未调用。
- 维修方向：保留setupGlSimulation返回的anchors，在resize时同步节点位置、力场锚点与tick边界（可复用resizeGlSim），同时保留当前播放/归位状态；增加播放中横竖屏或窗口缩小后的整球可见性回归。

### R23 · P2 · OP Sepolia 页面读取固定 OP 主网快照后重标资产身份

- 位置：`src/data/score/multichain.ts:128`。
- 范围：特定配置或数据条件。
- 触发：环境启用 OP Sepolia，访问该链配置合约某 token 页面且快照库存在同号历史主网快照。
- 影响：播放同号主网录音，却标记为测试网资产；无同号主网快照则测试网页面不存在。当前生产主网配置不触发。
- 证据：getScoreById numeric 路径调用无资产参数的 getActiveScoreSnapshot；后者默认 chain10/固定主网合约。本函数仅覆盖外层 id/chainId/contractAddress。registry 支持测试网配置，实际四段 Score 页面调用本函数。
- 维修方向：按请求 chainId/contract 读取并校验快照；固定历史查询只服务主网简写。

### R24 · P2 · 流式底轨结束后时间线无法推进到音效尾声结束

- 位置：`src/features/score-playback/timeline-session.ts:73`。
- 范围：当前产品与发布流程。
- 触发：配置镜像流式播放且音效/P9尾声或取整后总时长超过底轨。
- 影响：底轨结束后位置冻结，永远 playing，P9不能完成且RAF持续。
- 证据：position直接返回baseStream.positionMs，而结束条件是position>=max(底轨,音效,P9)。实际TS转译内存验证：底轨停10000ms/总12000ms/AudioContext到20000ms，位置仍10000且onEnded=0。
- 维修方向：底轨ended后用AudioContext延续统一时间线，覆盖尾音。

### R25 · P2 · 永久 Score decoder 按按键时长计算结尾会截断音效尾音

- 位置：`src/score-decoder/index.html:58`。
- 范围：当前产品与发布流程。
- 触发：最后按键靠近底轨结尾，音效buffer时长大于按住时长。
- 影响：永久回放提前stop全部sources，音效尾声与站内回放不一致。
- 证据：load已解码soundBuffers，但total仅用event.time+event.duration；play播放完整buffer，tick到total停止。10秒底轨、9.9秒处50ms按键、2秒音效会截去1.9秒。
- 维修方向：使用实际buffer.duration计算每个事件结束点，与audio-decode保持一致。

### R26 · P2 · 开关扭曲水面时遗漏手建 GPU 场景资源释放

- 位置：`src/components/pond-gl/water/WaterDistort.tsx:108`。
- 范围：旧实验页面、原型或手动样式。
- 触发：/test1 保持同一Canvas反复开关扭曲水面。
- 影响：每轮新增两个离屏quad geometry/material，旧GPU buffer和program未显式释放，长期调试积累显存。
- 证据：makeQuadScene使用new PlaneGeometry/ShaderMaterial并加到独立Scene；该组件返回null，场景不在R3F树内，组件所有effect仅清监听/resetRippleFeed，没有geometry/material.dispose。drei管理的FBO清理不能覆盖这些对象。RttSpike同样存在。
- 维修方向：给手建QuadScene明确dispose方法，并在实例替换/组件卸载时清理geometry/material。

### R27 · P2 · 重置 P9 场次时同步清理消费者提交缓存

- 位置：`src/components/pond-gl-test3/p9/runtime/p9-state.ts:188`。
- 范围：当前产品与发布流程。
- 触发：ScoreP9Session.destroy() 在暂停、重播和离开作品页时调用 resetP9Runtime；随后播放相同键序列。
- 影响：声部 sequence 回到0但微光消费者已完成记录仍保留，后续相同 seed 被误判为已汇入，部分动画在作品重播时消失；旧粒子偏移和重生状态还会跨场景残留。
- 证据：真实源码复现 repro-p9-mote-reset.ts：M 首场与重置后首场 voice.seed 均为1261。首次75%进度 alpha=0，重播75% alpha=1且位置与静止态完全相同。p9-motes.ts:23-27 模块 Map 不清理，:70-71 consumedVoice 相同即跳过；ScoreP9Session.destroy:79调用reset。
- 维修方向：建立统一场次重置入口清理微光消费者状态，或让提交标识包含不会跨场次重复的 epoch/声部ID；增加重播与暂停恢复回归。

### R28 · P2 · 详情模式仍需记录拖动阈值，避免滑动被当成播放

- 位置：`src/components/pond-gl-test3/overlay/SphereHit.tsx:66`。
- 范围：当前产品与发布流程。
- 触发：手机 /lens 中已选中音乐圆，手指从该圆开始滑动超过8px后松开。
- 影响：lensMode 在记录 moved 之前返回，pointer capture 使移出圆的 pointerup 仍回到原按钮；松手被当成第二次轻点，意外开始/暂停播放并锁定视角。
- 证据：真实组件源码离线复现 repro-pond-hit-dpr.cjs：pointerdown(10,10)→pointermove(160,160)→pointerup，212px滑动仍activate=1且played=1。onUp:81仅检查moved；LensLayer.tsx:59-66已选中touch返回false进入播放。
- 维修方向：详情模式禁止改变球坐标，但仍更新移动阈值并取消轻点资格；为选中球上的大幅滑动补回归。

### R29 · P2 · 为音乐圆保留 click 激活路径

- 位置：`src/components/pond-gl-test3/overlay/SphereHit.tsx:99`。
- 范围：当前产品与发布流程。
- 触发：屏幕阅读器/语音控制通过辅助技术激活按钮，仅派发click而没有pointerup或keydown。
- 影响：首页原曲与个人Echo按钮有button/aria标签却完全没有click处理，这类用户无法通过按钮启动或暂停音乐；详情模式也不能进行选中/播放。
- 证据：完整按钮仅注册onPointerDown/Move/Up和onKeyDown，无onClick；离线执行真实组件返回clickHandler='undefined'。同目录驻留Echo实现EchoResidentHit.tsx:88已用event.detail===0处理辅助click，普通音乐圆遗漏。
- 维修方向：补辅助技术click激活路径，并与现有pointerup/keydown去重，保证一次操作只切换一次播放。

### R30 · P2 · 持续低于 10fps 时也应触发自动降清晰度

- 位置：`src/components/pond-gl-test3/auto-dpr.tsx:53`。
- 范围：当前产品与发布流程。
- 触发：高DPR设备前台水面渲染持续耗时超过100ms/帧（例如5fps）。
- 影响：每一帧都重置采样窗口，永远到不了低FPS判定，最需要降配的设备反而一直保持原DPR，页面持续卡顿。
- 证据：真实AutoDpr源码复现 repro-pond-hit-dpr.cjs：初始DPR=2，20fps运行10s得到[1.5,1]；5fps运行同样10s降配调用为[]。dt>100分支先于frames累加及窗口判定。
- 维修方向：用可见性/明确长挂起判断恢复帧，保留持续慢帧统计；覆盖5fps与切后台后恢复两种场景。

### R31 · P2 · 调整窗口尺寸后刷新聚类力缓存

- 位置：`src/components/pond-gl-test3/spheres/gl-sim-setup.ts:142`。
- 范围：当前产品与发布流程。
- 触发：主页或 /test3 已展示球群后缩放窗口、旋转手机屏幕。
- 影响：节点先等比缩放，但随后又被 cluster-x/y 拉回旧屏幕锚点；缩小或转屏后球群偏到旧位置或挤在边界，适配不能保持原布局。
- 证据：forceX/forceY 在103-104行初始化时缓存每节点目标；resize 只改 anchorMap，未再次调用 x/y setter 或 initialize。use-gl-sim 的 resize 监听只调用此函数。已完整检查本地 d3-force/src/x.js 的初始化缓存逻辑；pond-gl 旧版存在同源问题。
- 维修方向：缩放 anchorMap 后刷新两个轴向力的目标缓存，再重启模拟；以移动端横竖屏切换检查节点归一位置。

### R32 · P2 · 修正星河塘底星点的阈值分支

- 位置：`src/components/pond-gl-test3/shaders/pond-floor-shaders.ts:149`。
- 范围：旧实验页面、原型或手动样式。
- 触发：在水面调试面板选择第4号星河塘底（pondFloorStyle=4）；默认暗矿style=0不受影响。
- 影响：星河只剩星云背景，密星、疏星和星光全部恒为0，用户选择星河看不到设计中的星点。
- 证据：rnd∈[0,1)：rnd>threshold直接返回0，其余rnd<=threshold返回(rnd-threshold)/(1-threshold)<=0；下一层f4_starNeighborMax从maxStar=0开始取max，因此永远为0。提取实际GLSL函数体执行10001个rnd样本，在阈值0.92/0.96均得maxStar=0。
- 维修方向：对低于阈值的样本返回0，高于阈值样本映射为正亮度；补查starGlow中固定length(dir)/0.08权重也恰为1导致贡献为0。

### R33 · P2 · 素材交易回滚后清除旧发送戳，才能执行重试

- 位置：`app/api/cron/process-mint-queue/steps-helpers.ts:102`。
- 范围：当前产品与发布流程。
- 触发：素材 mint 回执明确 reverted，tryConfirmMinting 调用 resetToPending，下一轮领取同一任务。
- 影响：tx_hash 被清除但旧 mint_attempted_at 保留；新 stamp 必须 NULL，故不会再发送，3 分钟后被错误归类为未知交易人工复核，原曲领取无法自动恢复。
- 证据：steps.ts:158 的 is(mint_attempted_at,null) 与 helpers:102-106 不兼容；002_claim_pending_job.sql 和 062_material_op_snapshot.sql 均仅改 status/updated_at。真实模块离线复现 repro-material-retry.cjs 输出 retry result=blocked、sends=0，status=minting_onchain 且旧戳仍在。
- 维修方向：仅在已证明未发送/明确回滚的 reset 分支原子清除 mint_attempted_at，并保留未知广播时的保守限制。

### R34 · P2 · 预算耗尽退出前撤销尚未上传的 Echo 账本占用

- 位置：`app/api/cron/process-wallet-recipe/steps-metadata.ts:112`。
- 范围：当前产品与发布流程。
- 触发：claim_wallet_recipe_metadata_upload 成功创建 uploading 记录，但 RPC 延迟耗尽剩余响应预算。
- 影响：实际未调用 uploadBuffer 却遗留 uploading；下轮只会等待，5分钟后账本变成 upload_result_unknown，永久进入人工复核，用户应获得的 Pond Echo 无法自动完成。
- 证据：同文件79行先领取上传账本；049_wallet_recipe_queue.sql:311-336 新 claim 写 uploading，过期后转unknown。真实 step 和 decideUploadAction 离线复现 repro-echo-upload-budget.cjs：uploads=0，首轮response_deadline，次轮upload_in_progress，5分钟后manual_review。SQL规则以mock边界重现，未执行生产SQL。
- 维修方向：在领取上传前检查预算；领取后若能确定 uploadBuffer 从未启动，使用内容/owner/state CAS 撤销该次占用，避免把已知未上传当未知结果。

### R35 · P2 · 浏览器首枚验收完成后因 rm 未导入而总是异常退出

- 位置：`scripts/p14/mainnet/audit-first-token.mjs:192`。
- 范围：运维、验收或开发工具。
- 触发：两个视口审计正常完成，报告已成功写入，执行清理partial报告。
- 影响：rm不存在导致ReferenceError；工具无法打印最终汇总并以非零退出，即使report.pass为true也被CI/操作者判断失败。属于验收工具缺陷，不影响运行中的用户功能。
- 证据：第2行node:fs/promises仅导入mkdir、mkdtemp、writeFile，全文件没有定义rm；192行每个VIEWPORT调用rm，两个视口数组非空。
- 维修方向：从node:fs/promises导入rm，并以隔离文件夹测试成功流程能够正常退出。

### R36 · P2 · 测试开包脚本允许把固定测试素材永久写入主网 Score

- 位置：`scripts/p22/e2e-open.ts:19`。
- 范围：运维、验收或开发工具。
- 触发：按文件顶部的“只用于测试网”说明运行，进程却继承CHAIN_ID=1或10及真实RPC/合约/signer配置。
- 影响：脚本接受主网并签发固定trackTokenId=1、soundIds=[1,2,3]的凭证，无视该Score真实播放快照；open成功后opened永久锁定，不能再给这枚Score补开正确资产包。
- 证据：19行显式选mainnet/optimism，30行硬编码测试素材，34–37直接发open；ScorePackOpener opened映射只允许开一次。此为维护测试工具风险，未执行。
- 维修方向：仅允许显式测试链且校验RPC实际chainId；若需主网验收，独立入口从该Score已验证快照派生真实素材，并要求reviewable输入。

### R37 · P2 · 续传复用旧条目前应核对当前文件的内容哈希

- 位置：`scripts/p22/upload-assets.ts:21`。
- 范围：运维、验收或开发工具。
- 触发：某图片或metadata已上传，在保持相同image:sound或sounds:<id>键的情况下调整输入文件后重新运行上传脚本。
- 影响：旧uploaded条目直接返回旧txId，当前新字节根本未检查/上传，却生成成功的asset-uris.json；后续不可变defineTokens可能登记旧metadata，或者新metadata仍引用旧图片。
- 证据：23行在计算25行sha256之前返回known.txId；ledger已保存sha256但没有任何与当前buffer对比。脚本最后68–69照常写出URI及完成日志。
- 维修方向：先计算当前sha256/bytes/contentType并与已上传记录严格比较；不一致时停止并要求显式新版本身份，不能静默复用旧URI。

### R38 · P2 · 充值确认超时后应对账既有交易而非重跑转账

- 位置：`scripts/arweave/topup-turbo.ts:76`。
- 范围：运维、验收或开发工具。
- 触发：Base充值已发送，但Turbo余额超过5分钟才更新，操作者按错误文案重跑本脚本。
- 影响：第二次运行再次执行topUpWithTokens；使用显式金额时重复充值，默认模式也会把剩余ETH再次转换为credits。
- 证据：第55行无条件发新充值，脚本没有保存/恢复交易身份；第76行明确建议超时后重跑，重跑不会仅查询第57行打印的旧txid。这是手工运维脚本问题，不是前端ETH提交流程。
- 维修方向：持久保存已发交易并提供仅对账模式；超时文案禁止重跑付款，恢复时先确认既有txid和credits状态。

### R39 · P2 · 把进入error状态的首声样本判为失败

- 位置：`scripts/p15-i/measure-score.mjs:101`。
- 范围：运维、验收或开发工具。
- 触发：Score点击后资源失败，页面进入playbackState=error且没有首声排程标记。
- 影响：该样本仍被计入valid，所有冷暖样本都播放失败时report.pass仍可为true且退出码为0，使发布性能验收产生假通过。
- 证据：69-70行等待条件允许error；随后正常return样本，不设置error字段。summary只按!item.error计valid，121行只比较valid与tokens.length，无播放态或有限首声指标条件。
- 维修方向：样本返回前要求播放态成功且首声标记存在；汇总valid和最终pass须包含这些条件，并检查页面运行时错误。

### R40 · P2 · 移除转场启动时重复注册的动画帧

- 位置：`src/components/pond-shell/motion/use-route-presence.ts:36`。
- 范围：当前产品与发布流程。
- 触发：快速切换路由，或转场尚未结束时incomingReady/pathname变化使effect重建。
- 影响：tick(started)内部已经排帧，随后又排第二帧；清理只取消其中一条，旧owner循环继续写共享presence和所有前景的opacity/visibility，和新导航同时控制显示，造成转场闪动/旧页面重新显现；多次快速操作继续叠加到各旧循环结束。
- 证据：tick第34行在elapsed<duration时自排RAF，36行同步tick后37行再排RAF。以原调度逻辑本地替代RAF队列复现：首次effect队列2；cleanup后旧回调仍1；新effect后的下一帧写入顺序home,archive,archive，队列仍3。
- 维修方向：只保留一处首次调度，并在清理时设置失效标记，确保旧循环不能再更新DOM或排下一帧。

### R41 · P3 · 在跳过注释前检测占位标记

- 位置：`.claude/hooks/check-forbidden-imports.js:65`。
- 范围：运维、验收或开发工具。
- 触发：写入独立一行// TODO或// FIXME注释。
- 影响：第4条占位符检测永远看不到最常见的独立注释，约定不会被强制执行。
- 证据：hooks-repro.json：// TODO: implement later真实hook exit0。
- 维修方向：先检查受禁占位标记，再跳过其他注释。

### R42 · P3 · 原型复制回调需在 await 前保存按钮节点

- 位置：`references/visual-prototypes/p14-pond-echoes/app.js:72`。
- 范围：旧实验页面、原型或手动样式。
- 触发：打开保留的 P14 原型并点击复制配方，clipboard.writeText 异步完成或拒绝。
- 影响：复制成功也无法显示成功提示；处理成功回调时抛错后 catch 再次访问 null，产生未处理异常。仅影响旧视觉原型，不是当前产品入口。
- 证据：DOM 事件 currentTarget 只在事件分发期间有效；handler await 返回后第75行的 event.currentTarget 为 null，第77行同样访问它。用原生 EventTarget + Promise.resolve 的离线验证输出 before=true、after=null。
- 维修方向：进入处理器即保存 const button = event.currentTarget，再在异步成功/失败分支使用该按钮引用。

## 第三方工具附录

详见 [原始附录](evidence/full-review-20261114/third-party-notes.json)：dealERC721 自转时余额辅助写入异常、StdConfig 字符串回写未转义。均未发现当前项目调用，未计入上方 42 项，不作为业务已存在的线上故障。
