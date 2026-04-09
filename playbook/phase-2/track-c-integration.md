# Phase 2 Track C — 集成（纯接线，不新增后端 API）

> 🎯 **目标**：把 A 的 API 和 B 的 UI 接在一起，加首页入口 + 草稿管理
>
> **前置**：Track A + Track B 都完成
> **原则**：Track C 只做集成，不新增后端接口（所有 API 在 A 里完成）

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| C0 | merge Track B | verify 全绿 |
| C1 | 适配层切换 mock → 真实 API | 合奏页从 DB 读 sounds |
| C2 | 首页加"合奏"入口 | 岛屿能进合奏页 |
| C3 | 个人页加草稿列表 + 倒计时 | /me 看到草稿 |
| C4 | e2e 验证 + merge 回 main | 完整流程跑通 |

---

# Step C0：merge Track B

## ✅ 完成标准
- merge 无报错（B 只新建文件，预期零冲突）
- `bash scripts/verify.sh` 全绿
- `npm run dev` 正常

---

# Step C1：适配层切换

## 📦 范围
- `src/data/jam-source.ts`（改内部实现）
- 可删除 `src/data/mock-sounds.ts`

## ✅ 完成标准
- 合奏页 sounds 从 /api/sounds 读
- 保存调真实 POST /api/score/save
- 预览从真实 GET /api/scores/[id]/preview 读

---

# Step C2：首页加"合奏"入口

## 📦 范围
- `src/components/archipelago/Island.tsx`（加合奏链接）

## ✅ 完成标准
- 每个岛屿有"合奏"链接，点击跳转 /jam/[trackId]
- 未登录也能进合奏页（保存时才要求登录）

---

# Step C3：个人页草稿列表

## 📦 范围
- `app/me/page.tsx`（修改，加草稿区域）
- `src/components/me/DraftCard.tsx`（新建）

## ✅ 完成标准
- /me 显示"我的草稿"区域
- 每个草稿：曲目名 + 剩余时间倒计时
- 点击草稿 → 跳转 /jam/[trackId]
- 过期不显示

---

# Step C4：e2e + merge 回 main

## ✅ 完成标准
完整流程：
1. 首页 → 点击岛屿播放
2. 点"合奏" → /jam/[trackId]
3. 背景音乐 + 键盘演奏 + 视觉反馈
4. 录制 → 停止 → 回放
5. 保存 → 个人页看到草稿 + 倒计时
6. 铸造素材仍然正常工作

- STATUS.md / TASKS.md 更新
- `git checkout main && git merge feat/phase2-backend`
