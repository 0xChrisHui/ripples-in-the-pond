# Phase 4 Completion Review

日期：2026-04-13

## 结论

Phase 4 这轮实现里，认证底座和空投骨架已经搭起来了，但离“可放心宣称 Phase 4 全部完成”还有明显距离。最关键的问题不在样式或局部代码质量，而在 3 条主链路还没有真正闭环：

1. Semi 登录的前端入口和客户端 token 管理没有落地。
2. Privy 和 Semi 的双身份合并规则只做成了单向，反向会失败。
3. 空投 cron 还没有做到链上幂等恢复，出现中断时存在重复空投风险。

下面按严重级别列具体问题。

## Findings

### [P0] Semi 登录并没有真正接入前端，Phase 4 的主卖点还不可用

证据：
- `src/hooks/useAuth.ts:8-20`
- `src/components/auth/LoginButton.tsx:10-24`
- `app/me/page.tsx:30-46`
- `app/me/page.tsx:93-103`

`useAuth()` 现在仍然只是对 `usePrivy()` 的薄封装，没有任何 localStorage JWT fallback、没有社区钱包登录状态、也没有 JWT logout / revoke 逻辑。`LoginButton` 也仍然只有一个 Privy 登录按钮，`/me` 页面的未登录态同样只会触发 Privy 的 `login()`。这意味着即使后端 `/api/auth/community` 已经能签发 JWT，真实用户也没有一条站内可用的 Semi 登录业务链路。

这不是“体验还没补完”的小问题，而是 Phase 4 顶层目标之一还没真正交付。按当前代码，Semi/JWT 更像是后端能力预埋，而不是可用功能。

建议：
- 先把 `useAuth` 升级成双来源状态机：`Privy` 优先，社区钱包 JWT 兜底。
- 明确 JWT 的存储键、读取时机、失效处理、logout 撤销路径。
- 把 `LoginButton` 和 `/me` 登录入口一起改成双登录入口，再做一次真实端到端回归。

### [P0] “同一 evm_address 合并同一 user”只做成了单向，Privy -> 已存在 Semi 用户会直接失败

证据：
- `src/lib/auth/middleware.ts:95-120`
- `src/lib/auth/middleware.ts:123-128`
- `app/api/auth/community/route.ts:94-109`

`/api/auth/community` 里已经处理了 “Semi 用户登录时，如果同地址 Privy 用户已存在，则补一条 `auth_identity` 到已有 user” 这条路径，所以 `Semi -> Privy` 合并是成立的。

但 `tryPrivy()` 里的新建逻辑不是这样。它直接往 `users` 插入 `{ evm_address, privy_user_id }`。如果这个 `evm_address` 之前已经被 Semi 用户占掉，插入会命中 `users.evm_address unique`。随后代码只按 `privy_user_id` 重查，而不是按 `evm_address` 合并到已有用户，所以这条反向路径会返回 `null`，最终把合法 Privy 用户当成未认证。

这会把你们 playbook 里最核心的账户语义打穿：现在不是“双入口合并同一用户”，而是“只有 Semi 登录到 Privy 老用户这一个方向能合并”。

建议：
- 把 `findOrCreatePrivyUser()` 的冲突恢复逻辑改成和 Semi 路径对称：优先按 `privy_user_id`，冲突时再按 `evm_address` 合并。
- 这一段最好放进单个事务/RPC，避免并发登录时产生新的身份撕裂。
- 补 2 条测试：`Semi -> Privy merge` 和 `Privy -> Semi merge`。

### [P1] 仍有受保护接口停留在 Privy-only 认证，Semi/JWT 用户会遇到局部 401/假未登录

证据：
- `app/api/scores/[id]/preview/route.ts:12-35`
- `app/api/tracks/[id]/route.ts:39-50`
- `src/lib/auth/middleware.ts:21-39`

你们已经有统一的 `authenticateRequest()`，也把 6 个核心接口迁过去了，但这里至少还漏了 2 个真实业务接口：

- `GET /api/scores/[id]/preview` 仍然直接 `verifyAuthToken` + 查 `users.privy_user_id`
- `GET /api/tracks/[id]` 也是同样的 Privy-only 逻辑

这会造成一种很隐蔽但很真实的坏状态：Semi 用户后端登录成功、部分 API 能用，但草稿预览和单曲 minted/pending 状态判断仍然失灵。用户体感会是“有时像已登录，有时像未登录”。

建议：
- 把所有需要用户身份的 route 全量改成 `authenticateRequest()`，不要停留在“主要 6 个接口”这个阶段性范围。
- 做一次 `rg "verifyAuthToken|privy_user_id"` 清扫，确认业务 route 已经没有绕开统一中间件的旧逻辑。

### [P0] 空投 cron 没有链上幂等恢复，链上已 mint / 数据库未回写时会重复空投

证据：
- `app/api/cron/process-airdrop/route.ts:71-102`
- `app/api/cron/process-airdrop/route.ts:121-129`
- `supabase/migrations/phase-4/019_airdrop_recipients.sql:4-15`

`process-airdrop` 当前流程是：

1. 把 recipient 从 `pending` 改成 `minting`
2. 直接发链上 mint
3. 等 receipt
4. 再把 `tx_hash / token_id / status=success` 回写数据库

如果第 2 步链上已经成功，但第 4 步前服务中断，数据库里这条记录会一直停在 `minting`。接着 `recoverStuck()` 会把它回退成 `pending`，下一次 cron 又会重新 mint。一条收件地址在同一轮里就可能收到多枚 AirdropNFT。

`unique (round_id, wallet_address)` 只能防止重复建 recipient 行，防不住重复发链上 mint。这是主网级别的正确性问题。

建议：
- 进入 `minting` 前先持久化一个幂等锚点，至少要有 `tx_hash` 或“本次尝试 ID”。
- 恢复流程不能只靠把状态改回 `pending`，而要先根据 `tx_hash` / receipt / 链上 owner / 事件日志判断这次 mint 是否其实已经成功。
- 最好复用 Phase 3 queue 的思路，把空投 cron 也做成“claim + chain write + recover by chain truth”。

### [P1] `recoverStuck()` 用 `created_at` 做超时判定，超时语义是错的

证据：
- `app/api/cron/process-airdrop/route.ts:121-129`
- `supabase/migrations/phase-4/019_airdrop_recipients.sql:11-14`

现在 `recoverStuck()` 的超时条件是：

- `status = 'minting'`
- `created_at < now - 5min`

但 `created_at` 是 recipient 被创建进 round 的时间，不是它进入 `minting` 的时间。也就是说，一个轮次如果创建超过 5 分钟，那么某条 recipient 即使 10 秒前才刚被 worker claim 成 `minting`，下一次 cron 也可能立刻把它重置回 `pending`。

这会直接放大上一个问题：还在执行中的空投任务也可能被错误回收，造成并发重复 mint。

建议：
- 增加 `updated_at` 或专门的 `claimed_at / minting_started_at`。
- 所有超时恢复都应该基于“进入当前状态的时间”，而不是基于“记录创建时间”。

### [P1] AirdropNFT 只 mint 了空壳 token，metadata / 音频上传链路实际上没有实现

证据：
- `app/api/airdrop/trigger/route.ts:22-35`
- `app/api/airdrop/trigger/route.ts:75-86`
- `app/api/cron/process-airdrop/route.ts:71-102`
- `contracts/src/AirdropNFT.sol:31-38`
- `src/types/airdrop.ts:5-30`

从表结构和合约能力看，Phase 4 的原意显然不是“只发一个裸 ERC-721 编号”：

- `airdrop_rounds` 里有 `audio_url / ar_tx_id`
- `AirdropNFT` 合约也暴露了 `setTokenURI`

但当前实现里：

- trigger 接口只接收 `{ round, title }`
- 没有任何 Arweave 上传
- 没有生成 metadata
- `process-airdrop` 只调用 `mint()`，从头到尾没有 `setTokenURI()`

结果就是链上确实能发 NFT，但发出去的是没有 metadata 的空 token。这和“奖励资产”应有的可展示、可分享、可验证状态还有明显距离。

建议：
- 明确 Phase 4 对空投资产的最低交付标准：至少要有 image / name / description / external_url / animation_url 中的哪几项。
- 如果这一期不做完整媒体资产，也至少要在 playbook 和状态面板里明确写成“骨架版 airdrop，不含 metadata”。
- 否则就补完 metadata 上传和 `setTokenURI`。

### [P2] `/api/health` 没有真正覆盖 Semi 可达性，观测面还是缺了一块

证据：
- `app/api/health/route.ts:17-76`
- `playbook/phase-4-community.md:279-290`

playbook 在 S4 里把 “Semi API 可达性” 列进了健康检查目标，但当前 `/api/health` 只检查了数据库、钱包、队列、JWT 黑名单和最近余额告警，没有任何对 `SEMI_API_URL` 的可达性探测。

这会让你们最脆弱的一条外部依赖链路处于不可观测状态。真到 Semi 挂掉时，监控面板还是绿的，但用户已经无法登录。

建议：
- 加一个轻量的 Semi 探针，哪怕只是 2-5 秒超时的 `HEAD/GET` 健康 ping。
- 如果 Semi 没有健康接口，就在 `/api/health` 里把它显式标为 `unknown`，不要让返回值看起来像“已覆盖”。

## 建议的修复顺序

1. 先补前端双登录闭环：`useAuth` / `LoginButton` / JWT logout。
2. 再修身份合并对称性，并清扫所有残留的 Privy-only route。
3. 最后重做空投 cron 的幂等恢复，再决定要不要把 metadata 一起补完。

## 协作提醒

当前 [STATUS.md](/E:/Projects/nft-music/STATUS.md) 仍写着 “Phase 4 6/7 step 完成，S3 挂起”。如果你们认为 Phase 4 已经全部完成，这份状态板和 `TASKS.md` 需要同步更新，不然下一位 AI 或未来的你会被错误上下文带偏。
