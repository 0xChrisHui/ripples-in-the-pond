# Phase 1 Track C — 集成线

> 🎯 **目标**：把 Track A 的 API 和 Track B 的 UI 接在一起，完成 MVP 全流程
>
> **前置**：Track A + Track B 都完成并 merge
>
> **分支**：在 `feat/phase1-backend` 上继续（已 merge 了 frontend）

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| C0 | merge Track B + 解决冲突 | verify.sh 全绿 + npm run dev 正常 |
| C1 | 适配层切换：mock → 真实 API | 首页从数据库读 tracks |
| C2 | 铸造按钮接入前端 | 点击 → mint_queue 出现记录 |
| C3 | 个人页接入真实数据 | 登录后看到已铸造 NFT |
| C4 | 端到端验证 + merge 回 main | 完整流程跑通 |

---

# Step C0：merge Track B + 解决冲突

## 🎯 目标
合并前端分支，确保两条线的代码在一起能跑。

## 📦 范围
- `git merge feat/phase1-frontend`
- 解决冲突（预期：`app/page.tsx`、`app/layout.tsx`、`useAudioPlayer.ts` 可能冲突）

## ✅ 完成标准
- merge 完成
- `bash scripts/verify.sh` 全绿
- `npm run dev` 正常，首页能看到 TB 的岛屿列表 + 播放条

---

# Step C1：适配层切换 mock → 真实 API

## 🎯 目标
把 Track B 的假数据替换为 Track A 的真实 API。只改适配函数内部，不改页面组件。

## 📦 范围
- `src/data/tracks-source.ts`（改内部实现：mock → fetch /api/tracks）
- `src/data/nfts-source.ts`（改内部实现：mock → fetch /api/me/nfts）
- 可删除 `src/data/mock-tracks.ts` 和 `src/data/mock-nfts.ts`

## ✅ 完成标准
- 首页岛屿列表从数据库读取（Dashboard 改 track 标题 → 刷新页面能看到）
- 个人页从 API 读取
- 控制台 0 报错

---

# Step C2：铸造按钮接入前端

## 🎯 目标
岛屿或 track 详情旁加铸造按钮，点击调 POST /api/mint/material，显示状态反馈。

## 📦 范围
- `src/components/MintButton.tsx`（新建）
- `src/hooks/useMint.ts`（新建）
- 页面组件接入 MintButton

## 🚫 禁止
- 不在前端调合约

## ✅ 完成标准
- 登录后看到"铸造"按钮
- 点击 → "铸造中…" → "已铸造"
- mint_queue 出现 pending 记录
- 未登录时提示登录

---

# Step C3：个人页接入真实数据

## 🎯 目标
C1 已切换适配层，这一步确认个人页完整可用。

## 📦 范围
- 可能微调 NFTCard 组件（字段映射）
- 确认 pending 状态显示"铸造中"
- 确认空状态正常

## ✅ 完成标准
- 铸造后刷新 /me 看到新 NFT
- 每条显示 track 名称 + Etherscan tx 链接
- pending 显示"铸造中"
- 空状态有提示

---

# Step C4：端到端验证 + merge 回 main

## 🎯 目标
跑完整用户流程，确认 MVP 可用，merge 回 main。

## 📦 范围
- 不写代码
- 跑完整流程
- 更新 STATUS.md / TASKS.md
- `git checkout main && git merge feat/phase1-backend`

## ✅ 完成标准
- 完整流程：登录 → 浏览 tracks → 播放 → 铸造 → cron 上链 → 个人页看到 NFT
- Etherscan 看到新 mint tx
- `bash scripts/verify.sh` 全绿
- STATUS.md 标记 Phase 1 完成
- main 分支包含所有改动
