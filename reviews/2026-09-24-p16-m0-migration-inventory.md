# P16 M0 选择性迁移清单

> 日期：2026-09-24
> 正式基线：`main@f24f5bd`
> 旧实现来源：`codex/p16-wip-snapshot@3c5fa6f`
> 结论：旧快照不能整体合并；合约和少量纯模块可直接迁入，业务流水线必须按 P15 永久资源合同与 P11 页面边界适配，旧共享页面实现全部放弃。

## 1. M0 结论

P16 可以立即进入 M1，不需要再做一轮全站 review。P11 的共享边界已经足够清楚：

- `/me` 的真实档案实例由 `PersistentRouteSurfaces` 预备并长期保留，`app/(pond)/me/page.tsx` 只是地址占位；
- `/score/**` 已由同一个 `PondTransitionProvider` 识别为 Score surface；
- `PersistentPondShell`、Water Core、档案 surface 和 Score surface 的所有权已经冻结；
- 全局 `PlayerProvider` 与 Score 路由播放器各有既定生命周期，P16 不需要新增音频路径；
- 当前 `ARCHITECTURE.md`、`STACK.md`、`CONVENTIONS.md` 已写明 P16 的 Privy 单一发送例外、多链边界和 viem 禁止发送规则，无需为 M0 再修改。

旧快照从较早提交 `811ea5f` 分叉，缺少之后的 P11/P15 收口。`main..3c5fa6f` 中大量删除和改名只是基线分叉产生的噪声，不能作为 P16 改动迁入。

## 2. 直接迁移

以下文件职责独立，且不接管 P11/P15 共享生命周期。可从 `3c5fa6f` 取出后先做定向编译与固定向量验证：

| 文件 | 处理方式 | 迁入后的最小验证 |
|---|---|---|
| `contracts/src/EthereumScoreNFT.sol` | 原样迁入 | Foundry P16 专项；核对已部署 Sepolia runtime bytecode、角色和 EIP-712 domain |
| `contracts/src/PermanentArUri.sol` | 原样迁入 | URI 正反例测试 |
| `contracts/script/DeployEthereumScore.s.sol` | 原样迁入但本轮不执行部署 | 脚本编译；不得重复部署已存在的 Sepolia 合约 |
| `contracts/test/p16/EthereumScoreNFT.t.sol` | 原样迁入 | P16 合约测试 |
| `contracts/test/p16/EthereumScoreSecurity.t.sol` | 原样迁入 | P16 安全测试 |
| `contracts/test/p16/EthereumScoreTestBase.sol` | 原样迁入 | P16 合约测试 |
| `src/lib/self-mint/ethereum-score-contract.ts` | 原样迁入 | ABI 与 Solidity `redeem`、事件、mapping 一致 |
| `src/types/self-mint.ts` | 原样迁入 | TypeScript |
| `src/types/auth.ts` | 原样迁入 | TypeScript |
| `src/lib/self-mint/client-hash.ts` | 原样迁入 | 仅作为 txHash 快速补登缓存，不作为成功真值 |
| `src/components/mint/self-mint-copy.ts` | 原样迁入 | TypeScript |
| `src/components/mint/*.css` | 可直接作为样式起点 | 只在当前 P11 弹窗 DOM 上做定向视觉检查 |
| `scripts/p16/verify-voucher-vector.ts` | 原样迁入 | 与 Foundry 固定向量一致 |
| `scripts/p16/verify-chain-identity.ts` | 原样迁入后读取当前环境验证 | Sepolia 地址、chainId、runtime bytecode 与角色一致 |

`scripts/p16/start-sepolia-local.ps1` 与 `run-sepolia-local-workers.ps1` 只在不占用现有端口时使用；它们不是功能依赖，也不进入首轮迁移阻塞链。

## 3. 适配迁移

### 3.1 M1：链注册表

| 旧文件 | 适配目标 |
|---|---|
| `src/lib/chain/chain-registry.ts` | 作为多链公共注册表迁入，但要与现有 `chain-config.ts`、`contracts.ts` 收口为一个地址来源；保留 OP 旧函数兼容层，禁止页面自行读取散落 env |
| `src/lib/chain/chain-client-registry.ts` | 保留读链客户端职责；加入明确的部署区块与确认数配置，供 orderId 事件恢复使用 |
| `scripts/p16/start-sepolia-local.ps1` | 若使用，改用 P16 独立端口，不能争用普通开发环境端口 |

最快做法是先增加 registry，再把 P16 新代码接入；不在 M1 顺手重写全部 OP 旧调用。

### 3.2 M2：数据库与永久资源

旧迁移只能作为 SQL 设计输入，必须重写编号并对齐 P15：

| 旧编号 | 新编号 | 处理 |
|---|---|---|
| `051_score_self_mint_schema.sql` | `053_score_self_mint_schema.sql` | 适配迁入；订单必须冻结 P15 v3 所需的 sound set、decoder、base、package、字节数、MIME、hash 与上传账本身份 |
| `052_op_score_claim.sql` | `054_op_score_claim.sql` | 不能原样覆盖 `mint_score_enqueue`；必须从当前 `052_permanent_core_queue_and_snapshots.sql` 的最新版函数出发，只加入共享 claim 锁与状态更新 |
| `053_self_mint_rpcs.sql` | `055_self_mint_rpcs.sql` | 保留 prepare/release 原子模型，补齐 v3 永久资源 pin 和当前 schema 字段 |
| `054_self_mint_pipeline.sql` | `056_self_mint_pipeline.sql` | 保留 lease、attempt、submission、原子 complete 结构；成功条件改为 orderId 链上真值 |
| `055_self_mint_hash_recovery.sql` | `057_self_mint_hash_recovery.sql` | 保留同一 hash 幂等补登；txHash 仍是提示和加速信息 |

关键冲突：旧 `052_op_score_claim.sql` 重建的是 P15 之前的 `mint_score_enqueue`，会丢失 `permanent_core_active`、sound set、decoder、base 和 `requires_package_v3` 的原子 pin。原样执行会破坏当前成熟流水线，因此必须基于主线 `052` 的函数增量改造。

### 3.3 M3：认证与钱包发送

| 旧文件 | 适配目标 |
|---|---|
| `src/components/auth/WalletLoginOptions.tsx`、`login-session.ts` | 保留“用链上钱包登录”入口和 MetaMask/WalletConnect/Phantom/OKX 列表；接入当前 `LoginModal`，不改变邮箱和 SEMI 的现有路径 |
| `src/hooks/useAuth.ts` | 只增加外部钱包选择、服务端 capability 和登录入口类型；必须保留当前 `authSource + userId + evmAddress` 档案隔离、`clearArchiveCache` 和双源 token 逻辑 |
| `src/lib/auth/privy-server.ts` | 改用主线现有 `@privy-io/server-auth`，不恢复旧快照新增的 `@privy-io/node` 依赖；能力判断仍由服务端关联钱包事实决定 |
| `app/api/auth/wallet-capability/route.ts` | 接入现有 `authenticateRequest` 返回的 `authSource/privyUserId`，保持 allowlist/live 开关 |
| `src/components/Providers.tsx`、`src/components/auth/LoginModal.tsx`、`src/lib/auth/privy.ts` | 做最小增量；必须保留 `NavigationFeedback`、`PlayerProvider` 和当前全站 Provider 顺序 |
| `src/hooks/useEthereumScoreMint.ts` | 重写发送段：保留模拟、估算、余额检查、attempt/submission；实际广播只用 Privy `useSendTransaction`，交易为第一个参数，外部钱包 `address` 与 `sponsor:false` 放 options |

认证完成的判断必须同时满足：Privy 会话有效、付款地址是该 Privy 用户关联的外部 EVM 钱包、功能开关允许。邮箱、SEMI、embedded wallet 不显示 Ethereum 入口。

### 3.4 M4：服务端流水线与恢复

以下旧模块可复用结构，但不能原样迁入：

- `src/lib/self-mint/access.ts`：适配当前认证中间件与 server-auth；
- `src/lib/self-mint/order.ts`：扩充 P15 v3 永久包字段；
- `src/lib/self-mint/assets.ts`：完全按 `ripples.score-package.v3` 重建，复用现有 permanent core、上传账本和双网关验证，不再从 env 拼 v2 decoder/sounds metadata；
- `src/lib/self-mint/voucher.ts`：保留 EIP-712 签名模型，但使用当前链 registry；
- `src/lib/self-mint/reconcile.ts`：保留 order mapping、事件、owner、tokenURI、确认数检查，删除“外层交易必须直接调用 ScoreNFT redeem”的要求；钱包路由交易必须能通过同一规则恢复；
- `app/api/self-mint/**`：保留窄路由和原子 RPC 模式，按新订单行与当前认证适配；
- `app/api/cron/process-self-mint-assets/route.ts`：改为 P15 v3 资产冻结/上传流程；
- `app/api/cron/reconcile-self-mints/route.ts`：始终领取 `submitted/confirming/manual_review`，并支持无 hash 但 mapping 已存在的订单；
- `app/api/cron/process-mint-queue/steps.ts`、`process-score-queue/**`：只加入共享 claim 必需的最小检查，不能用旧快照覆盖主线 P15 队列实现；
- `app/api/cron/process-wallet-recipe/**`：P14 只允许 `chainId=10 + OP ScoreNFT`，只补隔离断言，不接受 Ethereum Score。

订单 #2 只作为恢复回归 fixture。恢复应由 `tokenIdByOrderId → ScoreRedeemed → ownerOf → tokenURI` 收敛并补回真实 hash；禁止订单专用 SQL、手工改成功或再次签名。

### 3.5 M5：`/me` 与多链 Score 页面

| 旧文件/设计 | 当前接入点 |
|---|---|
| `MintNetworkSelector.tsx`、`MintChoiceDialog.tsx`、`ReconnectMintWallet.tsx`、`SelfMintOrderView.tsx` | 组件逻辑可适配迁入；弹窗状态由当前持久 `MeArchivePage` 持有，不创建第二个档案实例 |
| 旧 `RecordingArchiveRow.tsx` 改动 | 在主线当前行组件上增量增加“选择网络/打开弹窗”；保留 `PlayerProvider` 播放、事件懒加载和现有 OP `useMintScore` |
| 旧 `MeArchivePage.tsx` 改动 | 在主线当前 owner generation、预热与返回唱片行逻辑上增加 selector/order modal；不得替换整个文件 |
| 旧 `/me?mintOrder=` | 由持久档案组件读取 query 并打开同一个订单弹窗；`app/(pond)/me/page.tsx` 继续只是地址占位 |
| 旧 `app/me/mint/[orderId]` | 改放到 `app/(pond)/me/mint/[orderId]/page.tsx`，校验后重定向 `/me?mintOrder=...`，继续处于 Persistent Pond 路由组 |
| `src/data/score/multichain.ts` | 按当前 `ScorePageData` 的 verified snapshot / bootstrap 合同重写，Ethereum 作品也必须提供当前播放器需要的 v3 snapshot 数据 |
| 旧多链页面 | 在 `app/(pond)/score/[id]/[contract]/[tokenId]/` 下新增薄页面，复用当前 `ScorePondScene`、`ScoreLifecycle`、`ScoreArchive` 与 OG 组件，不复制旧页面树 |
| `src/components/me/archive/ScoreArchiveRow.tsx` | 为 ETH 资产生成完整多链 href；继续使用现有 `scoreOrigin` 与 `transition.navigate` |

## 4. 五个共享接缝的红线

### `/me`

- 当前页面地址组件不拥有档案 UI；真实实例在 `PersistentRouteSurfaces`。
- 不允许从旧快照恢复 `app/me/page.tsx` 或另挂一个 `MePondArchive`。
- 网络选择和订单弹窗只能成为现有 `MeArchivePage` 的轻量状态，不改变 `onPrepared`、owner generation、缓存隔离、Score package 预热和返回唱片行恢复。

### 认证

- 保留 Privy 优先、SEMI 兜底的双源模型。
- `authSource + userId + evmAddress` 仍是档案隔离键；旧快照把它退化为单 `userId` 的改动必须放弃。
- 前端识别只用于显示；Ethereum 能力必须由服务端核对 Privy linked external wallet。

### Score 路由事务

- `routeForPath()` 已把所有 `/score/` 子路径归为同一个 Score surface，多链 URL 不需要新增第二套路由状态机。
- 多链页面必须放在 `(pond)` route group，并复用当前 `PondRouteLink`、`scoreOrigin` 和 visualReady 报告。
- 不复制旧 `app/score` 页面，不改 `stable → preparing → revealing → settling → stable`。

### 播放器

- P16 不修改 `PlayerProvider`、`track-audio.ts`、Score Web Audio engine 或 BottomPlayer。
- 铸造弹窗可以暂停用户交互，但不创建音频元素、AudioContext 或第二个播放器。
- Ethereum Score 数据必须适配现有 verified package/bootstrap，不能恢复旧数据库事件回放路径。

### Persistent Pond

- 不修改 `PersistentPondShell`、`PersistentWaterCore`、`PersistentRouteSurfaces`、Canvas/WebGL 所有权。
- 弹窗是 archive surface 内的 DOM overlay；打开、轮询、关闭都不触发 Water Core 或 route surface 重挂。
- P16 的最小浏览器 Gate 只检查 `/me → /score → /me`、单播放器、Core/Canvas identity，没有必要重跑 P11 全能力压力矩阵。

## 5. 明确放弃

以下旧快照内容不得迁入：

1. 整体 merge/cherry-pick `3c5fa6f`。
2. 所有对 `app/(pond)/**`、`src/components/pond-shell/**`、`src/features/home-pond/**`、播放器、permanent-media、score-playback 的删除或旧版本覆盖。
3. 旧 `app/me/**`、`app/score/**` 页面树对 P11 route group 的替换。
4. `createWalletClient(...).sendTransaction()`、直接 provider 广播和任何第二套前端钱包发送客户端。
5. 旧 v2 `assets.ts` 中从 `SCORE_DECODER_AR_TX_ID`、`SOUNDS_MAP_AR_TX_ID` 拼 metadata 的实现。
6. 旧 `reconcile.ts` 中要求外层 transaction `to === ScoreNFT` 并解码顶层 calldata 的成功判断。
7. 旧 `052_op_score_claim.sql` 对 `mint_score_enqueue` 的完整覆盖。
8. 旧 `useAuth/useMeArchive` 对档案缓存隔离、P11 预热和 owner generation 的回退。
9. 旧快照内与 P16 无关的 UI、音频、P9、P14、P15、通用规则和临时素材改动。

## 6. 最快施工顺序

1. **M1**：迁入合约、测试、ABI、类型与链 registry；验证现有 Sepolia 部署，不发交易。
2. **M2**：以主线 `052` 为基础生成 `053–057`，先完成本地 SQL 静态审查和隔离库重建清单。
3. **M3/M4 并行实现**：一侧完成 Privy 认证与 `useSendTransaction`，另一侧完成 v3 永久资产、API、orderId 恢复。
4. **M5**：最后把已稳定的 service 接到现有持久 `/me`，再加多链 Score 薄路由。
5. **M6**：自动 Gate 通过后，才进入 MetaMask 与 WalletConnect 各一笔真实 Sepolia mint。

这样可以最大限度复用旧代码，同时避免把旧快照中的页面回退、v2 永久资源和 viem 发送路径带回主线。
