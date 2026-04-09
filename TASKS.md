# TASKS — 任务看板

> Now / Next / Later / Done / Blocked
> 一次只允许 1 件事在 Now，AI 完成一件就移到 Done 并提拔下一件到 Now。

---

## 🎯 Now（最多 1 件，AI 正在做的）

- （空，等用户发起下一步）

---

## ⏭ Next（接下来 1-3 件）

- **[Phase 0 Step 3]** Privy 登录（拿到 evm_address）
- **[Phase 0 Step 4]** Supabase 建 2 张表（users, mint_queue），用 Dashboard 手动

---

## 📅 Later（Phase 0 剩余）

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
- **[Day 1 续]** 学习机制补丁：SessionStart hook + Stop hook + QUICKSTART.md + check-folder-size 加项目根例外
- **[Day 1 续 2]** 决策日志机制：新建 docs/JOURNAL.md + AGENTS §4 第 4 步追加规则
- **[Day 2 大整修]**（commit `e6da1b1` / `0576d81` / `1f13aac`）
  - ARCH 从 782 行压缩到 410 行 + 12 条核心架构决策 + AI 编码约定安全网
  - 新增决策 13：Score Decoder 是 Phase 3 核心组件（用户原话"网页唱片机"已抄进 ARCH）
  - **全面切到 Optimism**：链 11155111 (Sepolia) → 11155420 (OP Sepolia)，单笔成本 ~$0.78 → < $0.01（用户实测），$500 预算从 ~577 张提升到 50000+ 张
  - 删 daily mint limit + gas price guard（OP 上不需要），保留 allowlist + balance alert
  - playbook 从 768 行压缩到 496 行 + Step 5 改用 OZ 现成合约 + 中场休息点
  - hook 修 grep 误判 + ESLint 隐藏地雷 + 220 行硬线 + route.ts 270 + api/** 子树豁免
  - AGENTS 加 3 名映射 + 越界停 + 复述代码规则
  - 新增 INDEX.md / PROMPT-TEMPLATE.md / learn.sh
- **[Phase 0 Step 0]** ✅ 完成（2026-04-09）— 项目改名 Ripples in the Pond + GitHub rename + 3 外部账号注册 + .env.local 10 key 填齐 + 测试钱包生成并领 OP Sepolia faucet + doctor.sh 26 ✅ / 2 ⚠（Foundry）/ 0 ❌ + checkpoint `checkpoint/2026-04-09-1226`
- **[Phase 0 Step 1]** ✅ 完成（2026-04-09）— 全屏黑底 + 中央白字 "Ripples in the Pond"，commit `6523c60`
- **[Phase 0 Step 2]** ✅ 完成（2026-04-09）— 呼吸圆 Island + useAudioPlayer hook + 点击播放/停止 mp3，commit `eb1d7fb`

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
