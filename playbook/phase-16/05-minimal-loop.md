# P16 最小成熟闭环 — 权威执行主线

> 基线：`main@f24f5bd`（P11 已冻结）\
> 旧实现来源：`codex/p16-wip-snapshot@3c5fa6f`，只允许选择性迁移\
> 本轮完成线：Sepolia 上跑通外部钱包登录、Ethereum ScoreNFT 自付 Gas、链上恢复与 OP 回归，并具备合入 `main` 的证据\
> Ethereum Mainnet：不在本轮执行，仍需单独不可逆确认

---

## 1. 成熟系统的五条真值

1. **一条钱包写入路径**：Privy 负责连接、SIWE、切链和 `useSendTransaction`；viem 只负责编码、模拟、估算与读链。
2. **一个链上成功真值**：`tokenIdByOrderId`、ScoreNFT 合约事件、owner 和 tokenURI 共同证明成功；浏览器是否保存 txHash 不决定 NFT 是否存在。
3. **一个数据库状态机**：OP 与 ETH 共用 mint claim 防双铸；ETH 使用独立订单，所有成功写回与 claim consumed 在同一事务完成。
4. **一个恢复入口**：后台按 orderId 对账。钱包直发、钱包路由交易、页面关闭、hash 漏报都走相同恢复规则，不按钱包品牌写分支。
5. **一个用户流程**：外部钱包用户在 `/me` 选择 OP 或 Ethereum，并在同一弹窗完成准备、签名、确认和恢复。

任何实现若需要第二套钱包客户端、第二套成功判断或某笔订单专用 SQL，先删除复杂性，再继续施工。

---

## 2. 本轮范围

必须完成：

- MetaMask 桌面钱包登录与一笔 Sepolia ScoreNFT 自付铸造；
- imToken / WalletConnect 登录与一笔 Sepolia ScoreNFT 自付铸造；
- 浏览器漏报 txHash 或关闭页面后，后台仍能按 orderId 自动恢复成功；
- OP ScoreNFT 继续由平台代付；邮箱和 SEMI 不显示 Ethereum 入口；
- P14 继续只消费 OP ScoreNFT；
- 新多链资产可通过完整 `chainId + contract + tokenId` 打开；
- 合约、数据库、API、页面与恢复证据可复核。

本轮只做入口 smoke，暂不要求完整铸造：Phantom、OKX Wallet。

延后：MetaMask 移动端完整铸造、20 次压力循环、全能力组合矩阵、交易 replacement 专项、离线/context-loss/no-WebGL 组合、截图美化、Google Fonts 本地化、Ethereum Mainnet 部署与灰度观察。

这些延后项不阻塞“P16 Sepolia 最小成熟闭环”，但在主网开放前必须重新评估。

---

## 3. 唯一执行顺序

### M0 — 校准与选择性迁移清单

- 从 `main@f24f5bd` 工作，不整体合并旧 P16 分支；
- 只审查 P16 会触碰的 P11 接口：`/me`、认证、Score 路由事务、播放器所有权和 Persistent Pond 边界；
- 将旧文件分为“直接迁移、适配迁移、放弃”三类；
- 同步 `ARCHITECTURE.md`、`STACK.md`、`CONVENTIONS.md` 中 P16 必需例外后，才写业务代码。

退出条件：共享页面边界清晰，P11 的路由事务、预热、Water Core 和播放器生命周期没有被 P16 接管。

### M1 — 合约与链身份

- 选择性迁入 EthereumScoreNFT、部署脚本、ABI、voucher 固定向量和测试；
- 复核既有 Sepolia 部署 `0x237a216F4034FF5Ee0d97f276c0bde26d59eD0DE`，不重复部署；
- 建立 OP Mainnet、OP Sepolia、Ethereum Mainnet、Sepolia 的显式 chain registry；
- 保持 P14 的 `chainId=10 + OP ScoreNFT address` 隔离断言。

退出条件：合约专项、OP 回归和固定向量通过；所有地址只来自链注册表。

### M2 — 数据库与幂等地基

- 主线已占用 `050–052`；旧 P16 `051–055` 最终映射为 `053–057`；
- `053` schema、`054` OP claim、`055` prepare/release、`056` pipeline、`057` hash recovery；
- 先导出旧隔离库的 migration history、函数、#2–#4 订单、claims 和永久资源引用；
- 旧库历史与主线冲突，证据保存后优先重建隔离测试库，不在冲突 history 上继续打补丁；
- 重建或清理隔离库属于破坏性外部写入，执行前单独确认精确项目和备份证据。

退出条件：干净库从最新主线迁移到 `057`；OP/ETH 竞争和 ETH prepare 并发幂等通过；旧 #2 证据仍可复核。

### M3 — 钱包认证与标准发送

- 外部钱包登录、关联地址和付款地址全部由 Privy 事实与服务端 linked-wallet guard 核验；
- 邮箱、SEMI、embedded wallet 保持 OP-only；
- 最终发送只调用 Privy `useSendTransaction`，显式固定 chainId、ScoreNFT 地址、`redeem` calldata 和 `sponsor:false`；
- 按 Privy 当前接口把交易放在第一个参数，把外部钱包 `address` 与 `sponsor:false` 放在第二个 options 参数，并从返回对象读取 `hash`；
- 删除前端 `createWalletClient(...).sendTransaction()` 发送路径；
- viem 保留模拟、Gas 估算、编码和只读链上查询。

退出条件：MetaMask 与 WalletConnect 能完成连接、SIWE、切链和调起交易确认；没有第二套钱包广播实现。

### M4 — 统一恢复流水线

标准顺序：

```text
prepare order + claim
→ freeze permanent assets
→ issue short-lived voucher
→ Privy sendTransaction
→ hash available 时登记提示
→ cron 始终按 orderId 查询链上
→ mapping + event + owner + tokenURI 全匹配
→ order success 与 claim consumed 原子提交
```

恢复规则：

- submission API 可以保存已认证订单返回的 hash，但不得仅凭 hash 标记成功；
- 不要求外层交易 `to` 必须直接等于 ScoreNFT；钱包可能使用路由交易；
- 成功只接受目标 ScoreNFT 合约的 order mapping、事件、owner 与 tokenURI 全部一致；
- mapping 已存在时，即使数据库没有 hash，也必须能从合约事件找到真实交易并完成；
- mapping 为 0 时才检查已知 receipt：pending 继续等，明确 reverted 才允许失败恢复；
- 无 hash、RPC 超时或广播结果不明时保持不可重签状态；不得自动释放 claim；
- 只有用户明确在广播前拒绝，或链上明确 reverted 且 mapping 为 0，才允许重新签名。

订单 #2 是回归样本：它必须通过通用 orderId 恢复逻辑收敛，禁止编写订单专用 SQL 或再次签名。

退出条件：直接交易和钱包路由交易使用同一成功判断；hash 漏报测试可以自动恢复。

### M5 — 接入 P11 页面

- 在当前 P11 `/me` 档案结构内加入轻量网络选择和铸造弹窗；
- 旧 `/me/mint/[orderId]` 只跳回 `/me` 并打开同一订单弹窗；
- 不修改 Persistent Pond 所有权、Score 路由事务、预热合同或播放器生命周期，除非 P16 的最小功能无法接入；
- 页面状态只表达：准备作品、等待钱包、链上确认、成功、需要核对；
- Ethereum 资产使用完整多链路由，OP 旧短链接保持兼容。

退出条件：`/me → /score → /me` 仍满足 P11 最小 Gate；邮箱和 SEMI 看不到切链能力。

### M6 — Sepolia 最小 Gate 与合入

自动 Gate：定向 TypeScript、ESLint、P16 静态验证、合约专项与一次完整 `scripts/verify.sh`；数据库迁移、权限、并发和恢复测试使用隔离环境。

真实 Gate：

1. MetaMask 桌面登录并完成一笔 Sepolia mint；
2. imToken / WalletConnect 登录并完成一笔 Sepolia mint；
3. 一次关页或 hash 漏报恢复；
4. 一次 OP 平台代付回归；
5. 邮箱、SEMI 无 Ethereum 入口；
6. P14 不读取 Ethereum ScoreNFT；
7. Phantom、OKX 登录入口 smoke。

退出条件：链上、数据库和页面结果一致；提交中文 commits；更新 STATUS/TASKS；合入 `main` 后核对远端 SHA。本轮不部署 Ethereum Mainnet。

---

## 4. 停止条件

只有以下情况停止受影响路径：

- 需要销毁或重建隔离测试库，尚未完成备份与明确授权；
- 缺少真实钱包本人确认、测试 App 权限或必要密钥；
- 外部写入结果未知，重复执行可能造成第二笔交易或永久资源分叉；
- 实现必须修改 P11 的路由事务、Water Core 或播放器生命周期，且定向审查无法证明安全；
- 即将执行 Ethereum Mainnet 部署、角色变更或真实交易。

普通文件冲突、迁移重编号、组件适配和技术选择按本文件默认方案处理，不形成等待点。

---

## 5. 详细参考

- [P16-0 架构与能力边界](./10-0-contracts-decisions.md)
- [P16-A 外部钱包认证](./20-a-wallet-auth.md)
- [P16-B 多链与数据库](./30-b-chain-identity.md)
- [P16-C EthereumScoreNFT 合约](./40-c-eth-contract.md)
- [P16-D 自付与恢复](./50-d-self-pay-pipeline.md)
- [P16-E P11 页面与多链资产](./60-e-surfaces-data.md)
- [P16-F 测试网、主网和回退](./70-f-testnet-mainnet.md)

详细参考与本文件冲突时，以本文件为准；执行中应同步修正对应参考，不保留双重真值。
