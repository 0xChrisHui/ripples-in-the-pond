# Track B — Semi 社区钱包前端接入

> **范围**：Phase 4A S3 续做（自 2026-04-13 挂起）。后端 100% 复用，前端 2 个 input + useAuth 双源化。
>
> **前置**：无（后端 S0-S2 已就绪，commit `4d35e80` 之前）
>
> **核心交付物**：投资人可看 demo — Semi 用户用手机号 + 验证码登录 → /me 显示 NFT → 铸造进 Semi 钱包
>
> **来源**：用户原话 2026-05-13 "P7 接入社区钱包" + 投资人催 demo

---

## 冻结决策

### D-B1 — 不等 Semi OAuth，用现有 API

JOURNAL 2026-04-13 记的"Semi OAuth 等"挂起原因依然成立（Semi 团队方案没出），但**投资人催 demo > 等 OAuth 政策明确**。

**用户决策（2026-05-13）**：先用 Semi 现有 `/send_sms` + `/signin` + `/get_me`，**未经 Semi 明确授权**。风险：Semi 团队后续可能改 API 或限制第三方调用。

**应对**：B4 端到端实测后做 PoC 版投资人 demo，**正式上线（Phase 10 主网）前再去找 Semi 沟通正式授权**。如果 Semi 明确拒绝，Phase 10 切回 SIWE 钱包签名方案（已有 JWT 后端 100% 兼容）。

### D-B2 — 不做 Semi 主网配置

P7 期间 Semi 仅在测试网（OP Sepolia）打通。主网 Semi 配置（如果有不同的 SEMI_API_URL）挪 Phase 10 部署日。

### D-B3 — useAuth 双源化，不破坏现有 Privy 用户体验

useAuth hook 改成双通道：Privy authenticated 优先；否则查 localStorage 的 Semi JWT。**Privy 已登录用户在 P7 升级后不受影响**（不需要重登）。

### D-B4 — 验证码 UX 走中国习惯

- 手机号输入框（不要 country code 选择器，默认 +86）
- 60 秒倒计时按钮
- 验证码 6 位（Semi API 规范）
- 错误状态：手机格式不对 / 60s 内重发 / 验证码错 / 网络错 4 类

### D-B5 — JWT / localStorage 契约冻结（开工前必须落地）

- **localStorage key**：`ripples_auth_jwt`（与 Phase 4A S0 注释一致）
- **JWT payload**：`{ userId: string, evmAddress: string, iat: number, exp: number }`
- **过期判断**：`exp` 秒级时间戳，前端 `Date.now()/1000 < exp` 即有效；过期后 useAuth 视为未登录，localStorage 清
- **失败降级**：JWT 失效（401）或 verify 失败 → 自动 logout + 提示重登（不静默忽略）
- **logout 行为**：localStorage 删 + 后端可选 revoke（jwt_blacklist 表已建，但 P7 不强制调，避免增 API 端点）

### D-B6 — 登录入口位置冻结

P7 期间 Semi 登录入口走 **Header 现有登录区**：
- 桌面：Header 右上"登录"按钮点击 → modal 弹出 + 两个 tab（Privy 邮箱 / Semi 社区钱包）
- 移动端：同 modal（Phase 8 UI 翻修时再决定要不要换底栏触发）
- 不新建 LoginEntry 组件，避免 components/auth/ 目录撞 8 文件硬线

### D-B7 — Track B 完全独立于 A1（2026-05-13 修订）

**原决策（已废弃）**：B4 必须在 A1 完结后开始。
**新决策（用户 2026-05-13）**：Track B 与 A1 完全并行，B4a 端到端冒烟接受**临时硬编码 chain 配置**。

理由：A1 是工程清理（抽 single source），不改运行时行为。B4a 冒烟期间 operator-wallet.ts 仍写死 sepolia 也能跑（测试网就是 sepolia）。A1 完结后 B4a 重测 **10 分钟**确认无回归即可。

**约束**：
- B4a 期间禁止改 operator-wallet.ts 任何代码（避免与 A1 冲突）
- A1 完结后必须重跑 B4a 关键步骤（步骤 5-6 铸造 + 链上确认）作为回归验证
- 如果 A1 完结时 B4a 已完结 → 加 10 分钟回归 smoke 即可
- 如果 A1 完结时 B4a 进行中 → 暂停 B4a 等 A1 部署到 Vercel preview，避免半成品撞 e2e

### D-B8 — Track B 显式标 PoC

P7 Semi 接入 = **PoC-only**，不向公众开放，仅投资人 demo + 内部测试号验证。具体：
- demo 前限定测试号清单（用户提供 3-5 个号）
- 投资人 demo 期间限流（前端 60s 倒计时已防一部分）
- JWT 过期时间默认 24h（不要永久）
- **localStorage JWT XSS 风险接受**（PoC 阶段、测试网、无资金风险）。Phase 10 主网前重新评估"是否换 httpOnly cookie"

---

## 📋 Step 总览

| Step | 内容 | 工时 | 依赖 | 环境 |
|---|---|---|---|---|
| [B1](#step-b1--配-semi_api_url--env-同步) | .env.local + Vercel + .env.example 同步 | 30 分 | 无 | Semi production API |
| [B2](#step-b2--前端登录组件semilogin) | 手机号 + 验证码 + 60s 倒计时 + JWT 契约（D-B5）| 半天 | B1 | 本地 |
| [B3](#step-b3--useauth-hook-双源化) | Privy / JWT 双通道 + localStorage 持久化 + 过期处理 | 半天 | B2 | 本地 |
| [B4a](#step-b4a--端到端技术冒烟) | 发码 → 登录 → 拿 evm → 铸造 1 个 MaterialNFT 进 Semi 钱包 | 半天 | B3（接受临时硬编码 chain，A1 完结后回归 10min）| Semi + OP Sepolia + Vercel preview |
| [B4b](#step-b4b--投资人-demo-协调) | demo 路演协调 + 截图归档 + 演示话术 | 0.5 天 buffer | B4a | 协作面 |

**Track B 总工时**：2-3 天

---

## 后端复用清单（Phase 4A S0-S2 已就绪，不动）

| 文件 | 用途 | 状态 |
|---|---|---|
| `src/lib/auth/semi-client.ts` | sendSemiCode / verifySemiCode / getSemiUser | ✅ 不动 |
| `app/api/auth/community/send-code/route.ts` | 转发短信请求 | ✅ 不动 |
| `app/api/auth/community/route.ts` | 验证码 → JWT 交换 + evm_address 合并 | ✅ 不动 |
| `src/lib/auth/jwt.ts` | RS256 自签 JWT (signJwt / verifyJwt / revokeJwt) | ✅ 不动 |
| `src/lib/auth/middleware.ts` | authenticateRequest 双通道 | ✅ 不动 |
| `supabase/migrations/phase-4/015_jwt_blacklist.sql` | JWT 撤销表 | ✅ 已在 Supabase |
| `supabase/migrations/phase-4/016_auth_identities.sql` | 多源身份表 | ✅ 已在 Supabase |
| `supabase/migrations/phase-4/017_users_privy_nullable.sql` | privy_user_id 可空 | ✅ 已在 Supabase |

**Phase 4A S3 挂起时唯一没做的就是"前端"**。Track B = 把这块前端补上。

---

## Step B1 — 配 SEMI_API_URL + env 同步

### 概念简报

Semi API 是 `https://semi-production.fly.dev`（用户 2026-05-13 给）。后端 `semi-client.ts` 读 `process.env.SEMI_API_URL`，缺这一个 env 整套后端就跑不通。

### 📦 范围（环境：本地 + Vercel）

**B1-local**：
- `.env.local`（加 `SEMI_API_URL=https://semi-production.fly.dev`）
- `.env.example`（加 `SEMI_API_URL=https://semi-production.fly.dev` 占位 + 注释）

**B1-vercel**：
- Vercel Dashboard env（Production / Preview / Development 三档）

### 做什么

1. **B1-local**：加 .env.local + .env.example 一行
2. **B1-vercel**：用户线下 Vercel Dashboard → Environment Variables 加 `SEMI_API_URL`（三环境）

### 验证标准

- [ ] **B1-local 验证**：本地 dev server `curl http://localhost:3000/api/auth/community/send-code -X POST -H "Content-Type: application/json" -d '{"phone":"<用户测试号>"}'` 返 200，用户收到验证码
- [ ] **B1-vercel 验证**：Vercel preview 部署后同 curl 验证（preview URL 替换 localhost）
- [ ] verify.sh 通过（.env 不影响 build）
- [ ] **fallback**：B2/B3 可在 B1-local 完成后继续开工，不阻塞等待 Vercel 同步；B4a 必须 B1-vercel 完成

---

## Step B2 — 前端登录组件 SemiLogin

### 概念简报

按 D-B6，Semi 登录入口走 **Header 现有登录区 modal**，两 tab（Privy / Semi）切换。

### 📦 范围（环境：本地 + components/auth 目录）
- `src/components/auth/SemiLogin.tsx`（新建，client component，含 JWT 写入 localStorage）
- `src/components/auth/LoginModal.tsx`（新建，Privy / Semi tab 切换）
- `src/components/LoginButton.tsx` 或 Header 触发位置（改 onClick 调 LoginModal）
- ~~**不**新建 LoginEntry / client-jwt 多余文件（控 8 文件硬线）~~ — **实施期决定推翻**：新建 `src/lib/auth/client-jwt.ts`（6→7 ≤ 8 OK）以打破 `useAuth ↔ LoginModal ↔ SemiLogin` 三角循环依赖；详 JOURNAL 2026-05-15 Track B 段
- **前置 ls 检查**：`ls src/components/auth/` 当前文件数 ≤ 6 才能新增 2 个

### 做什么

组件状态机：
1. 初始：手机号 input + "发送验证码" 按钮
2. 验证码已发：手机号 input（disabled）+ 验证码 input + "登录"按钮 + "60s 后重发"倒计时
3. 提交中：登录按钮 loading
4. 成功：localStorage 存 JWT + reload 触发 useAuth 重读
5. 错误：toast / inline error

### 验证标准

- [ ] 用户实测：输手机号 → 收短信 → 输验证码 → 登录 → 右上角显示 evm 地址（与 Semi 钱包一致）
- [ ] 错误路径：错验证码 → 401 toast；超时 60s → 重发按钮亮
- [ ] 移动端可用（Phase 8 整体 UI 翻修不冲突）
- [ ] verify.sh 通过

---

## Step B3 — useAuth hook 双源化

### 概念简报

当前 `src/hooks/useAuth.ts` 只支持 Privy（return `usePrivy()` 的封装）。按 D-B5 契约扩双源。

### 📦 范围（环境：本地）
- `src/hooks/useAuth.ts`（扩双源，含过期处理）
- ~~**不**新建 `src/lib/auth/client-jwt.ts`（JWT 解码 1 行 atob，直接放 useAuth）~~ — **实施期推翻同上**：抽 client-jwt.ts 容纳 store + setSemiJwt + clearSemiJwt + readSemiJwt，避免循环依赖；useAuth 通过 useSyncExternalStore 订阅
- 前置 ls：`ls src/hooks/` 文件数 ≤ 7

### 做什么

按 D-B5 契约：
- 读 `localStorage.getItem('ripples_auth_jwt')`
- 用 atob 解 payload + 检查 `exp` 是否 > now
- 过期 → `localStorage.removeItem` + 视为未登录

useAuth return 改成：
```ts
{
  ready,
  authenticated,     // Privy.authenticated OR semiJwt 有效未过期
  authSource: 'privy' | 'semi' | null,
  userId,
  evmAddress,
  login,             // Privy.login（保留兼容）
  openLoginModal,    // 触发 LoginModal（两 tab）
  logout,            // 双源都清
  getAccessToken,    // Privy → privy.getAccessToken / Semi → localStorage JWT
}
```

### 验证标准

- [ ] Privy 用户登录无回归（5 个测试账号都还能正常用）
- [ ] Semi 用户登录后 /me 显示 NFT（已铸造的）
- [ ] **JWT 过期**：手动改 localStorage JWT 的 exp 为过去 → 刷新页面自动 logout
- [ ] **JWT 失效**：调任意 /me API 收 401 → 前端 logout + 提示重登
- [ ] 同一 evm_address 的 Privy / Semi 用户切换不串数据（B1 cache 隔离已保证）
- [ ] logout 双源都清干净
- [ ] verify.sh 通过

---

## Step B4a — 端到端技术冒烟

### 前置

B1-vercel 已生效。**不再硬等 A1**（按 2026-05-13 修订 D-B7）— 接受临时硬编码 chain，但 A1 完结后必须重跑步骤 5-6 做回归验证（10 分钟）。

### 📦 范围（环境：Semi production + OP Sepolia + Vercel preview）
- 无代码改动；纯实测

### 做什么

完整跑一遍（**只用测试号清单**，按 D-B8）：
1. 退出当前 Privy 登录
2. 点 Header 登录 → modal 切到 "Semi 钱包" tab
3. 输手机号 → 收码 → 输码 → 登录
4. 右上角显示 Semi 钱包地址（与 Semi APP 内一致）
5. 进首页 → 收藏一首 → /me 看到 MaterialNFT 卡（先灰后绿）
6. 1-3 分钟后链上确认 → 在 Semi 钱包 APP 看到这个 NFT（实际地址）
7. 登出 → 重新 Privy 登录 → 不串数据

### 验证标准

- [ ] 7 步全过 + 链上 tx 可在 sepolia-optimism.etherscan.io 查
- [ ] Semi 钱包 APP 端实际显示这个 NFT
- [ ] JWT 24h 过期：等真过期或手动改 exp → 下次访问自动 logout
- [ ] **A1 完结后回归 10 分钟**：重跑步骤 5-6（铸造 + 链上确认），确认 A1 chain 配置抽走后无回归

## Step B4b — 投资人 demo 协调

### 📦 范围（协作面，非代码）
- `docs/SEMI-DEMO-SCRIPT.md`（新建演示话术 + 截图）

### 做什么

1. 联系投资人约 demo 时间窗口
2. demo 前 1 小时本地预演（避免网络 / 服务突发问题）
3. 截屏归档 7 步关键节点
4. demo 现场可能踩坑预案：Semi API 限流 / 短信延迟 / 链上确认慢（5-25min）

### 验证标准

- [ ] 7 张截图 + 30 秒话术脚本归档
- [ ] 演示完投资人确认看到了 NFT 进 Semi 钱包流程

---

## Track B 完结标准

- [ ] B1-B4 全部 ✅
- [ ] `bash scripts/verify.sh` 全绿
- [ ] Vercel preview 部署后投资人可直接看 demo
- [ ] JOURNAL 加 2026-05-XX 段记录"Semi ��有 API 先用着"决策 + 后续 Phase 10 沟通计划

---

## 风险 / 不在 P7 范围

- **Semi API 限流**：若投资人 demo 期间频繁登录触发 Semi 限流 → 临时换号或停 demo
- **Semi API 变更**：Semi 团队任何时候改 API → 后端 semi-client.ts 重写（不影响前端）
- **正式授权**：Phase 10 部署主网前必须和 Semi 团队明确"现有 API 是否可继续用 / 还是切 OAuth / 还是切 SIWE"
- **SIWE fallback 方案**：如 Semi 拒绝授权 → 后端 JWT 中间件 100% 兼容 SIWE，只需新建 `app/api/auth/wallet-signin/route.ts` 验证签名 + 签 JWT

---

## 参考

- JOURNAL 2026-04-13 段（Phase 4A 认证底座 + Semi 暂停）
- `src/lib/auth/semi-client.ts:1-93`（Semi API 三步流程注释）
- `app/api/auth/community/route.ts:11-89`（验证码 → JWT 主流程）
