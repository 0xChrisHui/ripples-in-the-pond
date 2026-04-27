# Phase 4 — 社区钱包 + 空投 (v2)

> ⚠️ **2026-04-13 起 S3（Semi 前端接入）挂起，2026-04-25 Phase 6 决策正式挂到 Phase 7**。
> 本 playbook 里 S3 章节及"D1 Semi 是 Bearer token API"描述的 `/send_sms + /signin` 流程是**初版设计**，
> Semi 团队后续转向 OAuth，至今 OAuth 文档未出。续做前请先读：
> - `docs/JOURNAL.md` 2026-04-13 段落（S3 挂起原因）+ 2026-04-25 段落（Phase 6 E2 = 挂 Phase 7）
> - `reviews/2026-04-13-phase-4-completion-review.md`
> - `playbook/phase-6/track-e-auth-observability.md` E2 章节（解除条件 + 续做范围）
>
> **当前状态**：Phase 4A S0-S2 后端基础设施（JWT + 双验证中间件 + Semi API 客户端）已完成可复用；S3 前端登录按钮 + useAuth 兼容**未做**，等 Semi OAuth 文档出再改。
>
> ---
>
> 目标：接入 Semi Wallet 作为第二登录入口，建立空投基础设施，补齐运营可观测性
>
> 前置：Phase 3 全部完成（3A + 3B + 3.1）
> 原则：一步只做一件事，每步有独立验证标准
> 参考代码：`references/semi-backend/` + `references/Bai/` + `references/semi-app/`
> 来源：`reviews/2026-04-13-phase-4-playbook-review.md`（Codex Review 驱动 v2 重写）
>
> 核心交付物：
> - Semi Bearer token 登录（登录页第二个按钮）
> - 自签 JWT 双验证中间件（含 jti + 黑名单）
> - auth_identities 表（多登录源身份模型）
> - 所有受保护 API 统一迁移到双验证
> - 空投系统骨架（按 wallet address 快照 + 独立 AirdropNFT）
> - 余额告警 cron + 艺术家页面

---

## 冻结决策（开工前必须对齐）

### D1：Semi 是 Bearer token API，不是 OAuth2
- Semi 的真实登录协议：`POST /signin`（手机号+验证码）→ 拿到 `auth_token` → `GET /get_me`（Bearer auth_token）
- **不是**标准 OAuth2（没有 authorization endpoint / code / redirect URI）
- 前端流程：用户在 Ripples 输入手机号 → Ripples 调 Semi `/send_sms` → 用户输入验证码 → Ripples 调 Semi `/signin` → 拿到 auth_token → 调 Ripples `/api/auth/community` → 换成自签 JWT
- Semi auth_token 只在登录时使用一次（换 JWT），后续请求走自签 JWT

### D2：用户身份模型用 auth_identities 表，不在 users 上硬塞
- `users` 表只代表站内用户，不绑定特定登录方式
- 新增 `auth_identities` 表：`provider / provider_user_id / user_id`
- `users.privy_user_id` 改为 nullable（向后兼容，Semi 用户没有 privy_user_id）
- `users.evm_address` 保持 NOT NULL（Semi 用户必有链上地址）
- 同一真人多登录源合并规则：evm_address 相同 → 同一个 user_id

### D3：后端双验证 — 先 Privy 后自签 JWT
- 新建统一中间件 `authenticateRequest()`
- **所有受保护 API 必须迁移到统一中间件**（不能只新端点用，旧端点不管）
- 自签 JWT 含 `jti`（JWT ID），支持撤销
- 最小撤销模型：`jwt_blacklist` 表 + logout 时写入 jti
- 密钥轮换策略：换密钥时旧 token 验证失败 → 用户重新登录（7 天有效期内最多影响一周）

### D4：空投触发点是每 36 首一轮，AI 再创作形式待定
- 108 首曲目分 3 轮空投（第 36、72、108 首发布时触发）
- 音乐文件由用户（艺术家）提供，Phase 4 不做 AI 生成
- **空投资格单位：wallet address**（不是 user_id）
  - 数据源：`chain_events` 的 owner projection（谁现在持有），不是 `mint_events`（谁当初 mint）
  - 站外地址也能领空投（直接 mint 到链上地址）
- **空投资产：独立 AirdropNFT**（不复用 ScoreNFT）
  - 理由：语义不同——ScoreNFT 是"用户创作的乐谱"，AirdropNFT 是"运营发放的奖励"
  - 避免 /score/[tokenId]、/me、stats 的类型混淆
  - 合约可复用 ScoreNFT 的代码但部署为独立实例

### D5：Semi App NFT 展示为加分项
- 如果 Semi App 支持标准 ERC-721 展示，Ripples NFT 自动可见（同链 OP）
- 不额外开发 Semi 侧代码

---

## 结构

Phase 4 拆成 3 段，按依赖关系排序：

### Phase 4A：认证底座（S0-S3）
必须串行——后面的 step 依赖前面的基础设施。

### Phase 4B：运营与观测（S4-S5）
和 4A 解耦，可以并行推进。

### Phase 4C：空投（S6-S7）
依赖 4A 的认证 + 需要产品决策确认后再开工。

---

## 总览

| Step | 段 | 做什么 | 验证 |
|---|---|---|---|
| S0 | 4A | 自签 JWT + jti + 黑名单 | 能签发、验证、撤销 JWT |
| S1 | 4A | auth_identities 表 + 双验证中间件 + 现有 API 迁移 | 所有受保护 API 通过统一中间件 |
| S2 | 4A | Semi 登录对接 + POST /api/auth/community | Semi 用户拿到 JWT |
| S3 | 4A | 前端登录按钮 + useAuth 兼容 + 端到端验证 | Semi 用户能登录并走完业务链路 |
| S4 | 4B | 余额告警 cron + 健康检查增强 | 低余额有告警 |
| S5 | 4B | 艺术家页面 /artist | 发布进度 + 统计可访问 |
| S6 | 4C | AirdropNFT 合约 + 空投表 + 管理员触发 | 能快照参与者并触发铸造 |
| S7 | 4C | 收口验证 | 10 项清单全通 |

---

# Phase 4A：认证底座

---

# Step S0：自签 JWT 基础设施

## 📦 范围
- `src/lib/jwt.ts`（新建）
- `scripts/generate-jwt-keys.ts`（新建）
- `supabase/migrations/...`（jwt_blacklist 表）
- `.env.local`（新增 JWT_PRIVATE_KEY / JWT_PUBLIC_KEY）
- `docs/STACK.md`（登记 jose）

## 做什么

### 1. 安装 jose
- `npm install jose`（轻量 JWT 库，支持 RS256，Edge Runtime 兼容）
- 登记到 STACK.md 白名单

### 2. 生成 RS256 密钥对
- 一次性脚本 `scripts/generate-jwt-keys.ts`
- 输出 PEM 格式，用户手动贴入 `.env.local`

### 3. jwt.ts 工具函数
- `signJwt(payload)` → JWT 字符串
  - 有效期 7 天，RS256
  - payload：`sub`（userId）、`evm`（evmAddress）、`iss`（"ripples"）、`jti`（唯一 ID，用 crypto.randomUUID）
- `verifyJwt(token)` → payload 或 null
  - 验证签名 + 过期 + 检查 jti 不在黑名单
- `revokeJwt(jti)` → 写入 jwt_blacklist 表
- 加 `import 'server-only'`

### 4. jwt_blacklist 表
```sql
create table jwt_blacklist (
  jti        text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
```
- pg_cron 每天清理过期记录（或 cron 端点手动清理）

## ✅ 完成标准
- 密钥生成脚本可用
- signJwt + verifyJwt 可签发和验证
- revokeJwt 能加入黑名单，验证时拒绝
- `verify.sh` 全绿

---

# Step S1：身份模型 + 双验证中间件 + API 迁移

## 📦 范围
- `supabase/migrations/...`（auth_identities 表 + users.privy_user_id nullable）
- `src/lib/auth-middleware.ts`（新建）
- 以下 6 个 API Route 迁移到统一中间件：
  - `app/api/score/save/route.ts`
  - `app/api/mint/score/route.ts`
  - `app/api/mint/material/route.ts`
  - `app/api/me/scores/route.ts`
  - `app/api/me/score-nfts/route.ts`
  - `app/api/me/nfts/route.ts`

## 做什么

### 1. auth_identities 表
```sql
create table auth_identities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id),
  provider         text not null,  -- 'privy' | 'semi'
  provider_user_id text not null,
  created_at       timestamptz not null default now(),
  unique (provider, provider_user_id)
);
```
- 迁移现有 Privy 用户：`INSERT INTO auth_identities SELECT ... FROM users WHERE privy_user_id IS NOT NULL`

### 2. users.privy_user_id 改 nullable
```sql
ALTER TABLE users ALTER COLUMN privy_user_id DROP NOT NULL;
```
- 不删列，向后兼容（旧代码读 privy_user_id 不会崩）

### 3. 双验证中间件 auth-middleware.ts
- `authenticateRequest(req)` → `{ userId, evmAddress } | null`
- 流程：
  1. 取 Bearer token
  2. 先 Privy `verifyAuthToken` → 成功则查 auth_identities(provider='privy') → 拿 user_id
  3. Privy 失败 → `verifyJwt` → 成功则直接返回 payload 中的 userId
  4. 都失败 → null

### 4. 迁移 6 个现有 API
- 每个 API 删掉各自的 `new PrivyClient` + `verifyAuthToken` + `privy_user_id` 查询
- 统一调 `authenticateRequest(req)`
- **迁移后功能不变**：Privy 用户体验完全不受影响

## ✅ 完成标准
- auth_identities 有现有 Privy 用户数据
- 6 个 API 全部迁移到统一中间件
- Privy 用户调所有 API 正常（回归测试）
- `verify.sh` 全绿

---

# Step S2：Semi 登录对接

## 📦 范围
- `src/lib/semi-client.ts`（新建）
- `app/api/auth/community/route.ts`（新建）
- `app/api/auth/community/send-code/route.ts`（新建）
- `.env.local`（新增 SEMI_API_URL）

## 做什么

### 1. Semi API 客户端 semi-client.ts
- `sendSemiCode(phone: string)` → 调 Semi `POST /send_sms`
- `verifySemiCode(phone, code)` → 调 Semi `POST /signin` → 拿 auth_token
- `getSemiUser(authToken)` → 调 Semi `GET /get_me` → 返回 `{ semiUserId, evmAddress, phone }`
- 全部 5 秒超时
- 加 `import 'server-only'`

### 2. POST /api/auth/community/send-code
- 请求体：`{ phone: string }`
- 调 `sendSemiCode(phone)` → 转发短信
- 返回 `{ result: 'ok' }`

### 3. POST /api/auth/community
- 请求体：`{ phone: string, code: string }`
- 流程：
  1. `verifySemiCode(phone, code)` → 拿 auth_token
  2. `getSemiUser(authToken)` → 拿用户信息
  3. 查 auth_identities(provider='semi', provider_user_id=semiUserId)
  4. 不存在 → 查 users(evm_address) 看是否已有同地址用户
     - 有 → 关联到已有 user（加 auth_identities 记录）
     - 没有 → 新建 user + auth_identity
  5. 签发自签 JWT（含 jti）
  6. 返回 `{ token: jwt, user: { id, evmAddress } }`

## ✅ 完成标准
- 手机号 → 验证码 → JWT 链路跑通
- 同一 evm_address 的 Privy/Semi 用户合并为同一 user
- Semi 用户的 JWT 能通过双验证中间件
- `verify.sh` 全绿

---

# Step S3：前端登录 + 端到端验证

## 📦 范围
- `src/components/LoginButton.tsx`（修改）
- `src/hooks/useAuth.ts`（修改）
- `app/me/page.tsx`（修改）

## 做什么

### 1. 登录页加"社区钱包登录"按钮
- 点击 → 弹出手机号输入框 → 获取验证码 → 输入验证码 → 调 `/api/auth/community` → 存 JWT 到 localStorage

### 2. useAuth hook 兼容双来源
- `authenticated`：Privy 登录 OR localStorage 有有效 JWT
- `getAccessToken()`：Privy 优先，fallback 到 localStorage JWT
- `logout()`：Privy logout + 清 localStorage JWT + 调 `revokeJwt`（如果有 jti）

### 3. 端到端验证（Semi 用户完整业务链路）
- Semi 用户登录 → /me 看到内容
- Semi 用户铸造素材 NFT（POST /api/mint/material）→ 成功
- Semi 用户保存草稿（POST /api/score/save）→ 成功
- Semi 用户铸造乐谱（POST /api/mint/score）→ 成功

## ✅ 完成标准
- 登录页两个按钮，视觉协调
- Semi 用户能走完上述 4 条业务链路
- Privy 用户不退化
- `verify.sh` 全绿

---

# Phase 4B：运营与观测

---

# Step S4：余额告警 + 健康检查增强

## 📦 范围
- `app/api/cron/check-balance/route.ts`（新建）
- `app/api/health/route.ts`（修改）

## 做什么

### 1. check-balance cron
- 每小时检查运营钱包 OP-ETH 余额
- < 0.05 ETH → console.error + 写 system_kv 告警记录
- 队列积压 > 50 → 告警
- 未来接 Telegram（Phase 5，本步只做检查 + 记录）

### 2. /api/health 增强
- 新增：score_nft_queue 状态分布、Semi API 可达性、jwt_blacklist 大小
- 返回更结构化的 JSON

## ✅ 完成标准
- check-balance cron 低余额时有记录
- /api/health 返回完整状态
- `verify.sh` 全绿

---

# Step S5：艺术家页面

## 📦 范围
- `app/artist/page.tsx`（新建）
- `app/api/artist/stats/route.ts`（新建）

## 做什么

### 1. GET /api/artist/stats（公开，无需鉴权）
- 已发布曲目数、总铸造数（Material + Score）、总参与者数、当前周数、108 首进度

### 2. /artist 页面
- 公开页面，深色背景，展示统计 + 进度条

## ✅ 完成标准
- /artist 可访问，数据正确
- `verify.sh` 全绿

---

# Phase 4C：空投

---

# Step S6：AirdropNFT + 空投系统

## 📦 范围
- `contracts/src/AirdropNFT.sol`（新建，复用 ScoreNFT 代码但独立部署）
- `supabase/migrations/...`（airdrop_rounds + airdrop_recipients）
- `app/api/airdrop/trigger/route.ts`（新建）
- `app/api/cron/process-airdrop/route.ts`（新建）
- `src/types/airdrop.ts`（新建）

## 做什么

### 1. AirdropNFT 合约
- 代码几乎和 ScoreNFT 相同（ERC-721 + URIStorage + AccessControl）
- 独立部署，独立 tokenId 空间
- name: `"Ripples in the Pond Airdrop (Testnet)"`，symbol: `RIPA`

### 2. 数据库表

**airdrop_rounds**：
```sql
create table airdrop_rounds (
  id          uuid primary key default gen_random_uuid(),
  round       integer not null unique,
  title       text not null,
  audio_url   text,
  ar_tx_id    text,
  status      text not null default 'draft'
              check (status in ('draft', 'ready', 'distributing', 'done')),
  created_at  timestamptz not null default now()
);
```

**airdrop_recipients**（主键是 wallet_address，不是 user_id）：
```sql
create table airdrop_recipients (
  id              uuid primary key default gen_random_uuid(),
  round_id        uuid not null references airdrop_rounds(id),
  wallet_address  text not null,
  user_id         uuid references users(id),  -- nullable，站外地址可能没有 user
  token_id        integer,
  tx_hash         text,
  status          text not null default 'pending'
              check (status in ('pending', 'minting', 'success', 'failed')),
  created_at  timestamptz not null default now(),
  unique (round_id, wallet_address)
);
```

### 3. 参与者快照（按 wallet address）
- 数据源：`chain_events` owner projection
  - 从 Transfer 事件计算每个 tokenId 的当前 owner
  - 去重后得到唯一 wallet 列表
- 如果 wallet 在 users 表中有记录 → 填 user_id
- 站外地址 → user_id 为 null，但仍参与空投

### 4. 管理员触发 POST /api/airdrop/trigger
- ADMIN_TOKEN 鉴权
- 上传音频 → Arweave → 快照参与者 → 标记 ready

### 5. process-airdrop cron
- 和 process-score-queue 类似的幂等策略
- 每次处理一个 pending recipient
- 用 AirdropNFT 合约（不是 ScoreNFT）

## ✅ 完成标准
- AirdropNFT 部署到 OP Sepolia
- 管理员触发后参与者快照正确（含站外地址）
- cron 铸造分发成功
- /score/[tokenId] 不受影响（独立合约）
- `verify.sh` 全绿

---

# Step S7：收口验证

## 端到端验证清单（10 项）

1. Privy 登录 → 正常使用所有功能（不退化）
2. Semi 登录（手机号+验证码）→ 拿到 JWT
3. Semi 用户 /me → 看到内容
4. Semi 用户铸造乐谱 → 201 成功
5. Semi 用户 logout → JWT 被撤销 → 再用旧 token 调 API 返回 401
6. 同一 evm_address 的 Privy/Semi 用户 → 合并为同一 user
7. /artist 页面数据正确
8. check-balance cron 低余额时有记录
9. 手动触发空投 → 参与者快照包含站外地址
10. process-airdrop cron → AirdropNFT 铸造成功

---

## 延后项（Phase 4 不做）

- **Telegram Bot 告警** — Phase 5
- **AI 再创作生成** — 音乐文件手动提供
- **Semi App 侧开发** — 标准 ERC-721 自动可见
- **触控合奏** — Phase 5+
- **完整 Rate Limiting** — HARDENING A1
- **Key rotation 自动化** — 手动换密钥 + 用户重新登录即可

---

## 风险提示

1. **Semi API 可达性**：Fly.io 部署，国内可能受限。S2 spike 时先测延迟。
2. **6 个 API 迁移回归风险**：S1 改动面大，必须逐个验证 Privy 用户不退化。
3. **空投规模**：数百人逐个 mint 可能需要数小时。考虑未来批量优化。
4. **evm_address 合并冲突**：同一地址注册了 Privy 又注册 Semi，S2 必须正确处理。

---

## Codex Review 采纳记录

| Review 建议 | 采纳情况 |
|---|---|
| P0: Semi 不是 OAuth2 | ✅ 全部改为 Bearer token 协议描述 |
| P0: users 表不兼容 | ✅ 改用 auth_identities 表 + privy_user_id nullable |
| P0: 现有 API 迁移范围 | ✅ S1 明确列出 6 个 API + 迁移步骤 |
| P1: 空投按 holder 不是 minter | ✅ 改用 wallet_address + chain_events owner projection |
| P1: 空投不复用 ScoreNFT | ✅ 独立 AirdropNFT 合约 |
| P1: JWT 需要撤销机制 | ✅ 加 jti + jwt_blacklist 表 |
| 重排建议 4A/4B/4C | ✅ 采纳三段式结构 |
