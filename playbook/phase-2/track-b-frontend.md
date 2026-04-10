# Phase 2 Track B — 前端：首页融合乐器 + 录制 + 视觉

> 🎯 **目标**：首页变成全屏乐器 + 岛屿共存，按键有音效+视觉，播放即录制，录完提示
>
> **分支**：`feat/phase2-frontend`
> **与 Track A 并行**，用假数据 / 本地音频开发
>
> **前置**：Step 0 spike 通过 ✅
>
> **适配层约定**：所有数据通过 `src/data/jam-source.ts` 获取，Track C 替换内部实现。

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| B0 | 首页接入键盘 + 音效播放 | 按键听到音效 |
| B1 | 视觉反馈（按键动画） | 按键看到彩色图形淡出 |
| B2 | 录制逻辑（绑定播放生命周期） | 播放中按键被记录，停止后 console 输出事件 |
| B3 | 草稿存储 + 录制完成提示 | 录完后 localStorage 有数据，页面显示提示 |
| B4 | mobile 提示 + UI 打磨 | 390px 显示提示，整体体验流畅 |

---

# Step B0：HomeJam 组件 + 键盘音效播放

## 🎯 目标
做一个 `HomeJam` 组件，能按 A-Z 键触发音效（Web Audio）。Track C 负责接入首页。

## 📦 范围
- `src/components/jam/HomeJam.tsx`（新建，合奏主组件）
- `src/hooks/useKeyboard.ts`（从分支搬过来）
- `src/hooks/useJam.ts`（新建，音效播放引擎）
- `src/data/jam-source.ts`（从分支搬过来，mock 实现）
- `src/data/mock-sounds.ts`（从分支搬过来）
- `public/sounds/` 下放音效文件

## 🚫 禁止
- **不改 `app/page.tsx`**（Track C 负责接入）
- 不改 `PlayerProvider.tsx`（本步只叠加音效，不绑定录制）
- 不调后端 API

## ✅ 完成标准
- `HomeJam` 组件独立可渲染
- 按 A-Z → 听到对应音效
- 多键同时按不冲突
- 延迟 < 50ms

---

# Step B1：视觉反馈

## 📦 范围
- `src/components/jam/KeyVisual.tsx`（新建）
- `src/components/jam/HomeJam.tsx`（接入视觉组件）
- CSS 动画

## 🚫 禁止
- 不用 Canvas API（DOM + CSS 先够用）
- 不用动画库

## ✅ 完成标准
- 按键 → 屏幕出现彩色图形并 0.5-1s 淡出
- 不同键不同颜色
- 快速连按 10 次不卡
- 视觉反馈不遮挡岛屿

---

# Step B2：录制逻辑

## 📦 范围
- `src/hooks/useRecorder.ts`（新建）
- `src/components/player/PlayerProvider.tsx`（暴露 onPlayStart / onPlayEnd 事件）
- `src/components/jam/HomeJam.tsx`（接入录制 hook）

## ✅ 完成标准
- PlayerProvider 播放开始 → 自动开始录制（console 显示 "recording started"）
- 按键记录为 `KeyEvent`（key + time + duration），time 基于 `AudioContext.currentTime`（音频时钟）
- 最长 60 秒自动停止，最多 500 事件自动停止
- 曲子播完 / 点停止 → 录制结束（console 输出事件数组）
- 没播放背景曲时按键 → 不录制

---

# Step B3：草稿存储 + 录制完成提示

## 📦 范围
- `src/lib/draft-store.ts`（新建，localStorage 草稿管理）
- `src/components/jam/HomeJam.tsx`（录制完成提示 UI）

## ✅ 完成标准
- 录制结束 → 草稿自动存 localStorage（key: `ripples_drafts`）
- 草稿格式：`{ trackId, eventsData, createdAt }`（createdAt 为创作时间 ISO 字符串）
- 24h TTL 从 createdAt 算起，前端过期的不展示
- 页面显示提示："你的创作已记录，24h 内可收藏"
- 提示 3-5 秒后自动淡出
- 刷新页面后 localStorage 数据仍在

---

# Step B4：mobile 提示 + UI 打磨

## 📦 范围
- `src/components/jam/HomeJam.tsx`（mobile 检测 + 提示）
- 各组件 UI 微调

## ✅ 完成标准
- 390px 宽度显示"请使用电脑键盘体验合奏"
- 深色背景统一
- 岛屿 + 键盘音效 + 视觉反馈 + 录制提示整体协调
- 无 console 报错

---

## Track B 完成后

1. 类型检查通过
2. 所有 step 已 commit
3. 通知 Track A → 进入 Track C
