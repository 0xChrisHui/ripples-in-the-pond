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

# Step C2：爱心收藏 + 登录流程

## 📦 范围
- `src/components/archipelago/Island.tsx`（加爱心按钮，去掉 MintButton）
- `src/components/MintButton.tsx`（删除或重构为收藏逻辑）

## ✅ 完成标准
- 岛屿上方显示爱心图标
- 点击爱心 → 变红
- 未登录 → 触发 Privy 登录
- 登录成功 → 自动从 localStorage 取草稿 → 上传后端 → 触发铸造
- 无草稿时点爱心 → 提示"先演奏一段再收藏"

---

# Step C3：底部播放条进度条 + 草稿管理

## 📦 范围
- `src/components/player/BottomPlayer.tsx`（加进度条）
- `app/me/page.tsx`（加草稿区域）
- `src/components/me/DraftCard.tsx`（新建）

## ✅ 完成标准
- 播放条显示进度条（当前时间 / 总时长）
- /me 显示"我的草稿"区域
- 每个草稿：曲目名 + 剩余时间倒计时
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
