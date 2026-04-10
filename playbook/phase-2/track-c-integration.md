# Phase 2 Track C — 集成（纯接线，不新增后端 API）

> 🎯 **目标**：把 A 的 API 和 B 的 UI 接在一起，加爱心收藏 + 草稿管理 + 进度条
>
> **前置**：Track A + Track B 都完成
> **原则**：Track C 只做集成，不新增后端接口（所有 API 在 A 里完成）

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| C0 | merge Track B | verify 全绿 |
| C1 | 适配层切换 mock → 真实 API | 首页从 DB 读 sounds |
| C2 | 爱心收藏 + 登录流程 | 点爱心 → 登录 → localStorage 草稿上传 → 铸造 |
| C3 | 底部播放条进度条 + 草稿管理 | 进度可视 + /me 显示草稿倒计时 |
| C4 | e2e 验证 + merge 回 main | 完整流程跑通 |

---

# Step C0：merge Track B

## ✅ 完成标准
- merge 无报错
- 类型检查通过
- `npm run dev` 正常

---

# Step C1：适配层切换

## 📦 范围
- `src/data/jam-source.ts`（改内部实现）
- 可删除 `src/data/mock-sounds.ts`

## ✅ 完成标准
- 首页 sounds 从 /api/sounds 读
- 保存调真实 POST /api/score/save
- 预览从真实 GET /api/scores/[id]/preview 读

---

# Step C2：爱心收藏 + 登录流程（决策 16 状态机）

## 📦 范围
- `app/page.tsx`（接入 HomeJam 组件）
- `src/components/archipelago/Island.tsx`（加爱心按钮，去掉 MintButton）
- `src/components/MintButton.tsx`（删除或重构为收藏逻辑）

## ✅ 完成标准
- HomeJam 组件正确渲染在首页，与岛屿共存
- 岛屿上方显示爱心图标
- 点击爱心 → 未登录触发 Privy 登录
- 登录成功 → 静默完成：铸造素材 NFT + 上传 localStorage 草稿（如有）→ "收藏成功"
- 无草稿时点爱心 → 只铸造素材 NFT，不报错
- 铸造失败 → 爱心回到未选中 + 提示"收藏失败，请重试"
- 草稿上传失败 → 素材仍铸造成功，草稿留 localStorage 等下次

---

# Step C3：底部播放条进度条 + 草稿管理

## 📦 范围
- `src/components/player/BottomPlayer.tsx`（加进度条）
- `app/me/page.tsx`（加草稿区域）
- `src/components/me/DraftCard.tsx`（新建）

## ✅ 完成标准
- 播放条显示进度条（当前时间 / 总时长）
- /me 两个区域："我的收藏"（素材 NFT）+ "我的创作"（草稿 + 倒计时）
- 登录后进入 /me 时，自动把 localStorage 未过期草稿补上传到后端
- 每个草稿：曲目名 + 剩余时间倒计时（从 createdAt 算起）
- 过期不显示

---

# Step C4：e2e + merge 回 main

## ✅ 完成标准
完整流程：
1. 首页 → 按键有音效 + 视觉反馈
2. 点击岛屿 → 背景音乐播放 + 自动录制
3. 演奏中按键 → 音效叠加 + 视觉反馈
4. 曲子播完 / 点停止 → 提示"已记录"
5. 点爱心 → 登录 → 草稿上传 → 铸造成功
6. /me 看到收藏 + 草稿倒计时
7. Phase 1 素材铸造仍然正常工作

- STATUS.md / TASKS.md 更新
- merge 回 main
