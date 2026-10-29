# P22-0 冻结表

> 2026-10-30。用户授权"尽可能按推荐方案做，一口气搞定"，下列决定均按推荐值自定，**事后可改，但改动需同步合约与测试**。
> 证据见 `01-chain-evidence.md`。合约与测试已落地（P22-A），`forge test` 126 全绿。

## 1. TBA 结构（已冻结）

| 项 | 值 |
|---|---|
| Registry | `0x000000006551c19487814612e58FE06813775758`（四链 runtime hash 一致） |
| 传给 Registry 的 implementation | **`0x41C8f39463A868d3A88af00cd0fe7102F30E44eC`（直接绑定，不经 AccountProxy）** |
| salt | `bytes32(0)` |
| chainId | `block.chainid`（本链） |
| 创建后 | 立即可用，无需 `initialize`（fork 实测：`token()`、`owner()` 正确，支持 ERC-1155 接收） |
| 升级 | 账户含 `upgradeTo` / `upgradeToAndCall`，Score 持有人可升级自己的 TBA；素材合约禁转让，升级不能转出素材 |
| 部署脚本护栏 | 链上 `codehash` 必须等于冻结值，否则拒绝部署 |

弃用 AccountProxy 的理由：创建后须再发一笔 `initialize`，开包合约在初始化前铸 ERC-1155 会失败。

## 2. 凭证（EIP-712，已冻结，Solidity/viem 向量一致）

- domain：name=`Ripples Pond Score Pack`，version=`1`，chainId 与 verifyingContract 由 domain 绑定。
- 类型：`PackVoucher(uint256 scoreTokenId,address holder,uint256 trackTokenId,bytes32 soundIdsHash,uint256 deadline)`
- `soundIdsHash = keccak256(abi.encodePacked(uint256[]))`（每个元素补足 32 字节后拼接）。
- TYPEHASH `0x7867dc90…2193`；向量 `PackVoucher(7, 0x1111…1111, 2, [1,2,33], 1900000000)` 的 structHash 为 `0x4d3ce9ad…e91c`（测试 `VoucherVector.t.sol`）。
- 构造时固定：Score 合约、两个素材合约、Registry、implementation、salt。
- **撤销策略：不加 epoch。** A→B→A 后旧凭证可重新生效（有测试固定此行为），靠 `MAX_VALIDITY = 1 小时` 与 signer 轮换兜底。
- 参数：音效上限 **64**；凭证有效期服务端签 **10 分钟**，合约硬上限 **1 小时**。

## 3. 角色与应急

| 角色 | 谁 | 约束 |
|---|---|---|
| admin | 现有独立 admin 钱包 | 合约里 admin ≠ signer ≠ pauser，部署脚本两条主网都校验；`AccessControlDefaultAdminRules`，延迟 **主网 ≥ 1 天** |
| signer | 服务端凭证签名钥匙，独立于 operator | 只签凭证 |
| pauser | 应急钥匙 | 暂停 `open` 与素材铸造 |
| operator | OP 代付提交者 | 无合约权限 |
| 素材 minter | **只有本链开包合约**（构造时写入 immutable，不是角色，admin 也授不了） | |
| deployer | 部署用临时钱包 | 部署后读回，不得持有任何角色 |

应急：signer 泄露 → pauser 暂停 → 轮换 signer → 评估被错开的 Score；链上无法撤销已开包，只能公告。

## 4. 运营参数（推荐值）

| 项 | 值 |
|---|---|
| OP 单日上限 | 全局 **200 包/日（UTC）**，单用户 **3 包/日**；预占在发送前原子完成，失败的交易**也计数** |
| OP 自动重试 | 最多 **3 次**，间隔递增 |
| 订单超时 | `awaiting_wallet` / `unsent` 超 **30 分钟**转 `abandoned`；失去所有权立即 `abandoned` |
| ETH 确认数 | 沿用 P16 |

## 5. tokenId 与素材身份

- 音效 tokenId：**按音频 SHA-256 去重后追加编号**，从 1 起，只追加不重排；覆盖"历史 Score 用过的有效音效 + 当前 33 个"，初始 46 个不同 SHA-256（本地统计，P22-B 时按两链全量重核）。
- 背景音乐 tokenId：从 1 起顺序追加；`catalog UUID → uint256` 映射存数据库与 `src/lib/score-pack/` 的常量表，**不对 UUID 做 BigInt**。
- 合约方面：`defineTokens` 只追加，已登记 ID 不可覆盖，URI 必须是 `ar://` 永久地址。
- 素材合约名：`PondSoundNFT`（"Ripples Pond Sound"）、`PondTrackNFT`（"Ripples Pond Track"）、`ScorePackOpener`。

## 6. Foundry 测试方式

- **不用 fork。** 把四链一致的 Registry 与 TBA 实现 runtime 字节码存成 fixture（`contracts/test/p22/fixtures/*.hex`），`vm.etch` 到真实地址；测试 `test_fixturesMatchMainnetHashes` 校验 hash，防止静默漂移。无需 `forge install`，无需网络。
- 另有只读 `foundry.toml` 的 `fs_permissions` 指向该目录。

## 7. 已知偏差与未做项

- 没有逐字节核对 `0x41C8…` 与 Tokenbound v0.3.1 官方源码；用 runtime hash 四链一致 + 行为实测代替。
- 凭证 digest 的 domain 部分依赖 opener 部署地址，viem 侧用 `eip712Domain()` 读回后对照。
- 目录基线：`src/lib/self-mint`（9 文件）、`src/types`（10 文件）仍是 `verify.sh` 的旧失败，P22 不新增文件到这些目录。
