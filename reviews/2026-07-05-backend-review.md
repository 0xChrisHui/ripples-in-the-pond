# Backend Review — 2026-07-05

> **来源**：2026-07-05 会话，用户要求"总体 review 后端"。由主会话调度 4 条并行子代理逐文件通读：
> ① 非 cron API 路由 + 认证 + middleware；② cron 队列 + 链交互 + Arweave；③ Solidity 合约；④ DB schema + 基础设施脚本。
> **性质**：只读评估，本文件是 findings 留底。所有修复动作统一收进 **Phase 10**（见 `playbook/phase-10/00-overview.md`）。
> **优先级口径**：P0 = 可被利用/资金安全，立即修；P1 = 主网前硬门槛；P2 = 主网前应修；P3 = 卫生项，可随手或延后。

---

## 总体判断

后端核心设计扎实：防双重铸造主线（幂等键 + `UNIQUE` 约束 + tx_hash 先落库 + CAS 状态推进 + Redis 全局锁）经过多轮打磨；`/me/*` 未发现 IDOR；运营钱包私钥暴露面控制良好（仅 `operator-wallet.ts` + 一处 `check-balance`，带 `server-only`）。

问题集中在三类：① 一条可被利用的铸造漏洞（P0）；② mint/airdrop 两条老队列没吸收 score 队列的安全改进；③ 一批"测试网无感、主网切换日集中爆发"的运维欠账（RLS、备份、告警接线、env 卫生、测试覆盖）。

---

## P0 — 立即修

- [ ] **P0-1 越权铸造任意 tokenId + 消耗运营钱包 gas**
  - 位置：`app/api/mint/material/route.ts:23` + `app/api/cron/process-mint-queue/steps.ts:120-125`
  - 证据：`if (!tokenId || !Number.isInteger(tokenId))` 只校验整数，不校验对应 track 存在/已发布；cron 原样 `mint(user.evm_address, BigInt(job.token_id), 1n)`。登录用户可枚举未来周次 / 未发布曲目 / 任意大整数让运营钱包代铸。
  - 与 P1-2 叠加成完整利用链：未发布曲目既能被列出又能被铸造。
  - 修法：入队前校验 `tokenId` 对应 `tracks` 存在且 `published=true`。
  - > ⚠ **2026-07-05 施工前核验修正**：published 校验会破坏现有功能——`BottomPlayer.tsx:24` 用 `week` 收藏任意在播曲目，B/C 组 week 16-36（全部 `published=false`）的收藏是正常主流程。**执行以 `playbook/phase-10/20-b-backend-fixes.md` P0-1 的存在性校验修法为准。**

---

## P1 — 主网前硬门槛

- [ ] **P1-1 全库零 RLS，安全押在 anon key 永不泄露上**
  - 位置：`supabase/migrations/**`（全部 36 个 SQL 无 `enable row level security`）+ `.env.example:49`（注释"权限受 RLS 限制"是假的）
  - 证据：`anon` key 带 `NEXT_PUBLIC_` 前缀存在 Vercel env；当前前端恰好没 import，但一次误 import 即全库裸奔（users 钱包映射 / jwt_blacklist 可读写）。
  - 修法：所有表 `enable row level security` 不加 policy（service-role 不受影响，anon 归零），或 revoke anon 默认 grant。

- [ ] **P1-2 未发布曲目通过公开只读接口泄露**
  - 位置：`app/api/tracks/route.ts:20-22`、`app/api/tracks/[id]/route.ts:20-24`
  - 证据：两个路由都 select 了 `published` 但都不过滤，draft 曲目对任何人可见。
  - 修法：列表加 `.eq('published', true)`；详情对 `published=false` 返回 404（管理员除外）。（待确认：是否有意公开）
  - > ⚠ **2026-07-05 施工前核验修正**：列表**不能**过滤——`getGroupTracks`（sphere-config.ts:111-114）B/C 组依赖 week 1-36 全量行，published 是 A 组 demo 显示门控而非权限位；过滤后 B/C 组被 A 组曲目循环填充。详情 404 化安全（`fetchTrackById` 零真实调用方）。**执行以 `playbook/phase-10/20-b-backend-fixes.md` P1-2 的产品决策方案为准。**

- [ ] **P1-3 mint/airdrop 老队列 writeContract 抛错一律 reset → 广播歧义可双铸**
  - 位置：`app/api/cron/process-mint-queue/steps.ts:127-130`、`app/api/cron/process-airdrop/route.ts:170-173`
  - 证据：`sendRawTransaction` HTTP 超时/502 时 tx 可能已进 mempool，`resetToPending` → 下轮重发 → 双铸。score 队列已用 `mint_attempted_at` 窗口解决（steps-mint.ts:52-60），两条老队列没有。
  - 修法：复制 score 的 attempted_at 窗口模式，或仅在明确 pre-broadcast 错误时才 reset。

- [ ] **P1-4 pending tx 悬挂无处理 + 队首永久阻塞**
  - 位置：`app/api/cron/process-mint-queue/steps.ts:52-59`、`process-airdrop/route.ts:83-90`、`process-score-queue/steps-mint.ts:96-101`、`steps-set-uri.ts:94-99`
  - 证据：确认逻辑取 `updated_at` 最老一条；tx 被 drop 后该行 receipt 永不出现、`updated_at` 永远最老 → 永远排队首，阻塞后面已确认行；三条队列对"有 hash 但无 receipt"均无超时/告警。
  - 修法：给"有 tx_hash 超过 N 分钟无 receipt"加超时转 `manual_review` + alert；确认后 touch `updated_at`。

- [ ] **P1-5 空投链上 revert 无限重试，无 retry 上限**
  - 位置：`app/api/cron/process-airdrop/route.ts:129-131,198-203` + `supabase/migrations/phase-4/019_airdrop_recipients.sql`
  - 证据：`airdrop_recipients` 无 `retry_count` / `failure_kind`；必然 revert 的地址 pending↔minting 永久循环烧 gas 且卡住整轮空投。mint/score 都有 `MAX_RETRY=3`，唯独 airdrop 没有。
  - 修法：加 `retry_count` 列 + 上限后标 failed，对齐另两条队列。

---

## P2 — 主网前应修

- [ ] **P2-1 短信 send-code 仅靠 fail-open IP 限流，无按手机号限流**
  - 位置：`app/api/auth/community/send-code/route.ts` + `middleware.ts:70-73,101-108`
  - 证据：Upstash 未配置/异常时完全放行；同一手机号无独立限流；phone 仅校验 `length>=5`。短信轰炸烧钱风险。
  - 修法：按手机号独立限流（每号每分钟上限）+ E.164 格式校验；花费端点考虑 fail-closed。

- [ ] **P2-2 operator-lock heartbeat 定义了但全项目零调用**
  - 位置：`src/lib/chain/operator-lock.ts:68`（`heartbeatOpLock` 无调用点）
  - 证据：锁 TTL 120s；`writeContract` 内含 estimateGas + getTransactionCount + send 多个 RPC 往返，RPC 挂起时任一步超 120s → 锁过期 → 第二个 cron 拿锁并发发 tx → 同 nonce race。
  - 修法：长调用包一层带心跳的 wrapper，主网前必须接线。

- [ ] **P2-3 低余额告警只 console.error + 写 system_kv，不发通知**
  - 位置：`app/api/cron/check-balance/route.ts:36-39`
  - 证据：`sendAlert`（Resend）已存在且 score 队列在用，但最关键的资金告警没接——钱包耗尽只体现在 Vercel 日志。
  - 修法：`alerts` 非空时调 `sendAlert`。

- [ ] **P2-4 manual_review / CRITICAL 路径不发邮件告警**
  - 位置：`process-mint-queue/steps.ts:66-71`、`process-airdrop/route.ts:98-106`（仅 score 队列 route.ts:151-159 发邮件）
  - 修法：三条队列的 manual_review 统一走 `sendAlert`。

- [ ] **P2-5 score 队列非终态不清 lease，每步须等 5 分钟自然过期**
  - 位置：`app/api/cron/process-score-queue/route.ts:98-100`
  - 证据：claim RPC 要求 `lease_expires_at < now()` 才能捞；步骤成功推进后 lease 未释放 → 一枚 NFT 5 步流水线 ~20-25 分钟。吞吐 bug（非正确性）。
  - 修法：非终态且步骤成功时也清 lease（副作用已 CAS 落库，清掉安全）。

- [ ] **P2-6 mint_queue 无状态机 CHECK 约束**
  - 位置：`supabase/migrations/phase-0-2/001_initial_minimal.sql:25`（`status`/`mint_type` 均无 CHECK）
  - 证据：对比 `score_nft_queue`(009) 有 7 值 CHECK、`airdrop_recipients`(019) 有 4 值 CHECK；typo 状态会让 job 永久静默失联。
  - 修法：`add constraint check (status in ('pending','minting_onchain','success','failed'))`。

- [ ] **P2-7 sounds 表没有建表 migration（schema 漂移）**
  - 位置：`supabase/seeds/sounds.sql`（直接 INSERT）+ `app/api/sounds/route.ts:11-14`（查询该表）
  - 证据：全仓库无 `create table sounds`；按 README 新人建库流程 `/api/sounds` 跑不了。
  - 修法：从生产 `pg_dump --schema-only` 反推补一个建表 migration。

- [ ] **P2-8 migration 编号两处冲突**
  - 位置：`phase-3/hotfix/015,016` vs `phase-4/015_jwt_blacklist,016_auth_identities`；`phase-6/track-a/030` vs `phase-7/track-a/030`
  - 证据：README 声称"编号是权威执行顺序"，但 `find | sort` 会把 phase-7/030 排到 phase-6/031 之后，"编号唯一递增"约定已破产。
  - 修法：冲突文件重编号为全局唯一号，或迁移到时间戳命名。

---

## P3 — 卫生项

- [ ] **P3-1 JWT 未校验 audience** — `src/lib/auth/jwt.ts:69-95`。`jwtVerify` 只传 issuer，signJwt 无 setAudience。修法：双端加 `audience`。（待确认是否规划多受众）
- [ ] **P3-2 cron-auth 非常量时间比较 + 生产仍接受 ?secret= query** — `src/lib/auth/cron-auth.ts:15-21`。admin-auth 已改 Bearer-only，cron-auth 没跟上。修法：`crypto.timingSafeEqual` + 生产禁用 query 路径。health 路由(route.ts:14) 同问题。
- [ ] **P3-3 .env.example 缺 6+ 键 + doctor.sh 同步缺失** — 缺 `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`、`UPSTASH_REDIS_REST_URL`/`TOKEN`、`SOUNDS_MAP_AR_TX_ID`、`NEXT_PUBLIC_APP_URL`、`NEXT_PUBLIC_AIRDROP_NFT_ADDRESS`、`TURBO_WALLET_JWK`。缺配置 = 限流静默 fail-open。修法：补齐 example + doctor.sh REQUIRED_KEYS。
- [ ] **P3-4 verify.sh 不跑任何测试** — `scripts/verify.sh` 从不 `forge test`，package.json 无 test script。修法：verify.sh 加一节 `forge test`（有 forge 才跑）。
- [ ] **P3-5 无备份/恢复预案** — Supabase Free 无 PITR、仅 7 天每日备份；`mint_events.score_data` / `pending_scores.events_data` 是乐谱主数据。修法：主网 runbook 加定期 `pg_dump` cron（或升 Pro + PITR）并演练恢复。
- [ ] **P3-6 mint/airdrop 老队列无 durable lease** — `phase-0-2/002_claim_pending_job.sql`；worker 发 tx 前崩溃 → 卡 minting_onchain 无 hash → 3 分钟后被打成 manual_review（本可安全重试）。修法：按 024 模式补 lease。
- [ ] **P3-7 sync-chain-events 无锁 + 逐条 upsert** — `app/api/cron/sync-chain-events/route.ts`。重叠运行 cursor 可回退（有 `ignoreDuplicates` 兜底，仅浪费 RPC）。修法：加锁 + batch upsert。
- [ ] **P3-8 FK 无覆盖索引若干** — `mint_queue.user_id`、`auth_identities.user_id`、`airdrop_recipients.user_id`/`status`、`score_nft_queue.track_id`、`chain_events.from_addr`/`to_addr`。修法：给高频查询列补索引。
- [ ] **P3-9 users 冗余索引** — `001:16` `idx_users_evm_address` 与 `evm_address unique` 自动索引重复。修法：drop 冗余。
- [ ] **P3-10 mint_score_enqueue 限流 count-then-insert 竞态** — `010/029`。并发可突破 5 次/时。修法：`pg_advisory_xact_lock`。
- [ ] **P3-11 me/scores not.in 字符串拼接** — `app/api/me/scores/route.ts:48-51`。当前 id 来自 DB 不可注入，防御性。修法：拼接前 UUID 断言。
- [ ] **P3-12 airdrop parseTokenId 不校验 log.address** — `process-airdrop/route.ts:192-196`。score 版 `_shared.ts:26` 有校验，模式不一致。
- [ ] **P3-13 me/nfts 依赖 token_id==week 隐式约定** — `app/api/me/nfts/route.ts:60-68`。语义分叉会显示错曲目。修法：加注释或显式关联列。
- [ ] **P3-14 check-balance 重复触碰私钥** — `check-balance/route.ts:28-30`。可用 `operatorWalletClient.account.address` 替代再次 `privateKeyToAccount`。

---

## 合约（Phase 12 部署前必须过一遍；部分可在 P10 先动脚本）

> 合约代码本身正确性风险低（重入/整数/返回值/front-running 均已验证无问题）。风险集中在**部署脚本与运维假设**，以及不可升级架构下"现在不做以后永远做不了"的决策项。

- [ ] **CT-1 [P1] 主网部署会把 "(Testnet)" 名称永久写死** — `script/DeployScore.s.sol:34-38`、`DeployAirdropNFT.s.sol:27-31`。ERC721 name 部署后不可改。修法：name/symbol 走 `vm.envOr` 参数化。
- [ ] **CT-2 [P1] ADMIN_ADDRESS 缺省静默回退 deployer** — 4 个部署脚本 `vm.envOr("ADMIN_ADDRESS", deployer)`。修法：`block.chainid == 10` 时改 `vm.envAddress`（缺失即 revert）。
- [ ] **CT-3 [P1] DEFAULT_ADMIN_ROLE 单步移交** — `DeployScore.s.sol:41-44`。地址填错即永久失控。修法：改 `AccessControlDefaultAdminRules`（两步+延迟），或交权前先链上探活。
- [ ] **CT-4 [P1] mintScore 无幂等键，后端重试会双铸** — `MintOrchestrator.sol:44-49`。修法：`mintScore(address to, bytes32 orderId)` + `mapping` 去重 + 事件带 orderId。
- [ ] **CT-5 [P1] MaterialNFT 零测试覆盖** — `contracts/test/` 无 `MaterialNFT.t.sol`（而 Deploy.s.sol 部署的正是它）。修法：补齐与 ScoreNFT.t.sol 对齐的测试。
- [ ] **CT-6 [P2] 三合约无 ERC2981 版税且不可升级** — 不加以后永远加不上。修法：主网前决策，要就继承 ERC2981 + setDefaultRoyalty。
- [ ] **CT-7 [P2] URI 首写永久（含空字符串也永久）** — `ScoreNFT.sol:54-56`、`AirdropNFT.sol:49-51`。修法：至少 `require(bytes(uri).length > 0)`，考虑给冷钱包保留一次性纠错。
- [ ] **CT-8 [P2] MaterialNFT.setURI 全局可变无冻结 + 不发事件** — `MaterialNFT.sol:37-39`。修法：加 `freezeURI()` 单向开关 + emit `URI`。
- [ ] **CT-9 [P2] 三合约无供应上限** — minter 热钱包泄露可无限增发。修法：评估加 `MAX_SUPPLY` 或链下监控。
- [ ] **CT-10 [P3] 测试覆盖缺口** — 角色管理（grant/revoke/renounce）、部署移交序列、`_safeMint` 到非 receiver 合约、空字符串 URI、AirdropNFT supportsInterface、无 fuzz/invariant。
- [ ] **CT-11 [P3] foundry.toml 未 pin solc/evm_version/optimizer** — 主网验证复现漂移风险。
- [ ] **CT-12 [P3] TestMintOrchestrator 无主网护栏** — `TestMintOrchestrator.s.sol:27-31`。修法：加 `require(block.chainid != 10)`。
- [ ] **CT-13 [P3] Orchestrator 未覆盖 setTokenURI** — minter EOA 仍需直接持 `ScoreNFT.MINTER_ROLE`，编排层没减少热钱包权限面。构造函数不验接口。
- [ ] **CT-14 [P3] MaterialNFT 无 ERC1155Supply + 三合约无 contractURI** — 链上查不到每 id 已铸总量；无合集级 metadata。
- [ ] **CT-15 [P3] Deploy.s.sol 硬编码 placeholder URI** — `Deploy.s.sol:26-29` 域名不存在。修法：env 参数化。

---

## 已有 TASKS.md 中"主网前必做"清单的对应关系

TASKS.md:217-225 已列过一批主网前项（admin/minter 分离、Turbo 阈值告警、换 CRON_SECRET、A7 充值、A8 Resend 接线、9 项 strict review P1、A3 幂等长期方案）。本 review 与其重叠部分：
- A8 Resend 接线 ⊃ P2-3 / P2-4
- admin/minter 分离 ⊃ CT-2 / CT-3
- A3 幂等长期方案 ⊃ CT-4 / P1-3

P10 playbook 的"债务收口"track 会把两份清单合并去重后统一编排。
