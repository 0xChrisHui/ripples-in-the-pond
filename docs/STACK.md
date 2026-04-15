# STACK — 技术栈白名单 / 黑名单

> AI 安装任何依赖前必须查这份。不在白名单的需要先问用户。

---

## ✅ 白名单（Phase 1-3 使用）

### 框架 & 语言
- `next` 16.x（App Router） — Phase 0 已安装
- `react` 19.x — Phase 0 已安装
- `typescript` 5.x — Phase 0 已安装
- `tailwindcss` 4.x — Phase 0 已安装

> ⚠️ 注意：原 ARCHITECTURE.md 写的是 Next.js 14。本项目实际用 16。
> 若遇到 16 的 breaking change（如 Server Actions 默认配置变化），按 16 文档处理。

### 区块链（仅后端）
- `viem` — 替代 ethers/wagmi，类型友好，更轻量
- `@privy-io/react-auth` — 前端登录 SDK
- `@privy-io/server-auth` — 后端 JWT 验证

### 链选择
- **生产链**：Optimism Mainnet（chainId 10）— L2，EVM 等价
- **测试链**：OP Sepolia（chainId 11155420）
- 不部署 Ethereum L1 主网或 Sepolia（成本和环境一致性原因，见 ARCHITECTURE.md 决策 3 + JOURNAL.md 2026-04-08）
- RPC：Alchemy 提供 OP Mainnet + OP Sepolia 端点
- Etherscan 等价物：`optimistic.etherscan.io`（主网）/ `sepolia-optimism.etherscan.io`（测试网）

### 安全
- `server-only` — Next.js 编译期防护，阻止后端模块被前端 import
- `jose` — 轻量 JWT 库，支持 RS256，Edge Runtime 兼容（Phase 4 自签 JWT 用）
- `@upstash/redis` — Upstash Redis 客户端（Phase 5 rate limiting 用）
- `@upstash/ratelimit` — Upstash 限流库，sliding window 算法（Phase 5 rate limiting 用）

### 数据库
- `@supabase/supabase-js` — Supabase 客户端
- Supabase Free（PostgreSQL 托管）
- Supabase Dashboard 手动管理 schema（Phase 0-1）

### 音频
- Web Audio API（浏览器原生，无依赖）
- 自建简化版 Patatap（Phase 2 spike）

### 合约开发
- Foundry（`forge` / `cast` / `anvil`）
- OpenZeppelin Contracts（`forge install`）

### Arweave
- `@ardrive/turbo-sdk` — 信用卡支付，无需 AR 代币

### 开发工具（devDependencies，不进生产）
- `tsx` — 一次性脚本的 TS 运行器（Phase 3 `scripts/upload-*.ts` / `verify-arweave-cors.ts` 用）。仅 devDependency，不进 Next.js 生产 bundle，生产运行时对它零依赖。

### 部署
- Vercel Hobby（Phase 0-1 免费）
- Vercel Cron（每分钟最快）

---

## ❌ 黑名单（hooks 强制阻止）

### 区块链
- `ethers` — 用 viem 替代
- `wagmi` — 我们前端不调合约，不需要 React 钱包 hooks
- `@account-abstraction/*` — ERC-4337 复杂度过高
- `@pimlicolabs/*` — 不用 Paymaster
- `@privy-io/server-auth` 的 Smart Account 模式 — 我们用普通 EOA

### 音频
- `howler` / `howler.js` — 用 Web Audio API
- `tone` / `tone.js` — 同上

### 合约开发
- `hardhat` — 用 Foundry

### 状态管理
- `redux` / `@reduxjs/toolkit` — 项目规模不需要
- `mobx` / `zustand` / `jotai` — Phase 1 用 React Context 就够，Phase 2+ 需要再讨论

### JWT
- `jsonwebtoken` — 用 jose 替代（更轻量、Edge Runtime 兼容）

---

## ⚠️ 灰名单（需要用户批准才能装）

| 包 | 何时可考虑 | 替代方案 |
|---|---|---|
| `framer-motion` | Phase 2+ 复杂动画时 | 先用 Tailwind animate-* + CSS transition |
| `react-hook-form` | 复杂表单（Phase 3+） | 简单表单用原生 + useState |
| `zod` | 需要运行时校验时 | TypeScript 静态类型先 |
| `swr` / `@tanstack/react-query` | API 调用模式复杂时 | Phase 1 用 fetch + useState 够了 |
| `@radix-ui/*` | 需要无障碍组件时 | 优先看能否手写简单版 |
| `lucide-react` / `react-icons` | 任何时候都可装 | 但优先复用已有 |
| `@sentry/nextjs` | HARDENING A2 阶段 | 见 HARDENING.md |

---

## 📦 Phase 演进

### Phase 0
当前已有：next, react, typescript, tailwindcss
**Phase 0 不装新包**（用 Next.js 默认 + Web Audio API）

### Phase 0 → Phase 1（最小闭环→ MVP）
新增：`viem`, `@privy-io/react-auth`, `@privy-io/server-auth`, `@supabase/supabase-js`

### Phase 1 → Phase 2（合奏）
新增：`@ardrive/turbo-sdk`（Arweave）

### Phase 3+
按需，每次新加都要在本文件登记。

---

## 🔧 工具版本

| 工具 | 最低版本 | 说明 |
|---|---|---|
| Node.js | 18+ | 推荐 20 LTS |
| npm | 10+ | 与 Node 一起 |
| Git | 2.40+ | Windows 用 Git for Windows |
| Foundry | 最新 | `foundryup` 升级 |

---

## 🚫 永远不要做的事

- 不要在没看本文件的情况下 `npm install <something>`
- 不要因为 Stack Overflow 答案要你装某个包就装
- 不要把灰名单的包当白名单用
