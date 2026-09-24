# P16-F — Sepolia、主网 Gate、灰度与回退

> 目标：先完成 Sepolia 最小成熟闭环；Ethereum Mainnet 作为后续独立 Gate。\
> 前置：P16-E 完成。\
> 外部写入：包含测试网部署；主网部署和真实交易必须单独通过不可逆 Gate。

---

## 1. 功能开关

至少拆成两个服务端权威开关：

- `external_wallet_login`：是否展示并接受外部钱包登录；
- `eth_score_self_mint`：是否允许 Ethereum ScoreNFT 自付铸造。

每个开关支持 `off / allowlist / live`：

- 客户端隐藏只改善体验；
- API、凭证签发和 worker 都读取服务端状态；
- 关闭 ETH 开关不影响已广播交易的对账；
- 紧急关闭时停止新 prepare 和 authorization，但继续确认在途交易。

---

## 2. 本地与 fork Gate

进入测试网前完成：

- 单一 lazy-mint ScoreNFT 的单元、fuzz、权限和回归测试；
- 本地完整 prepare → sign → mint → reconcile；
- Ethereum fork 上的 fee、nonce、receipt 与事件解析；
- 数据库并发与幂等测试；
- OP / ETH 抢同一 pending score 的竞争测试；
- worker 重启、重复事件与 RPC 故障恢复；
- 浏览器只跑不可被自动测试替代的钱包交互。

源码未变化时复用这些证据，不为主网准备重复跑无关矩阵。

---

## 3. Sepolia 部署

按顺序执行：

1. 确认 deployer、admin、authorizer、pauser 地址彼此职责清晰；
2. 先永久上传并双网关校验 Sepolia collection metadata，再将其 `ar://` URI 作为不可变构造参数部署一份 Sepolia lazy-mint ScoreNFT；
3. 授予 authorizer / pauser，撤销临时多余权限；
4. 在区块浏览器验证源码；
5. 读回 chainId、EIP-712 domain、角色、pause 状态、contractURI 与 ERC-7572 interface；
6. 把地址写入 Sepolia chain registry；
7. 用 allowlist 打开测试功能；
8. 至少完成 MetaMask 与 imToken / WalletConnect 各一笔真实测试网铸造；
9. 保存交易、ScoreRedeemed、Token ID、页面和订单对账证据。

部署脚本必须幂等识别已有地址，结果未知时不得盲目重部署。

---

## 4. Sepolia 验收矩阵

### 本轮阻塞 Gate

- MetaMask 桌面：登录、切链、一笔真实 mint；
- imToken / WalletConnect：登录、切链、一笔真实 mint；
- 页面关闭或 txHash 漏报后按 orderId 恢复；
- 用户拒签不会留下可重复广播的错误状态；
- OP 平台代付回归；邮箱与 SEMI 无 ETH 入口；P14 忽略 ETH；
- Phantom、OKX Wallet 登录入口 smoke。

以下原完整矩阵保留为主网前清单，本轮不阻塞：MetaMask 移动端完整 mint、交易 replacement 专项、全钱包失败矩阵、20 次压力循环、offline/context-loss/no-WebGL 组合和长时间灰度观察。

正常路径：

- MetaMask 桌面；
- MetaMask 移动端；
- imToken 扫 WalletConnect 二维码；
- 页面关闭后恢复；
- 交易替换后成功；
- 客户端漏报 txHash 后由 orderId mapping 恢复；
- 同一订单续签过期凭证。

失败路径：

- 拒绝 SIWE、切链和交易；
- 钱包地址在签发后变化；
- ETH 余额不足；
- 错链、错合约、篡改 URI；
- 重放凭证；
- 交易 revert；
- RPC 超时和 worker 重启；
- 关闭功能开关时仍正确对账在途交易。

回归路径：

- 邮箱和 SEMI 登录无 ETH 入口；
- OP ScoreNFT 仍由平台代付；
- P14 只读取 OP ScoreNFT；
- 旧 OP 资产链接和分享卡正常。

---

## 5. Ethereum Mainnet 不可逆 Gate

主网部署前必须把以下内容一次性交给用户确认：

- 单一 lazy-mint ScoreNFT 及不可升级说明；
- deployer、admin、authorizer、pauser 的最终地址；
- 当前 ETH 余额、实时部署 Gas 估算和费用上限；
- 预计单次用户 mint Gas 范围，只作为估算；
- 主网 RPC、浏览器、永久存储和数据库环境；
- 功能开关初始为 `off`；
- Sepolia 全部 Gate 证据；
- 出错时能做什么、不能回滚什么。

没有这次明确确认，不部署 Ethereum Mainnet、不授予主网角色、不发送真实 mint。

---

## 6. 主网部署与核验

获批后：

1. 再次核对 chainId 必须为 1；
2. 记录 deployer nonce 与发送前余额；
3. 先永久上传并双网关校验主网 collection metadata，再将其 `ar://` URI 作为不可变构造参数部署单一 ScoreNFT，并核验 receipt；未知结果先查链；
4. 验证源码；
5. 完成角色授予与多余权限撤销；
6. 逐项读回 NFT 地址、EIP-712 domain、角色和 pause 状态；
7. 将生产地址写入正式环境并保持开关 `off`；
8. 执行只读 smoke；
9. allowlist 打开给内部钱包，完成一笔真实小范围铸造；
10. 对账成功后再决定是否进入 live。

所有地址与交易哈希写入正式部署记录，不能只存在终端输出或聊天里。

---

## 7. 灰度观察

灰度期重点观察：

- 登录、连接、SIWE 和 WalletConnect 错误率；
- prepare、签名、提交、成功各阶段转化；
- Gas 估算偏差和余额不足比例；
- receipt 延迟、RPC 错误与 manual review；
- pending score 被重复占用的告警；
- ETH 事件误入 P14 的告警；
- 永久素材孤儿率。

从 allowlist 到 live 必须有明确样本量和观察窗口，不以“一笔成功”代表生产稳定。

---

## 8. 回退与事故处理

可回退：

- 关闭 ETH 新订单和新凭证；
- 隐藏外部钱包或链选择入口；
- 暂停 ScoreNFT 的新 redeem；
- 撤销 authorizer；
- 切换 RPC 并重跑对账；
- 修复前端和后端后重新开放。

不可回退：

- 已部署合约地址；
- 已确认的 NFT 和 tokenURI；
- 已消耗的用户 Gas；
- 已写入的永久存储素材。

事故时先停止新授权、保留在途订单证据，再判断是否暂停合约。不得自动补发用户交易或承诺链上数据可以删除。

---

## 9. P16 完成检查

本轮完成称为“P16 Sepolia 最小成熟闭环”，不冒充 Ethereum Mainnet 生产验收。满足阻塞 Gate、代码验证和 `main` 合入后即可关闭本轮；本节涉及主网部署、live 与长期观察的条目留到后续主网 Gate。

- P16-0 到 P16-F 的验证和中文 commits 齐全；
- 外部钱包登录、OP 回归、ETH 自付和恢复矩阵通过；
- 主网地址、源码验证、角色与配置均可读回；
- 生产开关状态与用户批准范围一致；
- 部署记录、运维手册和安全回退说明完整；
- `STATUS.md` 与 `TASKS.md` 更新到下一个权威阶段。

---

## 10. 旧快照预检记录（2026-09-22）

- ✅ P16 合约专项 14/14、全仓 Forge 70/70、TypeScript、ESLint 与 `p16:verify` 已通过；全量验证中的生产构建曾完整通过，最终收口后的两次复跑均只被 5 个 Google Fonts 网络下载失败阻断。
- ✅ 在本地 chainId 11155111 节点完成一次部署；再以既有地址重跑时只读核验角色、admin delay、URI 与 pause 状态，deployer nonce 保持 `1 → 1`。
- ✅ 部署脚本新增 `ETH_SCORE_EXISTING_ADDRESS`：广播结果未知时必须先填既有地址核验，禁止盲目重部署。
- ✅ 永久素材 worker 的普通错误最多自动重试 5 次；外部上传结果未知立即 manual review。
- ✅ 链上成功写回与共享 claim consumed 处于同一数据库事务，claim 不匹配会整体回滚。
- ⛔ 本机无 Docker/PostgreSQL；已链接的 `ripples-p14-test` 隔离 Supabase 项目处于 `INACTIVE`，CLI 连接超时，尚未执行 P16 migration/并发 Gate。
- ⛔ Sepolia RPC、collection metadata、角色地址、authorizer/deployer 凭证与合约地址未配置，因此未上传永久 collection metadata、未部署测试网、未发送钱包交易。
- ⛔ Ethereum Mainnet Gate 未请求也未获批；没有主网部署、角色授予或真实 mint。

## 11. 旧隔离环境续行记录（2026-09-23）

- ✅ 当时隔离库的 P16 `051–054` 已执行并登记；该历史现在与最新主线冲突，只作为旧环境证据，正式迁移使用 `053–057`。
- ✅ 隔离真库竞争测试证明 OP/ETH 不会同时占用同一 pending score；两个并发 ETH prepare 收敛到同一订单和 Token ID。测试夹具已全部清理。
- ✅ Sepolia collection image 与明确标注测试用途的 collection metadata 已永久上传，`ardrive.net` 和 `arweave.tokyo` 双网关完整字节/哈希/类型/CORS quorum 通过。
- ✅ 单一 EthereumScoreNFT 已部署至 Sepolia `0x237a216F4034FF5Ee0d97f276c0bde26d59eD0DE`；交易 `0x674aafee1d306ae60bb5cd5263b0c25f6e0c8794c1259ffa0f0e2e62a487389d`，源码 Sourcify `exact_match`。chainId、admin/authorizer/pauser、172800 秒延迟、contractURI、pause 与 ERC-7572 均链上核验通过。
- ⏸ 真实钱包矩阵尚未开始：当前 `.env.local` 的 Privy App 尚未确认是隔离测试 App。不得让测试钱包登录或 link 到未确认的 App；需要配置独立 Privy 测试 App，或由用户明确确认可在现有 App 创建/关联测试钱包身份。临时 Next.js 验收服务已停止，未发起 Privy 登录。
- ⛔ Ethereum Mainnet 仍未获批且完全未触碰；P16-F 在完成 MetaMask / imToken 真正的测试网 mint 与恢复验收前不算完成。

完整链上、数据库与永久资源证据当前保存在旧快照 `3c5fa6f` 的 `reviews/evidence/p16-f/sepolia-deployment.md`；M0 选择性迁移证据时再落入正式分支。

## 12. 2026-09-24 已知恢复样本

- 订单 #2 已在 Sepolia 铸造 Token #2，链上 order mapping、owner、tokenURI 与 `ScoreRedeemed` 一致；旧测试库仍为 `manual_review/HASH_UNKNOWN` 且没有 txHash。
- #2 绝不能再次签名、释放 claim 或发送交易；它只用于证明通用 orderId 恢复可以在没有数据库 hash 时收敛。
- 旧补登接口要求外层交易直接调用 ScoreNFT，不兼容钱包路由交易；新流程不以外层 `to` 作为成功真值。
- 该样本不要求继续还原当时每一次浏览器调用。验收重点是统一恢复规则能安全处理相同情况。
