# P16-D — ETH 自付 Gas 铸造流水线

> 目标：把永久素材准备、一次性凭证、用户交易和服务端对账连接为可恢复流程。\
> 前置：P16-C 完成。\
> 状态：旧快照的资产、凭证和合约读取可复用；钱包发送与恢复必须按最小成熟闭环收束后重新验收。\
> 完成后进入：P16-E。

---

## 1. 端到端顺序

```text
用户选择 ETH
→ 客户端先做钱包、链、余额与保守 Gas 预检
→ 用户明确同意准备永久素材
→ 服务端原子取得 mint claim、创建订单并预留 Token ID
→ 复用现有管线上传并冻结 events、封面、metadata
→ 生成永久 tokenURI 和内容哈希
→ 服务端签发短期 EIP-712 凭证
→ 客户端校验当前钱包与凭证
→ 切换 Ethereum
→ viem simulate / estimateGas / encodeFunctionData
→ Privy useSendTransaction 让用户确认并广播
→ 客户端拿到 txHash 就登记；漏报也不阻塞恢复
→ cron 始终先查询 order mapping，再核验事件、owner 与 tokenURI
→ success 后发布资产页
```

HTTP 路由不得等待交易确认；客户端关闭页面后，服务端仍能独立完成对账。

---

## 2. API 边界

拆分为最少三个动作：

1. **prepare**
   - 校验用户、能力、pending score 与 ETH 开关；
   - 在一个 RPC 事务内取得共享 claim、预留 tokenId、创建或返回幂等订单；
   - 调用抽取后的现有 Score 永久素材模块，不复制 uploader；
   - metadata 使用预留 tokenId 和完整 chain/contract 路由；
   - 返回订单状态，不接收客户端自报 tokenURI。
2. **authorization**
   - 校验当前钱包仍与会话一致；
   - 从数据库冻结字段构造 typed data；
   - 返回短期凭证、ScoreNFT 地址、chainId、authorizer 与 deadline；
   - 过期后可为同一订单重新签发，不重复上传素材。
3. **submission**
   - 接收 txHash；
   - 先校验 hash 格式、订单、链与调用者；RPC 若已可见则立即校验交易，暂不可见不误判失败；
   - 写入 `submitted`，由后台同步器继续处理。

另有一个轻量 **attempt** 动作：钱包弹窗打开前原子写 `send_attempted_at` 和 voucher digest。Privy 明确返回“用户拒绝”时可清除本次 attempt；其他未返回 hash 的异常先进入 `manual_review`，由 order mapping、事件和链上交易核验后再恢复，不能直接再发。

查询接口按订单 ID 返回可安全暴露的状态、交易哈希、资产身份和恢复动作。

---

## 3. 凭证签发

签发服务必须：

- 只读服务端冻结的 recipient、URI 和 orderId；
- 只读订单预留的 tokenId，禁止重新选号；
- 从 chain registry 取 chainId 和 verifying contract；
- 使用独立 authorizer 密钥；
- 将 typed-data 摘要写入订单；
- 使用短 deadline，并允许安全续签；
- 拒绝已提交、已成功、人工复核或 pending score 已被其他链消费的订单；
- 记录签名版本，支持未来无损轮换格式。

签发密钥不得进入 `NEXT_PUBLIC_*`、日志、数据库或客户端错误信息。

---

## 4. 客户端交易

客户端采用“Privy 负责钱包写入、viem 负责确定性只读准备”的成熟分工：

1. 再次读取当前地址，必须等于凭证 recipient；
2. 显示目标为 Ethereum Mainnet / Sepolia；
3. 用户点击最终确认后调用钱包切链；
4. 读取余额与当前 fee 数据；
5. viem `simulateContract` / `estimateContractGas` 并 `encodeFunctionData`；
6. 调 attempt API 盖 `send_attempted_at`；
7. Privy `useSendTransaction` 按官方两参数接口调用 `sendTransaction({ to: scoreContract, data, chainId }, { address: selectedWallet.address, sponsor: false })`；`chainId` 必须显式为当前目标链；
8. 一拿到哈希就调用 submission API；
9. 页面可继续轻量轮询，但不成为最终真理来源。

不手搓 provider、wallet client、交易 modal 或 WalletConnect 广播。本轮不保留 `wallet.getEthereumProvider()` + viem wallet client 的第二发送路径；若 Privy 标准接口真实失败，保存原始错误并停止该钱包 Gate，不能在同一实现中静默换广播方式。钱包展示的最终交易详情优先于站内估算。

Privy 的交易类型虽然把 `chainId` 设为可选，但其交易确认 modal 需要该值才能正确显示网络和费用；本项目禁止依赖“当前钱包链”的隐式默认值。切链完成后还要重新读取钱包 chainId，匹配才允许打开交易弹窗。

---

## 5. 异步对账

复用现有 Vercel cron / viem 模式扫描 `submitted`、`confirming` 和广播未知订单：

- 先读 `tokenIdByOrderId(orderId)`；非 0 时可直接进入链上恢复；
- mapping 非 0 时，从目标 ScoreNFT 的 `ScoreRedeemed` 找到真实交易；
- 校验事件、owner、tokenURI、orderId、recipient、tokenId 和 URI hash；
- txHash 存在时可查询 receipt 加速判断，但不要求外层 `to` 必须直接等于 ScoreNFT；
- 达到配置确认数后写 `success`；
- txHash 被 replacement / dropped / 漏报或钱包使用路由交易时，仍按 orderId mapping 和目标合约事件恢复；
- 对短暂 RPC 故障做有界重试；
- 对“可能已广播但无法判定”的情况进入 `manual_review`；
- 幂等消费同一事件，重跑不能重复创建资产。

API、worker 和页面都不能只凭客户端上报把订单标为成功。

submission API 只把 hash 保存为提示，不凭它写 success。即使用户提交任意无关 hash，只要 order mapping 与目标合约事件不匹配，订单就不能成功。订单 #2 必须作为通用漏报恢复样本完成，不写订单专用 SQL，不再次签名。

---

## 6. 失败与恢复

| 情况 | 状态与处理 |
|---|---|
| 用户拒绝切链 | 保持 `ready_to_sign`，不记失败 |
| 用户拒绝交易 | 保持 `ready_to_sign`，允许再次尝试 |
| 钱包调用异常且没有 hash | `manual_review`，先按 orderId 查链，禁止立即重发 |
| 凭证过期 | `expired`，同一冻结订单可续签 |
| 余额不足 | 保持可恢复，刷新估算后再试 |
| simulate 确定失败 | `failed` 或保持待签，按错误类型处理 |
| 已得 txHash 后关页 | 后台继续对账 |
| tx 被替换 | 记录替换哈希并继续追踪 |
| tx 明确 revert | `failed`，释放策略按是否可安全重试决定 |
| RPC 无法判断是否广播 | `manual_review`，禁止盲发第二笔 |
| 素材已上 Arweave 但未签名 | 保留孤儿素材与预留 Token ID，不回收编号 |

成功前 pending score 的占用不能被静默释放给 OP 路径；只有服务端确认“绝无链上成功可能”时才可恢复选择。

---

## 7. 幂等与攻击面

- preflight 不写数据库、不上传素材；
- prepare 重复调用返回同一 claim、tokenId 和活跃订单；
- authorization 重复调用可以更新 deadline，但 orderId 与 URI 不变；
- submission 同一哈希重复上报无副作用；
- attempt 使用订单版本和 voucher digest 幂等，已存在未知 attempt 时拒绝再开钱包弹窗；
- 用户不能提交别人的 orderId、pending score 或 txHash；
- 限制 prepare / authorization 的频率，且只有用户完成钱包/余额预检并明确确认后才开始永久上传；
- 在上传不可逆素材前完成登录、所有权和基础内容校验；
- 日志只记录地址、订单和摘要，不记录签名密钥或不必要的个人信息。

---

## 8. 验证

- API 鉴权与 capability 测试；
- prepare 并发幂等测试；
- Token ID 并发预留、空洞不回收与 metadata 编号一致性测试；
- 凭证快照与服务端/合约一致性测试；
- 错链、错地址、错合约、篡改 URI 测试；
- 拒签、低余额、过期、替换、revert、关页恢复测试；
- worker 重跑、txHash 丢失、replacement 和链重组测试；
- OP 与 ETH 同时竞争同一 pending score 的事务测试；
- 路由中不存在同步等待 receipt；
- 现有 OP 铸造回归通过。
