# P16-B — 多链配置、资产身份与订单数据

> 目标：建立不会与 OP 队列、Token ID 或合约部署互相混淆的多链数据底座。\
> 前置：P16-A 完成。\
> 状态：旧快照已有实现；迁入最新主线时按 `053–057` 重编号，并在干净隔离库重新验证。\
> 完成后进入：P16-C。

---

## 1. 链注册表

建立单一 chain registry，至少覆盖：

| 环境 | chainId | 用途 |
|---|---:|---|
| OP Mainnet | 10 | 现有生产代付铸造 |
| OP Sepolia | 11155420 | OP 测试 |
| Ethereum Mainnet | 1 | P16 最终自付铸造 |
| Sepolia | 11155111 | P16 集成测试 |

每条链显式声明：

- `chainId`、短名称、用户可见名称；
- RPC 环境变量名，不在代码中放商业 RPC 密钥；
- 区块浏览器基础 URL；
- 当前链对应的 ScoreNFT 地址与 mint mode；
- 是否允许登录连接、是否允许发起铸造；
- 确认数和回执超时策略；
- 资产规范路由生成器。

未知链、缺失地址或环境与地址不匹配时必须 fail closed，不能回退到 OP。

---

## 2. 共享铸造占用

新增轻量 `score_mint_claims`，作为 OP 与 ETH 共同的“双铸闸门”：

- `pending_score_id` 为唯一主键；
- 记录当前 mode：`op_sponsored` 或 `eth_self_paid`；
- 记录 `active / consumed / released / manual_review`；
- OP 的 `mint_score_enqueue` 与 ETH prepare 都必须在同一数据库事务里先取得 claim；
- claim 已 active/consumed 时，另一条路径不能建单；
- ETH 只有在链上 `tokenIdByOrderId == 0`、无已知成功事件、无广播未知且订单明确未提交时，才允许原子 release；
- release 保留审计记录，不删除；再次选择时更新同一 claim 的版本和 mode。

这会给 OP 入队 RPC 增加一个最小数据库前置检查，但不改变 OP 的链上、队列或用户体验。不得用“两张表各自唯一”冒充跨路径互斥。

---

## 3. 新订单表

新建 `score_self_mint_orders`，不扩展现有 `score_nft_queue`。

核心字段：

- 应用身份：`user_id`、`pending_score_id`；
- 链上目标：`chain_id`、`score_contract`、预留 `token_id`、`recipient_address`；
- 幂等标识：`order_id`，服务端生成 32 随机字节并规范表示为小写 `0x` + 64 位 hex，和合约 `bytes32 orderId` 一一对应；
- 状态：`preparing_assets`、`ready_to_sign`、`submitted`、`confirming`、`success`、`expired`、`failed`、`manual_review`；
- 素材：封面、音频、metadata 的永久存储 ID / URI / 内容哈希；
- 凭证：typed-data 摘要、URI 哈希、deadline、authorizer、签发时间、签名版本；
- 交易：`send_attempted_at`、`tx_hash`、替换交易哈希、区块号、确认时间；
- 失败：阶段、稳定错误码、可否重试、最后错误摘要；
- 运维：创建、更新时间与最近对账时间。

敏感签名私钥绝不入库；完整签名只有确有恢复需求时才加密保存，否则按相同订单重新签发短期凭证。

---

## 4. Token ID 预留、唯一约束与并发规则

ETH metadata 必须在用户交易前永久冻结，因此不能依赖交易后才产生的自增 ID。采用 PostgreSQL sequence 在订单事务内预留正整数 Token ID：

- Token ID 一经分配永不回收；取消订单允许留下编号空洞；
- metadata 的名称、规范 URL 和 EIP-712 凭证都使用该 ID；
- 合约 `redeem` 按凭证中的 tokenId `_safeMint`，重复 ID 由 ERC-721 拒绝；
- 不读取链上 `nextTokenId` 猜号，也不为保持连续编号牺牲并发安全。

数据库至少保证：

- `order_id` 全局唯一；
- `(chain_id, score_contract, order_id)` 唯一；
- 非空 `(chain_id, tx_hash)` 唯一；
- 非空 `(chain_id, score_contract, token_id)` 唯一；
- 同一 `pending_score_id + chain_id` 同时只有一张活跃订单；
- `score_mint_claims` 保证已占用或已消费的 pending score 不能再次进入 OP 或 ETH 铸造。

所有 claim、订单和 Token ID 分配由一个 Supabase RPC 事务完成，并沿用现有 advisory lock 习惯；不用前端按钮状态代替数据库约束。

`order_id` 不从 UUID 文本、数据库行号或用户输入临时转换；API、数据库、typed data、事件与 getter 全程使用同一 32-byte 值，并以固定向量验证 hex/bytes32 往返。

---

## 5. 状态转换

允许的主路径：

```text
preparing_assets
  → ready_to_sign
  → submitted
  → confirming
  → success
```

允许的旁路：

- `ready_to_sign → expired`：用户没有签名或凭证超时；
- `ready_to_sign → failed`：确定性模拟失败且可解释；
- `submitted / confirming → failed`：有确定的链上失败回执；
- 任意广播不确定状态 → `manual_review`；
- `expired → ready_to_sign`：仍是同一订单和同一冻结 URI 时，可签发新 deadline；
- `failed → preparing_assets`：只有资产本身失败且确认可重试时允许。

禁止直接把“用户拒绝钱包弹窗”记为链上失败；拒签前没有交易哈希，也不消费 pending score。

---

## 6. 多链资产身份

所有新代码使用：

```text
assetId = eip155:{chainId}/erc721:{contractAddress}/{tokenId}
```

数据库可以拆列存储，但日志、缓存和埋点要能还原完整身份。规范页面路由：

```text
/score/{chainId}/{contractAddress}/{tokenId}
```

兼容规则：

- `/score/{tokenId}` 只解析现有 OP 主网 ScoreNFT；
- 新 ETH 链接不生成短路由；
- API 接受多链资产时必须传完整三元组；
- 前端组件不得把 tokenId 当 React key、缓存 key 或分析主键的唯一组成部分。

---

## 7. 现有模块复用

- 从 `process-score-queue/steps-upload.ts` 抽取链无关的 events、封面与 metadata 构建器，OP/ETH 共用，不复制；
- 复用 `src/lib/arweave.ts` 和 P14/P15 内容哈希账本；不能沿用“相同 bytes 天然得到相同 txid”的旧假设；
- 从现有 chain client / receipt helper 抽取按 chain registry 参数化的只读能力；
- 复用 Supabase RPC、lease、稳定错误码和 `manual_review` 约定；
- 复用现有 Score 页面组件，页面查询键改为完整 CAIP-19 资产身份。

Alchemy webhook 不作为首版依赖：订单量低、已有 txHash/orderId/合约 getter 和 cron，轮询能确定恢复且无需新增供应商配置。未来 webhook 只能做加速器，不能替代链上读回。

---

## 8. 索引与 P14 边界

- P14 的事件监听器保持固定 `chainId=10 + OP ScoreNFT address`；
- ETH ScoreNFT 事件进入 P16 自付订单对账器，不送入 Pond Echo；
- 两个监听器使用不同 cursor / checkpoint；
- 重组处理按各链独立确认数执行；
- 任何“按合约名 ScoreNFT 自动发现地址”的逻辑都必须改成显式链配置。

---

## 9. 迁移与验证

主线已使用 `050–052`，P16 最终编号冻结为：

| 最终编号 | 内容 | 旧快照编号 |
|---:|---|---:|
| 053 | self-mint schema | 051 |
| 054 | OP/ETH 共享 claim | 052 |
| 055 | prepare / release RPC | 053 |
| 056 | asset、attempt、submission、reconcile pipeline | 054 |
| 057 | hash 漏报恢复 | 055 |

旧隔离库的 migration history 与最新主线冲突。先导出 history、函数、#2–#4、claims 与永久资源引用；证据齐全后优先重建隔离库。不得通过伪造同号 history 继续施工，也不得让重建后的 Token ID 与既有 Sepolia Token #2 发生身份混淆。

1. 写 forward migration、类型和索引；
2. 本地执行迁移与回滚演练；
3. 验证旧 `score_nft_queue` 数据与查询结果不变；
4. 对并发创建 OP / ETH claim、release 后重选和已广播禁止 release 做事务测试；
5. 对同 tokenId 不同链、同链不同合约做路由与缓存测试；
6. 对非法链、空合约、错误地址做 fail-closed 测试；
7. 确认 P14 索引器忽略所有 ETH 事件。

本 Track 不部署合约，也不打开生产功能开关。
