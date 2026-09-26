# P16-F0 — 多链 Token 编号隔离

> 目标：在 Ethereum Mainnet 部署前，把 ScoreNFT 的链上 Token ID 改为按链与合约独立编号。  
> 前置：Sepolia 最小闭环已通过，Ethereum Mainnet 尚未部署。  
> 完成后进入：[P16-F 主网 Gate](./70-f-testnet-mainnet.md)。

---

## 1. 最终编号模型

Score 同时保留两种身份，不混用：

1. **链上 Token ID**：每个 `chainId + contract` 独立从 `#1` 开始，只在该 NFT 合约内有意义；
2. **产品作品身份**：继续使用现有作品 UUID。若以后需要面向用户的全站流水号，另建不可变 `SCORE 000001`，不复用 Token ID。

NFT 的唯一坐标始终是：

```text
chainId + contract + tokenId
```

因此 `OP Token #7`、`Ethereum Token #7` 和 `Sepolia Token #7` 可以同时存在，且互不冲突。Sepolia 编号只属于测试集合，不占用 Ethereum Mainnet 编号。

---

## 2. 当前问题

- OP `ScoreNFT` 已由 OP 合约独立自增，不需要调整；
- Ethereum 自付订单目前通过 `score_self_mint_token_id_seq` 预留 Token ID；
- 这条序列同时服务 `chainId 1` 与 `11155111`，若沿用同一数据库，Sepolia 测试订单会抬高主网起始编号；
- 合约允许服务端凭证指定 Token ID，所以编号隔离应在数据库预留层完成，无需修改或重新部署 Sepolia 合约。

已经创建、签名、上传素材或完成铸造的订单一律保留原编号。编号空洞允许存在且永不回收，因为 metadata 和 EIP-712 凭证可能已经永久绑定该编号。

---

## 3. 数据库调整

新增一张集合级计数表：

```text
score_self_mint_token_counters
  chain_id
  score_contract
  next_token_id
  created_at
  updated_at

PRIMARY KEY (chain_id, score_contract)
```

实施要求：

1. 新建下一可用 migration；暂定 `058`，合入最新 `main` 时若编号被占用则顺延；
2. 不修改已经执行的 `053–057`；
3. 为现有 Sepolia 合约建立计数行，`next_token_id` 取数据库预留值与链上已铸事件中较大 Token ID 的下一位；
4. 主网合约部署并确认空集合后，建立独立计数行，`next_token_id = 1`；
5. `prepare_score_self_mint_order` 在原事务内锁定对应计数行、取号并递增；
6. `score_self_mint_orders.token_id` 继续显式写入，并保留 `(chain_id, score_contract, token_id)` 唯一约束；
7. 旧全局 sequence 暂时保留但停止使用；发布回退必须先关闭 ETH 入口，不允许恢复旧取号逻辑继续建单，稳定观察后再单独移除。

计数器必须同时包含链和合约。未来即使同一条链升级到新 ScoreNFT 合约，新集合也可以从 `#1` 开始，不受旧合约影响。

---

## 4. 代码与界面调整

后端：

- 把共享 sequence 取号替换为集合级原子取号函数；
- 幂等重试继续返回原订单和原 Token ID，禁止重复取号；
- authorization、metadata、对账与资产路由继续只读取订单冻结的 Token ID；
- OP 队列与 OP 合约保持不动。

界面：

- 铸造弹窗使用“未铸造 Token #N”；
- 成功资产使用“Ethereum · Token #N”“Sepolia · Token #N”或“OP · Token #N”；
- 不再把 Token ID 表述为跨链统一的“Score 编号”；
- 永久链接与缓存键继续使用完整 `chainId + contract + tokenId`。

本步骤不新增全站作品流水号，也不改已有作品 UUID、旧 OP 短链接或 P14 Pond Echo 的 OP-only 规则。

---

## 5. 迁移与发布顺序

1. 保持 Ethereum Mainnet 功能开关关闭；
2. 只读导出现有自付订单的 `chain_id / contract / token_id / status`；
3. 执行新 migration，建立计数表并初始化 Sepolia 下一编号；
4. 用现有 Sepolia 合约创建一笔新订单，确认编号延续且不会与历史订单冲突；
5. 完成一次并发测试，确认同一集合不会重复取号；
6. 部署 Ethereum Mainnet ScoreNFT，并确认 `Token #1` 尚不存在；
7. 注册主网计数行，从 `#1` 开始；
8. 配置主网环境变量，但继续保持入口关闭；
9. 用一笔主网低成本订单验证 `Token #1`；
10. 链、数据库、metadata 与页面四方一致后再开启主网入口。

任何已存在订单都不得为了“连续好看”重编号。若主网合约意外已有 Token，则停止开户，先以链上事实初始化下一编号。

---

## 6. 定向验证

必须通过以下检查：

- 同一集合并发准备两件作品，得到两个不同 Token ID；
- 同一作品重复 prepare，始终返回同一个订单和 Token ID；
- Sepolia 与 Mainnet 可以分别分配 `Token #1`；
- 同一条链的两个不同合约可以分别分配 `Token #1`；
- 现有 Sepolia 订单、metadata、voucher 和链上资产编号完全不变；
- 失败或放弃订单留下空洞，后续订单不会复用该编号；
- `(chain_id, contract, token_id)` 重复写入被数据库拒绝；
- OP 铸造回归通过，P14 仍只消费 OP ScoreNFT；
- 多链资产页、OG、分享链接和缓存不会仅用 Token ID 定位资产。

---

## 7. 完成定义

满足以下条件后，才能执行 Ethereum Mainnet 部署 Gate：

- 数据库已按 `chainId + contract` 原子分配 Token ID；
- Sepolia 下一编号已从现有最大值安全续接；
- Ethereum Mainnet 新集合明确从 `#1` 开始；
- 所有历史订单保持原编号且可继续恢复；
- UI 清楚展示链名与 Token ID；
- 定向数据库并发测试、类型检查、相关 lint 和 Sepolia 单笔 smoke 全部通过；
- 迁移、回退边界与主网初始化值已记录在发布证据中。

---

## 8. 施工结果（2026-09-26）

- ✅ 新增并执行 `058_score_token_counters.sql`，远端 migration history 已登记 `058`；
- ✅ 当前 Sepolia 数据库有 9 张订单，最大预留 Token ID 为 `#11`；6 张链上 order mapping 已兑换，链上最大值同为 `#11`；
- ✅ Sepolia 合约计数器初始化为 `next_token_id = 12`，已有订单、metadata、凭证与链上资产未改号；
- ✅ 同一虚拟集合并发原子取号得到 `#1/#2`，第二个集合独立得到 `#1`；夹具已清零；
- ✅ 订单 `token_id` 的旧 sequence 默认已移除，prepare RPC 已只使用集合计数器，未注册集合会以 `SELF_MINT_COUNTER_NOT_CONFIGURED` 拒绝；
- ✅ 远端 public schema lint、TypeScript、定向 ESLint、P16 chain identity、链/库编号审计与 `/me` HTTP smoke 通过；
- ⏭️ Ethereum Mainnet 合约部署后必须显式注册 `(1, contract, 1)`，再执行第一枚真实主网 smoke。
