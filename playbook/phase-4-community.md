# Phase 4 — 社区钱包 + 空投

> 目标：接入 Semi Wallet 作为第二登录入口，建立空投基础设施，补齐运营可观测性
>
> 前置：Phase 3 全部完成（3A + 3B + 3.1）
> 原则：一步只做一件事，每步有独立验证标准
> 参考代码：`references/semi-backend/` + `references/Bai/` + `references/semi-app/`
>
> 核心交付物：
> - Semi OAuth2 登录（登录页第二个按钮）
> - 自签 JWT 双验证中间件
> - 空投系统骨架（参与者追踪 + 铸造分发）
> - 余额告警 cron + 健康检查增强
> - 艺术家页面（发布进度 + 统计）

---

## 冻结决策（开工前必须对齐）

### D1：Semi OAuth2 是第二登录入口，不替代 Privy
- 登录页两个按钮：Privy（邮箱）+ Semi Wallet（社区钱包）
- 两种用户共享同一套 users 表，通过 evm_address 关联
- Semi 用户首次登录时自动入库，后续不再依赖 Semi API
- Privy 用户无需感知 Semi 的存在

### D2：后端双验证 — 先 Privy 后自签 JWT
- API Route 收到 Bearer token 后先尝试 Privy 验证
- Privy 失败再尝试自签 JWT 验证（Semi 用户走这条）
- 自签 JWT 用 RS256 非对称签名（`jose` 库，Phase 4 启用）
- Semi API 调用设 5 秒超时，失败降级但不阻塞登录流程

### D3：空投触发点是每 36 首一轮，AI 再创作形式待定
- 108 首曲目分 3 轮空投（第 36、72、108 首发布时触发）
- "AI 再创作"的音乐文件由用户（艺术家）提供，不需要代码生成
- Phase 4 只建空投**基础设施**（追踪参与者 + 铸造分发），不做 AI 生成
- 空投的 NFT 复用 ScoreNFT 合约（ERC-721），metadata 格式与乐谱 NFT 一致

### D4：Semi App NFT 展示为加分项
- 如果 Semi App 支持标准 ERC-721 展示，Ripples NFT 自动可见（同链 OP）
- 不额外开发 Semi 侧代码，优先保证 Ripples 站内体验

---

## 总览

| Step | 做什么 | 验证 |
|---|---|---|
| S0 | 自签 JWT 基础设施 + 双验证中间件 | 能签发和验证自签 JWT |
| S1 | Semi OAuth2 对接 + users 表扩展 | Semi 用户能拿到自签 JWT |
| S2 | 前端登录按钮 + 回调 + 个人页兼容 | Semi 用户能登录并看到 /me |
| S3 | 余额告警 cron + 健康检查增强 | 余额低时有告警，/api/health 更完整 |
| S4 | 艺术家页面 /artist | 发布进度 + 统计数据可访问 |
| S5 | 空投系统骨架 | 参与者可追踪，手动触发空投能铸造分发 |
| S6 | 收口验证 | 8 项清单全通 |

---

# Step S0：自签 JWT 基础设施

## 📦 范围
- `src/lib/jwt.ts`（新建）
- `src/lib/auth-middleware.ts`（新建）
- `.env.local`（新增 JWT_PRIVATE_KEY / JWT_PUBLIC_KEY）
- `docs/STACK.md`（登记 jose）

## 做什么

### 1. 安装 jose
- `npm install jose`（轻量 JWT 库，支持 RS256，无 Node.js 原生依赖）
- 登记到 STACK.md 白名单

### 2. 生成 RS256 密钥对
- 提供一次性脚本 `scripts/generate-jwt-keys.ts`
- 输出 PEM 格式，用户手动贴入 `.env.local`
- JWT_PRIVATE_KEY（签发用，仅后端）
- JWT_PUBLIC_KEY（验证用，仅后端）

### 3. jwt.ts 工具函数
- `signJwt(payload: { userId: string, evmAddress: string })` → JWT 字符串
  - 有效期 7 天，签名算法 RS256
  - payload 含 `sub`（userId）、`evm`（evmAddress）、`iss`（"ripples"）
- `verifyJwt(token: string)` → payload 或 null
- 加 `import 'server-only'`

### 4. 双验证中间件 auth-middleware.ts
- `authenticateRequest(req: NextRequest)` → `{ userId: string, evmAddress: string } | null`
- 流程：
  1. 从 Authorization header 取 Bearer token
  2. 先尝试 `privy.verifyAuthToken(token)` → 成功则查 users 表拿 userId
  3. Privy 失败 → 尝试 `verifyJwt(token)` → 成功则返回 payload
  4. 都失败 → 返回 null

## ✅ 完成标准
- `scripts/generate-jwt-keys.ts` 能生成密钥对
- `signJwt` + `verifyJwt` 可签发和验证
- 双验证中间件能同时处理 Privy token 和自签 JWT
- 现有 API（用 Privy 的）不受影响（向后兼容）
- `verify.sh` 全绿

---

# Step S1：Semi OAuth2 对接 + users 表扩展

## 📦 范围
- `supabase/migrations/...`（users 表加字段）
- `app/api/auth/community/route.ts`（新建）
- `src/lib/semi-client.ts`（新建）

## 做什么

### 1. users 表扩展
```sql
ALTER TABLE users
  ADD COLUMN auth_provider text NOT NULL DEFAULT 'privy',
  ADD COLUMN semi_user_id text UNIQUE,
  ADD COLUMN phone text;
```
- `auth_provider`：`'privy'` 或 `'semi'`，区分登录来源
- `semi_user_id`：Semi 系统的用户 ID，UNIQUE 防重复
- `phone`：手机号（Semi 登录必有）

### 2. Semi API 客户端 semi-client.ts
- 封装 Semi 后端 API 调用
- `verifySemiToken(token: string)` → 调 Semi `/get_me` 拿用户信息
  - 5 秒超时（决策 D2）
  - 返回 `{ semiUserId, evmAddress, phone }` 或 null
- 加 `import 'server-only'`
- Semi API base URL 从 `SEMI_API_URL` 环境变量读取

### 3. POST /api/auth/community
- 请求体：`{ semiToken: string }`
- 流程：
  1. 调 `verifySemiToken(semiToken)` 获取 Semi 用户信息
  2. 查 users 表 `semi_user_id` 是否已存在
  3. 不存在 → INSERT 新用户（auth_provider='semi'）
  4. 已存在 → 更新 last_login
  5. 签发自签 JWT（调 `signJwt`）
  6. 返回 `{ token: jwt, user: { id, evmAddress } }`

## ✅ 完成标准
- Semi 用户调 `/api/auth/community` 能拿到自签 JWT
- 自签 JWT 能通过双验证中间件
- users 表正确区分 privy / semi 用户
- Privy 用户完全不受影响
- `verify.sh` 全绿

---

# Step S2：前端登录 + 个人页兼容

## 📦 范围
- `src/components/LoginButton.tsx`（修改）
- `src/hooks/useAuth.ts`（修改，兼容双来源）
- `app/me/page.tsx`（修改，兼容 Semi 用户）

## 做什么

### 1. 登录页加"社区钱包登录"按钮
- 现有 LoginButton 旁边加一个 Semi 登录按钮
- 点击后跳转到 Semi OAuth2 授权页（或打开弹窗）
- 回调后拿 semiToken → 调 `/api/auth/community` → 存 JWT 到 localStorage
- 具体 UI 交互参考 `references/semi-app/` 的登录流程

### 2. useAuth hook 兼容双来源
- 除了 Privy 的 `getAccessToken()`，也支持从 localStorage 读自签 JWT
- `authenticated` 状态：Privy 登录 OR 有有效的自签 JWT
- `getAccessToken()` 返回可用的 token（Privy 优先）
- `logout()` 两边都清理

### 3. 个人页兼容
- Semi 用户进 /me 时用自签 JWT 调 API
- 和 Privy 用户看到一样的内容（乐谱 + 素材 + 草稿）

## ✅ 完成标准
- 登录页有两个按钮，视觉上协调
- Semi 用户能登录、看到 /me、和 Privy 用户体验一致
- Privy 用户流程不受影响
- `verify.sh` 全绿

---

# Step S3：余额告警 + 健康检查增强

## 📦 范围
- `app/api/cron/check-balance/route.ts`（新建）
- `app/api/health/route.ts`（修改，增强）

## 做什么

### 1. check-balance cron
- 每小时检查运营钱包 OP-ETH 余额
- < 0.05 ETH → 发送告警（先用 console.error 标记 + 写 system_kv 记录）
- 队列积压 > 50 → 告警
- Turbo credits（Arweave）余额检查（如果 API 支持）
- 未来接 Telegram Bot 通知（本步只做检查 + 记录，不做 Telegram）

### 2. /api/health 增强
- 现有：DB + wallet + pendingJobs
- 新增：Turbo credits 余额、score_nft_queue 状态分布、Semi API 可达性
- 返回更结构化的 JSON

## ✅ 完成标准
- check-balance cron 能检测低余额并记录
- /api/health 返回更完整的系统状态
- `verify.sh` 全绿

---

# Step S4：艺术家页面

## 📦 范围
- `app/artist/page.tsx`（新建）
- `app/api/artist/stats/route.ts`（新建）

## 做什么

### 1. GET /api/artist/stats
- 公开接口，无需鉴权
- 返回：
  - 已发布曲目数（tracks 表 count）
  - 总铸造数（MaterialNFT + ScoreNFT）
  - 总参与者数（users 表 count）
  - 当前周数（最新 track 的 week）
  - 108 首中的完成进度

### 2. /artist 页面
- 公开页面，无需登录
- 展示：艺术家简介（静态文案）+ 上述统计数据
- 108 首发布进度条（已发布 / 108）
- 视觉风格与首页一致（深色背景）

## ✅ 完成标准
- /artist 可访问，数据正确
- 统计数字实时反映 DB
- `verify.sh` 全绿

---

# Step S5：空投系统骨架

## 📦 范围
- `supabase/migrations/...`（airdrop 相关表）
- `app/api/airdrop/trigger/route.ts`（新建，管理员触发）
- `app/api/cron/process-airdrop/route.ts`（新建）
- `src/types/airdrop.ts`（新建）

## 做什么

### 1. 数据库表

**airdrop_rounds 表**：
```sql
create table airdrop_rounds (
  id          uuid primary key default gen_random_uuid(),
  round       integer not null unique,  -- 1, 2, 3（对应第 36、72、108 首）
  title       text not null,
  audio_url   text,                     -- 用户提供的 AI 再创作音频
  ar_tx_id    text,                     -- 上传 Arweave 后回填
  status      text not null default 'draft'
              check (status in ('draft', 'ready', 'distributing', 'done')),
  created_at  timestamptz not null default now()
);
```

**airdrop_recipients 表**：
```sql
create table airdrop_recipients (
  id              uuid primary key default gen_random_uuid(),
  round_id        uuid not null references airdrop_rounds(id),
  user_id         uuid not null references users(id),
  token_id        integer,         -- 链上 mint 后回填
  tx_hash         text,
  status          text not null default 'pending'
                  check (status in ('pending', 'minting', 'success', 'failed')),
  created_at      timestamptz not null default now(),
  unique (round_id, user_id)
);
```

### 2. 参与者快照
- 触发空投时，快照当时所有持有 ScoreNFT 的用户（从 mint_events 查）
- 写入 airdrop_recipients，每人一条 pending 记录

### 3. 管理员触发端点 POST /api/airdrop/trigger
- ADMIN_TOKEN 鉴权
- 请求体：`{ round: 1, title: "第一轮空投", audioUrl: "..." }`
- 上传音频到 Arweave → 快照参与者 → 标记 ready

### 4. process-airdrop cron
- 复用 ScoreNFT 铸造流程（Orchestrator.mintScore → setTokenURI）
- 每次处理一个 pending recipient
- 和 process-score-queue 一样的幂等策略

## ✅ 完成标准
- 管理员能触发空投，快照参与者列表
- cron 能逐个铸造并分发
- airdrop_recipients 状态正确推进
- `verify.sh` 全绿

---

# Step S6：收口验证

## 📦 范围
- STATUS.md / TASKS.md（更新）

## 端到端验证清单

1. Privy 登录 → 正常使用所有功能（不退化）
2. Semi 登录 → 拿到 JWT → /me 看到内容
3. Semi 用户铸造乐谱 → 和 Privy 用户一样成功
4. /artist 页面数据正确
5. check-balance cron 低余额时有记录
6. /api/health 返回完整状态
7. 手动触发空投 → 参与者快照正确
8. process-airdrop cron → 铸造分发成功

## ✅ 完成标准
- 8 项验证清单全部通过
- `verify.sh` 全绿
- STATUS.md / TASKS.md 更新

---

## 延后项（Phase 4 不做）

- **Telegram Bot 告警** — S3 先做检查 + 记录，Telegram 接入留给 Phase 5
- **AI 再创作生成** — 音乐文件由用户手动提供，不做自动生成
- **Semi App 侧开发** — 如果 Semi 支持标准 ERC-721 展示则自动可见，不额外开发
- **触控合奏（移动端）** — 延后到 Phase 5+
- **完整 Rate Limiting** — S3 加基础告警，完整方案见 HARDENING A1

---

## 风险提示

1. **Semi API 可达性**：Semi 后端部署在 Fly.io，国内访问可能受限。S1 要验证延迟和可用性。
2. **双验证复杂度**：两套认证共存容易出边界 bug。S0 的中间件必须覆盖所有 API Route。
3. **空投规模**：如果参与者多（数百人），cron 逐个铸造可能需要数小时。考虑批量优化。
4. **jose 库兼容性**：确认 jose 和 Next.js 16 + Edge Runtime 兼容（jose 专为 Edge 设计，应该没问题）。
