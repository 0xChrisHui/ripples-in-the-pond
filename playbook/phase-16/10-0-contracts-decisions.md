# P16-0 — 边界冻结与架构同步

> 目标：在写代码前消除“登录身份、付款钱包、链、合约、资产”五个概念之间的歧义。\
> 外部写入：无。\
> 状态：旧快照已经形成决定；最新主线仍是 OP-only，M0 必须先同步三份权威文档和环境合同。\
> 完成后进入：P16-A。

---

## 1. 必做清点

逐项确认并记录当前实现位置：

- Privy 配置、登录弹窗、`useAuth`、服务端身份解析；
- SEMI 与邮箱登录的现有分支；
- OP ScoreNFT 发起 API、队列表、cron、operator 和合约地址来源；
- `ScoreNFT.mint` / `setTokenURI` 的角色要求；
- 当前链配置、RPC、区块浏览器 URL 和环境变量；
- ScoreNFT 详情页、分享 URL、OG、媒体代理和 Token ID 的使用位置；
- P14 对 ScoreNFT 地址、Token ID 和事件的依赖。

产物不是一份泛泛审计报告，而是一张“改动位置 → 所属 Track → 验证方式”的短表，放入 P16 实施记录。

---

## 2. 术语合同

实施中统一使用以下含义：

| 名称 | 含义 |
|---|---|
| `authSource` | `privy` 或 `semi`，沿用现有认证真值 |
| `loginEntry` | 当前浏览器 session 从 `email`、`semi` 或 `external_wallet` 哪个产品入口完成登录；仅控制 UI |
| `authUserId` | 应用内部用户 ID，不等同于钱包地址 |
| `selectedExternalWallet` | Privy `connectWallet` 回调返回、当前将发交易的钱包 |
| `walletClientType` / `connectorType` | Privy 原始钱包元数据；不压缩成自造的两值枚举 |
| `walletKind` | 服务端推导的 `external`、`embedded` 或 `none` |
| `mintChainId` | 本次 ScoreNFT 铸造目标链，第一版只允许 10 或 1 |
| `assetId` | `chainId + contractAddress + tokenId` |
| `selfPayOrderId` | 服务端生成的 ETH 自付铸造订单标识，同时进入签名凭证 |

任何 API 都不得把“已登录”推导成“有可用外部钱包”，也不得把 `users.evm_address`、Privy `user.wallet`（首个钱包）或数据库历史地址推导成当前签名地址。

---

## 3. 文档与白名单同步

P16-0 实施时一次性同步：

1. `docs/ARCHITECTURE.md`
   - 增加 OP 代付与 ETH 自付双路径图；
   - 记录 ETH ScoreNFT lazy mint 与异步对账职责；
   - 明确 P14 只消费 OP ScoreNFT。
2. `docs/STACK.md`
   - 在链白名单加入 Ethereum Mainnet `1` 和 Sepolia `11155111`；
   - 保持 `viem + Privy`；
   - 保持 `wagmi / ethers / Reown AppKit` 不引入。
3. `docs/CONVENTIONS.md`
   - 把“前端禁止调合约”收窄为“前端禁止使用平台/operator 钱包调合约”；
   - 登记唯一受控例外：P16 ETH 自付路径可由已认证外部钱包通过 Privy `useSendTransaction` 调用 allowlisted ScoreNFT `redeem`；
   - 交易目标、chainId、ABI 方法和 `sponsor:false` 必须固定，禁止任意 calldata 透传。
4. 环境变量合同
   - 按链分组，不再用一个模糊的全局 `CHAIN_ID` 推导所有地址；
   - 客户端只暴露公开配置，签名密钥只在服务端；
   - 测试网与主网变量不得共用值或静默回退。

在这些文档同步完成前，不得开始 ETH 合约和数据库迁移。

---

## 4. 链与能力矩阵

P16-0 固化以下服务端规则：

```text
Privy embedded/email → OP sponsored only
SEMI                 → OP sponsored only
Privy linked external wallet + matching selected address → OP sponsored + ETH self-pay
```

前端隐藏只负责体验，服务端仍必须重新校验：

- access token 由完成 P16-A 迁移后的 `@privy-io/node` 验证；迁移期间旧 helper 只作回归对照，不产生两套并行业务真值；
- 服务端从 Privy 用户资料确认请求地址是已关联的外部钱包，而不是 embedded wallet；
- 请求地址与签名地址一致；
- 目标链在服务端开关中启用；
- 目标能力仅为 ScoreNFT；
- pending score 属于当前应用用户且尚未被消费。

`loginEntry` 写入 sessionStorage，刷新保留、登出清除、跨 tab 缺失时 fail closed；它只决定是否显示 OP/ETH，不参与服务端授权。即使用户手改该值，服务端 linked-wallet 校验和合约 `msg.sender == recipient` 仍不能被绕过。

---

## 5. 路由与资产身份决定

- OP 旧资产继续支持 `/score/[tokenId]`，避免破坏现有分享链接；
- 新的规范路由采用 `/score/[chainId]/[contract]/[tokenId]`；
- ETH 资产只生成规范路由；
- 合约地址进入路由前转为小写规范值，展示时使用校验和地址；
- 数据查询、缓存键、OG、事件索引和分析埋点都使用完整 `assetId`；
- 禁止单独用 `tokenId` 查询跨链资产。

---

## 6. 安全与费用边界

- P16 不托管用户私钥；
- 后端凭证签名者不是 operator，也不是默认管理员；
- authorizer 复用现有 viem 服务端签名基础设施，但使用独立 EVM 私钥和独立环境变量；不为一项签名能力新增钱包托管供应商；
- 主网签名者密钥单独配置、可轮换、可撤销；
- 服务端签发凭证前先完成资产所有权与元数据冻结；
- 客户端不得自行拼接可信 tokenURI 或签名字段；
- 所有 ETH 费用展示都标明“估算”，不承诺固定价格；
- 任何未知广播结果进入人工复核，不自动重复发送。

---

## 7. 依赖与版本基线

实施以当前锁定版本为基线：

- `@privy-io/react-auth 3.20.0`：`useConnectWallet`、`ConnectedWallet.loginOrLink`、`switchChain`、`useSendTransaction`；
- 当前 `@privy-io/server-auth 1.32.5` 只作为迁移起点；P16-A 按 Privy 官方迁移指南换为锁定版本的 `@privy-io/node`，承担 access token 验证与 Privy 用户读取；
- `viem 2.47.11`：地址规范化、typed data、calldata、只读模拟、Gas 与 receipt/event 读取；
- `OpenZeppelin Contracts 4.9.6`：ERC721URIStorage、EIP712、SignatureChecker、AccessControl、Pausable；
- 现有 Supabase、Vercel cron、Alchemy RPC 与 Arweave 上传模块。

先用已安装 React SDK 3.20.0 做最小兼容 spike，不为追新而升级客户端或增加钱包库。服务端 SDK 迁移是唯一预先批准的版本变更：保持现有 auth helper 的调用合同，确认 Node 20+ 运行时，完成 access token、邮箱、SEMI 共存和 linked-wallet 类型守卫回归后才删除旧包。

---

## 8. 验证与退出条件

- 架构与技术栈文档完成同步；
- 前端自付交易的唯一规范例外已写入 CONVENTIONS；
- 所有 P16 环境变量有名称、用途、作用域和失败策略；
- capability 只从 Privy 钱包事实推导，未新建平行认证或持久化真假字段；
- 旧 OP URL 和新多链 URL 的兼容规则明确；
- P14 的 OP-only 断言进入测试计划；
- 没有遗留“以后再决定”的关键产品或安全问题。

完成后提交一个只包含 P16-0 文档和配置合同的中文 commit。
