# 108 Cyber Records

> 一位艺术家用两年时间，将 108 首音乐逐周刻进区块链。
> 每位用户可与艺术家合奏，并将生成的音乐永久存储进自己的钱包。

代号：`nft-music`
产品名：`108 Cyber Records`

---

## 当前状态

📍 查看 [STATUS.md](./STATUS.md) — 当前做到哪、下一步是什么
📋 查看 [TASKS.md](./TASKS.md) — 任务看板

---

## 启动开发

```bash
# 1. 检查环境
bash scripts/doctor.sh

# 2. 启动 dev server
npm run dev

# 3. 打开浏览器
# http://localhost:3000
```

---

## 文档导航

**找文档的总入口：[`docs/INDEX.md`](./docs/INDEX.md)**（按需求查）

### 你（人类）需要读的

| 文件 | 什么时候读 |
|---|---|
| `STATUS.md` | 每次开始工作前 |
| `TASKS.md` | 每次开始工作前 |
| `playbook/phase-0-minimal.md` | 跟着做 Phase 0 时（📖 概念简报和 📝 复述问题段是给你的） |
| `docs/LEARNING.md` | 空闲时间，看新增的概念 |
| `docs/ERRORS.md` | 遇到报错时 |
| `docs/COMMANDS.md` | 不知道怎么敲命令时 |
| `docs/JOURNAL.md` | 想回看"为什么当时这么决定" |

### AI 自己会读的（你不用主动读）

| 文件 | 给谁 |
|---|---|
| `AGENTS.md` | AI 行为规则总入口 |
| `CLAUDE.md` | Claude Code 专用指针 |
| `docs/CONVENTIONS.md` | 代码规范 + 坏味道清单 |
| `docs/STACK.md` | 技术栈白名单 / 黑名单 |
| `docs/ARCHITECTURE.md` | 项目"形状和意图"（不是代码模板） |
| `docs/HARDENING.md` | 安全加固路线 |

---

## 协作模式

这个项目用 **双 AI 接力**：

```
Claude Code (主实现)  →  每 3-5 步暂停  →  Codex (独立审查)  →  回到 Claude
```

- **Claude Code**：负责日常实现、修 bug、推进 playbook
- **Codex**：负责定期 review 代码，输出到 `reviews/YYYY-MM-DD.md`

两个 AI 共享 `AGENTS.md` / `STATUS.md` / `TASKS.md` / `docs/`，但 `.claude/` 是 Claude 专属的强制保护层。

---

## 项目阶段

- **Phase 0**：1 天最小闭环（前端 → API → 队列 → 链上 1 笔 mint）⬅ 当前
- **Phase 1**：MVP 完整版（播放器 / 个人页 / 多岛屿）
- **Phase 2**：合奏 + 乐谱
- **Phase 3**：封面图 + 分享 + ScoreNFT
- **Phase 4**：社区钱包 + 空投
- **Phase 5**：OP Mainnet 上线

详见 `docs/ARCHITECTURE.md` §11。
