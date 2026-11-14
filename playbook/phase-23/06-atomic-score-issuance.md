# P23-C：OP 唱片原子发行

2026-11-14 用户批准修改发行流程，沿用当前工作区，不新开工作区；其他线路改动保留。

## 目标与边界

保留现有 ScoreNFT 地址、旧 MintOrchestrator 的订单映射及已铸唱片，通过新增薄发行入口，把铸造与首次写入永久资料地址放在同一笔交易。消除成功交易之间的空 tokenURI 窗口；不保证第三方索引必然成功，也不修复历史 Alchemy 空缓存。

本次授权为本地实现与验证，不包含部署、链上授权、生产变量、真实铸造、永久上传或数据库写入。原 P23-C 的只读范围由本次明确指令扩展；不修改 ARCHITECTURE.md 或 STACK.md。

## 设计

- 新增 `AtomicScoreIssuer`，固定绑定已有 `MintOrchestrator`，从其 `scoreNft()` 读取并固定 NFT 地址，不创建第二份订单账本。
- 入口 `mintScoreWithURI(address recipient, bytes32 orderId, uint256 expectedTokenId, string tokenUri)`，只允许 MINTER_ROLE；管理员和发行者均不得为零地址。
- 使用现有 PermanentArUri 校验永久地址；拒绝零接收地址、空订单、零预计编号。
- 调用旧 `mintScore`，核对实际编号与 expectedTokenId 一致，再调用现有 NFT 的 `setTokenURI`；任何一步失败均回滚铸造、编号递增和旧订单映射。
- 复用 OpenZeppelin AccessControl / ReentrancyGuard，不新增依赖。旧订单映射可经新入口只读转发查询。
- 不宣称安全接收回调期间 URI 已就绪：旧 `_safeMint` 的回调仍发生在写 URI 之前；本方案保证交易最终提交的状态完整。
- 正式接线前，须预先上传且验证 metadata，并冻结预计编号、订单和永久 URI。编号预测只作乐观候选，链上 expectedTokenId 检查才是最终保护；若发生竞争，停止并对账，不能重发旧资料冒充新编号。
- 部署前核验新入口的固定目标与代码；分别授予旧 Orchestrator 的 MINTER_ROLE（可铸造）和 ScoreNFT 的 MINTER_ROLE（可首次写 URI）。旧直接发行入口的权限迁移、在途单排空和全钱包锁必须在切换方案中明确。

## 当前小闭环：合约与真实组合测试

文件：
- `contracts/src/p23/AtomicScoreIssuer.sol`
- `contracts/test/p23/AtomicScoreIssuer.t.sol`
- 本文与本线路的验证证据、学习/决策记录。

不得改 P24 正在修改的 `app/api/cron/process-score-queue/process-order.ts`、`route.ts`、`src/lib/cron/score-cycle.ts`；本轮不改生产发行入口，不修改 Ethereum/Echo 路径。

执行：
- [x] 用现有真实合约复现缺少原子入口的失败测试：原入口调用新签名失败，断言 `atomic issuance must succeed` 为红。
- [x] 实现新入口与权限检查；55 行，没有修改现有两个合约。
- [x] 测试完整发行、旧订单防重复、旧唱片保留、编号竞争、URI 权限缺失、铸造权限缺失、参数错误、恶意接收回调；验证失败不消耗编号/订单。新增 13/13，全 Forge 152/152 通过。
- [x] 运行完整 Forge 测试及 `bash scripts/verify.sh`。verify 退出 1，仅既有 `src/lib/self-mint` 9 / `src/types` 10 文件超限；类型、Lint（4 个既有警告）、业务检查、构建与 Forge 152/152 通过。已停，不改邻接文件；证据 `reviews/evidence/p23-atomic/verify.log`。
- [x] 独立只读审查本轮差异，无重要缺陷；回调空 URI 与旧入口权限边界保持明确。
- [x] 登记完整检查结果后停止，等待用户继续；未提交、未部署、未接后台。

## 后续独立闭环（未实现）

1. 后台接线设计：与 P24 协调完成后，预先生成 metadata、冻结编号候选、选路新旧流程；恢复以旧订单映射和链上 URI 为真值。迁移必须隔离已经发出 mint 的旧订单，不能重复铸造。
2. 实现持久状态及恢复测试：上传结果未知、交易结果未知、编号冲突、旧单/新单混跑、队列预算不足、回滚配置后仍按已冻结路径对账。
3. 制作可审阅部署/授权/切换方案，测试网与真实钱包验收；另行批准后执行生产动作。
4. 验收新 NFT 的 Alchemy 单枚与 owned 列表、Semi 实际显示；缓存未更新不能冒充通过。

## 审查重点

1. 新入口必须使用旧订单映射，重复请求不制造第二枚 NFT。
2. setTokenURI 失败或编号变化必须整笔回滚，允许使用相同订单在纠正原因后重试。
3. 旧 NFT 的不可变 URI、原持有人、编号序列不被改写。
4. 合约接收者回调不得绕过新入口权限/重入保护；旧入口权限仍是部署切换时独立检查项。
5. 所有“成功”声明限于本地合约行为，不代表后台已接线或 Semi 已恢复。
