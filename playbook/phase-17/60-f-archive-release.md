# P17-F — 双链留存、外部 Gate 与 C2

> 默认夜间做到本地可验收。真正部署、上传、生产迁移和mint，需[总控](../parallel-2026-10/00-orchestration.md)登记的具体授权、环境、接收地址、预算和独占写入租约。
> 公共模型遵守[共享合同](../parallel-2026-10/10-shared-contracts.md)。`P17_EVIDENCE`、`P17_HANDOFF` 为[总览](00-overview.md)约定的未来证据路径。

## 1. 两种完成线

- **本地完成**：工具能生成70项计划、进行不写链dry-run与恢复测试；曲目馆/播放器和授权范围内铸造代码可运行。没有真实接收钱包或签名时，交付可继续执行的清单。
- **生产留存完成**：每首原曲在OP/ETH各一项，70/70具有真实永久来源、合约/Token和指定接收地址的mint/持有证据；unknown=0。

70项是 `trackId × chainId`，不是70笔交易。既有mint可复用；一笔合法batch交易也必须逐token解码映射。当前OP旧合约只有单项mint，不能假定支持mintBatch。

P17 是资产链/媒体及留存证明的唯一维护线：复用 A/B/C/D 已有有效证据，F 只补实际部署/交易、变化数据或缺失断言。P13 默认消费同 revision 的证明与账本摘要，不多线重验 70 项、重下 35 份媒体。相关源码/依赖/环境没变时无关 SHA 不使证明失效；真实发送前余额、权限、nonce 等易变事实仍须必要的新鲜核验。各工具先复用已有基础，不为文件清单重复建设；普通结果集中 handoff，交易/永久上传账本和必要安全证明必须保留。

## P17-F0：生成有界、可恢复的70项账本工具

**输入依赖**：A1/A2/B1真实数据，C/D代码可存在但外部操作不必已授权；未给接收地址时生成 awaiting_input 项，无需停所有工具开发。

**实际文件/符号**：先复用已有计划/账本/只读核验工具；确有缺口才在 `scripts/p17/archive/` 按 plan/ledger/inspect/execute 职责最小补齐，不强制四个新文件。只读复用 `src/lib/chain/operator-lock.ts:acquireOpLock/heartbeatOpLock/getLockProvider`、原曲合约 ABI、registry。不得在编写计划时创建/运行这些脚本。

**具体操作**：

1. `plan.ts`从registry生成35×2矩阵，固定runId、catalog revision、源码SHA；每项包含trackId/displayNumber、chain、contract、tokenId、URI、recipient、amount目标=1和当前state。
2. 接收地址按链明确；可以两链同地址，但必须有用户记录，不能从operator、登录钱包或历史mint自动猜。无地址填null+awaiting_input，无合约填undeployed。
3. 稳定operationId绑定chain/contract/token/recipient/本次批准的留存策略，不能用每次运行随机UUID作为去重依据。金额、mint份数和接收地址任何改变须重新生成待批准计划。
4. 内部账本状态细化 `planned/checked/attempted/submitted/confirming/confirmed/unknown/failed`；映射到公开archiveMint只使用共享枚举。发送前原子持久化attempt、sender、nonce、calldata hash、预算快照；已有hash或unknown先inspect，禁止重发新操作。
5. `inspect.ts`核对已有mint事件和当前`balanceOf(recipient,tokenId)`。已满足至少一份且有原mint可追溯则复用；不能仅凭数据库success计入，也不把一次普通transfer误写成新mint。
6. OP 旧合约无链上 order 去重，用稳定本地/服务端账本、全局 operator 锁、nonce 与事件对账保证不自动重复，并保留现有应用一次收藏行为；ETH 用 `redeemedOrders` 与事件恢复。仅在获批政策确实包含地址次数/额度时才依赖相应链上字段，不能预设终身一次。
7. CLI默认dry-run；真正execute须提供总控授权记录、固定plan hash和chain允许列表。显式拒绝生产环境下lockProvider=fallback，即使shell的NODE_ENV未设置也不能绕过全局锁。
8. 账本单写、原子落盘，敏感签名配置独立保存；公开C2只导出证明，不公开热钱包材料。一次一个在途发送，未知nonce期间停止同发送钱包新交易并通知总控；其他纯读取继续。

**失败恢复**：账本写入失败必须在广播前停止；已广播后失败先查已知hash/nonce/事件，不创建新行。同一钱包的并行cron/人工交易若无法串行化，不发送。

**定向验证**：本地dry-run零外部写入；重跑不增加confirmed项；unknown不自动重发；换recipient/坐标识别成不同待批准计划；批量receipt可逐项证明但不能增加清单项数。

**完成证据**：保留真实 plan/交易账本及恢复所需字段，handoff 引用其位置并记录 dry-run 结果；dry-run.md 非必建。未知字段如实记录，绝不填测试地址冒充生产。

**自动下一步**：进入F1；缺外部输入也进入G完成本地交接。

## P17-F1：本地/测试网高风险验证

**输入依赖**：C/D关键定向测试、隔离DB与本地链租约。真实Sepolia部署、钱包连接/签名等需对应授权和已确认测试环境；本轮默认本地指令不包含这些外部动作。

**实际文件/符号**：C04 部署工具、D4 对账、F0 账本和已有端到端测试入口；仅缺必要串联断言时才补 `scripts/p17/pipeline/verify-local-flow.ts`，不再造并行测试框架。共享 P16 真实钱包配置只读核对，不能假设它已完成 Mainnet。

**具体操作**：

1. 对照 C/D 已有证明核对 prepare→voucher→redeem→reconcile 的覆盖，仅在既有 Anvil/隔离库补缺失串联断言，不把并发、关页、丢 hash、替换/拒签、超时和重组矩阵再跑一遍。相关权限、防重放、recipient、事务、unknown 恢复必须有真实对应层证明；测试夹具/政策显式非生产。
2. 引用 D1 的 OP 兼容与相关事件过滤证明；仅在其源码/依赖/环境变化或证明缺失时补测旧调用体、SEMI、地址冻结、原有同用户一次收藏和未知不重入，不能因进入 F 重跑。
3. 已有对应Sepolia授权时核实chainId=11155111、分离角色、35 URI与collection URI、源码验证、pause；部署失败/未知先查既有地址，不能自动补部署。
4. 先复用 P16 已验证且实际仍使用的鉴权/钱包发送基础；原曲只补新合约调用与必要恢复差异的真实钱包证明。若共用发送路径未变，不机械要求 MetaMask/imToken 各重做完整矩阵；仅各自特有的连接/发送差异需相应实测。需要签名而无人提供则 external_pending，不能用 Anvil 私钥成功冒充真实钱包通过。
5. 仅在相关安全证据全部齐全时标testnet_ready，记录实际测试范围。P16 Score主网尚未部署不会自动阻断独立原曲本地工作，但钱包能力尚未验证的限制需继承。

**失败恢复**：隔离库或钱包工具异常只修失败层，按相关源码/依赖/环境复用其他合约/type/事务证明，不因无关 commit 失效；不额外创建新工作树/全量重装。真实外部失败保留交易证据，不删表重来。

**定向验证**：核对 C03 安全、D0 事务、D4 真实对账的已有结果，只补缺口；真实钱包差异若授权则测试。记录相关源码/依赖、chainId、库/钱包环境，不混用证据，不另跑全量 build/verify。

**完成证据**：handoff 的 F1 条目引用各层安全证明并标 local_pass/testnet_pass/external_pending；长日志才附 local-testnet-gate，不强制复制 C/D 结果另写报告。

**自动下一步**：F2评估外部输入，不能因测试通过自动发主网交易。

## P17-F2：一次性核对生产执行授权与预算

**输入依赖**：A3批准、B永久资料、C/D/F1验证；用户明确的生产动作范围、总控执行租约。收到已有明确授权时直接核对，不重复索要同一权限。

**实际文件/符号**：F0 plan、C04 deploy plan、总控批准记录；只读生产链/角色/env名称。产物 `P17_EVIDENCE/archive/production-gate.md`。

**具体操作**：逐项登记真实值和来源：

| 必需输入 | 通过条件 |
|---|---|
| 动作授权 | 具体覆盖新ETH合约部署、必要角色、生产migration、原曲留存、可能的永久上传/发布；未授权项分开关闭 |
| ETH发行政策 | 有明确产品确认的次数/总量/转出后资格及对应合约、订单约束和测试；架构批准不替代政策确认，不能默认终身一次或无限发行 |
| 接收钱包 | OP/ETH各自指定recipient，确认可接ERC1155；不猜地址，不要求用户暴露私钥 |
| 签名方式 | OP由已有获权minter串行发送；ETH默认recipient本人自付兑换。无人签名时保留待签计划，不能擅自改合约支持operator代收 |
| 角色账户 | deployer/admin/authorizer/pauser按已批准设计分离，权限读回明确；临时权限有撤销方案 |
| 费用边界 | 分链部署/铸造Gas上限、单笔费用上限、累计ETH上限、Arweave预算（若需要）；含安全余量且实时估算仍在上限内 |
| 资产冻结 | 35 URI/音频来源/plan hash与目录 revision 对应，复用 A/B 有效证明；新不可变内容写入仍需对应 rights 与授权、所依赖上传 unknown=0。缺 collection 附加资料只影响依赖它的新部署，不影响既有音频/目录 |
| 生产环境 | RPC实际chainId、合约部署字节码、数据库目标、部署配置和开关初始off，不能混测试地址 |
| 暂停方式 | 停新订单/签发/发送，保留在途对账；哪些不可逆明确记录 |

ETH首版`msg.sender==recipient`，所以普通“用户付款但mint给另一留存地址”的路径默认不成立。如用户要此模式，先确认新的签名/受益人规则，不能为一晚无人值守绕过现有约束。推荐先让指定接收地址完成自己的35笔兑换或复用既有证明；不承诺无人能签名仍能完成真实留存。

**失败恢复**：无预算、地址、权限、有效签名、发行政策确认或不可撤销动作授权时，只把受影响步骤标 external_pending。不要采用无限 Gas、测试钱包、任意 operator、终身一次或无限发行等“默认值”。继续独立本地工作与 P13 C1 交付，不为等待外部输入重复验证。

**定向验证**：总控检查授权scope与plan hash一致，预算按bigint/wei运算；读取余额、估算和合约/角色，不发送试探交易确认权限。

**完成证据**：handoff 的 F2 段记录逐项 pass/pending 并索引真实授权、政策、地址、预算和权限证明；较长时可附 production-gate，安全依据必须可追溯且无签名密钥。

**自动下一步**：全Gate通过且外部动作已授权则F3，否则跳G并给出精确恢复入口F2。

## P17-F3：真实部署、35×2留存与读回

**输入依赖**：F2通过；总控独占目标DB、上传账本、发送钱包nonce和部署操作。worker不得自行push或修改Vercel配置。

**实际文件/符号**：C04部署工具，F0执行/inspect，B2条件上传，D对账；总控负责生产配置和migration。

**具体操作**：

1. OP 复用 A/B 已核验的合约/冻结 URI 证明，不改旧权限或重部署；仅补本次目标 recipient 的 mint/当前持有证明及发送所需权限新鲜检查。已满足留存条件的项直接计入，不为进入 F 重读全部媒体。
2. ETH按部署计划检查已有地址；无既有且获授权才部署。回执和源码核验完成后读回全部35 URI、角色、domain、暂停状态和标准接口，才交总控注入真实地址，开关保持off/指定allowlist。
3. 原曲 metadata/音频已永久存在且有有效证明则直接复用；获批新部署确需的新 collection 对象由 B2 保留权利、授权与上传核验。缺附加对象仅挂起依赖它的部署，不影响既有音频/目录；上传/部署 unknown 冻结相关路径。
4. 留存按固定清单串行执行。OP每项调用既有`mint(recipient,id,1,'0x')`，必须共用生产operator锁并盖attempt；ETH走已批准recipient的正常voucher/redeem流程，不开放特权mint。
5. 每项有 receipt 后解码事件，确认 from=zero 的 ERC1155 mint、recipient、token、amount，达到确认数，并核验 `balanceOf(recipient,id)>=1`；同合约/URI 不变时直接关联 A/B/部署读回的解析与媒体证明，只对变化或未核验引用补查。
6. 同Token在其他用户手里存在不等于项目留存完成；既有有效留存不重铸。发现指定地址已经转出而不满足当前目标时报告，不自动“补一份”。
7. 每次完成写账本/累计费用，再处理下一项；达到预算、锁丢失、链错、receipt未知或URI不符停止该发送路径。外部输入仍齐备的纯读验证继续。
8. 所有70项逐项完成后输出矩阵，不能以总交易数、总余额、脚本exit=0代替。保持已确认NFT不回滚，错误修复采用停新操作和对账。

**失败恢复**：OP旧合约无order mapping，未知发送必须用sender nonce、已知/推导tx hash、从attempt前区块起的mint logs与recipient余额核对；查不到不意味着未发，不自动再mint。ETH按order mapping和事件恢复。未知发送钱包禁止并行新nonce操作直到总控裁定。

**定向验证**：补齐真实部署 bytecode/source、必要角色/URI 读回、每项 mint proof 与当前余额；永久媒体引用既有证明。unknown=0 才能 archive_complete；不将 70 行证明省成抽样，但相同资源不重复下载、不同 lane 不重复核验。发布/必要浏览器 smoke 由总控按授权与风险集中执行。

**完成证据**：必须保留真实部署/交易账本（如 archive-ledger.json）、授权及安全读回证明；70 项矩阵可由该账本投影，handoff 记录计数/费用及引用，不强制另写 mainnet-deployment 和 archive-matrix 两份重复报告。缺任一链明确局部完成。

**自动下一步**：进入F4；即使仅OP有真实新证据，也可部分C2交付，不等全70项。

## P17-F4：C2更新、P13接力与生产状态分离

**输入依赖**：F3真实核验结果或A/B对既有生产资产的新验证；C1接口稳定。

**实际文件/符号**：`src/lib/music-catalog/asset-registry.ts`与data、`public/music-catalog/catalog.v1.json`、C1生成/验证脚本。P13导出目录只读，不写手工清单。

**具体操作**：

1. 把真实网络坐标、metadata/播放URL、verification与archiveMint结果更新进唯一目录；测试地址不进生产，未部署保持明确null。
2. 重新生成revision；不随意变C1字段语义，破坏性变更先交总控/P13并升级schema。运行同输入生成两次一致性检查。
3. C2创建本地数据更新提交，向总控/P13交**完整commit SHA + revision + schemaVersion + network范围**；新资料先于后续UIWIP单独交付。
4. P13 消费同提交及 P17 已维护的链/媒体证明后生成 SEMI 清单，只双向核对页面/清单的 revision、地址、token、standard、metadata、publicPlaybackUrl；不再读链/下载整套 70 项。只有证明失效或钱包特有兼容问题才反馈 P17 补差异；导出清单不等于 SEMI 已支持播放。
5. `ready`部署、`archiveMint.confirmed`、`SEMI playback passed`分别计数。C2若只覆盖OP，报告OP 35项/ETH 0项或实际值，不把“C2完成”写成双链全完。

**失败恢复**：P13未接收或接口冲突保留上一稳定revision，提出明确差异；不能手改P13清单补地址。合约地址验证失效时停止新mint并从ready选择器排除，保留历史追溯记录。

**定向验证**：registry/生成数据校验、环境过滤、production ready无假值、SHA+revision可从指定提交重新生成。跨线一致性在总控K2执行。

**完成证据**：唯一 handoff 的 C1/C2 记录、35×2 实际统计、证明索引与 P13 接收状态；c2.md 仅按需附件。

**自动下一步**：进入[Track G](70-g-acceptance-handoff.md)，交付已完成结果和精确external_pending。
