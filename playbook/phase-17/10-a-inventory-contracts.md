# P17-A — 基线、资产盘点与共享目录 C1

> 先读[总控](../parallel-2026-10/00-orchestration.md)与[共享合同](../parallel-2026-10/10-shared-contracts.md)。本线范围见[总览](00-overview.md)。
> 本文件提供未来执行步骤；本轮只写文档。完成 C1 后立即把真实完整本地 commit SHA 和 revision 交总控/P13。证据路径别名见[总览 §6](00-overview.md#6-分册与夜间出口)，均为未来产物。

## P17-A0：在最终 BASE 上重定位，而非沿用脏目录实现

**输入依赖**：总控 K0 给出的 `BASE_SHA`、P17 branch/worktree、环境标识、文件所有权、公共接线机制。没有这些输入，不在当前脏目录开始代码工作。

**实际文件/符号**：总览 §2 的代码位置；`contracts/src/MaterialNFT.sol:mint/uriFrozen`，`app/api/mint/material/route.ts:POST`，`src/lib/chain/chain-registry.ts:buildAssetId/parseAssetId`，`src/hooks/useAuth.ts`，当前钱包发送函数，`src/components/p11/RecordAnchor.tsx`。

**具体操作**：

1. 只读执行 `git rev-parse HEAD`、`git status --short`、`git merge-base --is-ancestor <BASE_SHA> HEAD`，核对是总控提供的 P17 目录；未开始时应等于 BASE，恢复执行时应包含 BASE。
2. 用 `rg --files` 与 `rg -n` 重新查上述符号。仓库当前是根目录 `app/`，不是 `src/app/`；若最终 BASE 改布局，记录映射并使用实际布局。
3. 在 `P17_HANDOFF` 记录本次会用到的实际位置、必要接口、相关 blob/依赖版本、写者与已有能力；复杂映射才另附 `P17_EVIDENCE/inventory/implementation-map.md`，不逐符号制作独立审计材料。
4. 先复用已有鉴权、钱包发送、目录/上传账本和验证基础，按目标差异补齐，不按后续预定文件清单重造模块或大重构。发现共享文件必须变更时写入 `P17_HANDOFF` 的 integration requests。
5. 核对部署环境不会默认读取当前脏目录 `.env.local`。开发环境只使用总控分配的隔离配置；生产凭证不得成为夜间测试默认值。

**失败恢复**：BASE 不匹配、目录有不属于 P17 的新增 dirty 文件、路径/接口矛盾时只停受影响写入。报告事实给总控，继续只读盘点；禁止 stash、覆盖文件或自建另一个 worktree。

**定向验证**：路径映射每行都能由 `git ls-tree` / `rg` 定位；权威 SHA 对上；计划中的 import 路径不能引用不存在文件。

**完成证据**：handoff 的 A0 条目记录初始状态、BASE_SHA、P17 分支名及有关实现差异；详细映射按需附件。

**自动下一步**：进入 A1；等待公共接线仅标记该依赖。

## P17-A1：核对 35 首真实音频与现有 OP NFT

**输入依赖**：A0；只读的 OP RPC、现有部署记录；经授权可读的 tracks 数据或既有公开快照。RPC/数据库不可用时仍完成本地盘点，链上项保持 `unverified`。

**实际文件/符号**：`public/tracks/No.1.mp3`–`No.35.mp3`，`scripts/arweave/material/upload-metadata.ts:loadTracks/tokenHex/metadataBuffer`，`supabase/migrations/phase-10/047_tracks_insert_week16_35.sql`，`src/lib/chain/contracts.ts:MATERIAL_NFT_ADDRESS`，`docs/MAINNET-RUNBOOK.md`，`src/lib/arweave/core.ts`。先用既有盘点/验证能力；确有缺口才补 `scripts/p17/inventory/audit-originals.ts`。

**具体操作**：

1. 按整数 1–35 精确匹配文件，复用与这些实际文件相符的既有长度、SHA-256、音频格式/时长证明，仅补缺失或变化项；排除 `001.mp3`、No.36、`public/the36` 和 P14 clips。不得重命名、重编码或替换母文件。
2. 读取 `tracks(id,week,title,audio_url,arweave_url,published,cover)`，沿用真实、既有 `tracks.id` 作为稳定 trackId，单列 displayNumber 对应 1–35。不能按数组位置、编号或本次随机 UUID 冒充原 ID。缺数据库时先找 BASE 内真实快照；仍缺 ID 的条目记 pending，不能造齐 35 条来声称 C1 已完成。保留用户已有正式标题；数字标题就如实用数字。
3. 检查 OP chainId=10、部署字节码、ERC-1155 接口、`uriFrozen`、`uri(1)`/`uri(35)` 和角色。历史记录中的 `0x03504aeb95EbE3DC8c427b7b147f873F9948a299` 仅是待核验线索，不能据此自动覆盖 BASE 的最新地址。
4. 解析 35 项冻结 URI：ERC-1155 `{id}` 替换为小写、64 位、无 `0x` 的十六进制，不用十进制文件名。读取 Arweave path manifest 后解析真实 metadata txid。
5. 逐曲建立 metadata `animation_url` 与 `tracks.arweave_url`、本地母文件字节的对应关系；有效的同 URI/内容证明直接复用，未验证资源由 P17 集中核验一次，供 B/F/P13 引用，不重复下载。同一音频供两链使用不生成两套媒体证明；不一致时隔离冲突，已冻结 metadata 不能被数据库当前记录替换。
6. 建立 collections 清点，覆盖 Material、Score、Pond Echo 及已知各网络；部署事实必须有链、合约、验证级别和来源。P17 不修改 P14/P16 注册表。

**失败恢复**：单个网关最多两轮有界读取，失败保留 txid/证据并继续其他曲目；未知链地址不进入 ready。缺用户手记不阻断盘点；缺权益确认只阻断新增永久上传，不自动外推 P14 碎片授权覆盖原曲。

**定向验证**：35 个编号不重复不缺号；每个 metadata 能追溯到实际 URI；本地 hash 与永久音频不相同时，报告差异而不是重传。脚本默认只读，不能 import uploader 后自动调用。

**完成证据**：handoff 的 A1 结果及可供 B/F/P13 复用的资产证明索引；需要机器输入时附 `P17_EVIDENCE/inventory/originals.json`。冲突、读取时间/block 集中记录，不强制另写 op-material/content-differences 报告；revision 排除运行时间而保留实际链上事实。

**自动下一步**：无论是否所有网络已可用都进入 A2；缺失值保留显式状态。

## P17-A2：唯一资产目录与 C1 交付

**输入依赖**：A1 已知事实、总控共享 schemaVersion=1；此步骤无需 ETH 主网部署、完整手记或 70 项 mint。

**实际文件/符号（职责建议，已有等效能力优先复用，不要求逐个新增）**：

- `src/lib/music-catalog/{asset-registry.ts,types.ts,identity.ts,validate.ts,canonical.ts,selectors.ts}`。
- `src/lib/music-catalog/data/originals.ts` 与 `collections.ts`；超过文件硬线按固定编号段拆到子目录，由 registry 统一组合。
- `public/music-catalog/catalog.v1.json`，`scripts/p17/catalog/{generate.ts,verify.ts}`。
- 只读参照 `src/lib/chain/chain-registry.ts:buildAssetId/parseAssetId`，保持两个旧函数签名与行为兼容。

**具体操作与数据合同**：

| 字段 | 约定 |
|---|---|
| `schemaVersion/environment` | 固定 `1`；环境明确区分 production 与总控指定测试环境 |
| `revision` | 规范化公开内容 UTF-8 JSON 的 SHA-256 小写 hex；不是日期、版本自增数或 git SHA |
| `tracks[].trackId` | 沿用既有真实稳定 ID；不随标题或网络改变，不用数组位置生成 |
| `displayNumber/title` | 1–35 及真实标题，数字标题允许；编号与各链 tokenId 独立保存 |
| `audioArUri/audioSha256` | 真实 `ar://` 来源及哈希，尚未核实时允许 null，同时明确验证级别和原因 |
| `integrityMode` | `canonical_hash / legacy_verified_source / unverified`；观测 hash 写入 verification，不冒充永久承诺。历史音频可 `audioSha256=null` |
| `notes` | status 使用 absent/draft/final，text 为 string 或 null；absent 必须 null，draft 只有真实供稿才存在 |
| `deployments[]` | 按链分项，带 `chainId`、`status`、`contractAddress`、`tokenId`、`standard`、`metadataUri`、`publicPlaybackUrl`、`archiveMint`、`verification` |
| `standard` | 字面值 `ERC1155 / ERC721`；原曲固定 ERC1155 |
| `status` | `undeployed / unverified / ready`；undeployed 的 contractAddress、metadataUri、publicPlaybackUrl 可空，不能填零地址或虚构地址 |
| `archiveMint` | `state=not_planned / awaiting_input / pending / confirmed / unknown`；带 recipient、amount、txHash、blockNumber、verifiedAt，confirmed 增附 blockHash/logIndex/proof 来源；失败细节放证据不造枚举 |
| `collections[]` | kind=`original / score / echo`、chainId、contractAddress、standard、metadataMethod、playbackKind、enabled、verification；按链+合约唯一，不穷举全部 Score Token |
| `verification` | 真实来源、区块、核验时间、URI解析与媒体结果；未核验显式说明原因，不带敏感配置 |

在[共享合同](../parallel-2026-10/10-shared-contracts.md)存在更精确字段定义时，按共同定义实现上述语义；若 schema 已由总控发给消费者，先协调兼容变更，不能单线改名。

1. `identity.ts` 导出 `buildCatalogAssetId`、`parseCatalogAssetId`、`buildMaterialPlaybackRoute`，ID 分别编码 `erc1155` 或 `erc721`；链、规范化合约、十进制正整数 tokenId 共同唯一，tokenId 在 JSON 中用 string，避免浮点丢精度。合约比较用小写，展示可用 checksum。
2. validators 拒绝重复 trackId、重复坐标、原曲 standard 错误、collection/track 网络不一致、假地址、负 token、丢字段及 ready 条目的空 URI。undeployed 可保留已冻结拟用 tokenId，但不能据此认定链上有资产。不得调用旧 ERC-721 helper 再改 URL 字符串掩盖错误。
3. `asset-registry.ts` 是唯一公共入口，导出 `getMusicCatalog`、`getOriginalTrack`、`getOriginalDeployment`、`listEnabledCollections`、`validateMusicCatalog`；另可提供生产 ready 选择器。只包含可公开资料，不能引入 `server-only`、DB client、密钥或用户列表。沿用现有网络/浏览器配置，不建第二套网络表。
4. 规范化：递归排序对象键；tracks 按 trackId、collections 按 chainId/contractAddress、deployments 按 chainId/contractAddress/tokenId 排序；合约小写、tokenId 十进制、文本换行 LF；缺失显式 null、禁止 undefined/NaN。保留作品文本内容，不随意 trim 改稿。
5. revision 输入排除自身 `revision`、生成时间、检查时间（含 archiveMint.verifiedAt）、git SHA、私钥和内部测试环境资料。链上证明中的 tx/block/hash 属于公开事实，应参与 revision；verification 的记录时间保留在公开输出但不参与内容 hash，导出使用已记录时间、不在每次生成时读当前时钟。重新生成两次必须同 hash，任意语义字段变化必须不同。
6. 生成公开 JSON 时直接从 registry 导出，拒绝手工两份地址。生产 JSON 排除测试网，仅含生产已知状态；测试网单独使用相同 schema 的明确测试产物。`ready` 是选择器算出的验证结果，不由手写布尔值决定。
7. 生产 ready 选择器只返回链 1/10、已启用/核验的合约与非空永久资料；`archiveMint.state=confirmed` 作为独立指标。合约/播放已经 ready 但尚未项目留存时，可以交付可接入资产，同时明确 mint pending。
8. C1 验证后，在未来独立 P17 分支单独形成本地 commit；报告真实 commit SHA、schemaVersion、revision、公共 API 和兼容说明。由总控把该**完成的小提交**交给 P13，P13 不等 P17 全部完成。当前文档任务不做 commit。

**失败恢复**：生成数据与 registry 不符则重生成；某曲数据缺失保留状态，禁止补假数据通过校验。P13 已消费的 schema 若不兼容，先保留旧导出，再由总控确定迁移；不要让 P13 从 P17 可变文件夹运行。

**定向验证**：`npx tsx scripts/p17/catalog/verify.ts` 检查 35 曲、两种 standard round-trip、未部署拒绝进入 ready、canonicalization 向量和生成文件一致性；仅运行受影响文件 eslint 与现有 type check。模块无密钥/服务端依赖。

**完成证据**：`P17_HANDOFF` 的 C1 条目包含真实完整 commit SHA/revision、缺失计数、测试引用和 P13 可消费范围；仅按需附 `P17_EVIDENCE/catalog/c1.md`。不得用“待填 SHA”宣告 C1 交付。

**自动下一步**：交付 C1 后进入 A3；总控/P13接收异步进行，不阻塞独立数据工作。

## P17-A3：精确架构扩展提案与执行 Gate

**输入依赖**：A0 实现映射、用户双链原曲目标；架构/技术栈/规范由总控单写，worker 不自行解释成已有批准。

**实际文件/符号**：只读 `docs/ARCHITECTURE.md` 决策 1、3、16、18、MaterialNFT 一节；`docs/STACK.md` 的“P16 唯一 L1 例外”；`docs/CONVENTIONS.md` 前端交易例外；当前钱包实际广播实现。提案记 handoff，较长时才附 `P17_EVIDENCE/architecture-proposal.md`。

**具体操作**：提案逐条给出现状、建议替换语义、受影响接口、验证和回退：

1. L1 例外扩展为 **ETH ScoreNFT + 新 ETH Original Material ERC-1155**；默认 OP、SEMI OP、P14 只消费 OP Score 均保持。
2. 新 ERC-1155 不可升级、35 个固定 tokenId、零额外 mint 价、角色分离、允许正常转让；OP 原合约和历史 URI 不迁移。ETH 每地址/每曲次数、转出后再领取资格及发行总量另列 `issuance_policy_pending`；架构扩展批准不等于确认“终身一次”或无限发行。
3. 外部钱包仅可向目录中已验证且运行时启用的合约调用固定 `redeem`，显式链和付款账户，服务端凭证来自冻结目录；沿用最终 BASE 已验证的钱包发送方式，不因旧计划写 Privy hook 就覆盖当前 viem provider 实现。
4. 新原曲订单独立于 `score_mint_claims/self_mint_orders`；不借用 Score 的全局跨链互斥，因为用户可以分别收藏 OP 与 ETH 版本。
5. ERC-1155 typed 身份由 music-catalog 提供；是否扩展公共 chain-registry 由总控决定。迁移名、env 和 cron 接线也由总控发布。
6. 平台项目留存的 ETH 钱包/签名模式、接收地址、费用总额单独列入 F Gate，不默认让用户的签名者变成机器人热钱包。

**可一次批准的准确 scope**：允许 P17 在现有 viem、Privy、OpenZeppelin、Supabase、Arweave 技术栈内，为 35 首原曲新增 ETH ERC-1155 自付收藏、独立原曲订单、只读标准感知目录与单曲播放；允许总控仅同步上述 ARCH 决策 1/3/16/18 与 MaterialNFT 小节、STACK 的 L1 能力边界、CONVENTIONS 的固定合约自付调用例外。维持 OP 原合约/队列的向后兼容、既有 Score 行为和 P14 OP-only 触发。不得扩成桥接、代理升级、全生态钱包改造或重写既有 NFT。

若用户真正提交的启动指令已明确包含这段扩展授权，总控在K0冻结BASE前保存原指令依据并同步必要约定，使四线共同基线已经包含批准范围。A3只核对BASE中的同步结果、依据和完整commit SHA，即可passed并自动继续C/D，不重复确认上述技术选择。未使用含此授权的指令时仍保留对应Gate。当前编写/讨论启动模板不等于已经授权实施。主网部署、生产数据迁移、永久上传、付费和真实mint仍按F的具体动作、地址、预算和权限执行。

**失败恢复**：无架构批准记录时把受影响的 ETH 架构实施列为 `external_pending:architecture`，继续不依赖扩展的页面、数据和既有通用安全适配。架构已批准但发行政策未确认时，仅该政策相关合约字段/订单唯一约束/测试定稿及依赖它的生产启用、不可变部署待决；C/D 其余通用鉴权、防重放、正确 recipient、事务和 unknown 恢复实现继续。不能用测试政策当生产默认，也不能因缺政策默认放开无限发行。批准不包含主网交易授权，不能跨过 F。

**定向验证**：每条提案都有准确章节/接口，不引入新依赖，不与 P16 Score 幂等或 P14 触发条件混写。总控批准后记录批准来源和同步后的文档 commit。

**完成证据**：handoff 中分别记录架构 disposition（approved/pending/rejected）、发行政策确认状态、用户指令定位、批准范围和同步后完整 commit SHA；仅按需附提案。待批准不写成架构已改；只标记 C/D 受影响子项，顶层按仍可推进工作选择 working 或 external_pending。

**自动下一步**：进入[Track B](20-b-permanent-assets.md)，按 Gate 状态跳过依赖项并继续。
