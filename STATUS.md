# STATUS — 项目当前状态

> 这是给"人 + AI"共用的状态面板。AI 每次完成一个小闭环都要更新这里。
> 字段简短，不要超过 30 行。详细历史看 git log。

---

## 当前阶段

**Phase**: Phase 0 — Minimal Closed Loop
**目标**: 1 天内跑通 "前端 → API → 队列 → 链上 1 笔 mint"

## 当前进度

**做到哪**: Day 1 地基已完成（文档骨架 + 5 hooks + 3 scripts + QUICKSTART）
**下一步**: Phase 0 Step 0 — 跑 `scripts/doctor.sh` 检查环境
**playbook**: `playbook/phase-0-minimal.md`

## 上次成功验证

- 验证内容: 还未开始
- 验证时间: —
- 验证方式: —
- 通过的 commit: —

## 当前阻塞

- 无

## 备注（AI 写给下次会话的自己）

- 项目命名分 3 层：仓库 `NFT-Music-from-Ye` / 代号 `nft-music` / 产品名 `108 Cyber Records`，详见 AGENTS.md §1
- **链：OP Mainnet（生产）/ OP Sepolia（测试）**——不用 ETH L1，详见 ARCHITECTURE.md 决策 3
- Next.js 16.1.6 + React 19；ARCHITECTURE.md 已同步
- Windows 环境，hooks 用 Git Bash 跑
- 学习模式: slow mode（默认）
- 学习机制：SessionStart 注入 STATUS/TASKS，Stop 检查未提交改动，复述 1-3 行关键代码（AGENTS §4 第 4 步）
- 文件硬线 220 行 / 目录 8 文件；route.ts 放宽 270；`src/app/api/**` 整棵子树豁免目录限制
- 决策日志 `docs/JOURNAL.md` / 文档地图 `docs/INDEX.md`
