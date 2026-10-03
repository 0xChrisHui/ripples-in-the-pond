# Phase 13 — SEMI 音乐资产识别与播放接入

> 计划日期：2026-10-02。本文是本轮 P13 的唯一执行入口；本次仅编写计划，尚未执行导出、开发或外部接入。
> 用户目标：在 SEMI 内识别、展示并聆听项目已启用的音乐 NFT；曲目页公开的每个资产地址，必须进入同一版本的 SEMI 对接清单。

## 1. 开始条件与执行边界

先读[四线总控](../parallel-2026-10/00-orchestration.md)、[共享数据合同](../parallel-2026-10/10-shared-contracts.md)、[启动提示词](../parallel-2026-10/20-launch-prompts.md)及[汇总验收](../parallel-2026-10/30-acceptance.md)。本线所有数据字段、基线和合并流程服从上述文件。

- 当前 `E:\Projects\nft-music` 有大量用户未提交改动，且本地与缓存中的 main 已分叉。`BASE_SHA` 尚未冻结；不得把当前 HEAD、缓存 main 或脏目录内容直接当成四线共同输入。
- 夜间执行前必须通过总控 K0：总控交付共同基线 SHA、本线独立 worktree/branch 和允许写入的目录；P13 默认无需独立端口。P13 worker 不创建 worktree、不收束用户脏文件、不自行选择生产基线；可用当前版本与必要 WIP 形成基线，不另设整合最新主线的前置门槛。
- 此计划不启动旧 P7、P10、P12、P13 的历史施工步骤。旧文档只用于读取已形成的接口与链上证据。
- 默认执行至本地可验收的对接包。生产部署、主网交易、永久上传、短信、联系 SEMI、修改 SEMI 仓库或提交外部 PR，均不由本计划自动触发。
- 本轮不改登录、业务 UI、播放器、合约、数据库、架构或技术栈。集成差异写成本线交接请求，由文件所有者处理。
- 首版完成线：从唯一 registry 导出同版本清单，完成一致性检查，并提供一份接入说明。默认复用 P17 的资产与永久文件证据；不新建独立媒体验证平台、播放验收页或本地 HTTP 服务，不重复全量读链/下载，也不把每个 Step 变成报告或全量测试门槛。

## 2. 资产范围与当前证据

| 资产 | 标准与来源 | P13 必须解决的接入差异 |
|---|---|---|
| OP 原 Score | `contracts/src/ScoreNFT.sol`，ERC-721 | `ownerOf/tokenURI`，永久 HTML Decoder 与 `events/base/sounds`；核验实际 NFT 钉住的版本 |
| OP 35 首 Material 原曲 | `contracts/src/MaterialNFT.sol`，ERC-1155 | `balanceOf(address,id)` 数量、`uri(id)` 的 `{id}` 展开；现有 `animation_url` 是直接 `ar://` MP3 |
| OP Pond Echo | `contracts/src/WalletRecipeNFT.sol`，ERC-721 | 当前持有人与 origin 钱包分离；配方、manifest、36 碎片及独立 Decoder |
| ETH 原曲 | P17 注册表与部署证据 | 未部署明确 `undeployed`；实际标准由 C1/C2 交付，不能按名称猜测 |
| ETH Score | `contracts/src/EthereumScoreNFT.sol`、P16 配置与证据 | 区分 Ethereum Mainnet 与 Sepolia；测试部署不能进入生产 ready 清单 |

其他已退役或未启用合约只进入排除说明。P13 不把“全部相关资产”扩成所有历史测试合约的接入承诺。

### 已核对的本地事实

1. `scripts/arweave/material/upload-metadata.ts` 的 `metadataBuffer()` 将原曲音频写入 `animation_url`，没有包装 HTML。Material URI 已有冻结历史；不得为了适配钱包改写已冻结 URI。
2. `src/lib/chain/chain-registry.ts` 的 `buildAssetId()` 固定使用 `erc721`。P13 必须消费 P17 catalog 提供的 standard-aware 身份规则，不调用它构造 Material 的标识，也不修改该共享文件。
3. `src/score-decoder/index.html` 有 `ripples-parent/ripples-decoder` 消息桥；协议权威在 [P10-F D-F1](../phase-10/70-f-decoder-postmessage.md)。本地源码与 NFT 永久 Decoder 可能不一致，导出以该 NFT 实际钉住的内容为准。
4. `src/wallet-recipe-decoder/index.html` 是独立播放器，不能因为同为 HTML 就宣称具备 Score 的消息桥能力。
5. `references/community wallte/semi-app/server/utils/nft.ts` 的 `getOwnedNFTs()` 包含 ERC-721/1155 分支，但返回模型没有明确持有数量字段；同目录 `holders.get.ts` 的历史实现存在固定数量说明。它们是参考快照，不能证明现行 SEMI 行为。
6. `docs/SEMI-DEMO-SCRIPT.md` 记录的是旧测试网登录演示，曾把 Material 误写成 ERC-721，并保留 API 授权待确认说明。它不能充当本轮生产资产识别、播放或外部操作授权证据。

## 3. 文件所有权

| 权限 | 路径 | 约束 |
|---|---|---|
| P13 独占写 | `playbook/phase-13/` | 本轮三份计划 |
| P13 独占写 | `docs/integrations/semi/` | 未来生成的对接资料；地址表只能由 registry 生成 |
| P13 独占写 | `scripts/integrations/semi/` | 未来最小导出、一致性校验及相关测试；优先复用现有工具，不预建读链/media 平台，不新增依赖 |
| P13 独占写 | `reviews/evidence/parallel-2026-10/<runId>/p13-handoff.md`、同 runId 的 `p13/` 子目录 | 本线进度、决定、证据、依赖请求；未来执行时生成，不包含秘密或账号资料 |
| 只读消费 | `src/lib/music-catalog/asset-registry.ts` 及 P17 公开生成数据 | 由 P17 唯一维护；C1/C2 经总控交付到本线 |
| 只读核对 | `src/lib/chain/`、`src/data/`、`src/lib/wallet-recipe/`、两种 Decoder、合约和 SEMI references | 发现差异只提请求，禁止顺手修复 |
| 总控单写 | `STATUS.md`、`TASKS.md`、`docs/JOURNAL.md`、架构/技术栈、package 文件、部署配置、迁移号 | 本线不修改；由总控在汇总时归并必要记录 |

实现期每个代码文件按 200 行以内设计；单层最多 8 文件。拆分只在本线目录内进行，不改变白名单依赖。共享播放器、导航、chain registry、PondGL 不属于 P13。

## 4. P17 → P13 两次交付

### C1：数据形状与真实现有资产

P17 提供 `schemaVersion=1` 的 catalog、规范化规则、standard-aware identity、真实现有资产和生成入口。C1 必须交付完整 commit SHA、revision、文件清单与验证结果；由总控指定 SHA 供 P13 合入，保留同一提交身份。字段至少覆盖：

- 根 `environment/revision`、35 个稳定 `trackId`、`displayNumber=1–35`、标题、`audioArUri`、可空 `audioSha256`、`integrityMode`、创作手记 `draft/final/absent`。
- 每项 deployment 的 `chainId + contractAddress + tokenId`、`status`、`standard`、`metadataUri`、`publicPlaybackUrl`、`archiveMint` 与 `verification`。
- `collections.kind=original/score/echo`，覆盖 Material、Score、Echo 及实际启用网络；动态 Score/Echo 使用 collection 级发现规则和真实样例，不只白名单固定 Token。

消费 C1 的 `getMusicCatalog/getOriginalTrack/getOriginalDeployment/listEnabledCollections/validateMusicCatalog` 或同一提交冻结的等价接口。`displayNumber` 仅为展示编号，不能推导 tokenId；OP/ETH 同首曲目可有不同 tokenId。

`revision` 是按共享合同规范化后的公开内容 SHA-256，排除生成时间与 revision 自身。P13 导入或复用 P17 的规范化实现，不独立发明第二套排序/空值规则。总控交付工作区后，C1 尚缺时先完成 P13-R0 的只读核对、资料盘点和协议说明，不制造假 catalog 或占位合约。

### C2：部署、永久资源与留存证据

P17 提供同一 schema 下的新 revision、生产地址核验、区块/交易证据、永久资源、原曲播放路径与归档铸造状态。C2 每次必须包含完整 commit SHA、revision、文件清单与验证结果，可按网络分批。总控负责把指定 C2 提交交付本线，不能直接读取另一个正在写入的 worktree。

双链完整留存按 35 首 × 2 链的 **70 个 `trackId × chainId` 结果**核验；一笔批量交易可对应多项，已有铸造可复用证据，不能要求或推断必须发送 70 笔交易。

P13 对同一 revision 自动生成：

1. `catalog-inventory.json`：完整清单，包含明确的未部署/待核验项及缺失原因。
2. `contracts.ready.json`：只含已核验生产合约；仅代表接入资料可用，**不代表 SEMI 已上线**。
3. `assets.ready.json`：已核验生产资产及可用播放资料。
4. `README.md`：唯一接入说明，汇总范围、导入方式、媒体协议、已知限制及必要版本差异；需要人读地址摘要时从同一数据生成，不另维护 `contracts.md` 等重复说明。

集合关系必须成立：曲目页公开的已部署资产坐标集合，等于 inventory 中对应原曲集合；ready 是其中满足证据门槛的子集。若某地址正在曲目页展示而未满足 ready 条件，必须在 inventory 中明确列出排除原因；生产总验收不得把它当作已接入 SEMI。

证据复用不以“是不是本线执行”或“commit/revision 是否变化”一刀切：永久资源按 URI/hash 与验证级别匹配；链证据按网络、资产坐标、相关区块/确认状态及可变状态判断。只有缺证据、相关内容变化或相互冲突才定向核验。归档回执证明历史接收，不证明当前持有；动态所有权和余额在 W2 真实钱包验收时刷新。

## 5. 连续执行顺序

| 顺序 | 任务 | 输入 | 下一步 |
|---|---|---|---|
| P13-R0 | 只读核验总控交付的工作区与所有权 | 总控基线及启动参数 | P13-R1 |
| P13-R1 | 读取现行实现、确认能力与未知项 | 本地真实代码、历史证据 | P13-R2；C1 缺失则先 W0/W1 文档部分 |
| P13-R2 | 实现唯一源导出与静态一致性检查 | P17 C1 | P13-R3；可并行完成 W0 |
| P13-R3 | 复用链、永久文件及归档证据，仅补查缺失/变化/冲突项 | C1/C2 与 P17 已有证据 | P13-R4 |
| P13-R4 | 生成同版本清单与一份接入说明 | P13-R2/R3、C2 或显式不完整状态 | W0/W1 |
| W0 | 播放能力映射与合作方适配说明 | 真实媒体、现有协议 | W1 |
| W1 | 复用播放证据，必要时现有入口小样本验收 | C1/C2、真实 Token；SEMI 可测时直接 W2 | W2；外部条件缺失则 W3 |
| W2 | SEMI 内正式集成验收 | 当前 SEMI 授权、账号、版本与可测构建 | W3 |
| W3 | 按完成等级交接 | 所有证据与待办 | 结束本线，交总控 |

详细步骤见[注册表交接](10-registry-handoff.md)与[钱包播放验收](20-wallet-playback-acceptance.md)。不得把依赖等待写成完成；可独立工作先做完，剩余按总控等待机制恢复，禁止无限轮询或反复重做已通过证据。

## 6. 完成分级与夜间交付

handoff 顶层 `status` 只使用总控规定的 `working / code_ready / integration_ready / external_pending / blocked`。下述 `package_ready/wallet_verified` 是本线验收维度，不新增总控状态枚举；分别记录于 `packageReady/walletVerified`，附范围和证据。

- `code_ready`：导出器和校验器基于真实输入通过定向检查，资料完整、本线路径无越权修改；可以仍有尚未部署的资产。
- `external_pending`：顶层状态按总控口径表示存在尚未完成的外部依赖；同时在 `completedSteps` 和 `localCodeReady` 中保留本地完成事实，在 `pendingItems` 中逐项记录部署、账号、SEMI 能力或权限、用户签名和接收地址。
- `package_ready`：特定 revision 的所有目标已启用生产资产均通过 P13-R3，曲目页集合一致，对接包可交给 SEMI。此等级不包含 SEMI 客户端验收。
- `wallet_verified`：W2 在明确的 SEMI 版本、网络、样例与设备范围内全部通过。范围内任何一种资产只显示封面、只能外跳网站或无法播放，都不能计为该资产的 wallet_verified。

没有部署的 ETH 原曲可列为 external_pending；不得把现有 OP 子集通过改写成“35 首双链全部完成”。创作手记缺失不阻断既有音乐播放与地址清单，只保留 `notes=absent`，不生成虚构手记。

本线交接路径固定为 `reviews/evidence/parallel-2026-10/<runId>/p13-handoff.md`，证据放同 runId 的 `p13/` 子目录；这些均是未来执行产物，当前没有核验结果。handoff 至少包含：`lane=p13`、`BASE_SHA`、`headSha`、`dependsOn`（C1/C2 完整 SHA）、`completedSteps`、`nextStep`、`status`、C1/C2 revision、变更列表、命令与退出码、证据路径、排除项、接线请求和确切恢复步骤。决策写在此处，由总控归并；不自动发送给 SEMI。

全线只维护这一份 lane handoff：各 Step 的完成证据、选择的断言、复用来源和缺项直接记在其中；截图、原始响应等仅在有必要时附加，不要求每步新建报告。17 项断言是按影响选取的目录，不是每次整矩阵。按相关代码、依赖、输入与环境判断证据有效性并跨步骤复用，不因无关 SHA 变化失效；证据充分后结束，不重复导出、测试或浏览器验收来满足收尾形式。既有交易/上传账本和必要安全证明仍引用原件，不因合并普通报告而删除。

## 7. 本轮文档验收

仅检查三份 Markdown 的差异、格式、已有链接、步骤完整性和所有权边界。计划中新文件明确标为未来产物；总控文件由主 agent 并行编写，交接前再次检查链接。本次不运行 build、浏览器、Forge 或全仓 `verify.sh`，不提交、不 stash、不创建 worktree。
