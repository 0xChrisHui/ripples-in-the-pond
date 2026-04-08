# TASKS — 任务看板

> Now / Next / Later / Done / Blocked
> 一次只允许 1 件事在 Now，AI 完成一件就移到 Done 并提拔下一件到 Now。

---

## 🎯 Now（最多 1 件，AI 正在做的）

- **[Phase 0 Step 0]** 跑 `scripts/doctor.sh` 检查环境

---

## ⏭ Next（接下来 1-3 件）

- **[Phase 0 Step 1]** Next.js 项目初始化 + 深色首页（项目已经初始化过，只需调整首页背景）
- **[Phase 0 Step 2]** Island 组件（呼吸圆）+ 点击播放本地 mp3
- **[Phase 0 Step 3]** Privy 登录（拿到 evm_address）

---

## 📅 Later（Phase 0 剩余）

- **[Phase 0 Step 4]** Supabase 建 2 张表（users, mint_queue），用 Dashboard 手动
- **[Phase 0 Step 5]** MaterialNFT 合约部署到 OP Sepolia（用 OZ 现成合约）
- **[Phase 0 Step 6]** POST /api/mint/material（写队列 + 立即返回）
- **[Phase 0 Step 7]** 手动触发 cron 端点
- **[Phase 0 Step 8]** OP Sepolia Etherscan 看到 tx → 🎉

---

## 🚧 Blocked

- 无

---

## ✅ Done

- **[Day 1]** 文档骨架首版：13 markdown（含 1 个 phase-0 playbook）+ 3 hooks + 3 scripts
- **[Day 1 续]** 学习机制补丁：SessionStart hook（自动注入 STATUS/TASKS）+ Stop hook（未提交改动自检清单）+ QUICKSTART.md + check-folder-size 加项目根例外

---

## 📝 任务格式说明

每个任务理想格式（参考 `playbook/phase-0-minimal.md` 里完整版）：

```
[Phase X Step N] 一句话目标
- 范围: 允许改的文件
- 禁止: 不能碰的文件
- 完成标准: 看到什么算成功
- 验证命令: 怎么验证
- 回滚点: 失败时回到哪
```

简短任务可以只写一行目标。
