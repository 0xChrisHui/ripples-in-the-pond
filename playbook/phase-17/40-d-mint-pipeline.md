# P17-D — OP 收藏适配、ETH 自付与异步恢复

> 前置：A2 C1；ETH 分支需 A3 架构 passed、C01–C03 对应通用安全部分通过。发行政策待决仅挂起政策专属约束/测试及依赖它的生产启用，通用安全工作继续。
> [总控](../parallel-2026-10/00-orchestration.md)分配 DB migration 号、环境与外部写入租约；[共享合同](../parallel-2026-10/10-shared-contracts.md)定义资产坐标。证据路径见[总览](00-overview.md)。

## 1. 请求边界

| 登录能力 | OP 原曲 | ETH 原曲 |
|---|---|---|
| SEMI 社区身份 | 现有平台代付，接收地址来自服务端认证 | 不开放 |
| 邮箱/embedded wallet | 现有平台代付 | 不开放 |
| 已认证、已关联的外部地址 | OP 平台代付，服务端核验实际接收地址 | 用户自付 Gas，固定合约 redeem |

网站只把 receipt/事件验证后的状态称为“已铸造”；请求受理叫“处理中”。现有首页 `useFavorite` 的乐观 UI 属于旧产品行为，P17不顺手改它，但曲目馆不能据红心认定链上完成。

OP 与 ETH 可以分别收藏同一原曲，不使用 Score 的跨链独占 claim。ETH API 不能把 `users.evm_address` 或 `loginEntry` 当成已关联外部付款地址的证明。

先复用已有鉴权、linked-wallet、钱包发送、事务/CAS、账本和验证基础；下面文件/脚本列表是缺口定位，不要求逐个新建，不重构旧 Score/OP 系统。每步结果记 `P17_HANDOFF`，普通报告仅按需附件；权限、正确 recipient、防重放、事务和 unknown 恢复证明必须保留。C/D/F 使用同一套相关测试证据，只补变化或尚未覆盖的断言，不逐 Step 全跑。

## P17-D0：原曲订单与迁移草案

**输入依赖**：A3 架构 approved、C typed data、总控授予 schema 工作租约和迁移编号；未授予编号可先写可审阅 SQL 草案。发行政策未确认时可完成通用订单/权限/事务部分，不能先固化终身次数约束或默认无限制发行。

**实际文件/符号**：只读 `src/lib/self-mint/order.ts`、现有 P16 SQL 的事务模式；新增 `src/lib/material-mint/server/{order.ts,order-types.ts,db.ts}`；SQL 草案 `scripts/p17/database/{schema.sql,procedures.sql,security.sql,verify.sql}`。总控分配真实编号后，P17 写 `supabase/migrations/phase-17/` 对应文件，总控单独执行。禁止手填“下一号=055”。

确需新增时的建议分组：`server/` 放订单/权限/凭证职责；OP 适配放 `server/op/`，对账放 `server/reconcile/`。先复用既有模块，只按必要职责与文件硬线拆分，不为凑齐六个或其他预定文件新增空层。

**具体操作**：

1. 在现有订单基础上最小实现独立的原曲订单语义，不混用 Score claim。确需新表时 `material_mint_orders` 保存 order_id、user_id、track_id、chain_id、contract_address、token_id、recipient_address、amount=1、catalog_revision、metadata_uri、uri_hash、status、version、凭证 digest/deadline/authorizer、send_attempted_at、tx_hash、替换 hash、confirmed block/hash、error_kind；已有等效字段/工具直接复用。
2. 固定坐标和内容快照生成订单后不可变；目录后来换 revision 只影响新订单，不自动更改已签内容。
3. `order_id` 服务端生成 bytes32；同一次请求以用户/环境作用域的幂等标识返回原订单，并为目标链+合约+接收地址+tokenId 的在途/unknown 操作保留互斥占用。此安全约束不等于该坐标终身唯一；跨已完成订单的终身次数或额度唯一约束，只有相应发行政策明确确认后才实施。政策未定时生产新签发关闭，不能因移除终身约束默认允许无限新订单；user_id 绑定防止他人读写。
4. 活跃 order 不能删除重建。续签保留 orderId/坐标/URI；历史已签尝试使用独立 `material_mint_attempts` 保存 digest、deadline、发送状态及哈希，不能只覆盖最后一次签名导致旧有效交易无法恢复。
5. RPC 实现 prepare/upsert、attempt CAS、submission、finalize 的原子事务；finalize 同时校验事件身份和订单版本，重复事件无副作用。
6. RLS 默认阻断匿名/客户端写，只有服务端可调用状态修改 RPC；查询需认证 owner，公开播放不依赖私有订单。不同环境使用总控隔离库，不用公开数据清单存用户订单。
7. 对 OP 先复用已有接收地址快照；仅缺失且直接影响正确 recipient 时才提最小兼容方案，如 `mint_queue.recipient_address` 可空兼容历史记录。需要改旧 API/worker 时在 D1 申请独占权；保留现有 user+token 一次收藏语义，不把 ETH 塞入旧单链 mint_queue。

**失败恢复**：无隔离库只完成 SQL/单测，不把假数据库通过写成真并发通过；迁移版本冲突交总控重分配。未知 SQL 写入结果先查 history/表结构，不重复执行破坏性迁移。

**定向验证**：复用现有隔离库测试基础，覆盖同请求双 prepare 返回同 order、在途/unknown 互斥、跨用户不能读取、原子 finalize 冲突回滚、RLS、旧 OP 行兼容。政策唯一约束测试仅在明确确认后实施。测试夹具标注 runId，只清理自身已知数据；未变的权限/事务证明供 F 直接引用。

**完成证据**：handoff 引用实际迁移号/hash、数据库标识、权限读回和事务/竞争证明；详细日志才附 database-gate，不能用一行“通过”代替安全断言证据。

**自动下一步**：进入 D1；缺库不阻断纯适配和 UI。

## P17-D1：沿用 OP 收藏并固定实际接收地址

**输入依赖**：A1 真实 OP 映射、A2、已有接收地址快照或 D0 的必要兼容方案；不依赖 ETH 发行政策确认。总控明确授予旧 API/worker 涉及文件的 P17 独占修改权后才修改。

**实际文件/符号**：`app/api/mint/material/route.ts:POST`，`app/api/cron/process-mint-queue/steps.ts:trySendNew`、`steps-helpers.ts:markSuccess`，`src/lib/auth/middleware.ts:authenticateRequest`，`src/lib/auth/privy-server.ts:findLinkedExternalWallet`；新增 `src/lib/material-mint/server/op/{adapter.ts,recipient.ts}`。`useAuth`、PlayerProvider、P15 UI保持只读。

**具体操作**：

1. 原曲目录按钮以 trackId+chainId 选择 deployment，由服务端查真实 tokenId；新路由层向现有 OP队列传同一 mint 语义。不能按列表下标发送 tokenId。
2. 旧客户端不传钱包时，接收地址保持 `authenticateRequest().evmAddress`；外部钱包路径可显式传选中地址，但服务端必须通过 Privy linked-wallet 查证。SEMI/邮箱不得传任意第三方 recipient。
3. 新 OP 请求在入队时冻结 recipient；worker 读取快照，历史无快照的行沿用原 user 地址。不要修改 users 主地址来让一次 mint 改收件人。
4. 保留既有 user+token 幂等键/历史一次收藏语义；并发相同请求同 mintId。若同用户之前以另一地址收藏/在途，返回原记录和真实接收地址，不能静默送往新地址或新增一份。
5. `alreadyMinted`、`pending`、`needsReview`、`safe_retry` 在新 UI 中分别显示。对成功状态可读现有队列/事件；公共页面持有状态要用 ERC-1155 balance，不能以历史 mint 当当前持有。
6. 现有 operator 锁/未知广播处理继续保留；所需修复仅限本请求必需差异，旧队列历史问题登记给总控，不借机重构。

**失败恢复**：未获得共享文件写权时提交精确接线 diff 说明，现有 OP默认地址路径仍可集成；若无法保证所显示地址与实际接收地址相同，禁用该外部 OP 动作并说明，不静默回退。unknown 保持人工核验，不能再入队。

**定向验证**：SEMI默认地址、邮箱默认地址、外部关联地址、任意伪地址拒绝；更换 selected wallet 后旧订单保留原接收地址；重复入队与旧调用体兼容；不会消耗 Score claim/触发 Pond Echo。

**完成证据**：handoff 的 D1 记录实际文件权限、用例引用与旧行为兼容结果；op-compatibility 仅按需附件，正确 recipient 和原有一次收藏证明保留。

**自动下一步**：进入 D2；若 A3 未批仅将 ETH 分支 blocked，进入 E。

## P17-D2：ETH 鉴权、凭证与 API

**输入依赖**：D0 通用订单能力、C02；总控配置独立 `ETH_MATERIAL_SELF_MINT_MODE=off/allowlist/live` 及 allowlist。生产默认 off；发行政策未确认时即使误设 allowlist/live 也不得签发/启用，不能复用 ETH_SCORE 开关误开启原曲。此 Gate 不阻断通用 API 实现及隔离测试。

**实际文件/符号**：只读 `authenticateRequest`、`findLinkedExternalWallet`、现有限流 helper；新增 `src/lib/material-mint/server/{access.ts,voucher.ts,policy.ts}`；`app/api/material-mint/{prepare,authorization,attempt,submission}/route.ts`、`app/api/material-mint/orders/[orderId]/route.ts`。root middleware 接线由总控负责。

**具体操作**：

| API | 必须完成的操作 |
|---|---|
| prepare | 认证+linked 外部地址+开关+已确认发行政策+真实 ready 发行；冻结目录字段；同请求原子创建/返回订单，保持在途/unknown 互斥；不接受客户端 URI/合约 |
| authorization | 重新查当前 linked 地址、开关、订单消耗状态及已获批政策的资格/额度；只签冻结订单；默认 15 分钟 deadline；同订单续签保存新 attempt |
| attempt POST/PATCH | 钱包弹出前 CAS 记 digest/尝试；明确拒签可退待签，其他无 hash 异常进入 unknown/manual_review |
| submission | 接受 txHash 作为线索；校验订单、用户和链；链上暂不可见仍持久记录；绝不由客户端声明 success |
| order GET | 仅 owner 读取安全状态，私有响应 no-store；返回明确恢复动作 |

1. 独立 authorizer env 为服务端私密配置，由总控写入；不把签名密钥传到客户端、公开目录或日志。原曲不复用 Score token/订单分配器。
2. 复用现有 Redis 限流能力：prepare 建议每用户/分钟 10次，authorization 20次，submission/attempt 30次；owner查询60次。网络/库缺失时签名写入 fail closed；幂等 GET/恢复不因重复操作创建新订单。
3. 速率 key 带 environment+业务+user，返回 429/Retry-After；不新增商用服务或永久用户追踪。
4. 未知 attempt 期间不再授权可触发第二次钱包发送的动作；只有链上映射/事件证明可恢复才续行。已撤销签名者凭证不能继续准备。
5. 凭证 `tokenURIHash` 对链上构造 URI，音频 SHA-256 验证等级属于另一层，不能混淆两种 hash。
6. API 只处理快照/签发/状态，不 `waitForTransactionReceipt`；所有业务响应有稳定 code，拒绝开放重定向、任意 calldata和自报合约。

**失败恢复**：身份/网络错误拒绝本请求，不破坏既有订单；签名配置缺失保持功能关闭。普通RPC读取失败最多两次后可重试，未知广播不按普通重试处理。

**定向验证**：无登录、SEMI、embedded、未关联钱包、换地址、错链、错合约、假 URI、目录未部署/旧 revision、速率超限、签名过期、重复 prepare。真实 private key 不进入测试日志。

**完成证据**：handoff 引用 typed data 公开快照和模式/权限/recipient/防重放断言；较长结果才附 api-gate，不新建重复报告。

**自动下一步**：进入 D3。

## P17-D3：受控钱包发送与恢复

**输入依赖**：D2；K0 已定位最终 BASE 钱包发送实现。服务端返回的目标还需与本地公开目录核对，不能仅信任后端返回任意地址。

**实际文件/符号**：只读 `src/hooks/useEthereumScoreMint.ts:sendOrder` 的当前实现与 `src/hooks/useAuth.ts`；新增 `src/features/material-catalog/mint/{useMaterialMint.ts,wallet-send.ts,attempt-cache.ts}`。不修改全局 auth 或安装钱包库。

**具体操作**：

1. 用户明确选择 ETH 后获取登录能力，展示目标网络、实际付款/接收地址、收藏资产和“Gas由你支付”。不自动打开交易弹窗。
2. 凭证匹配 order/recipient/chain/contract/token/amount/URI hash；切链后再次读取钱包 accounts 和 chainId。输入全部一致才进行 simulate 与当前 fee/balance 检查。
3. 优先调用最终 BASE 已验证的受控发送能力，仅补原曲 ABI/订单适配，固定 `redeem`、显式 chainId、value=0、自付 Gas。已有 Privy provider+viem 不改回旧 hook，不因文件清单要求再造钱包发送/鉴权基础；公共接口缺口交总控最小接线。
4. 弹窗前写 attempt CAS；拒签保持可恢复；无 hash 且不能证明拒签时标 unknown。得到 hash 立即 submission，若接口失败将最小恢复线索存本地并在登录恢复时重报。
5. 本地线索按 environment+chain+contract+recipient+order隔离，仅存 hash/order，无 JWT/签名。登出/换号不得发送前一用户缓存；服务端会继续独立对账，清本地不释放订单。
6. OP/ETH 切换不会丢失在途订单，未提交订单可以显式切换；两链收藏互相独立，但每链同一订单不能被重复广播。

**失败恢复**：余额不足/切链拒绝是待操作状态；遇到未知发送关掉重复按钮，查询已有订单。只有后端证明安全时再显示重试；不能让刷新页面绕过 attempt。

**定向验证**：钱包适配单测覆盖账户切换、拒签、返回hash后断网、关页恢复、旧缓存隔离；真实钱包测试列入 F，仅靠 stub 不能标通过。局部代码可用既有 provider，不能新建长期全局钱包状态。

**完成证据**：handoff 明确适配单测与真实钱包验收分别状态，引用已有有效证明；wallet-adapter 仅按需附件。

**自动下一步**：进入 D4。

## P17-D4：服务端异步对账与停机恢复

**输入依赖**：D0/D2/C事件；总控分配 cron 配置与私有鉴权，不由 worker修改部署文件。

**实际文件/符号**：只读 `src/lib/self-mint/reconcile.ts`（该文件用 ERC-721 ownerOf，不能整段复制）；新增 `src/lib/material-mint/server/reconcile/{inspect.ts,receipt.ts}`、`app/api/cron/reconcile-material-mints/route.ts`、`scripts/p17/pipeline/verify-recovery.ts`。

**具体操作**：

1. 以带 lease/CAS 的有界批次读取 active/unknown 订单；先查 `redeemedOrders`，再从部署区块起按 orderId 分页查 `MaterialRedeemed`，避免无界 logs 扫描。额度/地址字段只有确认政策且合约实际存在时才读取，不硬依赖 `mintedByRecipient`。
2. 验证链、to/from、calldata、事件 order/recipient/token/amount/URI hash、receipt success、block hash与足够确认数。不能对 ERC-1155 调 ownerOf。
3. 与冻结订单匹配的是 mint 发生时的 recipient 和事件。用户后来转走 NFT 不推翻已成功 mint；当前 balance 单独展示。项目留存要求当前指定地址仍持有至少一份，由 F独立检查。
4. 用事件恢复漏报或 replacement hash；同一 order 两个已签 attempt 均能被识别，不能只按最后一个 deadline拒绝历史成功交易。
5. transaction missing/RPC超时只意味着待核对；revert 可允许同订单新的安全尝试，unknown 不释放在途互斥占用。重组时回退 confirming，再查 canonical block，不先补发；成功后的发行资格由已确认政策决定，不在恢复逻辑暗设终身一次或无限次。
6. `off` 阻止新 prepare/authorization，继续对账已发送订单。只用服务端 cron/admin 凭证，不开放匿名可触发的链写入；此 worker只读链，不能替用户发新mint。

**失败恢复**：数据库写回失败保留 receipt/事件并重入幂等 finalize；RPC故障有界重试，达到阈值标manual review而不是 success。缺 cron 权限时交付可在授权环境运行的单次对账入口，由总控接线。

**定向验证**：复用现有 local Anvil/隔离库验证入口和 D0/C03 证明，只补真实 receipt 对账断言：重复 worker、双消费、崩溃重启、丢 hash、replacement、转出不推翻成功 mint、关功能仍对账、重组和未知不重发。相关事件过滤只验受影响部分；这些结果交 F1/G 复用，不重复搭环境或再跑一套矩阵。

**完成证据**：handoff 索引网络/库/runId、相关源码/依赖、恢复断言证据和外部待验项；复杂日志才附 recovery-matrix。必须保留事务/unknown 恢复安全证明，不得以完整源码代替未执行的真库验收。

**自动下一步**：进入[Track E](50-e-catalog-playback.md)，并向总控交付 cron/迁移/env接线请求。
