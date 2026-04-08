# STATUS — 项目当前状态

> 这是给"人 + AI"共用的状态面板。AI 每次完成一个小闭环都要更新这里。
> 字段简短，不要超过 30 行。详细历史看 git log。

---

## 当前阶段

**Phase**: Phase 0 — Minimal Closed Loop
**目标**: 1 天内跑通 "前端 → API → 队列 → 链上 1 笔 mint"

## 当前进度

**做到哪**: Phase 0 Step 0 进行中 — baseline doctor.sh 已通过（17 ✅ / 3 ⚠ / 0 ❌）
**下一步**: 等用户完成 Privy / Supabase / Alchemy 三个外部账号注册，把值填到 `.env.local`，然后再跑 doctor.sh 确认 + 演练 checkpoint.sh
**playbook**: `playbook/phase-0-minimal.md` Step 0

### 续做指南（下次会话第一件事读这段）

用户上次离开时**正在注册 3 个外部账号**：
1. **Privy**（https://dashboard.privy.io/）—— 创建 app，启用 Email 登录，启用 Embedded wallet "Create on login"，**Networks 加 OP Sepolia (11155420) + OP Mainnet (10)**，复制 App ID + App Secret
2. **Supabase**（https://supabase.com/dashboard）—— 新建项目 nft-music-dev，Region 选 Tokyo/Singapore，Free 计划，复制 Project URL + anon key + service_role key
3. **Alchemy**（https://dashboard.alchemy.com/）—— 新建 app，**Chain = Optimism, Network = Optimism Sepolia**（不要选错），复制 HTTPS RPC URL

新会话开始时**先问用户**："上次注册的 3 个账号都搞定了吗？" 根据回答决定从哪一步继续：
- 都好了 → 引导写 `.env.local`（10 个 key）+ 生成测试钱包 + 领 OP Sepolia faucet（https://app.optimism.io/faucet, ≥ 0.02 OP-ETH）
- 卡在某个 → 帮用户排查那一个
- 还没开始 → 引导从头开始（playbook Step 0 的"🤖 AI 执行指引"）

完成 Step 0 全部后再演练 `bash scripts/checkpoint.sh "Phase 0 起点演练"`。

## 上次成功验证

- 验证内容: 项目地基整修 + 全面切到 Optimism + 文档大压缩
- 验证时间: 2026-04-08
- 验证方式: `bash scripts/verify.sh` 全绿
- 通过的 commit: `1f13aac`（docs/arch 大整修 + OP 切链）

## 当前阻塞

- 无（等用户注册账号是预期等待，不是阻塞）

## 备注（AI 写给下次会话的自己）

- 项目命名分 3 层：仓库 `NFT-Music-from-Ye` / 代号 `nft-music` / 产品名 `108 Cyber Records`，详见 AGENTS.md §1
- **链：OP Mainnet（生产）/ OP Sepolia（测试）**——不用 ETH L1，详见 ARCHITECTURE.md 决策 3
- Next.js 16.1.6 + React 19；ARCHITECTURE.md 已同步
- Windows 环境，hooks 用 Git Bash 跑
- 学习模式: slow mode（默认）
- 学习机制：SessionStart 注入 STATUS/TASKS，Stop 检查未提交改动，复述 1-3 行关键代码（AGENTS §4 第 4 步）
- 文件硬线 220 行 / 目录 8 文件；route.ts 放宽 270；`src/app/api/**` 整棵子树豁免目录限制
- 决策日志 `docs/JOURNAL.md` / 文档地图 `docs/INDEX.md`
