# P14-B — Recipe v1、metadata 与资格数据合同

> **目标**：在数据库、合约和页面施工前，把“同一钱包永远得到什么”写成逐字节可复现的规范。
> **前置**：P14-A 的字符顺序和素材 manifest 已冻结；本 Track 不部署、不上传 token metadata。

---

## B0｜Recipe v1 规范

### 常量

```text
recipeVersion = 1
domain        = UTF-8("RIPPLES_WALLET_RECIPE_V1")
charset       = UTF-8("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
recipeLength  = 36
```

这些值一旦产生第一枚主网 metadata 即永久冻结。未来变化只能新增 v2，不得改写 v1。

### 地址规范化

1. 输入允许 checksum 或任意大小写 EVM 地址。
2. 用 viem `getAddress` 校验；无效、零地址或非 20-byte 输入直接拒绝。
3. 哈希输入使用地址的原始 20 bytes，不使用带 `0x` 的 ASCII，也不使用 checksum 字符大小写。
4. metadata 与数据库展示统一保存 checksum 地址；唯一索引另存小写规范键。

### 确定性字节流

对 counter 从 `0` 开始递增：

```text
block(counter) = keccak256(
  domain
  || address20
  || uint32be(counter)
)
```

- `uint32be` 固定 4 字节大端；不是十进制字符串。
- 每个 block 产生 32 bytes，按从左到右消费。
- 当前 block 用完仍不足 36 个字符时递增 counter 继续。

### 无偏映射

256 中小于 252 的值可平均分成 36 组：

```text
若 byte >= 252：丢弃
否则 index = byte % 36
输出 charset[index]
```

直到得到 36 个字符。不得使用 `hashByte % 36` 直接映射全部 0–255；那会让前 4 个字符概率略高。

### 性质

- 算法不承诺密码学秘密；钱包地址和 recipe 都是公开的。
- 相同地址、版本和字符表必须逐字符一致。
- 输入不含 tokenId、登录账号、日期、随机数或数据库 id。
- recipe 允许重复；不得为了“多样性”洗牌、去重或保证 36 种都出现。
- origin NFT 转让不重新派生 recipe。

---

## B1｜共享实现与独立测试向量

### 📦 范围

- `src/features/wallet-recipe/recipe-v1.ts`
- `src/types/wallet-recipe.ts`
- `src/features/wallet-recipe/metadata.ts`
- `contracts/test/RecipeVector.t.sol`（只作独立参考，不进入生产合约）
- 现有测试/验证脚本允许增加 P14 定向检查，但不得安装新测试框架

`src/features/wallet-recipe/` 最终保持最多 8 个条目；A 与 B 写入同一 feature 边界，不在 `src/data` 顶层继续加文件。

### API

```ts
normalizeOriginWallet(input: string): `0x${string}`
deriveRecipeV1(wallet: `0x${string}`): string
collectRecipeKeys(recipe: string): string[]
calculateRecipeDurationMs(recipe: string, manifest: ClipManifestV1): number
```

- `collectRecipeKeys` 保留字符表顺序或首次出现顺序必须明确，不能依赖 JS object 偶然排序。
- recipe 校验必须同时检查长度、版本字符表和全部字符，不接受小写字母。
- 前后端复用同一纯函数；服务端不得另写一份“差不多”的算法。

### 测试向量

至少冻结 8 个地址：

- `0x0000000000000000000000000000000000000001`
- `0x1111111111111111111111111111111111111111`
- `0x1234567890abcdef1234567890abcdef12345678`
- 全 `f` 地址
- 现有 OP Sepolia 测试钱包地址 2 个
- 现有 OP Mainnet 已铸 Score 钱包地址 2 个（只用于算法，不触发资格）

每条记录：checksum 输入、address20 hex、counter block 前 32 bytes、丢弃字节数量、最终 36 位 recipe、总时长。TypeScript 与 Solidity 测试辅助实现必须独立得到相同结果。

### 统计 Gate

确定性不等于均匀性的证明；增加固定样本统计检查：

- 对顺序生成的至少 10,000 个合法地址派生 recipe，共 360,000 个字符。
- 每个字符频率相对期望值的偏差设置宽松、稳定的统计阈值，避免测试偶然抖动。
- 明确命中 `252–255` 拒绝路径，并证明输出仍为 36 位。
- 大小写/同一 checksum 变体必须同结果；无效地址和零地址按合同拒绝。

统计测试只防实现错误，不宣称随机不可预测或稀有度。

---

## B2｜Token metadata v1

### 顶层结构

```json
{
  "name": "<P14-0 冻结的命名结果>",
  "description": "<P14-0 冻结文案>",
  "image": "ar://<最终静态封面 txid>",
  "animation_url": "https://arweave.net/<decoderTxId>?v=1&recipe=<recipe>&clips=<manifestTxId>",
  "external_url": "https://pond-ripple.xyz/<冻结路由>/<tokenId或可永久定位值>",
  "attributes": [],
  "properties": {
    "recipeVersion": 1,
    "recipe": "<36位>",
    "originWallet": "<checksum address>",
    "sourceScoreTokenId": 1,
    "clipManifest": "ar://<txid>",
    "clipManifestSha256": "<64 hex>",
    "durationMs": 252000,
    "clips": {}
  }
}
```

示例中的尖括号只用于说明 schema；实现时所有值必须来自 P14-0/A/E 的冻结输入，禁止占位写入真实 metadata。

### `clips` 子集

只保存 recipe 实际出现的每种 key，一种 key 只列一次：

```json
"A": {
  "uri": "ar://<43位 txid>",
  "sha256": "<64位小写 hex>",
  "durationMs": 7000
}
```

播放器按 recipe 重复引用，不能把 `clips` object 的键顺序当播放顺序。

### metadata 构建约束

- `durationMs` 由 36 个 recipe 位置逐项相加，重复字符重复计时。
- `animation_url` 固定永久 Decoder 与全局 manifest，不引用当前环境 sounds/decoder env。
- `external_url` 必须能在不知道未来 tokenId 的方案下成立；若 P14-0 选择 tokenId 路由，则合约/队列顺序必须先可靠取得 tokenId 再上传 metadata，不能猜 `_nextTokenId`。
- metadata JSON 采用 UTF-8、稳定字段顺序和规范序列化；同一任务重试必须生成同一 bytes/hash。
- metadata 上限先定为 32 KiB；超限说明 schema 异常，不能静默截字段。
- 不写服务器时间、数据库 queue id、网关健康或其他会让同一任务重试内容漂移的字段。

### tokenId 依赖决策

P14-0 必须在两种完整流程中选一：

1. **推荐：永久路由用 origin/recipe identity**。先上传 metadata，再用一次 mint 写死 tokenURI；更少交易、更易幂等。
2. **若必须使用 `/.../<tokenId>`**：合约采用 mint 后 `setTokenURI` 两步和一次写入槽，队列增加 receipt/tokenId/URI 状态；不得读取 nextTokenId 预测。

该选择会改变 C/D 状态机，未拍板不得施工。

---

## B3｜资格与队列数据合同

### 单表真值

建议以 `wallet_recipe_queue` 同时表达排除基线与可执行任务，每个 origin wallet 恰好一行：

```text
origin_wallet_key     小写地址，UNIQUE，资格幂等真值
origin_wallet         checksum 地址，展示/metadata
eligibility           excluded_prelaunch | eligible
source_score_queue_id 首枚 Score queue UUID，UNIQUE
source_score_token_id 首枚 Score tokenId，UNIQUE
source_score_tx_hash  首铸交易
source_score_block    首铸区块，和 activationBlock 比较
recipe_version        固定 1
recipe                固定 36 位
recipe_hash           审计索引，不替代 recipe
image_ar_tx_id        E 冻结后写入；共用封面也明确保存来源
metadata_ar_tx_id     metadata 上传成功后写入
token_uri             最终 ar:// URI
token_id              P14 tokenId，成功后 UNIQUE
tx_hash               P14 mint 交易 hash
status                见下方状态机
retry/failure/lease   对齐现有 durable queue 语义
```

### 状态机

默认单交易 mint 流程：

```text
excluded_prelaunch（终态，不进入 worker）

pending
  → preparing_media
  → uploading_metadata
  → minting_onchain
  → success
  → failed(safe_retry | manual_review)
```

若 P14-0 选择 tokenId 后设 URI，则在 receipt 后增加 `uploading_metadata → setting_uri`，并复用 Score 队列已验证的 attempted_at/tx hash 双交易恢复模式。

### 三个唯一性层次

1. 数据库 `UNIQUE(origin_wallet_key)`：发现器并发只产生一行。
2. 数据库 `UNIQUE(source_score_queue_id/source_score_token_id)`：同一 Score 不被重复归因。
3. 合约 `tokenIdByOrigin[origin] != 0`：数据库丢失或误操作也不能铸第二枚。

不使用“前端查不到就允许 mint”的弱判断。

---

## B4｜解析与错误合同

- metadata 只接受 JSON object、`recipeVersion=1`、合法 36 位 recipe。
- `originWallet` 必须能规范化，并可与合约 `originWalletOf(tokenId)` 对账。
- `sourceScoreTokenId` 为正整数；不接受字符串拼接后默默转 NaN。
- `clipManifest` 和所有 clip URI 只接受 `ar://` + 43 位 txid。
- `animation_url` 只允许冻结的 Decoder txid 和已知 query keys；拒绝任意第三方脚本 URL。
- `clips` 必须恰好覆盖 recipe 的 unique keys，不多不少；每项 hash/时长与 A manifest 一致。
- `durationMs` 必须重新计算一致，不信远端声明。
- JSON/资源设置有大小、超时和有界网关回退；错误显示可重试，不用当前本地文件替换永久内容。

---

## Track B 完成标准

- v1 逐字节规范、共享 TypeScript 实现和独立 Solidity 测试向量一致。
- 8 个固定向量和统计 Gate 全绿，拒绝采样路径真实命中。
- metadata schema 可仅凭 tokenURI + Arweave 恢复 recipe、素材、来源钱包和首枚 Score。
- 数据 schema 能表示启用前排除、启用后 eligible、失败重试、manual review 和成功。
- 合约无需解释 recipe；若选择链上 recipeHash，目的和一致性检查已在 P14-0 明确。
- 无新增依赖，`bash scripts/verify.sh` 通过。
- 更新文档后停在 P14-C。
