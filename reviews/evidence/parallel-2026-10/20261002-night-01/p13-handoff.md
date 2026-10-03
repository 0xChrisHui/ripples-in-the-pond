# P13 夜间交接

- lane: p13
- runId: 20261002-night-01
- BASE_SHA: e6985bec5ef6d6f191526e6f2e5b58caa5414357
- headSha: 本交接所在最终提交由 `git rev-parse HEAD` 解析；总控合入前使用执行者最终消息提供的完整 SHA。
- dependsOn.C1: 0e1195f04222c0e441989cb9ca74304a37801b7f
- dependsOn.C2: 624216cb8b35c6b7883ae87693bf7cfb38487c32（总控接管容量故障后，正常merge指定完成提交）
- C1.mergeSha: 1828a15dd49c2743407d9d0f48485bb42816d266
- schemaVersion: 1
- revision: 70437f5e71f2684018b2565a815b78dffd8d1b0d692063ee43f2b447148b85b8（之前revision仅为下文历史记录）
- status: external_pending
- localCodeReady: true（导出、窄类型、定向 lint、测试通过）
- packageReady: true（35首双链70项原曲资料、旧OP系列及已核验ETH Score；OP Score/Echo仍不进入ready，不代表SEMI已接入）
- walletVerified: false（未在 SEMI 验收）
- completedSteps: R0、R1本地盘点、R2、R3本地映射/证据边界核对、R4开发包、W0、W1证据盘点、W3
- nextStep: SEMI真实测试条件齐备后恢复W2；留存与OP Score/Echo证明变化时仅消费总控新的同源交付。当前待项以末尾双链真实部署C2小节为准，下文C1/C2为历史记录。

> 当前已解除的输入：35首手记已final并发布；发行政策、必要部署费用授权及本地加密留存钱包已明确；两链新原曲已由总控真实部署并核验。下文预算0、手记absent、钱包/政策待用户、两链尚未部署等描述仅保留当时记录，不再作为续跑阻塞。当前以末尾双链C2小节为准。

## R0 / 所有权

实际唯一工作树 `E:\Projects\nft-music-p14-source-deploy`，分支 `codex/night-p13-20261002-night-01`。
启动 `git rev-parse --show-toplevel / branch --show-current / rev-parse HEAD / status --short` 退出0，目录/分支/HEAD吻合总控参数，初始工作区干净。
按指定完整 SHA 正常 merge C1；没有整枝合并、读取 P17 活跃工作树或复制源数据。C1 提交身份保留。
本线只新增 `scripts/integrations/semi/`、`docs/integrations/semi/` 与本交接。源注册表、公开快照、共享播放器、UI、状态、package、部署配置没有本线写入。
总控保护原工作区/暂存区/未跟踪素材的 K0/K1 证据复用 [coordinator-baseline.md](coordinator-baseline.md)；本线未进行 stash/reset、安装依赖、开服务/浏览器、发布、链写入、外部联系或生产迁移。

## R1 / W0 / 协议来源

- 现行 `scripts/arweave/material/upload-metadata.ts:metadataBuffer/tokenHex`：Material `animation_url` 为直接永久音频，ERC1155 metadata 文件名使用64位小写十六进制。不能按 HTML 渲染或改冻结 URI。
- `contracts/src/MaterialNFT.sol` 与唯一 catalog identity：ERC1155 `uri/balanceOf`；旧 chain-registry 的 buildAssetId 固定 ERC721，导出不调用它构造 Material。
- `src/data/score/metadata.ts:parseManifest` 与 `src/score-decoder/index.html:emit/emitState/message`：Score 的 HTML 与 events/base/sounds；候选 v1 ready/state/ended/error、ms 单位、play/pause/toggle，无外部 seek/音量命令。权威为 `playbook/phase-10/70-f-decoder-postmessage.md`。
- `src/lib/wallet-recipe/metadata.ts:buildWalletRecipeMetadataV1` 与 `src/wallet-recipe-decoder/index.html:params/load/play/stopSources`：Echo 固定 v/recipe/clips、永久 manifest/36碎片，不能推断具备 Score 消息桥或用 origin 代替 owner。
- `docs/SEMI-DEMO-SCRIPT.md` 是旧测试网登录演示，Material 曾被误写 ERC721，授权仍待确认；不复用为生产资产/播放证明。
- BASE 不含 `references/community wallte/semi-app/**`、`semi-backend/**` 参考目录；只记录缺失，不从其他工作树搬运，SEMI 当前实现/导入模型/数量字段未知。

协议、媒体分类、父窗口来源/schema/数值检查、opaque-origin策略、首播手势、sandbox、互斥关闭与断站/网关处理全部收敛到自动生成的 [唯一 README](../../../../docs/integrations/semi/README.md)。这些是适配要求与本地候选协议，未经永久对象或 SEMI 实测的能力保持 unknown。

## R2 / R3 / R4 / 本地一致性与证据复用

唯一输入为 C1 `src/lib/music-catalog/asset-registry.ts`；直接复用其 validateMusicCatalog、catalogRevision 与 standard-aware identity/URI 规则。`public/music-catalog/catalog.v1.json` 只用于页面公开数据比对，不作为第二导出源。

- 全部35 UUID/displayNumber/title/audioArUri/notes来自真实 C1；手记35条 absent，canonical 音频 hash=null，integrityMode=legacy_verified_source。
- 70个 trackId × chainId 记录完整：OP35 unverified，ETH35 undeployed。ETH 合约/Token/metadata/播放路由为真实空值；没有零地址/假交易/预估高度。
- 35个已知 OP 坐标与页面公开快照的 chainId/contract/token/standard/metadataUri/publicPlaybackUrl 集合相等；页面公开快照与源 revision 一致。此为数据层证明，实际 `/tracks` 与单曲路由的 K2 页面接线尚未验收。
- C1 的2个系列均 disabled；ready collections=0、ready originals=0、ready dynamicCollections=0。完整 inventory 每个发行/系列包含 readyExclusionReasons，归档状态独立保存。
- 70个 archiveMint 全 awaiting_input，confirmed=0，未报告双链留存完成。归档历史接收与当前持有不混用。
- 复用 C1 [P17交接](p17-handoff.md) 的真实公开来源/永久 URI、schema/hash/uint256/标准身份/URI展开/伪ready拒绝/类型和lint证据。链 uri(1) 读回与历史 URI 一致，但 metadata manifest 网关404且fallback无可用结果，不能提升完整生产 C2。
- 本线没有重复35音频下载、70链读回、试听或归档交易核验；永久媒体完整性/实际出声仍不足。公开来源 URI 不等于已完成播放实测。

四个确定性产物同 schema/revision：[inventory](../../../../docs/integrations/semi/catalog-inventory.json)、[系列ready](../../../../docs/integrations/semi/contracts.ready.json)、[资产ready](../../../../docs/integrations/semi/assets.ready.json)、README。无生成时钟字段，真实 C1 重排 tracks/collections/deployments 不改变产物。先验证全输入，再暂存/替换；可捕获写入失败时恢复旧包；--check 检出缺文件、手改和版本漂移并保持只读。

## 验证命令与实际结果

所有命令显式 workdir 为本线；运行器使用已有 `E:\Projects\nft-music-p15-verify\node_modules` 的只读 CLI，`NODE_PATH` 指向同目录，后续 `TSX_DISABLE_CACHE=1`。该目录已有 Junction→原项目 node_modules，经只读核验告知总控；本线没有创建链接、安装包或写共享编译缓存。

| 命令/断言 | 退出码 | 实际结果 |
|---|---|---|
| 指定 SHA `git merge --no-ff ... -m 中文消息` | 0 | 合入 C1、保留原提交身份 |
| tsx `--test scripts/integrations/semi/export.test.ts` 首轮 RED | 1 | 尚未实现 package 模块而失败 |
| 同上最终版本 | 0 | 6/6：真实35曲70状态、排序/生成确定性、Git CRLF兼容且字段变化仍失败、未知/测试网/伪ready/schema/revision拒绝、页面坐标缺项/手改检出、跨链身份分离 |
| tsx `scripts/integrations/semi/export.ts` | 0 | 全套开发包导出，revision吻合，ready0 |
| tsx `scripts/integrations/semi/export.ts --check` | 0 | 四文件与唯一源完全一致、页面公开快照一致 |
| ESLint既有CLI，`--no-ignore --config E:\Projects\nft-music-p15-verify\eslint.config.mjs` +本线6个TS显式路径 | 0 | 6个脚本无规则错误；React检测无本线安装的提示不影响检查 |
| TypeScript既有CLI：`--noEmit --strict --esModuleInterop --resolveJsonModule --moduleResolution bundler --module esnext --target es2020 --lib esnext,dom --skipLibCheck --baseUrl <既有node_modules> --typeRoots <既有@types> --types node` +本线6路径 | 0 | 窄类型检查通过；首次发现 map.sort 字面量推宽，给转换函数加明确返回类型修复；库参数对齐项目lib，未改共享源码 |
| README Markdown相对链接存在性检查 | 0 | 全部链接存在 |

收尾 staged diff检查退出0，显式暂存路径均在本线范围；6个TS均小于200行、脚本目录6文件/产物目录4文件，链接全部存在。最终提交SHA随消息交总控。未执行全仓verify/build、Forge、浏览器、RPC、媒体下载或SEMI验收。

## W1 / W2 断言状态

| 断言 | 状态与覆盖 |
|---|---|
| M1/M2/M15 | pass：本地35曲/70状态、公开快照的35已知坐标、生产/测试与revision边界；钱包/实际网页部分未验 |
| M3 | pass：本线保留ERC1155身份和正确原曲映射；64位URI展开复用C1证明。动态余额/数量与索引 external_pending |
| M4/M5 | external_pending：Score/Echo动态所有权/分页、真实Token样例未提供；collection发现规则已写明，不将样例当白名单 |
| M6/M14 | pass（静态）：缺字段/未部署/未核验清晰列因；导出固定公开schema，无账号秘密。媒体失败显示与钱包传参待实测 |
| M7–M13 | external_pending：缺有效永久版本播放/声音与容器证据。本线未改媒体、Decoder或播放器，不开启重复试听/故障矩阵 |
| M16/M17 | external_pending：70条归档均awaiting_input；缺真实接收钱包/receipt/当前余额与SEMI账号对应关系 |

候选 Material 样例为 inventory 中 displayNumber 7/24/34 的真实 OP发行，仅作后续从唯一源选择的线索；未拿旧编号直接断言实际持有。OP Score #1缺本revision真实 metadata/永久版本样例；Echo/ETH Score未在C1列明。ready为空时不制造可消费样例。
W1完成了已有证据与缺项盘点，没有冒称本地实际播放通过；站内必要播放断言交总控 K2 唯一会话。W2因外部输入缺失暂停，W3照常交接。

## 历史 pendingItems / 原接线请求（已被末尾续跑小节替代）

1. P17/总控：提供指定完整 C2 SHA、revision、生产 bytecode/标准/冻结URI/媒体证据及70项留存事实；仅正常合入指定已完成提交，再跑 R3匹配受影响证据、R4导出/--check。不重新建账本或读回无变化资产。
2. P17/总控：为实际启用 Echo、ETH Score及动态Score提供唯一catalog collection坐标、真实Token/metadata/永久Decoder版本样例。C1未提供，不抄历史地址。样例字段若需新增应由总控冻结等价公开接口再适配本线；资料ready与样例钱包验收分别记录。
3. 总控 K2：确认曲目页消费同一registry/revision，并在集成页面核对显示与单曲链接；P17新入口的实际声音/控制缺证据项汇入唯一浏览器会话，不能把自动快照比对说成页面或钱包实测。
4. SEMI/用户/总控：提供明确外部执行/联系授权、当前可测build/version、OP/ETH支持、合约导入格式、audio/HTML与ERC1155数量策略、WebView/sandbox及消息控制策略、可用测试账号和已持有真实资产的钱包；恢复 W2 所选钱包断言。当前没有联系授权、账号或可测构建，不发送资料/短信/消息，不创建外部PR，不改SEMI项目。
5. 用户/P17：新增发行政策、原曲权利、归档接收钱包、签名能力、真实动作授权与费用上限。当前费用上限0，ETH未部署、生产签发关闭；这些只阻断对应真实发行/留存路径，不阻断本地导出。
6. 创作手记待用户提供，当前absent，不阻断清单/既有试听；不伪造作品说明。

## 本线决定与关键代码

- 用完整pending开发包与空ready表交付，packageReady保持false；证据齐全后按范围升级，不能以空集的自动检查通过宣称所有生产资产已接入。
- 系列白名单与单Token映射分离；动态系列使用当前持有索引，缺真实部署高度/样例时不猜值、不限定未来Token。
- 不另建地址表、播放器/媒体验收页或读链平台；缺失SEMI参考目录只记录，现行客户端以外部真实版本为准。
- Git已配置Windows检出CRLF，--check只规范化CRLF→LF再严格比对，避免同内容误报漂移；不忽略字段、地址、格式或顺序变化。回归断言经历RED→GREEN。
- `scripts/integrations/semi/package.ts` 的 readyExclusionReasons空数组筛选决定ready边界；`validate.ts` 的完整坐标+URI+revision比对决定网页与资料一致性；`export.ts` 的check分支决定手改/陈旧包是否被拒绝。

最终状态 external_pending，保持本地代码成果并停止写入后交总控。未声明SEMI已支持、已上线、实际声音通过或35首双链留存完成。

## C2 更新（总控接管）

代理收尾时容量错误，保留原提交16eb12a6679690b72adc7f8839fc3e74b70d19e8，由总控在原唯一工作树完成本段。
指定C2正常合入，不读取活跃源、不另抄地址。OP35资料ready、ETH35 undeployed、归档0/70；新增真实Echo #1样例只进入inventory，Echo系列仍disabled。
恢复R3/R4：自动重新导出四份资料，加入同源样例身份和URI/证明；样例不限制后续Token发现，不猜扫描起点，不抬高系列ready。
C1测试中的旧unverified计数调整为真实C2状态；伪ready拒绝用仍未部署的ETH副本，保留完整安全断言，另加Echo来源一致性断言。
7项导出/同源测试、export/--check通过；窄类型及lint见本次最终命令。复用P17一次metadata/链/HEAD证明，没有重复媒体下载、交易或SEMI测试。
W2继续external_pending：当前SEMI build、账号、网络/标准、容器策略、真实持有与可用授权均未提供。本地对接包通过不等于钱包内识别或出声通过。

## K2 总控结果（替代未接线状态）

K2曲目馆和独立原曲页实际呈现revision与C2导出一致，sameRevision=true。复用一次P17媒体/链证明及总控一次实际试听，不另建服务或重复35下载。C2本地OP35资料包通过，SEMI真实识别/持有/播放未验；上文C1空ready与无Echo样例仅为历史段，当前以C2更新和本段为准。

## 2026-10-03 连续续跑 / 当前待项

本次指定工作树 `E:\Projects\nft-music-progress-release`，父代理唯一负责catalog接线。本线只调整README生成说明与本交接；地址、URI、revision及排除原因继续来自唯一注册表。没有另建地址表或测试服务，没有改SEMI reference，没有发短信、联系团队、上传、交易或生产迁移。

### W0/W1 可复用证据与资料差异

- 35首手记已final，revision已由页面与SEMI资料同步；不再等待用户提供。必要部署费用授权、ETH一次领取/转出不恢复/无总量上限、未来OP SBT政策与留存钱包均已明确。本线不读取私钥，未发生留存，真实链回执仍为0/70。catalog的archiveMint=awaiting_input是旧机器账本状态，不表示接收钱包仍缺失。
- OP35资料ready复用既有P17证明；音频身份仍为legacy_verified_source、canonical audioSha256=null，不提升为完整音频hash承诺。
- OP Score disabled的直接原因是known-facts中的historical unknownProof，缺本包有效bytecode/standard/URI/media与核验区块；这不是Score停服或SEMI不支持的证明。
- Echo #1已有code、tokenURI、三网关metadata与实际样例；注册表仍将standard/media置false。K2播放证明可交总控核对相同永久版本并同步，不能由本线绕开registry提升ready。
- Ethereum Score主网Token #1已有 [P16收口](../../../2026-10-02-p16-mainnet-closeout-review.md) 与 [17项永久资源证明](../../../evidence/p16-mainnet/token-1-closeout.json)：链回执/映射、正式订单、tokenURI、17/17 bytes/hash/MIME、v3 package与snapshot一致、正式页面playing/eclipse且无页面错误。它不代表完整听音、SEMI容器或全消息桥已验。当前catalog未登记ETH Score，已向总控请求复用证据接线，不在本线抄坐标。
- 原脏树现在可只读取得 `references/community wallte/semi-app/server/utils/nft.ts`、`server/api/nft/owned.get.ts`、`server/api/nft/[contractAddress]/[tokenId]/holders.get.ts` 与 `semi-backend/app/models/token_class.rb`。历史代码允许chain 1/10/11155111、ERC721/ERC1155并循环pageKey；NFT DTO未传余额，holders将quantity写死1。M3需在当前版本读回真实ERC1155数量。限定检索没有找到可证明audio/HTML/postMessage播放容器的实现；未修改或运行reference。
- 官方候选公开入口 `https://semi.im/`、`https://semi.mobit.app/` 在本次浏览工具中未获得可用页面；限定域名检索无可用协议资料。此为本次取证工具结果，不能推断服务失效、当前网络/标准不支持，或猜测生产build/version。历史API域名不是W2可用播放入口，不探测私有API或触发登录。

### 精确恢复输入与责任方

1. 总控/P17：把可复用的Score/Echo真实证明补入唯一catalog、同步公开快照后交完整SHA/revision。本线只恢复R3/R4受影响的同源导出与检查；不重新下载音频或读回无变化媒体。新ETH原曲/OP SBT实际部署、真实领取和70项留存由P17完成，资料ready与发行完成分别记录。
2. SEMI实际验收：需要可访问的当前build/version、可用测试账号或公开导入入口、真实持有样例、当前ETH/OP及ERC721/1155导入格式、真实数量与audio/HTML容器策略。若须联系团队/写入合作方系统，应先由总控取得该具体动作授权；泛化部署授权不自动允许发送消息。输入齐备后恢复W2同一次会话所选M3–M13/M16/M17，不再先建本地服务。
3. UI由总控最后集中处理，非P13等待用户逐步验收项。站内/生产播放的旧证据按实际资源与实现继续复用，SEMI内实际声音与容器控制不能用官网证据替代。

### 本次定向验证

README由唯一源重新生成，35/35手记状态和每系列排除原因不手写；三份机器表内容未变，保持同revision。实际执行 `npx --no-install tsx scripts/integrations/semi/export.ts` 与 `--check` 退出0；现有 `export.test.ts` 7/7通过；`eslint --no-ignore scripts/integrations/semi/readme.ts` 退出0；新增两条P16证据链接存在，diff格式检查通过。首次lint因scripts忽略规则未检查文件，已用--no-ignore修正验证命令；不是源码失败。readme.ts为96行，无新目录/服务/依赖。保持 `status=external_pending`、`walletVerified=false`；未声明SEMI接入、70留存或新原曲主网上线完成。

## 双链真实部署 C2 消费（2026-10-03）

总控交付revision `70437f5e71f2684018b2565a815b78dffd8d1b0d692063ee43f2b447148b85b8`，唯一注册表已登记新ETH ERC1155和OP原曲SBT的部署回执、runtime、角色、35 URI及发行/不可转让证明；复用既有永久音频与metadata。P13只消费完整同源数据，不发新交易、不重新下载媒体、不手抄地址。

- 三份机器表与README均重新生成并比对页面公开快照，schema=1、revision相同。
- 35首 × 两链共70项原曲资料ready，undeployed=0；4个生产系列资料ready：新ETH原曲、新OP SBT、旧OP可转让原曲、ETH Score。动态ready系列=1（ETH Score），样例只从registry取得。旧OP系列保留为发现白名单，当前70项原曲映射对应两条新发行合约，不冒称旧发行已重新铸造。
- ETH Score复用P16主网Token #1既有17资源及官网启动证明后进入同源ready；OP Score/Echo仍disabled，排除原因原样导出，不猜能力或发行高度。
- 35/35手记final；archiveMint仍awaiting_input、confirmed=0/70。这是留存尚无回执的事实，不再表示接收钱包/政策/费用授权缺失。真实领取、生产签发开关和留存对账由P17负责，本包资料ready不代替这些运行时完成线。
- W2继续external_pending、walletVerified=false：当前可测SEMI build/version、账号或导入入口、真实持有资产、当前数量与audio/HTML容器策略仍缺；必须在实际钱包验收。需要联系人时由总控核准该具体外部动作，本线没有发送资料或探测私有API。

定向验证仅限本次受影响导出/同源断言；父代理已将export.test预期适配到70原曲与4系列，并新增ETH Score同源断言。本线承接该文件检查与提交：export/--check退出0、export.test 8/8通过、readme.ts与export.test.ts的ESLint --no-ignore退出0，P13指定路径diff检查通过。未重跑全仓build、Forge、浏览器、音频或链上矩阵。
