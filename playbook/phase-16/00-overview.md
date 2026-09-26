# Phase 16 — 外部钱包登录与 ETH ScoreNFT 自付 Gas

> 状态：2026-09-24 已按“最小成熟闭环”优化；旧 P16 有可复用实现，但尚未迁入最新 `main`\
> 正式基线：`main@f24f5bd`；旧快照 `3c5fa6f` 只作选择性迁移来源\
> 权威执行顺序：[05-minimal-loop.md](./05-minimal-loop.md) 的 `M0 → M1 → M2 → M3 → M4 → M5 → M6`\
> 本轮完成线：Sepolia 最小成熟闭环并具备合入 `main` 的证据；Ethereum Mainnet 另过不可逆 Gate

---

## 1. 这一阶段交付什么

P16 给外部钱包用户增加真正的钱包登录与链选择：

1. 登录页提供 `MetaMask`、`imToken / WalletConnect`、Phantom 与 OKX Wallet 入口；
2. MetaMask 桌面与 imToken / WalletConnect 是本轮真实铸造 Gate，Phantom/OKX 先做入口 smoke；
3. 只有通过外部钱包登录、且当前钱包可发起交易的用户，才在 `/me` 看到 `OP / ETH` 选择；
4. `OP` 继续走现有平台代付 Gas 队列；
5. `ETH` 第一版只开放 ScoreNFT，用户用当前外部钱包支付 Ethereum Gas；
6. 邮箱登录和现有 SEMI 登录保持原体验，不显示链选择，也不能进入 ETH 自付路径。

P16 不改变 P14 的 Pond Echo：Pond Echo 继续只识别 OP 上的 ScoreNFT，不读取 ETH ScoreNFT。

---

## 2. 冻结的产品规则

| 场景 | 登录方式 | 可见链 | Gas | 第一版能力 |
|---|---|---|---|---|
| MetaMask | 外部钱包签名登录 | OP / ETH | OP 平台代付；ETH 用户自付 | 两条链均可铸造 ScoreNFT |
| imToken / WalletConnect | 外部钱包签名登录 | OP / ETH | OP 平台代付；ETH 用户自付 | 两条链均可铸造 ScoreNFT |
| Phantom / OKX Wallet | 外部钱包签名登录 | OP / ETH | OP 平台代付；ETH 用户自付 | 产品能力相同；本轮先完成入口 smoke |
| 邮箱 | Privy 邮箱登录 | OP，不显示切链 | 平台代付 | 沿用现有 ScoreNFT 铸造 |
| SEMI | 现有 SEMI 登录 | OP，不显示切链 | 平台代付 | 沿用现有能力 |

补充规则：

- 网络选择位于 `/me` 档案顶栏，铸造确认与恢复继续使用同一 `/me` 弹窗；不放在登录页或全局导航；
- 每次默认选择 OP，避免用户误触高额 ETH Gas；
- 选择 ETH 时先显示网络、预计 Gas、付款钱包和余额，再允许确认；
- 用户真正确认时才请求切换到 Ethereum，不在点选单选框时打断用户；
- 外部钱包切换账号后，必须重新校验登录身份与付款地址，一致才可继续；
- ETH 路径铸造价格为 0，用户仅承担链上 Gas，不额外收取 mint fee。

---

## 3. 技术总览

```text
登录页
  ├─ MetaMask ───────────────┐
  ├─ imToken / WalletConnect ├─ Privy 外部钱包连接 + SIWE 登录
  ├─ 邮箱 ───────────────────┤
  └─ SEMI ───────────────────┘

ScoreNFT 铸造确认
  ├─ OP（默认）→ 现有 API → score_nft_queue → operator 代付 → OP ScoreNFT
  └─ ETH（外部钱包专属）
       → 钱包/余额预检并取得用户明确确认
       → 服务端原子占用作品并预留 Token ID
       → 复用现有永久上传管线冻结素材与 metadata
       → 服务端签发一次性 EIP-712 lazy-mint 凭证
       → Privy ConnectedWallet provider 让用户发送一笔交易并自付 Gas
       → Ethereum ScoreNFT.redeem 原子完成 mint + tokenURI
       → 后台始终按 orderId + 合约事件对账，txHash 只是加速提示
```

OP 与 ETH 是两条独立执行路径。不得为“复用代码”把 ETH 状态塞进现有 OP 队列，也不得让 HTTP 请求等待链上回执。

---

## 4. 成熟方案与项目自研占比

按预计工程时间计算，约 **50% 直接复用官方能力或项目现有稳定模块，50% 是 Ripples in the Pond 的业务编排**。按模块数量看复用比例更高，但数据库双铸防线、永久素材与恢复状态机仍是主要工作量。这里的“复用”是调用官方 SDK、标准合约模块和现有已验证代码，不是复制未知项目代码。

| 模块 | 成熟方案可复用 | 项目自己写 |
|---|---:|---:|
| MetaMask 登录 | 90% | 10%：品牌入口和产品状态 |
| imToken / WalletConnect | 90% | 10%：桌面/移动入口选择与文案 |
| SIWE、切链、发交易 | 90% | 10%：地址校验和业务流程 |
| EIP-712 lazy mint 合约 | 70% | 30%：业务字段、角色与测试 |
| 永久素材管线 | 65% | 35%：预留 Token ID 后的 metadata 适配 |
| 订单、双铸防线与恢复 | 25% | 75%：项目特有状态和跨 OP/ETH 占用 |
| 多链资产页面 | 45% | 55%：现有 Score 页面抽象与 P14 隔离 |

直接采用：Privy 外部钱包/SIWE/WalletConnect/切链/交易弹窗与当前官方 Node SDK，viem 编码、模拟、Gas 估算与链上读取，OpenZeppelin 4.9.6 的 ERC721URIStorage/EIP712/SignatureChecker/AccessControlDefaultAdminRules/Pausable，以及现有 Arweave 上传、Supabase RPC、Vercel cron 和链上回执模式。必须自己写：共享双铸占用、ETH 订单、Token ID 预留、凭证业务字段、多链资产身份、OP/P14 隔离和产品界面。

### 成熟方案优先规则

- 不自建 WalletConnect modal、二维码、深链或钱包安装检测；交给 Privy；
- 不自建 SIWE challenge/nonce/session；交给 Privy；
- 新增的服务端 linked-wallet 校验使用 Privy 当前 `@privy-io/node`，通过现有认证 helper 隔离迁移，不继续扩散旧 `@privy-io/server-auth`；
- 外部钱包只走 `wallet.switchChain` + `wallet.getEthereumProvider()` + viem wallet client；不再并存第二套广播路径；
- 不手写 ECDSA、EIP-712 domain、RBAC 或暂停逻辑；使用 OpenZeppelin 4.9.6；
- 不新建第二套 Arweave uploader、RPC 客户端或 cron 框架；抽取并复用项目现有模块；
- 不因“成熟”而盲目增加 Reown、wagmi、ethers、第三方 lazy-mint 平台或 webhook 服务；现有官方栈能闭环时，新增供应商不是复用而是额外依赖。

---

## 5. 已冻结的工程决定

1. **连接层继续使用 Privy。** MetaMask 使用定向钱包入口；imToken 通过 WalletConnect 2.0 进入，不新增 Reown/AppKit。
2. **链交互继续使用 viem。** 不引入项目黑名单中的 `wagmi` 或 `ethers`。
3. **身份与付款能力分开表达。** capability 从 Privy 已连接且已关联的外部钱包实时推导，不另造登录系统或持久化真假布尔值。
4. **OP 行为保持不动。** 原 `score_nft_queue`、cron 和 operator 代付流程继续承担 OP 铸造；只在入队 RPC 增加共享 mint claim，防止同一作品同时选 OP 与 ETH。
5. **ETH 使用独立订单表。** 新建 `score_self_mint_orders`，避免污染已经稳定的 OP 队列状态机。
6. **ETH 使用单合约 lazy mint。** 新 Ethereum ScoreNFT 的 `redeem` 接收一次性 EIP-712 凭证，在同一交易内完成 mint 与 tokenURI；不再额外部署 orchestrator。
7. **服务端先预留 Token ID。** 凭证绑定 tokenId、收款人、订单、URI 和期限；允许未完成订单留下编号空洞，但编号永不回收，从根本解决永久 metadata 在交易前不知道 Token ID 的问题。
8. **链上身份使用完整坐标。** 新资产以 `chainId + contract + tokenId` 为唯一身份；OP 旧链接继续兼容。
9. **ETH 第一版只支持 ScoreNFT。** 不包含 MaterialNFT、Pond Echo、拍卖或二级市场。
10. **先 Sepolia，后 Ethereum Mainnet。** 主网部署、角色授予和真实交易是单独不可逆 Gate。

---

## 6. Track 索引

施工时先读 [P16 最小成熟闭环](./05-minimal-loop.md)；下列 Track 是模块细节，不另立执行顺序。

| Track | 文件 | 目标 |
|---|---|---|
| 权威主线 | [05-minimal-loop.md](./05-minimal-loop.md) | M0–M6 的范围、顺序、Gate 与停止条件 |
| P16-0 | [10-0-contracts-decisions.md](./10-0-contracts-decisions.md) | 冻结边界、同步架构与技术栈白名单 |
| P16-A | [20-a-wallet-auth.md](./20-a-wallet-auth.md) | MetaMask 与 imToken / WalletConnect 登录 |
| P16-B | [30-b-chain-identity.md](./30-b-chain-identity.md) | 多链配置、资产身份和独立订单表 |
| P16-C | [40-c-eth-contract.md](./40-c-eth-contract.md) | ETH 用户自付铸造合约与安全测试 |
| P16-D | [50-d-self-pay-pipeline.md](./50-d-self-pay-pipeline.md) | 素材冻结、凭证、钱包交易和异步对账 |
| P16-E | [60-e-surfaces-data.md](./60-e-surfaces-data.md) | 铸造 UI、资产页、恢复与运营面板 |
| P16-F0 | [65-f0-token-numbering.md](./65-f0-token-numbering.md) | 主网上线前隔离各链、各合约的 Token 编号 |
| P16-F | [70-f-testnet-mainnet.md](./70-f-testnet-mainnet.md) | Sepolia 验收、主网 Gate、灰度和回退 |

---

## 7. 明确不做

- 不接 SEMI 新 SDK，不修改 SEMI 登录合同；
- 不新增手机号登录；
- 不让邮箱或 SEMI 用户通过嵌入式钱包绕过产品限制进入 ETH；
- 不把 P14 Pond Echo 扩到 ETH；
- 不在 ETH 上部署 MaterialNFT；
- 不做跨链桥、跨链消息或 NFT 跨链迁移；
- 不代用户支付 ETH Gas，不保存用户私钥，不使用 operator 替用户广播；
- 不在 P16 里重构既有 OP 铸造队列；
- 不默认打开 Ethereum Mainnet 功能开关。

---

## 8. 本轮完成定义

P16 完成必须同时满足：

- MetaMask 与 imToken / WalletConnect 可以完成连接、签名登录、登出和重连；
- 只有合格的外部钱包会看到 OP / ETH 选择；
- OP 回归测试证明原平台代付路径无行为变化；
- ETH ScoreNFT 可由用户钱包通过一次 `redeem` 完成 mint + tokenURI 固化；
- 重放、错误链、错误合约、错误地址、篡改 URI 和过期凭证均会失败；
- 用户拒签、页面关闭和 txHash 漏报均不会造成重复签名；
- MetaMask 桌面与 imToken / WalletConnect 在 Sepolia 各完成一笔真实铸造；
- Sepolia 留有合约、角色、交易、数据库恢复和页面证据；
- 邮箱与 SEMI 用户看不到 ETH 入口；
- P14 仍只消费 OP ScoreNFT。

完整异常矩阵、移动端 MetaMask mint、交易 replacement 专项、主网部署与灰度观察延后，见权威执行主线的范围说明。

---

## 9. 参考资料

- [Privy：配置外部钱包列表](https://docs.privy.io/wallets/connectors/setup/configuring-external-connector-wallets)
- [Privy：连接外部钱包](https://docs.privy.io/wallets/connectors/usage/connecting-external-wallets)
- [Privy：通过钱包认证](https://docs.privy.io/wallets/connectors/usage/authenticate)
- [Privy：从 server-auth 迁移到 Node SDK](https://docs.privy.io/basics/nodeJS/advanced/migrating-from-server-auth)
- [Privy：配置 EVM 网络](https://docs.privy.io/basics/react/advanced/configuring-evm-networks)
- [Privy：切换网络](https://docs.privy.io/wallets/using-wallets/ethereum/switch-chain)
- [Privy：发送 EVM 交易](https://docs.privy.io/wallets/using-wallets/ethereum/send-a-transaction)
- [Privy：viem 集成](https://docs.privy.io/wallets/connectors/ethereum/integrations/viem)
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712)
- [OpenZeppelin 4.x：EIP-712 与 SignatureChecker](https://docs.openzeppelin.com/contracts/4.x/api/utils)
- [CAIP-19：多链资产标识](https://chainagnostic.org/CAIPs/caip-19)
- [imToken：WalletConnect 2.0 支持说明](https://support.token.im/hc/en-us/articles/20079311809945-imToken-Fully-Supports-WalletConnect-2-0-User-Guide-Important-Notices)
