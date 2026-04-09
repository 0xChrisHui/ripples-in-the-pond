# STATUS — 项目当前状态

> 这是给"人 + AI"共用的状态面板。AI 每次完成一个小闭环都要更新这里。
> 字段简短，不要超过 30 行。详细历史看 git log。

---

## 当前阶段

**Phase**: Phase 0 — Minimal Closed Loop
**目标**: 1 天内跑通 "前端 → API → 队列 → 链上 1 笔 mint"

## 当前进度

**做到哪**: Phase 0 Step 6 ✅ 完成 — POST /api/mint/material 幂等写队列，curl 验证通过
**下一步**: Phase 0 Step 7 — 手动触发 cron 处理器（真正上链）
**playbook**: `playbook/phase-0-minimal.md` Step 7

### 续做指南（下次会话第一件事读这段）

Step 6 已收尾（commit `b4fdc2a`）。下次会话直接读 `playbook/phase-0-minimal.md` 的 Step 7：
- 目标：cron 端点取 pending 记录 → 用运营钱包调合约 mint → 更新 status=success + tx_hash
- 需要装 `viem`，新建 `src/lib/operator-wallet.ts` + `src/lib/contracts.ts` + `app/api/cron/process-mint-queue/route.ts`
- 合约地址：`0xdeC99da00290d15f0742b0abd26e4Cd5d121f02A`
- API route 放在 `app/api/`（不是 `src/app/api/`），Next.js 的 app 根在 `app/`
- npm 用 `--legacy-peer-deps`；tsconfig `@/*` 映射项目根，src 下 import 写 `@/src/...`
- Foundry 在 `C:\foundry`；LoginButton 有临时 logToken 功能（Phase 1 删）

测试钱包地址：`0x306D3A445b1fc7a789639fa9115e308a34231633`（OP Sepolia 已领 faucet）

## 上次成功验证

- 验证内容: Phase 0 Step 6 完成 — mint API 幂等写队列
- 验证时间: 2026-04-09
- 验证方式: curl 返回 `{ result: 'ok', mintId }` + Supabase 确认 pending 记录 + 幂等重复请求返回同一 mintId
- 通过的 commit: `b4fdc2a`

## 当前阻塞

- 无（等用户注册账号是预期等待，不是阻塞）

## 备注（AI 写给下次会话的自己）

- 项目命名：仓库 `ripples-in-the-pond` / 代号 `ripples-in-the-pond` / 产品名 `Ripples in the Pond`（本地文件夹仍是 `nft-music`，历史遗留）
- **链：OP Mainnet（生产）/ OP Sepolia（测试）**——不用 ETH L1，详见 ARCHITECTURE.md 决策 3
- Next.js 16.1.6 + React 19；ARCHITECTURE.md 已同步
- Windows 环境，hooks 用 Git Bash 跑
- 学习模式: slow mode（默认）
- 学习机制：SessionStart 注入 STATUS/TASKS，Stop 检查未提交改动，复述 1-3 行关键代码（AGENTS §4 第 4 步）
- 文件硬线 220 行 / 目录 8 文件；route.ts 放宽 270；`src/app/api/**` 整棵子树豁免目录限制
- 决策日志 `docs/JOURNAL.md` / 文档地图 `docs/INDEX.md`
