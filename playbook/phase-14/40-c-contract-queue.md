# P14-C — ERC-721、资格唯一性与 durable queue 地基

> **目标**：在不接入 Score 生产流的前提下，完成新合约、数据库状态机和本地并发证明。
> **前置**：P14-0 合约参数已拍板；P14-B 的 recipe/metadata/状态合同已冻结。
> **本 Track 不部署 OP Sepolia/Mainnet，不启用 cron。**

---

## C0｜施工前基线

只读记录：

```bash
git status --short
cd contracts && forge build && forge test
cd .. && bash scripts/verify.sh
```

- 记录现有 Forge 测试数量与通过数，不把既有脏改动归入 P14。
- Foundry 不可用或基线不绿时立即停止；不通过删测试、改旧合约或降低规则进入 C1。
- 检查 OpenZeppelin 当前锁定版本，使用现有依赖，不升级包。

---

## C1｜新 ERC-721

### 📦 范围

- `contracts/src/WalletRecipeNFT.sol`
- `contracts/test/WalletRecipeNFT.t.sol`
- `contracts/script/DeployWalletRecipe.s.sol`
- `contracts/test/DeployWalletRecipe.t.sol`（若既有 deploy 测试结构需要）

合约类名是内部稳定代号；构造参数 `name_`/`symbol_` 必须取 P14-0 最终值，部署脚本不硬编码测试名。

### 最小状态

```solidity
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
mapping(address => uint256) public tokenIdByOrigin;
mapping(uint256 => address) public originWalletOf;
uint256 private _nextTokenId;
```

### mint 合同

默认单交易方案：

```text
mintToOrigin(originWallet, tokenUri)
```

- 仅 `MINTER_ROLE`。
- origin 不能为零地址，且首次接收人必须就是 origin。
- tokenUri 非空，只接受链下已构造好的永久 URI；合约不请求 HTTP。
- `tokenIdByOrigin[origin] == 0` 才可铸造。
- tokenId 从 1 开始；写 origin 映射并 `_safeMint`，任何 receiver revert 使全部状态回滚。
- tokenURI mint 时一次写入，合约不暴露后续修改函数。
- 发出包含 `originWallet` 与 `tokenId` 的专用事件，另有标准 Transfer。

若 P14-0 选择 tokenId 后设 URI，改为 `mintToOrigin` + 一次 `setTokenURI`；必须复制 ScoreNFT 的 `_uriSet` 和空串防御，但不得修改 ScoreNFT 本身。

### 转让/烧毁不变量

- 标准 ERC-721 transfer/safeTransfer 可用。
- 转让只改变 owner，不改变 `originWalletOf` 和 `tokenIdByOrigin`。
- 若允许 burn，烧毁后 `tokenIdByOrigin[origin]` 仍保留，origin 不能重铸。
- 若采用 Enumerable，`supportsInterface` 正确合并 ERC721URIStorage/Enumerable/AccessControl。
- 不添加可枚举之外的“按 owner 自建数组”，避免两套所有权索引漂移。

### Foundry 测试矩阵

1. 首枚 mint 成功，tokenId 从 1 开始，owner/origin/tokenURI/event 正确。
2. 非 minter、零 origin、空 URI、非 receiver 合约全部 revert。
3. 同 origin 相同 URI、不同 URI、不同大小写表示均不能第二次 mint。
4. 不同 origin 可各得一枚。
5. 普通转让与 safeTransfer 成功，origin 不变。
6. 转出后再 mint 给原 origin 被拒。
7. 若允许 burn，burn 后再 mint 仍被拒；若禁 burn，接口不存在。
8. 角色 grant/revoke 后权限即时生效；admin 与 minter 不混用。
9. fuzz 至少覆盖 origin 唯一性和任意合法转让序列。
10. Enumerable/royalty/pause 只按 P14-0 拍板结果测试，不留未使用开关。

每修改一次合约先跑定向 `forge test --match-contract WalletRecipeNFTTest -vvv`，再跑全量 Forge。

---

## C2｜部署脚本与链配置

### 📦 范围

- `contracts/script/DeployWalletRecipe.s.sol`
- `.env.example`
- `src/lib/chain/wallet-recipe-contract.ts`
- `scripts/vercel-env-sync.ts`

### 要求

- 主网 `ADMIN_ADDRESS` 缺失必须 hard fail；不得回退 deployer/operator。
- `name`/`symbol` 作为明确 env 或脚本常量冻结，测试网只允许 network suffix 出现在 UI 环境说明，不改正式 name/symbol。
- 部署脚本只部署并打印地址；不自动启用资格、不自动改 Vercel、不自动广播第二笔权限交易。
- 新 ABI 独立文件，避免继续膨胀现有 `contracts.ts`。
- 浏览器需要公开合约地址时才使用 `NEXT_PUBLIC_*`；私钥和 admin 配置永远 server-only。
- `vercel-env-sync` 纳入新地址、启用开关、activation block、永久 manifest/decoder txid 的环境对照，但不得输出 secret 值。

### 地址变量建议

```text
NEXT_PUBLIC_WALLET_RECIPE_NFT_ADDRESS
WALLET_RECIPE_ENABLED=false
WALLET_RECIPE_ACTIVATION_BLOCK
P14_CLIP_MANIFEST_V1_TX_ID
P14_DECODER_V1_TX_ID
```

最终变量名在 C2 一次冻结；之后不同时保留 `P14_*` 和 `WALLET_RECIPE_*` 两套同义配置。

---

## C3｜数据库 migration

### 📦 范围

- `supabase/migrations/phase-14/049_wallet_recipe_queue.sql`
- `src/types/wallet-recipe.ts`

migration 必须可在空测试库一次执行成功，并能安全重复检查对象是否已存在；生产执行留 F，不在 C 触碰远端数据库。

### 表约束

- `origin_wallet_key`：固定 42 字符小写 `0x[0-9a-f]{40}`，唯一且非空。
- `origin_wallet`：checksum 展示地址，应用写入前验证。
- `eligibility`：仅 `excluded_prelaunch | eligible`。
- `status`：严格 check；排除态和成功态不被 claim。
- recipe：eligible 必须 `version=1` 且 36 位合法字符；excluded 行可以不生成 recipe，避免给历史钱包制造“未发作品”。
- source Score queue/token 各自唯一；外键删除策略不得级联删除资格历史。
- token_id、tx_hash、metadata txid 按状态约束；不允许 `success` 缺 tokenId/txHash/tokenURI。
- `retry_count >= 0`，错误文本长度在应用写入时截断。
- `created_at/updated_at` 使用 timestamptz。
- RLS 默认开启；客户端无直接 insert/update/select 权限，读写走服务端 API。

### 索引

- `UNIQUE(origin_wallet_key)`。
- `UNIQUE(source_score_queue_id)` 与 `UNIQUE(source_score_token_id)`，允许 excluded/eligible 均被审计。
- `UNIQUE(token_id) WHERE token_id IS NOT NULL`。
- claim 索引覆盖 `status, created_at`。
- 当前持有人不以数据库 origin 推断；转让后的发现走合约 Enumerable 或经 Gate 选择的链上索引。

### 原子函数

1. `claim_wallet_recipe_job(p_owner, p_lease_minutes)`：`FOR UPDATE SKIP LOCKED` + durable lease，忽略终态/排除态/重试耗尽。
2. `register_wallet_recipe_origin(...)`：在同一事务中检查 activation、规范 origin、首次 Score 证据并插入；冲突返回既有行，不抛成 500。
3. 必要的 CAS update 必须带 `locked_by` 且 lease 未过期。

不得直接复制旧 queue SQL 后留下与 P14 无关的字段。

---

## C4｜本地/临时库状态机证明

使用测试数据库或事务回滚环境验证，不把 migration 提前应用到生产：

- 两个并发 registration 指向同 origin，只产生一行。
- 同 Score queue/token 重复 registration 收敛到同一行。
- eligible 与 excluded_prelaunch 不可互相覆盖。
- 两个 worker 并发 claim 取得不同任务；lease 未过期不能抢，过期可恢复。
- stale worker CAS 更新失败，不能覆盖新 worker 结果。
- success、excluded、manual_review 不再自动 claim。
- safe_retry 明确重开后仍使用原 recipe/metadata identity。
- 转让不修改数据库 origin 资格。

如果 Supabase 本地环境不可用，不把“SQL 看起来正确”写成通过；保留 C3 完成、C4 阻塞的真实状态。

---

## C5｜跨层静态审计

- 合约地址/ABI 只在后端调用模块和公开只读数据源使用；前端不 import operator wallet。
- 新合约没有调用旧 ScoreNFT，也没有改现有 MintOrchestrator。
- 新表没有触发器回写 Score queue 状态。
- 合约 origin、DB origin、metadata origin 使用同一地址规范。
- `tokenIdByOrigin` 的 0 哨兵与 tokenId 从 1 开始一致。
- 没有 `waitForTransactionReceipt` 进入普通 API route；receipt 轮询只在 cron。
- 没有新增依赖，所有代码文件和目录满足硬线。

---

## Track C 完成标准

- 新合约全量 Foundry 测试通过，旧 42 项或当前基线测试无回归。
- migration 与 claim/register 函数通过并发、lease、终态和排除态测试。
- 部署脚本在本地/anvil 可复现，但没有任何测试网或主网广播。
- ScoreNFT、MintOrchestrator、现有 Score queue 运行时代码零改动。
- `bash scripts/verify.sh` 通过。
- 更新 STATUS/TASKS/LEARNING；若 P14-0 合约选择产生非显然决定，追加 JOURNAL。
- 停在 P14-E0，与用户共创视觉后才继续。
