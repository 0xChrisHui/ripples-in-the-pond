# P13-R — 唯一资产注册表与 SEMI 对接包

> 入口：[P13 总览](00-overview.md)。执行前必须通过[总控 K0](../parallel-2026-10/00-orchestration.md)，数据口径服从[共享合同](../parallel-2026-10/10-shared-contracts.md)。
> 本文列出的脚本、导出文件与报告是未来执行产物；当前只编写计划。

## 1. 产物与脚本职责

`src/lib/music-catalog/asset-registry.ts`、catalog schema/规范化工具和公开数据均由 P17 提供，P13 不创建或修改。

未来在 `scripts/integrations/semi/` 只实现最小导出和一致性检查，使用已安装的 `tsx` 和 Node 原生能力，不改 package 文件。优先复用已有实现；下表是职责划分，不是必须逐项新建的文件清单：

| 文件 | 具体符号/职责 |
|---|---|
| `export.ts` | `exportSemiPackage()`；读取 P17 唯一源和核验证据，生成清单，不访问私钥 |
| `validate.ts` | `validateSemiPackage()`；身份、revision、曲目页集合、生产/测试分离与 ready 筛选 |
| `export.test.ts` | 对真实 C1/C2 快照测试确定性、身份和地址集合 |

未来输出到 `docs/integrations/semi/` 的首版产物仅为 `README.md` 与 `catalog-inventory.json`、`contracts.ready.json`、`assets.ready.json` 三份机器表。README 合并接入范围、导入方式、媒体协议、能力限制及必要版本差异；不再拆八份重复资料。机器表由同一源生成，不能手抄地址。

交接统一写 `reviews/evidence/parallel-2026-10/<runId>/p13-handoff.md`（下称 `P13_HANDOFF`）；必要的真实快照或原始响应才放同 runId 的 `p13/`（下称 `P13_EVIDENCE`）。source-map、核验结果、版本差异、播放和钱包结果默认写 handoff 的小节或引用已有证据，不逐 Step 新建报告。当前不生成这些实施产物。

不默认创建 `read-chain.ts`、`read-media.ts`、`check.ts`、`media.test.ts`、`playback-check.html` 或本地 HTTP 服务。定向补证优先调用 P17/现有只读工具；工具缺失只处理当前缺项，不扩成独立验证平台。

所有 JSON 产物包含源 `schemaVersion/revision`；校验证据另记时间和区块，不参与 catalog revision。生成采用稳定排序和显式输出路径。先验证再替换本线生成物，失败保留上一次可读文件并标记过期，不能一半旧 revision、一半新 revision。

## P13-R0 — 只读核验总控交付的基线

**输入依赖**：总控交付已冻结 `BASE_SHA`、P13 worktree 绝对路径/branch、可读 C1/C2 交付位置。P13 默认无需独立端口；未交付基线时不开始实现。

**实际文件/符号**：`STATUS.md`、`TASKS.md`、`docs/CONVENTIONS.md`、`docs/STACK.md`、本轮三份 P13 文档；只创建本线 `P13_HANDOFF`。

**具体操作**：

1. 在总控指定工作树运行 `git rev-parse --show-toplevel`、`git branch --show-current`、`git rev-parse HEAD`、`git status --short`；逐项与启动参数比较。不得在原始脏目录开始开发。
2. 接受总控选择的共同基线与差异记录；不要求先整合最新生产分支，也不自行执行 fetch/merge/rebase 重新选基线。
3. 记录实际可用的 catalog/SEMI reference/Decoder/原曲 metadata 脚本路径。下面步骤的路径须以该 BASE 为准，缺少文件先记录，不能从别线活跃目录直接复制。
4. 确认未来写目录不存在未知用户改动；把允许写目录、禁改共享文件和基线状态写入 handoff。

**失败恢复**：目录、分支或 SHA 不符，停止写入并交总控修正；不 stash、不 reset、不替用户提交。仅可继续阅读计划和准备不依赖基线的说明。

**定向验证**：Git 身份与所有权核验，不运行应用或远端写命令。

**完成证据**：handoff 中的 P13-R0 记录、原始状态摘要、`BASE_SHA` 与本线目录完全匹配。本步只核验总控已交付的基线，不创建基线。

**自动下一步**：P13-R1。

## P13-R1 — 盘点现有协议和真实资产证据

**输入依赖**：P13-R0；P17 C1 不是本步前置，因此可立即执行。

**实际文件/符号**：

- `src/lib/chain/chain-registry.ts`：`getConfiguredScoreAddress/buildAssetId/buildScoreRoute`。
- `contracts/src/MaterialNFT.sol`：`uri/mint/freezeURI`；`scripts/arweave/material/upload-metadata.ts`：`metadataBuffer/tokenHex`。
- `src/lib/wallet-recipe/metadata.ts`：`buildWalletRecipeMetadataV1`；`src/lib/chain/wallet-recipe-contract.ts`：`getWalletRecipeAddress/WALLET_RECIPE_ABI`。
- `src/data/score/metadata.ts`、`src/score-decoder/index.html`、`src/wallet-recipe-decoder/index.html`。
- `docs/SEMI-DEMO-SCRIPT.md`、`playbook/phase-10/70-f-decoder-postmessage.md`。
- `references/community wallte/semi-app/server/utils/nft.ts` 的 `getOwnedNFTs()`；`server/api/nft/owned.get.ts` 和 `server/api/nft/[contractAddress]/[tokenId]/holders.get.ts`；`semi-backend/app/models/token_class.rb`。

**具体操作**：

1. 在 handoff 简记“现行仓库事实/历史记录/外部未确认”及必要的路径/符号；能直接引用 C1/P17 证据的内容不重新整理一份 source-map。
2. 记录三种媒体：Material 直接音频、Score 带 `events/base/sounds` 的 HTML、Echo 带配方/manifest 的 HTML。写明各自永久引用和当前能力，不推定支持 seek 或同一 postMessage 协议。
3. 从 P12/P14/P16 或 P17 已有证据选择真实候选：OP Score #1、曾成功铸造的 OP Material #7/#24/#34、OP Echo #1；样例编号只是查找线索，地址/URI须对应 C1 与有效链证据，不要求本线重新读回。Sepolia Score 可作测试对照，绝不进入生产 ready。
4. 写 `docs/integrations/semi/README.md` 的接入范围。将未知的 SEMI 当前版本、导入格式、WebView/sandbox、测试账号和外部授权记入 handoff；不把本地 reference 当线上版本，也不为填报告研究无关历史实现。
5. 发现旧协议提到不存在的 P13 PRD 时，引用实际存在的 P10-F 权威协议和本轮文档；不恢复已丢失的历史实现，不修改其他 Phase 链接。

**失败恢复**：缺外部协议或 reference 过旧，只记录 `external_pending`；本地 registry 导出和协议资料继续推进。不得发送验证码、探测私有 SEMI API或批量收集持有人资料来补证。

**定向验证**：检索上述文件/符号，核对每项断言有代码或历史证据来源；Markdown 链接检查。

**完成证据**：handoff 中必要的来源引用、三种媒体分类、真实候选及外部缺项。

**自动下一步**：C1 已到则 P13-R2；否则先写 W0 的媒体/协议说明，按总控等待机制接收 C1。W1/W2 复用现成断言目录，不另造矩阵；C1 未到不得实现替代 registry。

## P13-R2 — 从 C1 构建确定性导出和静态一致性校验

**输入依赖**：P13-R1、P17 C1 的完整 commit SHA、revision、文件清单和验证结果；共享合同字段与规范化规则已冻结。只合入总控指定且已完成的 C1 提交，不 cherry-pick 活跃工作分支或手工复制源表。

**实际文件/符号**：只读 `src/lib/music-catalog/asset-registry.ts` 与 P17 公开生成数据；按需实现本线 `export.ts`、`validate.ts`、`export.test.ts` 的职责，不另建校验编排平台。

**具体操作**：

1. 复用 P17 的 `getMusicCatalog/listEnabledCollections/validateMusicCatalog` 及单曲查询纯公开接口。它应能被脚本读取而不初始化 Supabase、私钥或 Next 客户端；如现有模块做不到，向 P17/总控提纯读取入口请求，不复制数据表绕开。
2. 使用共享的 standard-aware identity；坐标按链 ID、规范化合约地址、十进制 tokenId 比较，并校验该 deployment 的 ERC 标准。数值用 bigint/字符串保持精度，禁止 `Number(tokenId)`。未知网络/标准拒绝进入 ready。
3. 校验 `schemaVersion=1`、`environment`、35 个 original 稳定 trackId 唯一、displayNumber 恰好 1–35、部署坐标不重复、collections 引用存在；displayNumber 不推导 tokenId。同一合约可覆盖 35 个 token，不误要求 35 个不同合约。
4. 复算或调用 P17 的 revision 校验：共享规范化公开内容 SHA-256，排除生成时间与自身 revision。历史 `audioSha256=null` 使用共享的 `integrityMode=legacy_verified_source`，禁止拿 observed 镜像 hash 冒充永久 metadata 钉住的 canonical hash。
5. 对每个原曲完整复制其 deployments 到 inventory。未部署项只保留真实状态与原因，不填零地址、示例地址或预估 txid；只有通过 P13-R3 的生产条目才进入 ready。
6. 对 Score/Echo 导出 collection 的 `(chainId, contractAddress, standard)`、metadataMethod/playbackKind、核验区块和发现规则，附真实 Token 样例；不能把无限新增的 Score 限制为样例 tokenId 白名单。扫描起始区块有正式证据才导出，缺失时采用合作方当前持有索引，不猜部署高度。
7. README 如需人读地址摘要，从相同导出函数渲染。读取 P17 为曲目页提供的公开数据，比对 revision 和完整坐标集合；不得通过只比较合约地址掩盖 tokenId 缺漏或跨链混淆。
8. 先用真实 C1 生成开发包；缺少链证据时 ready 留空并说明原因。`--check` 模式只校验、不覆写。旧 schema、不匹配 revision、未知标准、未核验 ready 条目、网站集合缺失均返回非零退出码。

**失败恢复**：schema 不符只停止数据消费并发交接请求；继续已确定的说明文档。源数据错误由 P17 修；P13 不手改生成 JSON 救绿。真实数据的损坏副本可用于否定测试，但必须标记“测试输入”，不能充当部署/播放证据。

**定向验证**（脚本实施后按受影响项执行；相关实现、依赖、输入与环境未变则后续步骤复用，不每步重跑）：

```powershell
npx --no-install tsx --test scripts/integrations/semi/export.test.ts
npx --no-install eslint scripts/integrations/semi
npx --no-install tsx scripts/integrations/semi/export.ts
npx --no-install tsx scripts/integrations/semi/export.ts --check
```

首版覆盖导出与筛选边界：同源生成一致；ERC1155 不误写 erc721；相同 tokenId 不同链不合并；undeployed/testnet 不进 ready；曲目页少一个坐标必失败。revision 规范化优先直接调用 P17 已验证实现并引用其测试；只有 P13 新增转换逻辑影响时间/notes 等字段时才补测，不重写 P17 全套测试。

**完成证据**：C1 SHA/revision、真实输入引用、检查输出及确定性对比；仅 C1 时 ready 可以是合规的已验证子集或空集，须附原因。

**自动下一步**：P13-R3，先核验 C1 真实已启用资产；C2 到达后只追加受影响项。

## P13-R3 — 复用资产证据，仅定向补查缺项

**输入依赖**：P13-R2、真实 catalog、P17 及已有资产证据；只有需要补查链状态时才需要只读 RPC。归档核对使用 P17 的接收地址与交易证据，缺少时标待确认，不猜钱包。

**实际文件/符号**：P17 C1/C2 与现有部署、永久文件、归档证据；必要时复用 P17/现有只读命令及 `src/lib/chain/chain-client-registry.ts`、`src/lib/arweave/index.ts` 的读取能力。本步不默认新建脚本；不能为复用强行引入 server-only 模块或运营签名能力。

**具体操作**：

1. 先匹配现有证据，不先发网络请求。按资源 URI/hash、完整性级别与格式复用永久文件证据；按 chainId、合约/token、相关区块号/hash、确认状态及可变状态复用链证据。commit 或 catalog revision 变化本身不使无关证据失效；引用旧 revision 时写明相同坐标/资源的对应关系。
2. 原曲 35 首部署映射及 70 个 `trackId × chainId` 归档结果仍全量做本地一致性核对；不重复 P17 的全量 RPC 读回、metadata/音频下载或双网关验证。逐项引用已有证据即可，相同资源不重复传输。
3. 只有证据缺失、相关 URI/合约/标准变化，或数据冲突才定向补查：生产 bytecode/`supportsInterface`、ERC-721 `tokenURI` 或 ERC-1155 `uri` 按缺项选取。可变 URI 未有有效冻结/最终确认依据时，核对相关 Token 当前 URI；不因此扩查全部资产。contractURI 可选，缺失不等于不可播放。
4. 保留 ERC-1155 `{id}` 展开规则（无 `0x`、小写、左补零至 64 位十六进制）和真实 amount；原曲 MP3 分类为 audio，Score/Echo 保留永久 HTML 参数。需要补查媒体时只读对应资源，核对实际类型与声明 hash；200 的 HTML 错误页不算音频。沿用已有大小上限，历史 txid-only 的 observed hash 不升级为 canonical 声明。
5. `archiveMint` 逐项核对 receipt、链/合约/token/接收者/数量和确认依据，复用 P17 已确认结果；只有待确认、区块重组迹象或矛盾时复查相关回执/区块。保留 `not_planned/awaiting_input/pending/confirmed/unknown`，未知不冒充 confirmed，批量或历史交易可覆盖多项，不要求 70 笔交易、不发补铸。
6. 历史归档接收证据不证明当前持有。真实钱包验收 W2 刷新相关样例的 `ownerOf` / `balanceOf` 与索引状态；Echo origin 不能代替当前 owner，数量未知不默认 1。本步无需为了静态对接包扫描所有持有人。
7. 补查仅使用只读能力，确认 RPC chainId；并发最多 3、单请求超时 12 秒、最多 2 次尝试，429 尊重退避，不无限扫链/下载。失败只影响对应链/坐标/URI，不重传或重铸。
8. 在 handoff 记录复用来源、匹配依据、补查项与 `pass/fail/external_pending` 原因；原始响应确有需要才作附件。机器表引用证据，不复制一套独立核验账本；RPC key、JWT、手机号不得写入。

**失败恢复**：RPC 故障只阻断对应链，网关故障只阻断对应 URI；保留失败与已有成功证据，最多重试失败项。不因读取失败更改注册表、重传 Arweave、部署或重铸。

**定向验证**：默认只做证据与 registry/70 项结果的一致性检查；现有校验已覆盖则引用结果。缺项才运行对应的现有只读命令，记录真实结果；无缺项不调用 RPC、不下载媒体、不新建测试工具。离线校验只证明映射/证据一致，不能冒充新一次链上或音频实测。

**完成证据**：handoff 中证据复用索引、70 项核对结果及准确的缺项坐标；只为补查附必要响应，不要求每条目新产报告。

**自动下一步**：P13-R4；若 C2 未到先生成注明范围的开发对接包，继续 W0/W1 可运行项。

## P13-R4 — 生成交付包、版本差异与 P17 一致性证明

**输入依赖**：P13-R2、P13-R3、已交付的最新 C1/C2。只有 C1 时允许开发包，不能标完整生产 package_ready。

**实际文件/符号**：本线 `exportSemiPackage/validateSemiPackage`；生成 `docs/integrations/semi/` 的三份 JSON 与唯一 `README.md`。

**具体操作**：

1. 接收总控发布的 C2 完整 commit SHA、revision、文件清单和验证结果；只合入总控指定已完成提交并保留相同提交身份，不直接 pull 或合并 P17 活跃工作分支。C2 可按网络分批，每批单独记录 SHA/revision。
2. 按新旧 revision 比较新增/移除网络、合约、Token、媒体 URI、验证级别与页面入口；按 P13-R3 的资源/链状态有效性复用证据。新增部署若已附有效 P17 证据直接消费，不因为首次进入 P13 就重新全量读回。
3. 以一次导出生成全套同 revision 文件。全量 inventory 包含页面公开部署及未部署项；ready 只含证据齐全的生产项。生产与测试明确分区，测试 fixture 不能被传成生产导入地址。
4. `README.md` 写交付包版本、覆盖范围、导入顺序、媒体协议及合作方需要确认的能力；必要版本差异在同文件简记，执行缺项和证据只在 handoff 维护，不新增独立差异报告。
5. 导出脚本只读 registry、不反写、无上传/发送动作；手工调整生成地址表会被 `--check` 检出。接入资料包含媒体与资产证据，不包含用户签名、短信或凭证。
6. 曲目页与对接包必须使用同一 revision。若页面发布了更新版而 SEMI 包尚旧，标 `external_pending: revision_drift`；总控不得验收“地址清单一致”通过。

**失败恢复**：生成一半失败只在本线恢复上次完整包并标旧 revision；不覆盖 P17 或页面数据。源 revision 不稳定时停止打包，继续文档/外部测试方案。

**定向验证**：包实际变化后运行一次 `export.ts --check`（包含 JSON/一致性校验），说明有改动才检查 diff/链接；R2 已通过且输入/实现/产物未变则直接复用。不跑全仓 build、合约测试或浏览器矩阵。

**完成证据**：源提交/revision、所有产物摘要、曲目页与 inventory 的坐标集合 diff 为零、ready 排除原因完整、版本漂移状态明确。

**自动下一步**：[W0–W3 播放与集成验收](20-wallet-playback-acceptance.md)。
