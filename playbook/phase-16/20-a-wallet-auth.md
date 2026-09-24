# P16-A — MetaMask 与 imToken / WalletConnect 登录

> 目标：让外部钱包成为一等登录方式，并准确暴露“是否能自付 Gas”的能力。\
> 前置：P16-0 完成。\
> 状态：旧快照已有实现；迁入最新主线后重新验证 MetaMask 桌面与 imToken / WalletConnect，Phantom/OKX 先做入口 smoke。\
> 完成后进入：P16-B。

---

## 1. 登录入口

登录弹窗保留现有邮箱与 SEMI，同时新增：

1. `MetaMask`
   - 直接调用 `useConnectWallet().connectWallet({ walletList: ['metamask'], walletChainType: 'ethereum-only' })`；
   - 桌面扩展、移动 deep link 与安装提示全部交给 Privy。
2. `imToken / WalletConnect`
   - 桌面传 `wallet_connect_qr`，使用 Privy 通用二维码；
   - 移动端传 `wallet_connect`，由 Privy 展示 WalletConnect registry 并唤起所选钱包；
   - 文案明确 imToken 是推荐钱包之一，但入口仍兼容其他 WalletConnect 钱包。

不得伪造 Privy 不支持的 `imToken` 专属 connector 名称；产品入口可以叫 imToken，底层连接能力必须如实记录为 `wallet_connect`。

---

## 2. 认证流程

推荐流程：

```text
用户选择钱包入口
→ Privy connectWallet 连接并在 onSuccess 返回准确 wallet
→ 对该 wallet 调用 loginOrLink() 完成 SIWE 登录或关联
→ 服务端会话建立
→ sessionStorage 记录本次 loginEntry=external_wallet
→ 生成 capability
```

约束：

- 单纯“连接钱包”不等于登录成功；
- SIWE 签名被拒绝时，不创建半登录会话；
- 已用邮箱登录的用户主动连接钱包时，走关联而不是创建重复账号；
- 关联冲突时停止并给出可恢复提示，不自动合并两个用户；
- 地址统一按 EVM 地址规范比较，存储原始值前先校验；
- 邮箱按钮显式调用 `login({ loginMethods: ['email'] })`，不能因为全局启用 wallet 而再次展示钱包选项；
- 钱包、邮箱、SEMI 三个入口分别写当前浏览器 session 的 `loginEntry`，登出统一清除；
- 登出时清理应用会话和选中钱包状态，但不声称能替用户断开钱包 App 内全部会话。

---

## 3. Capability 模型

前后端共享的结果至少包含：

```ts
type WalletCapability = {
  authSource: 'privy' | 'semi' | null
  loginEntry: 'email' | 'semi' | 'external_wallet' | null
  walletKind: 'external' | 'embedded' | 'none'
  activeWalletAddress: string | null
  walletClientType: string | null
  connectorType: string | null
  canChooseMintChain: boolean
  canSelfPayEthGas: boolean
}
```

规则：

- 只有 `loginEntry=external_wallet` 且经过认证、已关联、当前仍连接的外部钱包令两项能力为 `true`；
- 邮箱嵌入式钱包不因为“存在 EVM 地址”自动获得 ETH 入口；
- SEMI 地址不因为格式像 EVM 地址自动获得 ETH 入口；
- capability 是推导值，不入数据库；
- `loginEntry` 只控制 UI，服务端不信任它；
- 服务端使用 Privy linked account + 地址匹配复核，客户端结果只用于即时显示；
- 合约最终以 `msg.sender == recipient` 证明当前钱包确实控制该地址。

---

## 4. 账号与钱包切换

覆盖以下状态：

- 钱包扩展切换账号；
- WalletConnect 会话切换账号或断开；
- 当前地址不再属于登录会话；
- 同时连接多个钱包；
- 页面刷新后 Privy 恢复连接，但应用会话已过期。

处理原则：

- 选中钱包使用 `connectWallet` 成功回调返回值，不能静默取 `wallets[0]`；
- 地址变化立即使未提交的 ETH 凭证失效；
- 铸造页发现身份不一致时关闭确认按钮并要求重新认证；
- OP 代付路径仍按应用用户身份工作，不把临时钱包变化写进旧队列。

---

## 5. UI 状态

应用只自定义以下外层状态：

- 正在连接；
- 等待签名；
- 用户取消；
- 地址冲突；
- 成功登录。

钱包安装、二维码、深链、registry 搜索和 connector 级错误使用 Privy 原生 modal，不复制 UI 与状态机。应用错误文案只区分“没有连接钱包”和“连接了但没有完成登录签名”。

---

## 6. 实施步骤

1. 按官方迁移指南把认证 helper 从 `@privy-io/server-auth` 换为 `@privy-io/node`；保持现有调用合同，先回归 access token、邮箱与 SEMI，再删除旧依赖；
2. 在 Privy 配置启用 wallet 登录并登记 wallet list，保持功能开关默认关闭；
3. 拆分登录入口组件与连接状态，避免继续膨胀单个登录弹窗文件；
4. 扩展 `useAuth` 输出 session-scoped loginEntry 与 capability；服务端另建按需的 external-wallet guard，不把它塞进所有普通请求；
5. 使用 `useWallets().ready` 和 Privy 钱包对象处理地址切换、关联状态与断开；
6. 给服务端路由增加统一 capability guard；
7. 只在内部测试环境打开钱包登录开关；
8. 完成定向单元测试和一次真实钱包浏览器 Gate。

---

## 7. 验收矩阵

本轮阻塞项只有 MetaMask 桌面、imToken / WalletConnect、邮箱、SEMI 和服务端伪造防线。MetaMask 移动端及其他钱包的完整交互保留为主网前矩阵。

- MetaMask 桌面扩展：首次登录、拒签、切账号、重连、登出；
- MetaMask 移动端：唤起、返回浏览器、取消；
- imToken：桌面扫码、移动 registry/deep link、确认、断开、二维码过期；
- 其他 WalletConnect 钱包：可连接但 UI 不冒充 imToken；
- 邮箱：仍可登录，capability 为 OP-only；
- SEMI：现有登录无回归，capability 为 OP-only；
- 多钱包：当前付款钱包可见且切换后重新校验；
- 服务端：伪造 `canSelfPayEthGas=true` 无法绕过校验。

验收通过后，入口仍由服务端开关控制；P16-F 前不对全部生产用户开放。
