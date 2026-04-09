# STATUS — 项目当前状态

> 这是给"人 + AI"共用的状态面板。AI 每次完成一个小闭环都要更新这里。
> 字段简短，不要超过 30 行。详细历史看 git log。

---

## 当前阶段

**Phase**: Phase 0 — Minimal Closed Loop ✅ **完成**
**目标**: ~~1 天内~~跑通 "前端 → API → 队列 → 链上 1 笔 mint" — **已达成**

## 当前进度

**做到哪**: Phase 0 全部 8 步 ✅ 完成 — 首笔 NFT 已上链 OP Sepolia
**下一步**: Codex review → 决定是否进入 Phase 1
**playbook**: `playbook/phase-0-minimal.md` 全部完成

### 续做指南（下次会话第一件事读这段）

Phase 0 已全部收尾。下次会话：
- 按 playbook 末尾的 Codex review 流程走，或直接开 Phase 1
- 合约地址：`0xdeC99da00290d15f0742b0abd26e4Cd5d121f02A`
- 首笔 mint tx: `0xe4ae06a8a03b781b7b37d047783d48945565caf3677e15e16b68c2cb5bec9b1d`
- API route 放在 `app/api/`（不是 `src/app/api/`）
- npm 用 `--legacy-peer-deps`；tsconfig `@/*` 映射项目根，src 下 import 写 `@/src/...`
- Foundry 在 `C:\foundry`；LoginButton 有临时 logToken 功能（Phase 1 删）

测试钱包地址：`0x306D3A445b1fc7a789639fa9115e308a34231633`（OP Sepolia 已领 faucet）

## 上次成功验证

- 验证内容: Phase 0 全链路 — 登录 → API 写队列 → cron 上链 → Etherscan 确认
- 验证时间: 2026-04-09
- 验证方式: OP Sepolia Etherscan tx `0xe4ae06a...ec9b1d` + Supabase status=success
- 通过的 commit: `3c93a1c`

## 当前阻塞

- 无

## 备注（AI 写给下次会话的自己）

- 项目命名：仓库 `ripples-in-the-pond` / 代号 `ripples-in-the-pond` / 产品名 `Ripples in the Pond`（本地文件夹仍是 `nft-music`，历史遗留）
- **链：OP Mainnet（生产）/ OP Sepolia（测试）**——不用 ETH L1，详见 ARCHITECTURE.md 决策 3
- Next.js 16.1.6 + React 19；ARCHITECTURE.md 已同步
- Windows 环境，hooks 用 Git Bash 跑
- 学习模式: slow mode（默认）
- 学习机制：SessionStart 注入 STATUS/TASKS，Stop 检查未提交改动，复述 1-3 行关键代码（AGENTS §4 第 4 步）
- 文件硬线 220 行 / 目录 8 文件；route.ts 放宽 270；`src/app/api/**` 整棵子树豁免目录限制
- 决策日志 `docs/JOURNAL.md` / 文档地图 `docs/INDEX.md`
