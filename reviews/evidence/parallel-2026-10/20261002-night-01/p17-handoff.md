# P17 夜间交接

- lane: p17；runId: 20261002-night-01。
- BASE_SHA: e6985bec5ef6d6f191526e6f2e5b58caa5414357。
- 工作树: E:/Projects/nft-music-p16-fast；分支: codex/night-p17-20261002-night-01。
- C1: 0e1195f04222c0e441989cb9ca74304a37801b7f。
- C1 revision: e88df51c6f8bfc731aa686bef1c7ae2bb72a2bfb23e98d874fc5fa16f0538767。
- C2: 624216cb8b35c6b7883ae87693bf7cfb38487c32。
- C2 revision: 5e7241cbc7e234c1180e1d69231eba912fe39f0746727aa7891d761137f57eac；schemaVersion 1。
- 最终移交HEAD由晨间验收包记录；本交接与最后实现同一提交，不将自身SHA写成循环依赖。
- status: code_ready；2026-10-03 ETH政策已批准并实现；真实隔离数据库Gate已通过，具体两合约部署工具与Anvil完整构造/读回已通过；生产迁移/新资产部署/真实钱包/留存仍未执行。

## 2026-10-03 — 继续执行：真实数据库与幂等部署工具

旧段落中“隔离数据库缺环境”“发行政策/预算/留存接收钱包待输入”已被新证据及用户授权解除，不作为现在的停点。真实PostgreSQL 17.11安全Gate通过13组，证据`p17/pipeline/database-proof.json`，实现提交`b0df4b1`；正式库已只读核对到migration058，P17表尚未迁移，不能把隔离测试写成生产生效。

本闭环补齐`scripts/p17/contracts/deployment-{plan,ledger,inspect,cli}.ts`与`verify-deployment.ts`（分别44/30/30/140/51行，contracts目录共8文件）。CLI默认要求显式`--plan`，不会发送；`--execute`须同planHash、授权/政策依据、总控独占租约、明确链与RPC、独立角色和费用边界。真实发送沿用`op_wallet_lock`同一锁名与120秒/30秒心跳，缺Upstash拒绝，OP额外核验L1费预留。签名交易hash/nonce/构造data在发送前原子持久化；attempted/submitted/unknown/confirmed重跑只读回，不自动重发或创建新地址。未知nonce期间总控须暂停同钱包后续写入。

新合约固定35直接metadata URI来自唯一曲目registry的编号与既有`music-catalog/data/metadata-source.json`上传证明，不建立第二份地址表；新constructor不接受旧manifest的`/{id}.json`形式，35份旧永久metadata可复用无需重上传。series collectionURI单独要求有效永久来源，禁止拿Score/Echo系列URI凑数。编译artifact逐个来源核对编译器输入hash（兼容Forge的Windows换行归一化），读回runtime/immutable、35URI、三角色、2天admin delay、暂停、接口，OP还读回`isSoulbound`。

定向证据：先运行新测试确认缺工具失败，再完成实现；`verify-deployment.ts`通过错误链/重复角色/缺35URI/缺系列URI/预算超限/余额不足拒绝、持久化先于发送、磁盘失败不发送、unknown不补发、确认后幂等。显式`eslint --no-ignore`与`tsc --noEmit --incremental false`退出0；`check:quick`在当前主线无script，未冒称其通过。只编译两新合约，未重跑旧合约安全套件。

`p17/contracts/deployment-local-proof.json`记录实际完整EthereumMaterialNFT与OptimismOriginalSBT构造、35URI/角色/runtime读回、重复execute；本地Anvil31337端口8547，公开开发sender最终nonce=2，两合约各只部署一次。估算Gas分别6,133,199/5,599,834；collectionURI仅标明的本地夹具，不能冒称永久上传或生产部署。自建临时Anvil验证后关闭。

生产只读事实：2026-10-03 11:53:50 +08，现有P16部署sender`0x306D3A445b1fc7a789639fa9115e308a34231633`在ETH1余额`0.000792844646079183 ETH`、nonce1/pending1；OP10在11:44核验余额`0.010097041215977635 ETH`、nonce18/pending18。真实发送前须刷新，不能用本机Sepolia环境替代。P16证明可复用独立角色公钥：admin`0x305Ef22382A850f6FC5Fd1a15A76d75db3a42722`、authorizer`0xAb14FeFDFBedC67176E1ea6D6461Ad9F07bDe73a`、pauser`0x910380D1C8ad89f9ABf953460044d7b979883194`；目前可读配置未找到authorizer签名材料，公钥存在不代表可签。新original系列collection永久URI仍待准备。未新生成角色钱包，留存钱包未作admin/pauser/deployer。

最短续作：总控接完旧OP worker安全差异与正式库migration Gate；复用既有角色来源寻找真实authorizer签名方式，准备真实original系列collection；明确每链RPC/费用/部署计划，实际发送由总控独占执行。随后有限领取/恢复、70项留存与同revision的C2。已有授权不再重复询问固定预算/手记/接收钱包；本闭环外部广播、永久上传、生产迁移均0。

## 2026-10-03 — 网站发布适配

用户追加部署授权；生产候选基于main@1514108，保留现有P16主网Score、认证/钱包、PondShell/GL/visitor、focus bus和渐进预取。只将P17独立原曲目录、公开页、订单、P13同源包及导航/分享必要入口移植，原路径按当前`app/(pond)`和`chain/multichain`定位；不覆盖既有worker/API、不开启尚未验DB的新队列。原曲播放器补生产Track的永久身份与网关列表，35曲全部来源/轮转回归通过。生产架构/栈/规范同步P17授权边界，未引入依赖或迁移SDK。旧P17/P14和视觉测试继续证明原夜间本地候选，不冒称新生产GL采用了它们。

发布定向证据：tsc、显式lint、分享作者/旁听者/规范URL（1项）、目录35曲/70状态/同revision、SEMI导出check、订单客户端恢复、真实发送器未部署拒绝、ETH签发独立off/allowlist/错误live/链上历史资格均通过。没有真实资金交易或DB写入。发布树历史`.next/dev/types`损坏且含旧路由路径，只移除自身生成路由类型并typegen，不动源码/用户WIP。初次node --test把方括号当glob导致0项，改为直接运行实际TS测试后确认1项通过。Git/Vercel动作与恢复目标见同份coordinator-baseline；网站Ready/域名smoke完成后追加真实结果。
- nextStep: ETH原曲订单接线与OP新SBT本地实现已完成；UI按用户指令延期。独立外部Gate待隔离数据库、真实登录环境、两链部署/留存授权和SEMI输入。续作在E:/Projects/nft-music-p15-verify集成树，由总控接管。

发布审查发现并修复离开原曲页继续试听的P2：仅在当前HTMLAudio来源属于该曲永久网关时停止，保留主线PlayerProvider/互斥总线；另一首曲目和空音频不受影响。定向脚本实际RED→GREEN，补丁后tsc/组件与适配器lint通过；只读复核确认原P2解决且无新阻塞。首个云端候选`dpl_GiMGaFt9pTRZuTh9dg1E276FxHpe`已Ready，但未含此修复，不切正式域名。最终候选重新构建受影响代码，不重跑未变化的合约或数据库证据。

最终发布代码`60d75f80770fcda55b80110269bd63fbaa1e4e6c`，Vercel`dpl_9MY3RoJHnJ7tdFeesE5kpqGwvEmX`云端Turbopack构建退出0/Ready；官方CLI候选匿名应用smoke通过。候选直连被Vercel保护302到vercel.com，不当作产品失败，也没有取消保护；CLI并发检查时其版本通知cache lock有一次ENOENT，HTTP响应/文件断言均完成，不修无关工具缓存。`/score`云端静态预渲染为HTTP200+NEXT_REDIRECT/meta refresh到/tracks，不套用本地307断言；应用目标已核验。随后Git快进main且远端SHA一致、promote成功。2026-10-03 02:31 +08正式域名匿名smoke：首页/曲目馆/同源原曲2/我的/原曲订单入口200且无404 fallback；目录35曲70状态与同源JSON完全相同；订单GET与ETH prepare未登录401，未触及DB；新OP状态503/OP_SBT_DEPLOYMENT_PENDING。真实登录、音频播放、SQL与铸造未因上述HTTP通过而记通过。之后仅文档收尾复用代码证据。

P17代理已完成核心实现、定向类型/lint和下述安全测试；最后提交期间连续容量错误。总控在同一工作树接管收尾，保留既有提交与全部现场，没有另建环境或重跑无变化链/媒体证明。

## 已完成的本地范围

| 范围 | 实际交付 | 边界 |
|---|---|---|
| A0–A3 | 真实35首公开UUID/永久URI盘点、精确ETH例外授权核对、唯一注册表 | 2026-10-03用户已批准ETH每钱包每首一次/转出不恢复/总量无上限 |
| B | 具体EthereumMaterialNFT；35个构造时冻结metadata；独立角色/EIP712/ERC1155兑换；历史资格映射 | 相关16项安全测试通过，ETH实际部署仍undeployed |
| C | 独立订单/历史attempt、外部钱包认证、rate、签名与CAS/unknown恢复；签发前hasClaimed核验 | 政策依赖解除，默认off、部署与数据库启用独立；真实DB事务/RLS未验 |
| D | OP trackId→真实tokenId适配、认证默认接收地址与真实队列状态 | 新快照接口默认关闭，依赖OP列/RPC与总控worker接线；不接任意选择地址 |
| E | 外部钱包自付Gas客户端、持久attempt、发前登记、拒签/unknown保守恢复 | 不发真实资金交易；没有生产凭证可获取 |
| F | 70项只读留存账本、费用0、无广播/上传；真实已有OP资产证明 | 本轮留存confirmed=0，不等于双链留存完成 |
| G | /tracks、35首筛选/选择/播放、真实手记absent、标准感知公开原曲页与凭证 | Ethereum无部署时显示不可用，原曲独立页不拼假Token |

## C1/C2唯一数据源

[src/lib/music-catalog/asset-registry.ts](../../../../src/lib/music-catalog/asset-registry.ts)唯一维护坐标，public快照与SEMI包由同一注册表生成。
C1公开来源：https://pond-ripple.xyz/api/tracks，仅匿名读取35条真实公开记录；不含私人账号。tokenId来自已登记tracks.week映射，展示编号不新增另一套地址表。
OP合约/Score历史坐标来自MAINNET-RUNBOOK；ETH全undeployed，字段null。

C2在同一公开区块157674584完成OP bytecode/ERC1155/frozen/35个URI核验，metadata与既有永久上传账本SHA256一致。35音频HEAD可达、长度对应真实母文件；没有再次下载35首。audioSha256仍null、legacy_verified_source，不把HEAD或观测hash冒充canonical内容承诺。
OP35资料ready；ETH35 undeployed；归档70项awaiting_input；手记35条absent。
Echo #1坐标/metadata/配方来源总控真实证据，只作为同源样例；系列标准/永久播放器完整Gate未齐，enabled=false。Score系列本轮未完整核验，仍disabled。

证据：

- [OP链证明](p17/inventory/op-chain-proof.json)。
- [永久metadata与音频HEAD证明](p17/inventory/permanent-proof.json)。
- [本地31337真实恢复证明](p17/pipeline/local-recovery.json)。
- [70项留存账本](p17/archive/archive-ledger.json)。
- [总控Echo证据](featured-echo-proof.json)。

## 安全验证与复用

P17代理实际执行并报告：10个Foundry相关安全测试（256次fuzz）、TypeScript/Solidity固定EIP712向量一致；类型与本线lint通过。只覆盖test/p17，不跑无关合约。
31337使用本地有界harness，非生产发行政策；真实回执/双事件/calldata/recipient/历史attempt校验，丢hash按order事件恢复、错误recipient拒绝、转出不推翻历史mint、重复inspect不发送且nonce不变、unknown不补发、重组后回退confirming。结果保存在上述local-recovery.json，chainId31337不能写为主网或测试网上线。
上述31337恢复证明针对当时的有界harness，仅证明通用恢复；2026-10-03具体发行政策的合约已变化，重新运行16项相关安全测试，见末尾续作。未变的inspect与typed-data结构复用恢复/向量证据，不冒称新政策的真实RPC/数据库全链路已验。

总控接管后刷新新增路由类型，执行npm run check:quick：项目类型、本线所有新TS/TSX定向lint通过（退出0）；业务代码没有为了类型检查改无关行为。scripts定向显式no-ignore检查见最终输出。git diff/staged diff检查通过。
C1/C2 catalog generate/verify通过：35/70数据完整、standard-aware身份、大uint256/URI展开、独立SHA256对照、假ready和空地址拒绝、public快照与revision一致。新资产核验脚本只读，不再机械重跑。
真实PostgreSQL事务/并发/RLS未运行；提供的SQL属于未执行草案，不能称数据库已迁移或生产恢复链路已验。

## 总控共享接线

1. 首页“艺术家”旁新增/ tracks入口（实际链接/tracks）。
2. 原曲只复用PlayerProvider.toggle(Track)与RecordAnchor；独立源网关来自真实永久URI，不另建Audio实例。总控统一与Score/Echo互斥及路由清理。
3. OP旧API在MATERIAL_OP_RECIPIENT_SNAPSHOT_READY=1保存auth.evmAddress快照；worker调用新claim_pending_material_job返回完整队列行并优先快照，旧任务回退旧用户地址；非法快照需人工核查且不广播。
4. scripts/p17/database/op-recipient.sql保留旧RPC，新增完整行SKIP LOCKED函数并仅service_role可执行。该flag默认不启用，本轮不执行SQL。
5. 不改package/lock、旧Score/Echo发行政策、生产部署配置、共享文档或worker；共享修改由总控统一提交。

## 文件与命令

- 合约：contracts/src/p17与contracts/test/p17。
- 原曲服务：src/lib/material-mint、app/api/material-mint、app/api/cron/reconcile-material-mints。
- 页面：app/tracks、app/score/material、src/components/music-catalog、src/features/material-catalog/mint。
- 数据：src/lib/music-catalog、public/music-catalog/catalog.v1.json。
- 工具/SQL：scripts/p17/catalog、assets、contracts、pipeline、archive、database。

恢复时只用受影响命令：catalog generate/verify；contracts/verify-voucher；test/p17 Foundry；需要真实隔离数据库后验证SQL；pipeline/verify-local会部署本地harness，已有证据无变化时不重跑。dry-run只生成禁用操作的70项账本。

## 真实外部项

1. ETH发行政策已批准并完成本地实现；OP未来SBT与现有可转让合约衔接待明确，不能原地转换旧资产。
2. 新ETH原曲collection/35metadata实际永久发行、合约部署、角色隔离、预算和生产授权；本轮禁止执行。
3. 隔离数据库与角色/RLS/并发证据；OP快照列和RPC实际迁移。正式环境迁移需另行授权。
4. 归档接收钱包、当前余额证明、具体70项发送计划/费用上限/签名授权；现有账本confirmed0。
5. 真实Privy外部钱包关联、断连/拒签/替换/余额/网络矩阵、实际SEMI容器与持有验收。
6. 35首创作手记尚未提供，只阻塞手记内容。

未push、生产部署、永久上传、迁移生产数据库、发送主网/测试网资金交易或联系SEMI。默认外部费用上限0。

## K2 总控结果（替代未接线状态）

K2 /tracks35目录、选择原曲2、OP/ETH诚实禁用说明、单曲独立规范路由、同C2 revision、375px无横溢出、真实永久原曲2播放（时钟36.9/57.048s）通过；未重新下载35首。运行时写入/cron拒绝503。真实钱包/政策/DB/发行与0/70留存仍待外部项；共享预览不具生产写权限。

## 用户继续后的非 UI 小闭环计划

用户将所有UI细节统一延后。复核F0发现旧dry-run直接覆盖同一路径，尚不能安全保留unknown/hash，因此此前“本地已全收尾”需收紧为核心代码完成、留存工具仍有缺口。

- [x] 在`scripts/p17/archive/verify-archive.ts`先复现重跑抹去unknown；再覆盖锁竞争、损坏/坐标漂移拒绝、稳定operationId、普通转账不能充mint。
- [x] `plan.ts`从唯一registry生成70项，固定runId/revision/sourceSha/目标数量1；无接收输入保持null，操作始终disabled。
- [x] `ledger.ts`单写锁、原子落盘；读取并保留旧交易状态，损坏/身份变化直接拒绝，不静默重建。
- [x] `proof.ts`/`inspect.ts`只读核验已知回执、规范区块、当前余额与URI；缺hash保持unknown，不触发发送。
- [x] 修复`dry-run.ts`、运行对应测试/type/lint，更新本记录与当前权威入口；提交范围仅本闭环。

本轮不实现待决发行政策，不安装Docker/数据库替代工具；本机只有Supabase CLI，没有Docker/psql或本地数据库监听，真实数据库Gate仍待环境。沿用集成工作树，不开浏览器或重跑无变化构建/链证明。

实际执行与结果：

- `node node_modules/tsx/dist/cli.mjs scripts/p17/archive/verify-archive.ts`：四组通过。先以旧CLI复现unknown/hash被覆盖；审查后另先复现数量0误确认、余额观测head重组误确认，再修复。夹具只用于协议/文件回归，不作为真实链证据。
- `node node_modules/typescript/bin/tsc --noEmit`与`node node_modules/eslint/bin/eslint.js --no-ignore scripts/p17/archive`退出0；首次类型检查的readonly topics问题修复后重跑通过。`git diff --check`通过，archive恰8文件，各代码文件≤200行。
- requesting-code-review只读复查确认两项P2已解决，无剩余必要修复项；审查未访问RPC。
- 实际`dry-run.ts`退出0，旧70项账本升至schema2，接收地址0、启用操作0、confirmed0、费用上限0；sourceSha绑定目录未变基线`8ecb21ac67396d2017d9984b72761a032dcc757f`，planHash不因无关提交变化重置。
- 只读CLI需显式`--ledger <文件> --chain 1或10 --rpc-url <地址>`；无接收地址跳过RPC，`--execute`拒绝。已知hash最多核对最近16个，其他线索原样保留；无hash不扫描生产nonce、不补发，需原交易线索。余额/URI固定观测高度，返回confirmed前复查观测head hash，重组回confirming。

边界：本闭环未用真实RPC刷新70项，未实做留存，不代替生产F0/F2完整Gate；发行政策、真实数据库/RLS/并发、真实钱包与部署/上传/SEMI依赖仍待输入。既有应用构建与浏览器证据继续复用，用户UI反馈留到最后验收。

## 2026-10-03 — 已批准ETH发行规则的本地实现

用户明确：同钱包同首ETH原曲累计领取1次，ETH为可转让普通NFT，总量无上限。解释为历史领取资格永久消耗，转出不恢复；持有/转入数量不等于领取次数。仍沿用既定ERC1155、自付Gas、零额外mint价格、独立订单。

本闭环终点：生产合约实现上述资格规则，服务端及SQL草案同步且保持生产关闭，有定向安全验证与提交。只在本集成树施工，不写原目录、不开展UI返工、不部署/上传/交易/迁移。

- [x] 先新增合约回归，复现同钱包不同订单重复领取与转出后再次领取未被拦截。
- [x] 以不可回退的地址+tokenId领取记录实现具体政策，完整运行相关P17安全测试。
- [x] 服务端在签发前按已批准政策及已核验固定部署检查链上领取状态；默认模式off保留。
- [x] SQL草案增加钱包坐标的成功/在途唯一性与明确政策校验；真实数据库Gate无环境时不报通过。
- [x] 总控同步ARCHITECTURE/STACK/CONVENTIONS及STATUS/TASKS/唯一晨间包，定向type/lint和只读审查；提交仅本闭环。

OP差异：现有MaterialNFT源码允许转让，不能原地改为SBT。已向用户询问未来新增OP SBT的本地范围或另行安排；仅等待该项，不改现有OP合约/地址/队列或把它标成SBT。

实际证据：

- `forge test --match-path test/p17/MaterialIssuance.t.sol`先得到3个预期失败：换订单重复领取、转出再领未拒绝、旧夹具供应限制。随后改为测试生产具体合约，`forge test --match-path 'test/p17/*.t.sol'`16/16通过，amount fuzz256次。接收失败回滚、35曲独立资格、转入者可使用自身未用资格、正常单笔/batch转让、权限/重放/暂停/固定URI均覆盖；不运行旧OP/Score无关测试。编译出现OpenZeppelin既有assembly注释弃用警告，未修改依赖。
- `node --conditions=react-server --import tsx scripts/p17/contracts/verify-policy.ts`：先复现已批准政策仍抛pending，再实现后通过；覆盖实际签发入口默认off、独立allowlist、误设live仍拒绝未部署、历史资格而非余额、数量和错链拒绝。RPC响应为明确测试夹具，不算真实RPC/钱包验证。最初tsx CLI未传播react-server条件导致server-only加载失败，仅改用现有tsx loader，未安装依赖/改模块安全标记。
- 项目`tsc --noEmit`与本次TS显式`eslint --no-ignore`退出0；独立EIP712 viem向量再次通过。只读审查无本次必要P1/P2问题；SQL仍未执行、真实事务/并发/RLS未验。
- `verify-archive.ts`四组通过，实际dry-run仍70项/confirmed0/费用0/发送禁用；仅移除已解除的ETH政策待决清单，旧hash/身份不重置。catalog地址/内容/revision没有修改，C2/P13导出及OP永久资产证据复用。
- 未开浏览器、未重建应用；3115沿用已有K2只读预览产物，新政策以本次合约/服务端定向测试验收，不能据旧build称新增签发已在网页运行。旧目录提示中的政策待决文字属历史C2/待UI收尾，不代表当前用户政策未确认。

关键走读：`EthereumMaterialNFT.sol`的`hasClaimed[a.recipient][a.tokenId] = true`决定永久领取次数；`eligibility.ts`读取同一映射而非balanceOf，决定签发前拒绝；`schema.sql`的`material_wallet_token_once`覆盖success，决定换登录账号也不新增第二次领取订单。

## 2026-10-03 — 连续施工OP新SBT与最终收尾

用户已批准按上一条方案连续开发：新OP原曲用新增SBT，旧合约/旧藏品保留；不再等待该项选择。终点是新SBT本地代码/安全验证、新旧队列接线、剩余可执行项及最后一次集中UI验收，更新同一晨间包。

- [x] 新增固定35曲metadata的OP不可转让ERC1155，仅项目minter铸造；旧MaterialNFT不改。
- [x] 唯一registry维护未来SBT未部署状态；新请求/worker核对固定目标与冻结recipient，旧NULL目标继续旧合约。保持每用户每曲队列语义，不给OP额外引入ETH钱包终身次数政策。
- [x] SQL草案补冻结目标；缺真实隔离Postgres仅保留待验，不安装数据库替代系统/迁移生产。
- [x] 相关Foundry/队列逻辑/type/lint与只读审查，通过后提交非UI闭环。
- [x] 非UI独立项完成后，集中修第36圆静止/贴画、曲目馆首屏入口及相关真实提示；回归通过，实际浏览器因工具拒绝待验，详见P14/P15同份交接。
- [x] 最终本地构建/预览及十项需求包更新，外部部署/上传/70项留存/SEMI仍独立待授权与输入。

本闭环证据：新增OptimismOriginalSBT的7项Foundry测试通过（转账fuzz256次），涵盖单笔/batch/自转/零量转账与授权拒绝、minter/暂停/固定35曲URI、接收回调回滚、旧合约仍可转让和授权minter重复铸造（不发明OP终身钱包政策）。目标/receipt回归通过，C2 revision未漂移。真实worker隔离I/O回归先复现关闭flag丢冻结目标而错发旧合约，再改为claim后select(*)读回及confirm完整行；stamp失败无广播、旧NULL目标兼容通过。只读审查发现RPC小写to与checksum目标比较误拒绝，先用含字母地址回归复现，再规范化比较后通过。测试夹具仅替换DB/RPC边界，未加载生产凭证或实际发送。

项目tsc与本次显式eslint退出0，git diff --check通过；审查所列P2已修复并以回归核验。SQL草案未执行，本机没有Docker/psql/隔离数据库，真实事务/RLS/并发仍待验；未部署/上传/交易，留存0/70不变。
- 最终本地Webpack构建代码54fed83247df1633ae92edf30053adfa6a5ce409，buildId bPbpzcopN9DEQoXMCdavG，退出0；3115刷新PID65620。公开四页HTTP200、35曲同revision、静态按钮CSS/禁用提示已送达；OP/ETH收藏、cron、短信均503拒写，未做真实数据库或链上发送。

## 2026-10-03 — 睡前连续施工：补齐原曲订单功能接线

用户明确不再要求第36圆/曲目馆UI验收，将打磨延后；当前终点是补齐已有P17-D3/E3/E4要求的本地功能，不新增生产动作。复核发现ETH客户端未被任何界面调用、没有原曲订单恢复页面，且缓存hash检查在authorization之后，unknown订单无法恢复。最初怀疑签发JSON夹带BigInt，源码复核确认既有service已显式转换字段、不展开typedData，撤掉该不必要改动和测试，不把临时抽取引入的问题写成原有缺陷。

- [x] 接通原曲prepare/owner订单查询、独立订单页与已有hash恢复；恢复先于续签，unknown不重发，换用户/钱包不复用。
- [x] 收藏面板只在已核验部署与认证能力下进入真实流程；未部署保持禁用，提供已有订单查询入口，不新增视觉打磨。
- [x] 补计划要求的/score根入口，保留旧Score/P16订单行为；唯一catalog/SEMI内容不改变。
- [x] 定向回归/type/lint及一次相关只读审查；路由变化集中构建/HTTP刷新本地3115，更新同份晨间包与状态。

本轮复用executing-plans/TDD流程与同份交接作为记录，不新增计划/Checkpoint/测试服务。真实数据库/RLS/并发、部署/留存/登录环境/SEMI仍保持external_pending；没有新输入时不重复生产依赖探测。UI审美不再作为当前停点或要求用户验收。

定向证据：`node --import tsx scripts/p17/pipeline/verify-client.ts`退出0，覆盖unknown旧hash优先、无hash等待、丢回报后恢复不重发、CAS、错凭证拒绝、换用户/钱包缓存隔离、手工hash、不可用浏览器存储与非法字段。手工hash回归先失败再修；测试仅替换HTTP/钱包/存储边界，真实发送器另断言未部署时在访问钱包前拒绝，未启用假部署。项目tsc与本次显式eslint退出0；只读审查未发现P1/P2阻塞，不把审查当作真实钱包或数据库通过。输入、通知和迟到响应按owner+order隔离；原曲开关独立于Score，已有订单GET/恢复不因新签发关闭而重新创建。

最终交付代码SHA `44664144777039be5a4088210243b674b32b8793`：一次`npm run build -- --webpack`退出0，57静态页，buildId `7qjULHmcekOojLZTdFcSn`；复用原依赖，既有Privy可选模块/middleware警告不影响构建。3115新产物PID25536、LOCAL_REVIEW_ONLY=1。首页/曲目馆/我的/原曲订单列表与合法ID的未登录详情/同源原曲2均HTTP200；/score为307到/tracks。非法和零orderId返回notFound/noindex，旧P16保留/me?mintOrder目标；这两类因流式响应HTTP200，不记录成HTTP404/307。第一次HTTP探针误要求未登录曲目馆有仅认证状态显示的订单入口、后续误要求流式notFound的HTTP状态，核对实际响应后修正探针，未为“救绿”改产品代码。目录API/页面快照仍35曲同revision；原曲私有GET、prepare/submission、旧OP收藏、cron、短信均503。以上不是登录/钱包/数据库实际验收。

原目录只读复核：HEAD仍001a21d，index空，77项status和tracked binary patch与K0备份逐行一致；没有修改原工作区或运行外部写入。UI按用户指令延期；现有SQL/角色/两链部署/70项留存/SEMI相关外部缺项未被本地通过代替。
