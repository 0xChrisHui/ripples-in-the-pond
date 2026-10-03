# P17-C — Ethereum 原曲 ERC-1155 与签名凭证

> 前置：A3 的明确扩展授权已由总控记录并同步必要约定；B1 具有真实 35 曲映射。
> 遵守[总控](../parallel-2026-10/00-orchestration.md)、[共享合同](../parallel-2026-10/10-shared-contracts.md)。当前只写计划，不编译、部署或签名。

证据根 `P17_EVIDENCE`、handoff `P17_HANDOFF` 见[总览](00-overview.md)。先复用已有合约/签名验证基础，仅补本能力差异；文件清单不是必须新建的任务。普通结果记唯一 handoff，安全证明保留并可引用既有有效记录。部署、真实角色写入、主网 mint 属 F，不能把本 Track 合约通过当作上线。

## 1. 通用合同与待确认发行政策

| 事项 | 推荐实施 |
|---|---|
| 标准 | ERC-1155，单一不可升级合约；不桥接、不部署第二个 orchestrator |
| 曲目 | 显式 35 个有效 tokenId，新部署默认 1–35；映射写入 registry，与 displayNumber 分离 |
| mint 费用 | 合约调用 `nonpayable`、不收额外价格；用户承担自身交易 Gas |
| 数量 | 单个授权订单 `amount=1`，不代表同地址/同曲终身限额；每地址/每曲次数、转出后的资格待产品确认，不宣称唯一 1/1 |
| 总量 | 待产品确认；不默认开放版、无限发行或擅加限量。未确认保持生产签发/启用关闭，不固化供应政策字段 |
| URI | 构造时逐项写入 35 个 direct `ar://txid`；没有 setter，构造后不能更改；复用已核验 OP metadata |
| collection URI | 获批新合约采用时构造固定永久 URI，新内容上传由 B2/F Gate 负责；缺附加资料只影响依赖它的部署，不影响既有音频/目录 |
| 角色 | 延迟管理员、独立 authorizer、独立 pauser；延迟默认复用 P16 48h，地址不得为零且职责分离 |
| 暂停 | 暂停新兑换；正常持有/转让不因网站开关被取消 |
| 重放 | 链+合约 EIP-712 domain、orderId、recipient、tokenId、amount、URI hash、deadline 全绑定 |
| 重入 | 先验证、再消耗订单、最后 `_mint`；receiver 失败整体回滚。额度/地址资格如获明确确认，再按该政策原子消耗 |

若最终 BASE 已存在符合目标的原曲合约，先复用并核验差异，不得仅因名称不同另部署一份。架构扩展授权不等于发行政策确认；政策待决时继续通用权限、防重放、recipient 和回滚实现/测试，只挂起政策字段、相关订单约束/用例定稿及依赖它的不可变部署/生产启用。不用无条件放行、空函数或测试政策填补生产缺口，签发与启用 fail closed。确认后合约、签发端与订单约束必须使用同一政策。

## P17-C01：实现不可变原曲合约

**输入依赖**：A3 架构 passed，B1 35 曲永久资料；发行政策未确认不阻断本 Step 通用安全部分。测试 URI/政策向量必须显式限于测试，不得写入 production registry 或视为产品决定。

**实际文件/符号**：只读 `contracts/src/MaterialNFT.sol`、`EthereumScoreNFT.sol`、`PermanentArUri.sol`；新增 `contracts/src/p17/{EthereumMaterialNFT.sol,OriginalMetadata.sol}`。复用锁定 OpenZeppelin 4.9.6，不改 package、foundry.toml 或既有合约。

**具体操作**：

1. `OriginalMetadata` 保存并校验 35 项 tokenId/URI 映射，拒绝重复、漏项、非法 URI和零 token。覆盖 `uri(id)` 时只返回该有效 token 的永久 URI；未知 id 明确 revert。constructor 自包含，不需后续配置交易才能得到真实音频。
2. `EthereumMaterialNFT` 组合 ERC1155（必要时 ERC1155Supply）、EIP712、SignatureChecker、AccessControlDefaultAdminRules、Pausable。按 200 行目标拆职责，不改公共依赖源码。
3. 固定 domain name=`Ripples in the Pond Originals`、version=`1`，使其与 Score 的 domain/type 显式分离。
4. 固定 typed data：`MaterialMintAuthorization(bytes32 orderId,uint256 tokenId,uint256 amount,address recipient,bytes32 tokenURIHash,uint256 deadline)`；`redeem(authorization,authorizer,signature)` 不接收任意新 URI。
5. 通用校验：非空订单、有效 token、amount=1、recipient 非零且 `msg.sender==recipient`、未过期、订单未使用、URI hash 等于 `keccak256(bytes(uri(tokenId)))`、签名者具有 AUTHORIZE 角色、签名有效。recipient/token 次数和供应校验只按明确获批的发行政策追加。
6. 通用状态先写 `redeemedOrders[orderId]` 再 `_mint`；`mintedByRecipient` 或额度字段仅在对应发行政策确认需要时实施，不能预置终身一次约束。发 `MaterialRedeemed(orderId,recipient,tokenId,amount,tokenURIHash)`，前三个索引按日志恢复需要定义，保证 ABI 一致。
7. 不开放绕过授权/已确认政策的 owner mint/batch mint，不加 URI 修改/任意调用/升级入口。项目留存也必须通过最终确认的政策 Gate；特殊批量或他人付款路径须另有产品授权，不能为脚本便利增加后门。
8. `pause` 仅 PAUSER_ROLE；`unpause` 仅管理员；撤销 authorizer 后其未消费凭证立即不能用；支持 ERC-1271 签名者验证但首版 recipient 自付 EOA。

**失败恢复**：URI/已确认供应政策/权限不一致时只修受影响部分，不修改 OP 或 Score 限制。未获架构授权的扩展不实施；仅发行政策或附加资料待决时继续其余通用安全及 E/F 独立工作，不把整个 C/D 阻断。不得先部署再补 URI/发行政策。

**定向验证**：C03 中的合约用例；编译只触及本地，旧 OP/Score 测试按受影响继承边界保留。不得自动使用 `--broadcast`。

**完成证据**：handoff 的 C01 条目记录签名、事件、URI/角色、源码版本和发行政策确认状态，复杂表格才附 contract-scope；未定政策不记为通过，没有链地址时写 undeployed。

**自动下一步**：进入 C02。

## P17-C02：客户端/服务端共用 ABI 与类型哈希

**输入依赖**：C01 ABI 已固定，A2 标准感知身份模块；与 P13 的 schema 无破坏性变更。

**实际文件/符号**：只读 `src/lib/self-mint/ethereum-score-contract.ts` 与 `scripts/p16/verify-voucher-vector.ts`；新增 `src/lib/material-mint/{contract.ts,types.ts}`、`scripts/p17/contracts/verify-voucher.ts`。

**具体操作**：

1. `contract.ts` 仅放公开 ABI、domain 常量、typed-data 字段定义，不导入密钥或 operator；`tokenId`/amount/deadline 在签名中为 bigint，在 API 中按字符串/有限整数显式转换。
2. `types.ts` 明确 chainId、contractAddress、trackId、recipient、orderId，禁止套用 `ScoreReadyData` 或 `SelfMintOrderRow`。
3. 暴露 `buildMaterialTypedData`、`hashMaterialAuthorization`；domain chainId/contract 从已冻结订单和启用目录读取，不能信任客户端提交。
4. 记录固定输入向量及预期 digest；Solidity `authorizationDigest` 与 viem `hashTypedData` 使用同一向量。向量测试地址只存在 test/脚本测试域，不进入 registry。
5. 验证同 token 在不同链、合约、standard 的身份不冲突；旧 `buildAssetId/parseAssetId` 的 ERC-721 输出保持原值。

**失败恢复**：任一 hash 不一致时禁止签发/部署；检查字段名、顺序、类型和编码，不通过“改预期值等于现输出”掩盖差异。必要时同时修 Solidity/TS 并重新生成独立向量证据。

**定向验证**：`npx tsx scripts/p17/contracts/verify-voucher.ts`、相同输入的 Forge hash 断言；有关 TS 文件 lint/type。没有新增 SDK。

**完成证据**：`P17_EVIDENCE/contracts/voucher-vectors.json`（公开测试输入）、对应两个运行结果与 commit。

**自动下一步**：进入 C03。

## P17-C03：合约安全与恢复行为验证

**输入依赖**：C01/C02；总控分配的本地 Foundry/Anvil 环境，不能默认指向测试网或生产 RPC。

**实际文件/符号**：新增 `contracts/test/p17/{MaterialTestBase.sol,MaterialRedeem.t.sol,MaterialSecurity.t.sol,MaterialMetadata.t.sol}`；用本合约事件/映射验证，不修改旧测试断言来救绿。

**具体操作**：

- 正常授权兑换：余额+1、订单已消费、URI 不变、事件完全匹配；地址资格/额度变化仅按明确确认的政策断言。
- 无条件拒绝订单重放、amount 0/2/极大值、无效 token、零 recipient/order。对同地址同曲的新订单、转出后再兑换、总量边界的预期只有政策确认后才能写定，不预设一律拒绝或一律允许。
- 同订单多 attempt/并发只有一笔成功，接收转让不冒充曾 mint；不同订单是否消耗共享额度及并发结果按获批政策测试，政策待决标出该子项，通用安全测试继续。
- 分别篡改每个 typed-data 字段、chainId、verifyingContract、domain name/version，旧签名全部失效；过期/边界 deadline 按定义验证。
- 抢跑者不能替 recipient 调用；未授权/被撤销签名者、畸形签名、EOA 与 ERC-1271 authorizer 都有断言。
- receiver 回调 revert 回滚订单/余额；重入同订单失败；如已确认额度/次数限制，必须证明回调不能突破相应限制。
- URI 与 collection URI 均无修改入口；拒绝 HTTP/空/非法 ar URI；35 个映射全查，构造遗漏/重复失败。
- 角色隔离、延迟 admin 迁移、暂停新 mint、暂停时仍允许已发行 NFT 正常转让。
- 复用现有安全向量/fuzz 基础，补本合约字段篡改与重放边界；部署预算需要时在同次专项运行记录 gas，不为普通修改额外重复测量或建立性能矩阵。

**失败恢复**：修本 Track 根因并只重跑失败层；测试工具不可用列清环境阻断，继续 D 的无链单测/E。测试通过不能免除真库竞争或真实钱包验收。

**定向验证**：使用既有测试入口或 `forge test --root contracts --match-path 'test/p17/*.t.sol'`；需要 gas 时同次加 `--gas-report`。旧 MaterialNFT/ScoreNFT/EthereumScoreNFT 仅在受影响的共享源码/依赖边界内回归，不因 P17 提交变化重跑无关合约。有效证据按相关源码、依赖/编译设置、环境复用，F/G 引用而非再次全跑。

**完成证据**：handoff 记录安全断言结果、相关源码/依赖与环境、未执行项及原始测试证明；日志较长才附 security-gate。权限、防重放、recipient、receiver 回滚证明不可省，政策未确认项单列 pending。

**自动下一步**：进入 C04。

## P17-C04：幂等部署准备与本地验证

**输入依赖**：C03 对应安全部分通过，B1 bundle；真实网络部署需 F Gate 和发行政策确认。本地准备可先行，但不得用测试政策产物宣告部署就绪。

**实际文件/符号**：新增 `contracts/script/p17/DeployEthereumMaterial.s.sol`、`scripts/p17/contracts/deployment-plan.ts`；只读 `contracts/script/DeployEthereumScore.s.sol` 的已部署核对模式。

**具体操作**：

1. 部署计划固定 network、chainId、35 URI hash、需要的 collectionUri、角色、admin delay、源码/bytecode hash、发行政策批准来源与预算来源。政策未确认时拒绝外部部署；测试/主网配置显式区分，禁止空配置回退到生产。
2. 脚本支持 `existingAddress` 只读核验；发现 bytecode、URI、角色、domain 不符立即拒绝，不自动再部署。
3. 无 `existingAddress` 的 dry-run 只输出构造参数/估算，本地 Anvil 可执行真实本地部署，报告 chainId=31337 或总控分配本地值。
4. 合约部署发送前要有持久化 attempt/nonce/交易身份；回执未知只进入核对流程，不能靠重跑脚本新建地址。
5. 本地部署后逐项读回 35 URI、角色、paused、接口和 contractURI；第二次带地址运行，nonce 不增加。
6. env/config 需求通过 `P17_HANDOFF` 交总控，不能写 `.env.local`、公共 chain-registry 或部署配置。

**失败恢复**：本地失败只清理自身明确测试数据，不重置共享链/库；外部链配置错误时拒绝发送。不能复制 Sepolia 地址填 Ethereum Mainnet 空位。

**定向验证**：本地部署/第二次只读幂等；构造数据与 B1 hash一致；无外部广播的 dry-run 记录。复用相关源码/依赖/环境未变的证明，只补部署特有断言；本 Step 不跑应用 build 或全仓 verify。

**完成证据**：handoff 记录 dry-run/幂等结果、网络和 fixture，详细日志按需附 deploy-dry-run；真实部署尝试账本必须保留，production `status=undeployed` 保持到真实 F。

**自动下一步**：进入[Track D](40-d-mint-pipeline.md)。
