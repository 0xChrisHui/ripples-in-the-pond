# STATUS — 项目当前状态

> 这是给"人 + AI"共用的状态面板。AI 每次完成一个小闭环都要更新这里。
> 字段简短，不要超过 30 行。详细历史看 git log。

---

## 当前阶段

**Phase**: Phase 2 执行中
**目标**: Phase 2 — 合奏 + 草稿系统（方向调整：Patatap 风格首页融合）

## 当前进度

**做到哪**: Phase 2 全部完成（Track A + B + C ✅），C4 浏览器验证通过
**下一步**: merge 回 main
**playbook**: `playbook/phase-2/track-c-integration.md`

### 续做指南（下次会话第一件事读这段）

**⚠️ 方向调整**：用户要求首页融合 Patatap 风格全屏乐器 + 现有岛屿列表。核心变化：
- 首页即合奏——一进来就能按键触发音效，不跳转单独页面
- 点击岛屿播放背景曲 = 自动开始录制（用户无感）
- 曲子播完/点停止 → 才提示"你的创作已记录，24h 可铸造"
- 铸造才需要登录，不铸造不登录完全 OK
- Patatap 参考代码：`references/patatap/`（从 Downloads 搬入）
- `feat/phase2-frontend` 分支有旧 B0 代码（`/jam/[trackId]` 路由方案），需重写
- 共享类型：`src/types/jam.ts`（API 命名仍冻结）
- 关键决策：Arweave 后移 Phase 3 / 草稿私有预览 / 录制上限 60s+500 事件
- 合约地址（Phase 1）：`0x99F808bdE8E92f167830E4b9C62f92b81c664b7C`
- API route 放在 `app/api/`；npm 用 `--legacy-peer-deps`；`@/*` 映射项目根
- Foundry 在 `C:\foundry`
- **globals.css 已配白名单扫描**（`source(none)` + `@source`），因 `.claude/logs/` Windows 路径触发 Tailwind v4 bug
- **Cursor 会执行 `git checkout` 还原未提交文件**，修改 globals.css 后必须立即 commit
- globals.css 回写问题尚未彻底确认根因（ProcMon 监控中），每个 phase 结束时复查
- 延后项：`reviews/phase-0-deferred.md` + `reviews/phase-1-deferred.md`

测试钱包地址：`0x306D3A445b1fc7a789639fa9115e308a34231633`（OP Sepolia 已领 faucet）

## 上次成功验证

- 验证内容: Phase 2 全流程 — 音效 + 录制 + 爱心收藏 + 铸造上链 + 草稿 + /me
- 验证时间: 2026-04-10
- 验证方式: 浏览器 7 项清单全部通过 + cron 手动触发上链成功
- 通过的 commit: `8fbc7ca`（C4 修复）

## 当前阻塞

- 无（globals.css 已有 workaround，持续监控中）

## 备注（AI 写给下次会话的自己）

- 项目命名：仓库 `ripples-in-the-pond` / 代号 `ripples-in-the-pond` / 产品名 `Ripples in the Pond`（本地文件夹仍是 `nft-music`，历史遗留）
- **链：OP Mainnet（生产）/ OP Sepolia（测试）**——不用 ETH L1，详见 ARCHITECTURE.md 决策 3
- Next.js 16.1.6 + React 19；ARCHITECTURE.md 已同步
- Windows 环境，hooks 用 Git Bash 跑
- 学习模式: slow mode（默认）
- 学习机制：SessionStart 注入 STATUS/TASKS，Stop 检查未提交改动，复述 1-3 行关键代码（AGENTS §4 第 4 步）
- 文件硬线 220 行 / 目录 8 文件；route.ts 放宽 270；`src/app/api/**` 整棵子树豁免目录限制
- 决策日志 `docs/JOURNAL.md` / 文档地图 `docs/INDEX.md`
