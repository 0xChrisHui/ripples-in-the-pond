# 夜间开发晨间验收包

runId：20261002-night-01。原夜间批次交付为本地整合候选，未执行外部写入。2026-10-03用户追加网站部署授权并说“继续”，网站发布适配另见下节；永久上传、数据库迁移、主网/测试网真实交易和SEMI联系仍未执行。

## 2026-10-03追加网站发布（与原本地交付区分）

生产基线main@1514108，发布树`E:/Projects/nft-music-progress-release`，分支`codex/night-production-20261003`。发布原曲目录/试听/公开页/本人订单、同源清单、导航/登录/我的必要文案与分享B；适配Track永久身份/网关字段及当前multichain模块路径，保留生产PondShell、GL/visitor、focus bus、Score/Echo渐进预取和Privy认证SDK。夜间P14/视觉时序未切换生产，完整本地候选仍为8db180e；不要把两个版本说成字节相同。新增原曲签发、新OP队列与数据库未启用，70项留存仍0/70。

当前验证：清理本发布树历史生成的损坏路由类型，按真实源码重新typegen成功；项目tsc和定向lint退出0，35曲/主线播放器永久来源轮转、订单恢复与真实发送器未部署拒绝、ETH独立off/allowlist/未部署/历史资格、分享作者/旁听者/规范URL专项通过。C1与SEMI export --check通过，同revision不变；真实wallet/DB/SEMI不记通过。Vercel生产环境已只读核对，新原曲开关未配置，默认关闭。外部执行目标/费用边界和回退部署登记在coordinator-baseline，候选部署与正式域名结果在完成后追加。

发布审查补齐原曲页卸载停止试听：只停止来源属于本曲的HTMLAudio，不影响另一首曲目或生产独立播放引擎。新增归属清理断言实际RED→GREEN，补丁后类型/lint通过，只读复核无新阻塞。首个候选Ready但缺此补丁，保留为未推广候选；只重建最终发布代码。

**网站发布完成**：生产代码SHA `60d75f80770fcda55b80110269bd63fbaa1e4e6c`（单个发布提交快进main，远端核对一致），最终Vercel候选`dpl_9MY3RoJHnJ7tdFeesE5kpqGwvEmX`云端构建通过/Ready、sourceSha一致，候选检查后promote成功。2026-10-03 02:31 +08正式域名解析到该Ready部署，匿名HTTP页面与安全断言全部通过。收尾文档不改变代码/依赖/配置，复用该证据；Git自动部署同源码可能替换部署ID，不另跑相同页面/合约矩阵。

- 正式首页：https://pond-ripple.xyz/ 。
- 正式曲目馆：https://pond-ripple.xyz/tracks 。
- 正式本人原曲订单入口：https://pond-ripple.xyz/me/material 。需本人登录；新原曲数据库/发行仍关闭。
- 正式目录：https://pond-ripple.xyz/api/music-catalog 。35首/70状态/revision与同源快照完全相同，SEMI未实际接入。
- 最小smoke：上述页面及同源原曲2、/me均200，无404 fallback；/score为预渲染200+meta refresh/NEXT_REDIRECT到/tracks；订单API与ETH prepare无登录401、新OP状态503。没有执行真实登录、媒体完整播放、资金操作或数据库写入。
- 回退：上一版Ready部署`dpl_57TnRhFt2FsVkqJQJbQQ2GmUYugV`保留，只有确需恢复时再推广，不做破坏性git回滚。

2026-10-03后续补齐35首用户创作手记：网站registry/公开快照/SEMI包同源，当前revision `928e698244bdd88ec77eca8644944bbf832474968e90e5ffb12a49bc06a5f5b7`，35首notes均final；正文、括号补记、日期与段落保留。旧夜间3115候选仍是原冻结版本，不将新网站数据说成已写入该旧产物。手记为网站可更新内容，原永久metadata未改写或重传。

## 立即打开

- 首页：http://127.0.0.1:3115/ 。第36圆会随机显隐；没有出现时稍等，不是新原曲。
- 曲目馆：http://127.0.0.1:3115/tracks 。35首目录，无需登录试听。
- 独立原曲2：http://127.0.0.1:3115/score/material/10/0x03504aeb95ebe3dc8c427b7b147f873f9948a299/2 。地址来自同一catalog注册表。
- 我的：http://127.0.0.1:3115/me 。当前只验了未登录入口；本地禁止认证写入，不要求你在这里做真实收藏。
- 原曲订单：http://127.0.0.1:3115/me/material 。本人查询/独立详情/已有交易hash恢复已接线；当前只读预览未启用真实登录、订单数据库或钱包操作。

服务运行目录：`E:\Projects\nft-music-p15-verify`，PID 25536，端口3115（仅本机）。停止：`Stop-Process -Id 25536`，先核对该PID仍对应本目录的Next服务；当前PID记录为`.tmp/night-final-server.pid`。
恢复：在该目录先执行`$env:LOCAL_REVIEW_ONLY='1'`，再运行 `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3115`；保持本地只读，不拷贝生产写入密钥。需要重新构建时运行 `npm run build -- --webpack`。
原夜间批次当时未push；追加网站发布已完成main推送，范围见上节。原工作目录仍在原分支，不要用原目录3000服务误验本批代码。

用户睡前明确延期UI打磨、不再要求验收；第36圆/曲目馆已有修复保留，观感不列为当前继续施工门槛，也不冒称已验通过。继续完成了P17原曲收藏客户端、本人订单列表/详情、已有hash恢复和/score根入口，定向回归/type/lint、只读审查与最终构建/HTTP通过。当前可试听原曲；Score #1媒体读取失败，不能作为已通过的唱片退场样板。

## 集成身份与现场保留

- BASE_SHA：`e6985bec5ef6d6f191526e6f2e5b58caa5414357`。
- 集成分支：`codex/night-integration-20261002-night-01`；最终完整SHA由此分支HEAD唯一解析：`git rev-parse codex/night-integration-20261002-night-01`，随最终交付消息给出。避免将自身提交SHA循环写入提交内容。
- 最终实际构建代码SHA：`44664144777039be5a4088210243b674b32b8793`，buildId `7qjULHmcekOojLZTdFcSn`；2026-10-03集中Webpack构建退出0，57静态页，包含ETH政策、OP新SBT、既有UI修复与新增原曲订单接线。之后只更新交接/状态文档，代码/依赖/环境未变，复用该构建。3115已刷新为这份只读产物。
- 旧K2实际浏览器代码SHA：`6dfa1bef0cfb05cde5a0938fef480bc7cfcd6e18`；仅复用未变的播放/身份/路由等断言，不能作为当前UI最终画面或新增签发真实钱包运行证明。
- 本次后续提交：`d3d6b068df24bbf6bb347694e8a8e038c052d787`确认ETH政策实现；`d177e45`新增OP原曲SBT/冻结目标队列；`54fed83`修复第36圆和首屏播放；`4466414`接通本人原曲订单与安全恢复。
- P15-X：`4990dcbe72892a19e42941794be64b3430a14265`。
- P14-H：`9e7140be1def11ff03c4811d559da491f3ed4bfe`。
- P17：`16c18dc6c3060b470e0729673d1e728228220b84`。
- P13：`70dbc0dee536552e63612e626f580ccb65398aca`。
- C1提交：`0e1195f04222c0e441989cb9ca74304a37801b7f`；revision `e88df51c6f8bfc731aa686bef1c7ae2bb72a2bfb23e98d874fc5fa16f0538767`。
- C2提交：`624216cb8b35c6b7883ae87693bf7cfb38487c32`；当前revision `5e7241cbc7e234c1180e1d69231eba912fe39f0746727aa7891d761137f57eac`。
- 四线均正常merge，C1/C2原身份保留；总控唯一修改共享播放器/GL/water/导航/公共文档和安全预览接线。
- 原目录HEAD `001a21dd60c96adf0fa72cfb47f217885132a655`、index空、status与K0备份完全一致。必要用户seek/CSS/播放器进度纳入BASE；未纳入本轮的改动仍在原目录和私有恢复目录。
- 私有恢复目录 `E:\Projects\nft-music-night-backup-20261002`：tracked/staged binary patch、233个untracked副本及233/233 SHA256校验、必要纳入清单；不把素材/凭证备份提交Git。
- P17/P13最后收尾容量故障由总控在原各自工作树完成，不重复已有链/媒体证据，不另开测试服务。

## 十项需求完成表

下表记录原夜间完整本地交付，并单列实际生产范围；本地通过不等于所有夜间代码已发布。UI观感与真实登录不要求本轮验收。

| # | 需求 | 本地状态 | 实际生产范围 | 证据与具体边界 |
|---|---|---|---|---|
| 1 | OP/ETH切换稳定 | code_ready；UI延期 | 保留最新主线；夜间布局改动未移植 | 固定标签/说明/按钮占位与类型lint完成；真实已登录状态未验，需要认证环境；不要求当前UI验收 |
| 2 | /me异步布局稳定 | code_ready；UI延期 | 保留最新主线；夜间布局改动未移植 | 固定布局、错误/重试分支完成；未登录页实测。cache→verified/error需要真实账号，未造状态；不要求当前UI验收 |
| 3 | 删除旧Echo入口、不抢焦点 | passed | 导航已发布；焦点沿用主线 | 无旧Echo导航，曲目在艺术家旁；夜间首次/关闭登录/返回BODY、主动Tab、真实按键声音通过，3键FX42动效accepted |
| 4 | 作者/旁听者分享 | passed（本地） | 默认B已发布 | 默认B一版运行，A/C留handoff；身份与chain-aware URL/编码专项通过，无实际发帖 |
| 5 | 第36圆常驻运动 | code_ready；UI延期 | 夜间新增运动仅本地，生产GL保留 | 首次1×1展开的零路线回归先红后绿；轻边缘波/光晕由可冻结驻留时钟驱动，四组测试通过。观感按用户指令延期，不能称视觉验收通过 |
| 6 | 唱片自然结束过渡 | code_ready；真实媒体未验通过 | 夜间过渡仅本地，生产引擎保留 | 生命周期/连续fade/取消旧回调测试通过；Score #1一个永久音效网络不可读，error与重试现场已保留，不称退场实测通过 |
| 7 | 登录称谓 | passed（本地入口） | 文案已发布；真实登录未验 | 定向搜索、实际本地登录窗“SEMI社区身份”；“链上地址登录”代码完成，真实钱包操作未验 |
| 8 | 35首双链永久留存 | external_pending | 未执行 | OP35合约/冻结URI/metadata核验、音频HEAD/长度对应；ETH35未部署；70条留存confirmed0，不把历史发行当项目留存 |
| 9 | SEMI实际接入 | external_pending | 同源资料包已入main，未实际接入 | 同源资料包7项测试/导出/check通过，OP35资料ready；钱包内识别/持有/数量/播放未验，未联系对方 |
| 10 | 曲目馆与原曲收藏 | code_ready；UI延期 | 目录/试听/公开页/订单代码已发布；新发行关闭 | 35目录/切选/永久试听/独立页/同源凭证；ETH prepare客户端、本人订单列表/详情与手工/缓存hash恢复、/score根入口已接通。unknown不重发、错钱包拒绝。ETH政策与OP新SBT本地接线完成；真实部署/DB/收藏未开放，首屏视觉打磨延期 |

A键既有FX01需日食才绘制，空闲首页不绘制该效果；A声音真实触发，3键环境动效真实通过。未改P9编舞规则来满足验收脚本。

## 验证与复用

| 范围 | 实际结果 | 可追溯位置 |
|---|---|---|
| 本地构建 | 2026-10-03最终`next build --webpack`退出0，57静态页、新订单动态路由生成；沿用既有依赖/打包选项 | 最终代码SHA/buildId见上；`.tmp/night-final-build.log`和`.tmp/night-final-server.log`保留输出 |
| 新产物HTTP验收 | `/`、`/tracks`、同源原曲2、`/me`、原曲订单列表/合法ID未登录详情均200；/score 307到/tracks；非法/零ID为notFound/noindex，旧P16重定向目标保留（流式HTTP200）；目录35曲同revision；私有查询/收藏/cron/短信503 | 同份P17交接记录实际断言及探针修正；不是浏览器绘制、真实登录/数据库或mint验收 |
| 项目类型与定向lint | K0、四线、总控显式路径检查退出0；新脚本no-ignore lint，diff检查 | 四个唯一handoff与总控记录 |
| P15体验逻辑 | 6/6 passed：生命周期/取消/重播/reduced-motion、作者/旁听者、B文案、URL特殊字符与两链身份 | [P15交接](p15-x-handoff.md) |
| P14-H | 数学/生命周期/呈现适配/命令四组通过，≤200行、单层≤8 | [P14交接](p14-h-handoff.md) |
| 原曲合约安全 | 2026-10-03生产具体合约16项Foundry测试通过，amount fuzz256次；TS/Solidity固定向量一致。钱包每曲一次/转出不恢复/回调回滚/正常转让均覆盖，未部署 | [P17交接](p17-handoff.md#2026-10-03--已批准eth发行规则的本地实现) |
| 幂等恢复 | 本地31337真实回执/双事件/recipient/calldata/丢hash、unknown不补发、nonce幂等、重组回退通过；非主网/测试网 | [本地恢复证明](p17/pipeline/local-recovery.json) |
| 本续作留存工具 | 四组定向回归/type/lint通过；旧unknown/hash保护、原子锁、数量损坏拒绝、观测head重组回confirming。实际dry-run为70项/confirmed0/地址0/禁用发送/费用0 | [P17续作记录](p17-handoff.md#用户继续后的非-ui-小闭环计划) · [账本](p17/archive/archive-ledger.json) |
| 已批准ETH签发政策 | 专项/type/lint通过；默认off、独立allowlist、误设live仍拒绝未部署；按hasClaimed核验历史资格。SQL草案获只读审查，无真实DB验收 | [同份P17续作记录](p17-handoff.md#2026-10-03--已批准eth发行规则的本地实现) |
| 新OP原曲SBT | 7项Foundry测试与256次转账fuzz通过；目标/实际worker隔离I/O/receipt回归、type/lint通过。flag变化不丢冻结合约、stamp失败不广播、旧NULL任务兼容、RPC地址大小写兼容；只读审查问题已修 | [同份P17交接](p17-handoff.md#2026-10-03--连续施工op新sbt与最终收尾) |
| 原曲订单客户端 | unknown旧hash优先、无hash等待、丢回报恢复不重发、CAS、错凭证/钱包/用户隔离、手工hash与存储不可用回归通过；真实发送器未部署即拒绝，type/lint和限定只读审查通过 | [同份P17交接](p17-handoff.md#2026-10-03--睡前连续施工补齐原曲订单功能接线) · `scripts/p17/pipeline/verify-client.ts`；HTTP/钱包/存储为明确I/O夹具，不是实际资金操作 |
| 最后集中UI修复 | 首次1×1→正常布局及shader时钟回归先红后绿；P14四组/type/相关lint通过。布局按源代码完成，浏览器启动遭工具拒绝，新画面未验 | [P14交接](p14-h-handoff.md#2026-10-03-集中ui收尾) · [P15交接](p15-x-handoff.md#2026-10-03-最终统一ui收尾) |
| 注册表/SEMI | C1/C2 generate/verify、7项SEMI检查、export/--check通过；拒绝假ready/空坐标/漂移包 | [P13交接](p13-handoff.md) |
| 共享播放/呈现 | 租约、两真实engine解码中被接管后不排程、scene fade反向连续、readonly白名单、recipient快照/拒坏地址、既有wallet播放器专项通过 | `scripts/parallel/verify-*.ts`与已有`scripts/p14/verify-wallet-recipe-player.ts` |
| 一次集成浏览器 | 同一个Edge9315/profile，桌面1365×900与手机375×844；真实Echo、原曲2、独立页、键盘/焦点、安全拒写、sameRevision通过 | [原始K2结果](k2-browser.json) · [截图](visuals/) |
| Score媒体例外 | 固定双网关有界重试后音效`-8QBKp_uxZdwyHF9CIgoBdFkAyipGys4krfEMLDA800`失败；permagate CORS、主网关连接关闭，ArDrive同ID探测亦失败 | K2 score阶段与failedClipProbe，非业务代码被删或资源被替换 |
| 真实数据库/钱包/SEMI | 未运行真实Postgres事务/RLS/并发、外部钱包关联/拒签/换钱包或SEMI容器测试 | 不记通过；SQL仅草案，不做迁移 |

未跑全仓verify.sh。ETH合约16项、OP新增SBT7项及受影响服务端/worker/UI逻辑均有定向测试/type/lint；未变目录内容、媒体与SEMI证据复用，不以提交SHA变化补重复Gate。旧K2画面不能复用为本次改变后UI的视觉验收。
原始浏览器结果保留后台标签、选择器转义/DOM序列化脚本错误及中断后续跑；它们不是应用通过证据。页面异常pageErrors为空，网络/Privy来源错误如实保留；不把Console零错误作为实际生产Gate。
构建警告：既有middleware命名、Redis Edge版本与Privy可选Farcaster模块警告；构建成功，不为本轮本地结果扩成依赖重构。

## 资产事实

OP35资料ready与项目70项留存不同：每条archiveMint仍awaiting_input，confirmed0，费用0。
音频SHA256未被历史metadata承诺，audioSha256仍null、legacy_verified_source；HEAD可达不等于35首逐一实听，也不等于canonicalhash。
ETH地址/Token/metadata字段null，不制造预期地址；2026-10-03用户明确每钱包每首累计领取1次、可转让、转出不恢复资格、总量无上限。具体合约/签发资格已实现并本地验证；生产off、未核验部署拒签、数据库尚未启用，不能称已发行。
Echo #1真实metadata三网关一致，首页永久片段实际播放通过；C2仍冻结在样例阶段，永久HTML/SEMI标准完整Gate未齐，不把Echo系列升级ready。
新增OP SBT本地实现、不可转让/固定URI安全测试与冻结目标队列接线完成；没有已部署新地址或实际链上SBT资产。新目标从唯一registry取得，只有进入同revision公开目录且不可转让证明齐备才可启用；旧合约/藏品保留，不能标成SBT。SQL未执行，生产默认关闭；OP/Score/Echo旧行为保留。

## 真实外部依赖（不要求今晚处理）

1. ETH政策和OP新增SBT/保留旧藏品本地方案均已批准并实现，无需再确认该本地方案。实际部署/启用两链新合约需要具体环境、角色/签名与动作授权，未执行。
2. 两链35首留存：项目接收钱包已按用户授权本地生成并加密保存，公开目标及安全核验见[同份执行清单](coordinator-baseline.md#2026-10-03--项目留存钱包输入已补齐)。用户随后允许必要部署在现有部署钱包可用余额内执行，不再要求固定额度；发送前实际余额/费用/角色核验及部署安全Gate仍保留。当前0/70，不可默认为已持有。
3. 需要真实恢复/收藏验收时提供隔离数据库和测试账号；先验证事务/CAS/RLS/并发，证据齐备后按新增部署授权登记生产迁移目标。当前SQL未执行。
4. Privy应用当前frame-ancestors未允许3115来源；需要具备账号权限的人允许本地验收来源或提供合适隔离测试配置，才能验已登录布局、邮箱/外部钱包。此项不是本轮修改生产认证配置的授权。
5. SEMI提供可测版本/build、测试账号/真实持有钱包、网络/ERC1155/HTML音频容器策略，并明确联系/发送包的授权。当前只生成包，不联系或外写。
6. Score #1该永久音效的当前可读网关/网络条件；没有安全可读路径时只暂停真实Score退场验收，不替换作品资源。
7. 35首创作手记和艺术家正式文字尚未提供；只影响对应内容，可继续试听和目录验收。

## 三行核心走读

- `src/components/player/playback-session.ts` 的claim/owns决定谁能发声；过期加载即使解码结束也不能抢回播放。
- `src/components/pond-gl-test3/echo-resident/render/EchoResidentSphere.tsx` 的唯一runtime.step使球、水面、DOM消费同一frame pose，切组不重建第36圆。
- `contracts/src/p17/EthereumMaterialNFT.sol` 的`hasClaimed`永久记录领取资格，转出不重置；`server/eligibility.ts`读取该映射，`server/authorization.ts`继续校验off与真实部署。政策批准不自动启用生产。

## 回退与服务边界

原目录未切换，可继续使用原可用版本；本批候选留在隔离集成分支，不需要破坏性git回滚。
所有写入入口在本地预览返回503；GET公开播放资源可读，不代表真实收藏可操作。
构建/验收复用一个集成环境；旧K2 Edge已关闭，睡前按用户指令不再启动UI验收；3115新版服务保留给用户。原n8n不动，P17本地链无监听。
原夜间本地交付当时没有推进远端/生产；2026-10-03追加授权后已fetch核准最新main、快进推送、候选Ready、推广正式域名及最小smoke，实际范围见顶部发布记录。
