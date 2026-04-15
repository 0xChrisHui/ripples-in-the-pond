# Phase 5 — 测试网公开版

> 目标：把现有功能部署到 Vercel，第一次让外部用户可以访问
>
> 前置：Phase 4 完成（Review F1-F8 修复 ✅）
> 原则：一步只做一件事，每步有独立验证标准
> 链：仍在 OP Sepolia 测试网，不动合约
> 来源：`reviews/2026-04-13-phase-5-playbook-review.md`（Codex Review 驱动 v2 重写）
>
> 核心交付物：
> - Cron 拆步（10 秒超时安全）+ 鉴权迁移（header 方式）
> - Turbo 钱包环境变量化（Vercel 无本地文件系统）
> - Upstash Redis rate limiting
> - 错误页面（404 / 全局错误边界）+ 公开 ping 端点
> - Vercel Hobby 部署 + cron-job.org 外部触发
> - 域名绑定
> - 线上冒烟测试通过

---

## 冻结决策（开工前必须对齐）

### D1：Vercel Hobby（免费）+ cron-job.org（免费外部触发）

- Vercel Hobby 函数超时 10 秒，cron 最短每天一次
- 外部触发：cron-job.org 免费，最快每分钟触发一次
- 拆步设计让每步都在 10 秒内完成（D2）
- Phase 7 上主网时再评估是否升 Pro（$20/月，60s 超时 + 原生分钟级 cron）

### D2：Cron 拆步 — 发交易和等确认分开

现有 `process-score-queue` 已经是多步状态机，但 `process-mint-queue` 和
`process-airdrop` 把"发交易 + 等确认"挤在一次调用里，容易超 10 秒。

拆成两步后每步都在 5 秒内：
- 第 1 次调用：发交易 + 立刻存 tx_hash → 返回
- 第 2 次调用：查 tx_hash 结果 → 写最终状态

`process-score-queue` 的 `stepMintOnchain` 和 `stepSetTokenUri` 内部也各自
做了"发 + 等"，同样拆开——有 tx_hash 就只查结果，没有才发。

### D3：Cron 鉴权从 query param 迁移到 Authorization header

Vercel 官方推荐方式。所有 cron 端点统一改成：
- 生产：认 `Authorization: Bearer ${CRON_SECRET}`
- 本地调试：兼容 `?secret=xxx`（方便手动测）

### D4：Turbo 钱包从文件路径改为环境变量

`TURBO_WALLET_PATH`（本地文件）→ `TURBO_WALLET_JWK`（JSON 字符串环境变量）。
ScoreNFT 铸造时需要上传 events.json + metadata.json 到 Arweave，这是线上硬依赖。

### D5：公开 ping 和私有 health 分离

- `GET /api/ping` — 公开，返回 `{ ok: true }`，用于冒烟测试和监控
- `GET /api/health` — 保留私有（需 secret），返回运维级信息

### D6：Phase 5 = Privy-only 公开版

Semi 前端登录仍挂起（等 OAuth），测试网公开版只支持 Privy 邮箱登录。

### D7：域名在第一次公开 mint 之前绑定

ScoreNFT metadata 的 `external_url` 在铸造时写死。先绑域名再开放，
避免历史 NFT 指向临时地址。

### D8：Rate limiting 用 Upstash Redis，只限用户可触发的端点

- 限流范围：`/api/mint/*`、`/api/auth/*`、`/api/score/save`
- 排除：`/api/cron/*`、`/api/health`、`/api/ping`、`/api/tracks`（公开只读）
- 策略：sliding window，按 IP，每 10 秒 20 次
- 需新装 `@upstash/redis` + `@upstash/ratelimit`

---

## 降本路径（写给未来的自己）

当前方案月成本 $0（Vercel Hobby + cron-job.org + Upstash Free）。

如果以后用户增长需要升级：
- Vercel Pro $20/月：60s 超时 + 原生分钟级 cron（可以去掉 cron-job.org）
- Upstash Pro：按量计费，免费额度用完再说

如果项目长期没人用想降本：
- 已经是 $0，没什么好降的

---

## 总览

| Step | 段 | 做什么 | 验证 |
|---|---|---|---|
| S0 | 5A | Cron 鉴权迁移（query param → header） | 本地 header + param 都能认证 |
| S1 | 5A | Cron 拆步（mint-queue + airdrop 两步化） | 每步 < 5 秒，状态机正确推进 |
| S2 | 5A | Turbo 钱包环境变量化 | 不读文件也能上传 Arweave |
| S3 | 5A | 公开 ping + rate limiting + 错误页面 | 404 正常、ping 返回、连续请求被 429 |
| S4 | 5B | 域名购买 + Vercel 部署 + 环境变量 + cron-job.org | 域名能访问首页 |
| S5 | 5B | 冒烟测试 + 收口 | 12 项清单全通 |

Phase 5A = 代码改动（本地完成）
Phase 5B = 部署 + 验证（需要用户操作浏览器）

---

# Phase 5A：代码准备

---

# Step S0：Cron 鉴权迁移

## 概念简报
1. **Authorization header** 是 HTTP 标准的身份验证方式，比 URL 参数更安全（URL 会出现在日志里）
2. 改动很小：每个 cron 路由改 2-3 行，从读 URL 参数改成读 header
3. 本地调试时两种方式都兼容

## 📦 范围
- `app/api/cron/process-mint-queue/route.ts`（修改）
- `app/api/cron/process-score-queue/route.ts`（修改）
- `app/api/cron/process-airdrop/route.ts`（修改）
- `app/api/cron/sync-chain-events/route.ts`（修改）
- `app/api/cron/check-balance/route.ts`（修改）
- `app/api/health/route.ts`（修改）

## 做什么

### 1. 提取公共验证函数

在 `src/lib/cron-auth.ts`（新建）写一个：
```ts
export function verifyCronSecret(req: NextRequest): boolean
```
- 优先读 `Authorization: Bearer xxx`
- 降级读 `?secret=xxx`（本地调试兼容）
- 对比 `process.env.CRON_SECRET`

### 2. 6 个路由统一替换

把每个文件里的：
```ts
const secret = req.nextUrl.searchParams.get('secret');
if (secret !== process.env.CRON_SECRET) { ... }
```
替换为：
```ts
if (!verifyCronSecret(req)) { ... }
```

## 验证标准
- [ ] 本地用 `Authorization: Bearer xxx` header 调用 → 200
- [ ] 本地用 `?secret=xxx` 调用 → 200（兼容）
- [ ] 不带任何凭证 → 401
- [ ] `scripts/verify.sh` 通过

---

# Step S1：Cron 拆步（mint-queue + airdrop 两步化）

## 概念简报
1. 现在铸造是"一口气做完"：发交易 → 等确认 → 写结果，可能超 10 秒
2. 拆成两步后，每步只做一半，每步都在 5 秒内
3. 核心技巧：发完交易立刻存 tx_hash，下次 cron 来了只查结果

## 📦 范围
- `app/api/cron/process-mint-queue/route.ts`（重构）
- `app/api/cron/process-airdrop/route.ts`（重构）
- `supabase/migrations/phase-5/`（如需加字段）

## 做什么

### 1. process-mint-queue 两步化

**现在**：pending → (发交易 + 等确认 + 写结果) → success

**改成**：
- 状态：`pending → minting_onchain → success / failed`
- 第 1 次 cron（pending）：
  - 原子抢单 pending → minting_onchain
  - `writeContract` 发交易
  - 立刻存 `tx_hash` 到 `mint_queue` 表
  - 返回（不等确认）
- 第 2 次 cron（minting_onchain）：
  - 查 `tx_hash` 不为空的 minting_onchain 记录
  - `getTransactionReceipt(tx_hash)` 查结果
  - 成功 → success + 写 mint_events
  - 失败 → pending 重试（或 failed）
  - receipt 还没出来 → 不动，等下次

**注意**：`mint_queue` 表可能需要加 `tx_hash` 列（如果还没有）。

### 2. process-airdrop 确认拆步

当前代码已经在发交易后立刻存 tx_hash（F5 修复），但 `waitForTransactionReceipt`
还在同一次调用里。改成：
- 发完交易 + 存 tx_hash → 返回
- 下次 cron：有 tx_hash 的 minting 记录 → 查 receipt → 推进状态

### 3. process-score-queue 的 stepMintOnchain / stepSetTokenUri

这两个函数内部也各自做了"发 + 等"。改成：
- 有 tx_hash → 只查 receipt（快）
- 没 tx_hash → 只发交易 + 存 hash（快）
- receipt 还没出 → 保持当前状态，下次再查

## 验证标准
- [ ] process-mint-queue：pending → minting_onchain → success 分两次 cron 完成
- [ ] process-airdrop：同上
- [ ] 每次 cron 调用耗时 < 5 秒（console.time 测量）
- [ ] `scripts/verify.sh` 通过

---

# Step S2：Turbo 钱包环境变量化

## 概念简报
1. 现在代码用 `readFileSync` 读本地 JSON 文件获取 Arweave 签名密钥
2. Vercel 没有本地文件系统，必须改成从环境变量读
3. 改动集中在 `src/lib/arweave/core.ts` 一个文件

## 📦 范围
- `src/lib/arweave/core.ts`（修改 `getTurboClient` 函数）
- `.env.local`（新增 `TURBO_WALLET_JWK`）

## 做什么

### 1. 修改 getTurboClient

- 优先读 `TURBO_WALLET_JWK` 环境变量（JSON 字符串）
- 降级读 `TURBO_WALLET_PATH`（本地开发兼容）
- `JSON.parse(process.env.TURBO_WALLET_JWK!)` 得到 `{ privateKey, token }`

### 2. 本地 .env.local 新增

把现有 JWK 文件的内容整个复制为一行 JSON，放进 `TURBO_WALLET_JWK=...`

## 验证标准
- [ ] 删掉 `TURBO_WALLET_PATH`，只留 `TURBO_WALLET_JWK` → 上传仍成功
- [ ] 两个都配 → `TURBO_WALLET_JWK` 优先
- [ ] `scripts/verify.sh` 通过

---

# Step S3：公开 ping + Rate Limiting + 错误页面

## 概念简报
1. **ping** = 最简单的"活着吗"检查，公开可访问
2. **rate limiting** = 限流防滥用，用 Upstash Redis 做计数器
3. **错误页面** = 404 和崩溃时用户看到的友好页面

## 📦 范围
- `app/api/ping/route.ts`（新建）
- `middleware.ts`（项目根目录，新建）
- `app/not-found.tsx`（新建）
- `app/error.tsx`（新建）
- `docs/STACK.md`（白名单新增 @upstash/redis + @upstash/ratelimit）
- `.env.local`（新增 UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN）

## 做什么

### 1. 公开 ping 端点

`GET /api/ping` → `{ ok: true, ts: "..." }`。不需要鉴权，不暴露内部状态。

### 2. 注册 Upstash（用户操作）

1. https://console.upstash.com → 注册
2. Create Database → Region 选 US East
3. 复制 REST URL + REST Token → `.env.local`

### 3. 安装 + middleware

```bash
npm install @upstash/redis @upstash/ratelimit
```

项目根 `middleware.ts`：
- 只对成本敏感端点限流：`/api/mint/*`、`/api/auth/*`、`/api/score/save`
- 排除：`/api/cron/*`、`/api/health`、`/api/ping`、`/api/tracks`、`/api/artist/*`
- sliding window：每 IP 每 10 秒 20 次
- Upstash 宕机时 fail open（放行不阻塞）

### 4. 错误页面

- `app/not-found.tsx`：黑底白字 "404 — 页面不存在" + 回首页按钮
- `app/error.tsx`：`'use client'`，"出了点问题" + 重试按钮

### 5. 登记 STACK.md

白名单安全类新增：`@upstash/redis`、`@upstash/ratelimit`

## 验证标准
- [ ] `/api/ping` 返回 200
- [ ] 快速连续 POST `/api/mint/material` 20+ 次 → 429
- [ ] `/api/tracks` 不限流
- [ ] `/random-page` 显示 404 页面
- [ ] `scripts/verify.sh` 通过

---

# Phase 5B：部署 + 验证

---

# Step S4：域名 + Vercel 部署 + 环境变量 + cron-job.org

## 概念简报
1. **Vercel** 连 GitHub 仓库，push 代码自动部署
2. **cron-job.org** 定时帮你发 HTTP 请求，替代 Vercel Pro 的分钟级 cron
3. 域名绑上后所有人都能通过网址访问

## 📦 范围
- `vercel.json`（新建，仅框架配置，不含 cron — cron 走外部）
- 环境变量迁移（Vercel Dashboard）
- 域名 DNS 配置
- cron-job.org 注册 + 6 个 job

## 做什么

### 1. 购买域名

用户操作。推荐：Namecheap / Cloudflare / Vercel 自带。

### 2. Vercel 项目初始化

1. https://vercel.com → GitHub 登录
2. Import `ripples-in-the-pond` 仓库
3. Framework: Next.js（自动检测）
4. **先配环境变量，再 Deploy**

### 3. 环境变量（完整清单）

**公开变量（所有环境）**：

| 变量 | 值 |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy Dashboard |
| `NEXT_PUBLIC_CHAIN_ID` | `11155420` |
| `NEXT_PUBLIC_ALCHEMY_RPC_URL` | Alchemy Dashboard |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard |
| `NEXT_PUBLIC_SCORE_NFT_ADDRESS` | `0xA65C9308635C8dd068A314c189e8d77941A7e99c` |
| `NEXT_PUBLIC_ORCHESTRATOR_ADDRESS` | `0xcBE4Ce6a9344e04f30D3f874098E8858d7184336` |
| `NEXT_PUBLIC_MATERIAL_NFT_ADDRESS` | 从 .env.local 复制 |
| `NEXT_PUBLIC_AIRDROP_NFT_ADDRESS` | `0xa6Aa896b222bB522bA5c8fcC6bD8e59e3f5de56B` |
| `NEXT_PUBLIC_APP_URL` | 你的域名（如 `https://108cyber.xyz`） |

**私密变量（Production + Preview）**：

| 变量 | 来源 |
|---|---|
| `PRIVY_APP_SECRET` | Privy Dashboard |
| `ALCHEMY_RPC_URL` | Alchemy Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard |
| `OPERATOR_PRIVATE_KEY` | 运营钱包私钥 |
| `CRON_SECRET` | 自己生成一个随机字符串 |
| `SCORE_DECODER_AR_TX_ID` | `FWy1XA-B8MvRAgsNgMfDSUBiXXjHNpK1A_fHWjsUAXg` |
| `SOUNDS_MAP_AR_TX_ID` | `fVpKvspVhusgUdn1FQr8j61jreFRZGKmiK3CyR0WO_8` |
| `TURBO_WALLET_JWK` | JWK 文件内容（一行 JSON） |
| `JWT_PRIVATE_KEY` | RS256 私钥 |
| `JWT_PUBLIC_KEY` | RS256 公钥 |
| `UPSTASH_REDIS_REST_URL` | Upstash Dashboard |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Dashboard |

### 4. Deploy + 域名绑定

1. 点 Deploy → 等 Build 成功
2. Settings → Domains → 添加域名
3. 到域名注册商 DNS 添加 Vercel 给的 CNAME 记录
4. 等几分钟生效

### 5. cron-job.org 配置

1. https://cron-job.org → 注册
2. 创建 6 个 job（除 queue-status 外）：

| Job | URL | 频率 | Header |
|---|---|---|---|
| process-mint-queue | `https://你的域名/api/cron/process-mint-queue` | 每 1 分钟 | `Authorization: Bearer {CRON_SECRET}` |
| process-score-queue | `https://你的域名/api/cron/process-score-queue` | 每 1 分钟 | 同上 |
| process-airdrop | `https://你的域名/api/cron/process-airdrop` | 每 2 分钟 | 同上 |
| sync-chain-events | `https://你的域名/api/cron/sync-chain-events` | 每 5 分钟 | 同上 |
| check-balance | `https://你的域名/api/cron/check-balance` | 每 1 小时 | 同上 |
| queue-status | 不注册 | — | 按需手动访问 |

3. 每个 job 添加 HTTP Header：`Authorization: Bearer 你的CRON_SECRET`

## 验证标准
- [ ] Vercel Build 成功（绿色 ✅）
- [ ] 域名能打开首页
- [ ] HTTPS 正常（浏览器锁图标）
- [ ] `/api/ping` 返回 `{ ok: true }`
- [ ] cron-job.org Dashboard 显示 6 个 job 已注册
- [ ] 手动触发一次 process-mint-queue → 日志正常

---

# Step S5：冒烟测试 + 收口

## 概念简报
1. **冒烟测试** = 上线后快速跑一遍核心功能，确认没爆炸
2. 在线上环境用真实域名测试
3. 发现问题 → Vercel 一键回滚到上一个部署

## 📦 范围
- 无代码改动，纯测试
- `STATUS.md` / `TASKS.md` 更新

## 冒烟测试清单（12 项）

### 基础可达
1. [ ] 首页能打开，黑底 + 岛屿群 + 按键有音效
2. [ ] `/api/ping` 返回 200 + `{ ok: true }`
3. [ ] 访问 `/random-page` 显示 404 页面
4. [ ] `/api/health?secret=xxx` 返回运维 JSON（DB/RPC/余额正常）

### 认证
5. [ ] Privy 登录成功 → /me 能看到地址
6. [ ] 登出后再登录正常

### 核心业务
7. [ ] 点爱心收藏 → 排队成功（/me 显示 pending）
8. [ ] cron 执行后 → 素材 NFT 上链（Etherscan 可查）
9. [ ] 乐谱铸造：录制 → 保存 → 铸造 → 上链 → `/score/[tokenId]` 能打开
10. [ ] `/artist` 页面能打开，显示统计

### 安全
11. [ ] 不带凭证访问 `/api/cron/process-mint-queue` → 401
12. [ ] 快速连续请求 `/api/mint/material` → 触发 429

### 回滚计划

严重问题 → Vercel Dashboard → Deployments → 上一个成功部署 → Redeploy。

## 安全审计清单（部署前跑一遍）

- [ ] `OPERATOR_PRIVATE_KEY` 没出现在 `NEXT_PUBLIC_` 变量或前端代码
- [ ] `.env.local` 在 `.gitignore`
- [ ] `server-only` 保护的模块不会被前端 import
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 只在后端使用
- [ ] `TURBO_WALLET_JWK` 没暴露给前端

## 验证标准
- [ ] 12 项冒烟测试全通
- [ ] 安全审计 5/5 ✅
- [ ] STATUS.md 更新到 Phase 5 完成
- [ ] TASKS.md Phase 5 移到 Done
