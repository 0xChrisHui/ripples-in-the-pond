# Phase 5 Playbook Review

日期：2026-04-13

## 结论

`playbook/phase-5-testnet-public.md` 的方向是对的：它抓住了“第一次公开可访问”真正需要补的几类能力，尤其是部署、定时任务、限流、错误页和冒烟测试。

但以 CTO 视角看，这份 playbook 现在还有 5 个会直接影响执行成败的硬问题：

1. 对 Vercel Hobby 的 cron 能力判断错了，按现文档写法会在部署阶段直接失败。
2. cron 鉴权方案和当前代码、Vercel 官方推荐方式都没对齐。
3. `TURBO_WALLET_PATH` 被当成“可选处理”，但它其实是 ScoreNFT 线上运行时的硬依赖。
4. `/api/health` 现在是运维私有接口，playbook 却把它当成公开冒烟入口。
5. Phase 4 前置条件和当前 `STATUS.md` / `TASKS.md` 的真理源不一致。

也就是说，这份 plan 还不是“可以直接开工”的版本，更像“方向对、但发布门槛还没冻结”的版本。

## Findings

### [P0] D1 把 `Vercel Hobby` 当成分钟级 cron 平台，这是错误前提

位置：
- `playbook/phase-5-testnet-public.md:21-26`
- `playbook/phase-5-testnet-public.md:145-165`

playbook 现在写的是：
- Hobby 足够 Phase 5
- cron 最短 1 分钟
- S1 要注册 6 个分钟级 / 小时级 job

但我核对了 Vercel 2026 官方文档，当前口径是：
- `Hobby` 的 cron **最小间隔是每天一次**
- 调度精度是 **hourly (±59 min)**
- 任何“一天多次”的表达式会在部署时直接失败

这意味着当前 S1 的 `* * * * *`、`*/2 * * * *`、`*/5 * * * *`、`0 * * * *` 在 Hobby 上都不成立。不是“上线后可能不稳”，而是**按现在的计划根本注册不进去**。

建议：
- Phase 5 要么明确前置为 `Vercel Pro`。
- 要么把“公开测试网”拆成两段：
  - `5A`：先完成部署、错误页、域名、限流
  - `5B`：等 Pro 或外部 worker 再接 cron

### [P0] S1 的 cron 鉴权设计还没冻结，`?secret=${CRON_SECRET}` 这条路不该继续往下写

位置：
- `playbook/phase-5-testnet-public.md:145-177`
- `app/api/cron/process-mint-queue/route.ts:23-27`
- `app/api/cron/process-score-queue/route.ts:28-32`
- `app/api/cron/process-airdrop/route.ts:15-18`
- `app/api/cron/check-balance/route.ts:18-21`
- `app/api/cron/sync-chain-events/route.ts:23-26`

当前代码里的 cron 端点全部都在读 query string：
- `?secret=...`

playbook 也延续了这个写法，并且在 `vercel.json` 里写成：
- `"/api/cron/... ?secret=${CRON_SECRET}"`

这里有两个问题：

1. Vercel 官方推荐的 cron 鉴权方式不是 query string，而是给请求自动加：
   - `Authorization: Bearer ${CRON_SECRET}`
2. 我没有看到任何官方文档支持在 `vercel.json` 的 `path` 里做 `${CRON_SECRET}` 模板插值。

所以这条路线现在至少是“未证实且偏离官方推荐”的。按最保守工程标准，我会把它当成**不应继续扩写的方案**。

建议：
- 先新开一个 `S0-preflight`，统一把所有 cron route 改成：
  - 生产：认 `Authorization: Bearer ${CRON_SECRET}`
  - 本地：可以临时兼容 query param，便于手动调试
- `vercel.json` 里只写字面 path，例如：
  - `/api/cron/process-score-queue`
- 不要把 secret 放进 URL。

这里我明确说明：`“vercel.json 不支持 ${CRON_SECRET} 插值”` 这一点是我基于 Vercel 官方 cron 文档做的工程推断，因为官方只展示字面 `path`，并把 `CRON_SECRET` 放在 header 里，而不是 URL 里。

### [P0] `TURBO_WALLET_PATH` 不是可选项，当前 public testnet 运行时就依赖它

位置：
- `playbook/phase-5-testnet-public.md:106-115`
- `src/lib/arweave/core.ts:80-102`
- `app/api/cron/process-score-queue/steps-upload.ts:53`
- `app/api/cron/process-score-queue/steps-upload.ts:141`

playbook 现在把 `TURBO_WALLET_PATH` 处理写成二选一：
- A：改成 `TURBO_WALLET_JWK`
- B：Phase 5 不配，空投 / Arweave 上传暂时不需要

这里的判断不对。不是只有空投才要 Arweave，**你们当前公开链路里的 ScoreNFT mint 本身就要在运行时上传：**
- `events.json`
- `metadata.json`

而这些上传现在都走：
- `uploadBuffer()`
- `TURBO_WALLET_PATH`

所以如果 Phase 5 真的把现有功能部署到 Vercel 并让外部用户可 mint score，那么：
- `TURBO_WALLET_PATH` 不可能继续是本地文件路径
- 这件事必须在第一次公开部署前解决

建议：
- 直接把这项提升为 `S0` 的硬前置，不要写成“可选处理”。
- 推荐方案：
  - `TURBO_WALLET_JWK_BASE64` 或 `TURBO_WALLET_JWK_JSON`
  - 运行时从环境变量解码，而不是读文件系统路径

### [P1] 环境变量矩阵还不完整，按现在清单迁移到 Vercel 会留坑

位置：
- `playbook/phase-5-testnet-public.md:90-108`
- `playbook/phase-5-testnet-public.md:366-382`
- `src/lib/contracts.ts:8-10`
- `src/lib/contracts.ts:148-150`
- `app/api/cron/process-mint-queue/route.ts:7-10`

当前 playbook 的环境变量清单至少漏了这两项：
- `NEXT_PUBLIC_MATERIAL_NFT_ADDRESS`
- `NEXT_PUBLIC_AIRDROP_NFT_ADDRESS`

但当前代码已经在用：
- `process-mint-queue` 需要 `MATERIAL_NFT_ADDRESS`
- `process-airdrop` 需要 `AIRDROP_NFT_ADDRESS`

如果按现清单上 Vercel，这两条链路会在运行时出问题。

另外，如果 S1 还保留 `queue-status`，那也要同步考虑：
- `ADMIN_TOKEN`

建议：
- 先做一份“Vercel 真实运行所需 env matrix”，按“构建期 / 运行期 / 仅 cron / 仅运维”分类，而不是只列“公开 / 私密”。

### [P1] `/api/health` 的角色定义冲突了：它现在是私有运维接口，不是公开 smoke endpoint

位置：
- `playbook/phase-5-testnet-public.md:123`
- `playbook/phase-5-testnet-public.md:230`
- `playbook/phase-5-testnet-public.md:311`
- `playbook/phase-5-testnet-public.md:330`
- `app/api/health/route.ts:9-15`

playbook 现在把 `/api/health` 用在了 4 个地方：
- S0 部署验证
- S2 rate limit 本地验证
- S4 域名验证
- S5 冒烟测试

但当前实现里的 `/api/health` 是：
- `GET /api/health?secret=xxx`
- 没有 secret 直接 `401`

而且它返回的是运维级信息：
- 钱包余额
- 队列堆积
- JWT blacklist size
- 最近余额告警

这不是一个适合对公众开放的 health endpoint。把它直接变公开，会把内部运行状态暴露出去；继续保持私有，则 playbook 当前所有 “直接访问 /api/health” 的验证步骤都不成立。

建议：
- 拆成两个接口：
  - `GET /api/ping`：公开，只回 `{ ok: true }` 或最小 liveness
  - `GET /api/health`：保留私有运维视图
- 然后：
  - 冒烟测试、域名测试用 `/api/ping`
  - 运维排查用 `/api/health?secret=...` 或 header 保护版

### [P1] Phase 5 的前置条件和当前真理源打架了，必须先同步文档

位置：
- `playbook/phase-5-testnet-public.md:4`
- `STATUS.md:9-16`
- `STATUS.md:62-79`
- `TASKS.md:16`
- `TASKS.md:29`

按照 `AGENTS.md`，当前在哪一步的真理源是 `STATUS.md`。

而现在的冲突是：
- Phase 5 playbook 写的是“Phase 4 完成”
- `STATUS.md` 写的是 “Phase 4 S3 挂起等 Semi OAuth”
- `TASKS.md` 也还把 “Phase 4A S3” 标成 `Blocked`

这说明项目事实还没有被同一口径描述。

这不是文字洁癖问题，而是执行风险：
- 如果你们对外说“Phase 5 public”，那到底是：
  - 仅 Privy 登录公开？
  - 还是必须等 Semi 前端入口也落地？

建议：
- 先统一一句话：
  - `Phase 5 public beta = Privy-only public launch`
  - 或
  - `Phase 5 必须等待 Semi 前端 S3`
- 然后同步 `STATUS.md / TASKS.md / playbook/phase-5-testnet-public.md`

### [P1] 域名放到 S4 才处理，会把早期公开 mint 出去的 ScoreNFT 永久写成旧域名

位置：
- `playbook/phase-5-testnet-public.md:41-45`
- `playbook/phase-5-testnet-public.md:300-311`
- `app/api/cron/process-score-queue/steps-upload.ts:96-130`

当前 ScoreNFT metadata 的 `external_url` 是在 mint 时写死的：
- 它直接取 `NEXT_PUBLIC_APP_URL`

这意味着如果你们先用 `xxx.vercel.app` 做公开测试，
再在 S4 换成正式域名，那么在这之前 mint 出去的所有 ScoreNFT：
- `external_url` 都会永久指向旧域名

测试网可以接受“历史 NFT 指回旧域名”，但前提是这件事要被显式接受，而不是计划里没意识到。

建议：
- 两个方案二选一：
  - 方案 A：Phase 5 全程接受 `vercel.app` 作为测试网 canonical URL
  - 方案 B：域名前置到“第一次公开 mint 之前”

### [P2] `queue-status` 不应该作为定时 cron 注册，它是观察面，不是执行面

位置：
- `playbook/phase-5-testnet-public.md:165`
- `app/api/cron/queue-status/route.ts:5-13`

`queue-status` 当前是一个管理员观察端点，不做任何状态推进。
把它也注册成定时 cron：
- 不会修复问题
- 只会消耗调用额度
- 还会制造一堆“定时查状态”的日志噪音

建议：
- 从 `vercel.json` 的 cron 列表里删掉它
- 保持按需访问，或者以后交给外部监控系统定时拉取

### [P2] Rate limit 范围写成“所有 `/api/` 按 IP”过粗，容易把内部端点和正常用户一起误伤

位置：
- `playbook/phase-5-testnet-public.md:32`
- `playbook/phase-5-testnet-public.md:186-230`

按当前写法，S2 可能会把这些都纳入同一套 IP 限流：
- cron 端点
- health / ping
- 管理员端点
- 用户登录发送验证码
- 正常业务 mutation

这会带来两个问题：
- 内部端点明明已有 secret/header 鉴权，却再被统一 IP 限流一遍
- 公网用户如果在共享出口 IP（公司网、校园网、移动网关）下，可能会互相误伤

建议：
- 第一轮限流只覆盖“公开、用户可触发、成本敏感”的端点：
  - `/api/auth/community/send-code`
  - `/api/mint/material`
  - `/api/mint/score`
  - 其他公开 mutation
- `cron / ops / health / admin` 默认排除
- 真要做全局 limiter，也至少做 route-specific policy，而不是整棵 `/api/` 一刀切

## 推荐重排

我建议把 Phase 5 改成下面这个顺序：

### Phase 5A：Deployability Gate

先冻结 5 个前置：

1. 明确公开测试网的登录策略
   - `Privy-only` 还是 `必须等 Semi`
2. 统一 cron 鉴权协议
   - 全部切到 `Authorization: Bearer ${CRON_SECRET}`
3. 改掉 `TURBO_WALLET_PATH`
   - 变成可在 Vercel 运行时读取的 env 格式
4. 补齐真实 env matrix
   - 至少补 `NEXT_PUBLIC_MATERIAL_NFT_ADDRESS` / `NEXT_PUBLIC_AIRDROP_NFT_ADDRESS`
5. 定义 public vs ops health
   - `ping` 和 `health` 分离

### Phase 5B：Platform Bring-up

然后再做：

1. S0 Vercel 部署
2. S1 cron 注册
   - 前提：Pro 或外部 worker 已确定
3. S2 rate limit
4. S3 错误页 + 安全收口

### Phase 5C：Public Gate

最后再做：

1. 域名策略冻结
2. 线上冒烟测试
3. 更新 `STATUS.md / TASKS.md`

## 我会要求的上线门槛

如果是“第一次对外公开访问”的测试网版，我会要求至少满足这 4 条再放人进来：

1. cron 方案是真能跑的
   - 不是纸面上的 Hobby 分钟级 cron
2. ScoreNFT 运行时 Arweave 上传能在 Vercel 成功
3. health 体系已经分成 public / ops
4. canonical URL 已冻结
   - 接受 `vercel.app`，或先绑正式域名再开放 mint

## 外部资料核对

这次 review 里和平台能力相关的判断，我核对了这些官方资料：

- Vercel Cron usage & pricing：<https://vercel.com/docs/cron-jobs/usage-and-pricing>
- Vercel Cron 管理与 `CRON_SECRET` header：<https://vercel.com/docs/cron-jobs/manage-cron-jobs>
- Vercel Cron quickstart：<https://vercel.com/docs/cron-jobs/quickstart>
- Vercel Functions duration / `maxDuration`：<https://vercel.com/docs/functions/configuring-functions/duration>
- Upstash Ratelimit overview：<https://upstash.com/docs/redis/sdks/ratelimit-ts/overview>

其中关于 `vercel.json` 里 `${CRON_SECRET}` 模板插值“不应假设支持”这一点，是我根据 Vercel 官方文档做的工程推断，不是它们逐字写明的限制。
