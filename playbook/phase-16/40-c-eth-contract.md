# P16-C — Ethereum ScoreNFT Lazy Mint 合约

> 目标：采用成熟的 EIP-712 lazy-mint voucher 模式，让用户一笔交易完成 ScoreNFT 铸造与永久 URI 写入。\
> 前置：P16-B 完成。\
> 状态：旧快照实现和测试可复用；Sepolia 已部署，迁入最新主线后只复核，不重复部署。\
> 完成后进入：P16-D。

---

## 1. Review 后的简化结论

Ethereum 只部署一份新的 `ScoreNFT`，不再部署额外 orchestrator。

原因：

- 原方案要在用户交易前冻结 metadata，但旧 ScoreNFT 的 Token ID 只会在 mint 后产生，链路无法闭合；
- 标准 lazy mint 由服务端预留 tokenId，并把 tokenId、URI 和接收人写入 EIP-712 voucher；
- NFT 合约自身验证 voucher 后原子 `_safeMint + _setTokenURI`，比“两合约 + 两次内部调用 + 角色转接”更少部署、更省 Gas、更少故障面；
- OP 现有 ScoreNFT 与 MintOrchestrator 完全不变，ETH 合约拥有独立地址和 ABI。

这是标准 lazy-mint 模式的项目化实现，不采用第三方 marketplace/drop 平台，避免平台费、升级代理和供应商锁定。

合约公开身份延续现有主网 ScoreNFT：ERC-721 `name = "Ripples in the Pond"`、`symbol = "RPIP"`。它可转让、不可升级、无 burn、无版税、无供应上限；Ethereum 与 OP 通过 chainId + contract 区分，不伪装成同一链上合约。

---

## 2. 直接复用的 OpenZeppelin 4.9.6 模块

- `ERC721URIStorage`：ERC-721 与 tokenURI 存储；
- `EIP712`：domain separator 与 typed-data digest；
- `SignatureChecker`：同时兼容 EOA 与 ERC-1271 authorizer；
- `AccessControlDefaultAdminRules`：单一默认管理员、延迟且两步式 admin 转移；
- `Pausable`：只暂停新 redeem，不冻结已存在 NFT 的转移。

禁止手写椭圆曲线恢复、domain separator、ERC-721 存储、角色系统或代理升级。默认 admin 延迟在部署 Gate 冻结并测试，不能临时写自定义“两步移交”。

同时直接复用现有 `WalletRecipeNFT` 已验证的两项永久性约束，而不是另写一套：

- `tokenURI` 与构造参数 `contractURI` 都必须是严格的 `ar://` + 43 位 base64url txid；拒绝 HTTPS、路径、空值和占位地址；
- 构造时冻结 collection metadata，公开 `contractURI()` 并声明 ERC-7572 interface，合约不提供后续修改入口。

复用时应抽出同一份内部 URI 校验实现或逐字沿用已通过测试的实现与测试向量，避免两份“看起来相同、边界不同”的校验器。

---

## 3. Voucher 合同

```solidity
struct MintAuthorization {
    bytes32 orderId;
    uint256 tokenId;
    address recipient;
    bytes32 tokenURIHash;
    uint256 deadline;
}
```

EIP-712 domain：

- `name = "Ripples in the Pond"`；
- `version = "1"`；
- 当前 `chainId`；
- 当前 ScoreNFT `verifyingContract`。

调用参数额外传：

- `string tokenURI`：合约核对 `keccak256(bytes(tokenURI))`；
- `address authorizer`：先检查角色，再交给 `SignatureChecker`；
- `bytes signature`。

tokenId 由 Supabase sequence 在订单创建时预留，因此永久 metadata 可以在用户交易前写入准确名称和规范 URL。取消订单留下编号空洞，编号永不回收。

类型字符串固定为：

```solidity
MintAuthorization(bytes32 orderId,uint256 tokenId,address recipient,bytes32 tokenURIHash,uint256 deadline)
```

`orderId` 是服务端生成的 32 随机字节，不把 UUID 字符串临时 pad/hash 成 bytes32。TypeScript 使用 viem `hashTypedData`，Solidity 使用 `_hashTypedDataV4`；字段名称、顺序和类型由跨语言固定向量锁定。

---

## 4. `redeem` 校验与写入顺序

公开、nonpayable、`whenNotPaused` 的 `redeem` 依次执行：

1. `tokenId > 0`；
2. `orderId != bytes32(0)`；
3. `msg.sender == recipient`；
4. `block.timestamp <= deadline`；
5. `tokenIdByOrderId[orderId] == 0`；
6. tokenId 尚未存在；
7. URI 通过严格永久 `ar://` 校验且哈希一致；
8. authorizer 持有 `AUTHORIZER_ROLE`；
9. `SignatureChecker.isValidSignatureNow(authorizer, digest, signature)`；
10. 先写 `tokenIdByOrderId[orderId] = tokenId`；
11. `_safeMint(recipient, tokenId)`；
12. `_setTokenURI(tokenId, tokenURI)`；
13. 发出 `ScoreRedeemed(orderId, recipient, tokenId, tokenURIHash)`。

任何一步失败整笔交易回滚。先写订单映射用于重入保护；后续 mint 失败时 EVM 会把映射一并回滚。

`tokenIdByOrderId` 必须公开可读，后台可在 txHash 丢失或交易被替换时直接按 orderId 判断链上是否已完成。

---

## 5. 角色与运维

- `DEFAULT_ADMIN_ROLE`：由 `AccessControlDefaultAdminRules` 管理的冷路径单一 admin，不参与日常签名；
- `AUTHORIZER_ROLE`：独立服务端 EVM 地址，可并存新旧地址完成轮换；
- `PAUSER_ROLE`：可暂停新 redeem；只有默认 admin 可恢复，避免被盗 pauser 同时解除暂停；
- 不保留公开 mint、公开 setTokenURI、提款或收 ETH 方法；
- `contractURI()` 只返回构造时冻结的永久 collection metadata，不保留 setter；
- `redeem` 为 nonpayable，用户只向网络支付 Gas，不向合约付费；
- pause 只影响新铸造，不能冻结用户已拥有 NFT 的转移。

authorizer 复用项目现有 viem 服务端签名方式，但使用与 operator/admin 完全不同的私钥和环境变量。Privy Server Wallet 不是首版必需：它仍需新增 Node SDK、钱包资源、authorization key 与费用/额度合同，不能减少当前业务复杂度；若未来全站统一迁移托管签名，再单独评估。

---

## 6. 重放与抢跑防护

- `orderId → tokenId` 映射：同订单只能成功一次；
- voucher `tokenId`：后台预留编号不能被替换；
- domain `chainId`：阻止跨链重放；
- domain `verifyingContract`：阻止跨部署重放；
- `recipient` 与 `msg.sender` 绑定：看到 calldata 的第三方不能抢走 NFT；
- `tokenURIHash`：阻止篡改永久 metadata；
- `deadline`：限制泄露 voucher 的有效期；
- ERC-721 token existence：不同订单也不能复用同一 tokenId。

EIP-712 本身不提供重放保护，不能删除 order mapping 或 deadline。

---

## 7. 事件与恢复合同

```solidity
event ScoreRedeemed(
    bytes32 indexed orderId,
    address indexed recipient,
    uint256 indexed tokenId,
    bytes32 tokenURIHash
);
```

后台恢复优先级：

1. 读 `tokenIdByOrderId(orderId)`；
2. 非 0 时按 ScoreRedeemed / ERC-721 Transfer 事件找到真实交易；
3. 校验 owner、tokenURI 与哈希；
4. 再更新数据库 success。

因此不需要依赖 Alchemy webhook，也不会因客户端漏报或 replacement hash 丢失资产。

---

## 8. 合约测试清单

- 正常 redeem，owner、tokenURI、映射和事件正确；
- 合约 name/symbol、不可变 contractURI、无 burn/版税/升级入口符合冻结产品合同；
- 同一 voucher / orderId 重放；
- 两个订单复用同一 tokenId；
- 改 tokenId、recipient、URI、deadline 或 orderId；
- 错误 chainId domain；
- 错误 verifying contract；
- 非 recipient 抢跑；
- 过期 voucher；
- 无角色 authorizer 和畸形签名；
- EOA authorizer 与 ERC-1271 authorizer；
- authorizer 轮换与撤销；
- pause 阻止 redeem，但不阻止已铸 NFT transfer；
- `_safeMint` receiver 回调失败时所有状态回滚；
- 空 URI、tokenId=0、orderId=0 的明确策略；
- tokenURI / contractURI 拒绝 HTTPS、错误长度、非法 base64url 字符、路径和占位 URI；
- contractURI 构造后不可改，ERC-7572 interface 可读；
- fuzz：任意单字段变化都不能复用签名。

保留现有 OP 合约测试，证明 P16 没有改变 OP ScoreNFT 与 MintOrchestrator。

---

## 9. Gas 与静态安全

- 记录 deploy 与正常 redeem Gas；
- 对比原“两合约 orchestrator”方案，确认单合约没有更高调用成本；
- URI 只传短 `ar://{txid}`，不把完整 metadata 放 calldata；
- 运行 Forge 全套、fuzz 和 gas snapshot；
- 使用项目允许的静态检查；若没有已配置审计器，不为本 Track临时引入重量级框架；
- 主网部署前完成一次独立合约 review，重点看 typed-data typehash、角色、重放和状态写入顺序。

UI 不把测试网一次估算写成主网固定费用；最终 Gas 由钱包确认。

---

## 10. Track 出口

- 单一 ETH ScoreNFT 源码、部署脚本和 ABI 已落地；
- voucher 的 TypeScript 与 Solidity hash 测试向量完全一致；
- 全部安全测试和 OP 回归通过；
- 合约地址只通过 chain registry 注入；
- `tokenIdByOrderId` 恢复路径已测试；
- 尚未部署 Ethereum Mainnet；
- 关键安全行完成代码走读记录。

既有 Sepolia 地址为 `0x237a216F4034FF5Ee0d97f276c0bde26d59eD0DE`。除非链上字节码、角色或不可变 URI 与部署证据不一致，禁止为迁移代码重新部署测试合约。
