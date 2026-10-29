# P22-0 链上证据（只读查询）

> 2026-10-30，`cast` 只读。主网用公共 RPC（用户 2026-10-30 批准）；测试网用 `.env.local` 的 Alchemy。

| 链 | chainId | 区块 |
|---|---|---|
| OP 主网（mainnet.optimism.io） | 10 | 158846458 |
| ETH 主网（ethereum-rpc.publicnode.com） | 1 | 26299633 |
| OP Sepolia | 11155420 | 50744202 |
| ETH Sepolia | 11155111 | 12020688 |

## runtime code keccak（四条链完全一致）

| 合约 | 地址 | keccak(runtime code) |
|---|---|---|
| ERC-6551 Registry | `0x000000006551c19487814612e58FE06813775758` | `0xda1d5b06e579f9e42e59b00fbc22939896ecb38dc8830d40de0a2508fecd6735` |
| AccountProxy | `0x55266d75D1a14E4572138116aF39863Ed6596E7F` | `0x7f2b4bea519ba5fe0e8e3cf054654f18480c4416fc71370b31f37848688afdb0` |
| 逻辑 `0x41C8…44eC` | `0x41C8f39463A868d3A88af00cd0fe7102F30E44eC` | `0xdf5eeb80b53e48dfd667fff5264976de4004fdd27eef4f6b954d182109f0f85b` |

## AccountProxy 自身的 ERC-1967 implementation 槽

| 链 | 槽值 |
|---|---|
| OP 主网 | `0x41C8…44eC` |
| ETH Sepolia | `0x41C8…44eC` |
| ETH 主网 | 空 |
| OP Sepolia | 空 |

- 各链不一致，说明有人在部分链上直接对 AccountProxy 调过 `initialize`。
- 作为 Registry 的 implementation 时，每个 TBA 是 ERC-1167 克隆，用克隆自己的存储，故此槽预计无影响。**待 fork 实测确认**：创建一个 TBA 后读它的 implementation 槽，并验证 `initialize` 对已初始化账户的行为。

## 仍未核实（P22-0 后续）

- `0x41C8…` 与 Tokenbound v0.3.1 源码的一致性（需编译比对 runtime，或查区块浏览器已验证源码）。
- 升级权限与 guardian；ERC-1155 回调是否可 override。
- 凭证编码与测试向量、tokenId 分配、Score 盘点、各项参数。

## Fork 实测（anvil fork OP 主网区块 158846458；TBA 对象为 OP ScoreNFT #1/#2，salt=0，chainId=10）

| 方案 | implementation 传给 Registry | 创建后 | 结果 |
|---|---|---|---|
| A 代理 | AccountProxy `0x5526…` | gas 94929，`token()` 调用失败（账户未初始化） | 需任何人再调 `initialize(0x41C8…)` 后才可用；创建后到初始化前，ERC-1155 铸入会失败 |
| B 直接 | 逻辑 `0x41C8…` | gas 94929，`token()`=(10, Score, 1)，`owner()` 为真实 Score 持有人，`supportsInterface(0x4e2312e0)`=true | 创建即可用，无需初始化 |

- A 的 `initialize` 对陌生地址开放，但传入非白名单实现会 revert `InvalidImplementation (0x68155f9a)`，无法借此换成恶意实现。
- `0x41C8…` 的代码含 `upgradeTo` / `upgradeToAndCall` 选择器，不含 `setGuardian`、`executeNested`。即 TBA 的持有人（= Score 持有人）可升级账户逻辑。素材合约自身禁转让，所以升级不能把素材转出。源码对照尚未做。
- 注意：`0xf23a6e61`、`0xbc197c81` 是函数选择器不是接口 ID，`false` 无意义；ERC-1155 接收能力以 `0x4e2312e0` 为准。
- anvil 是本地 fork，未向任何真实链写入。

## 倾向（待用户冻结）

采用 B：Registry 直接绑定 `0x41C8…`。理由：创建即可用，开包一笔交易内不需要先初始化；少一层代理。
