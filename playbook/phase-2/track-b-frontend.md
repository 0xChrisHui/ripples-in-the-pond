# Phase 2 Track B — 前端：合奏 UI + 录制 + 预览

> 🎯 **目标**：用户能在浏览器里用键盘和曲目合奏，看到视觉反馈，录制并回放
>
> **分支**：`feat/phase2-frontend`（worktree）
> **与 Track A 并行**，用假数据 / 本地音频开发
>
> **前置**：Step 0 spike 通过
>
> **适配层约定**：所有数据通过 `src/data/jam-source.ts` 获取，Track C 替换内部实现。

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| B0 | 合奏页骨架 + 键盘输入 + 数据适配层 | 按键有 console 输出 |
| B1 | 音效播放 + 背景混音 | 按键听到音效叠在背景曲上 |
| B2 | 视觉反馈（按键动画） | 按键看到彩色图形 |
| B3 | 录制逻辑 + 预览回放 | 录完能回放，节奏一致 |
| B4 | 完整 UI + 保存 + mobile 提示 | 完整合奏流程 |

---

## 数据适配层

```ts
// src/data/jam-source.ts — Track B 用假数据，Track C 换真实 API
export async function fetchSounds(): Promise<Sound[]> { ... }
export async function saveScore(token: string, data: SaveScoreRequest): Promise<SaveScoreResponse> { ... }
export async function fetchScorePreview(token: string, scoreId: string): Promise<ScorePreviewResponse | null> { ... }
```

---

# Step B0：合奏页骨架 + 键盘输入 + 适配层

## 📦 范围
- `app/jam/[trackId]/page.tsx`（新建）
- `src/hooks/useKeyboard.ts`（新建）
- `src/data/jam-source.ts`（新建，假数据）
- `src/data/mock-sounds.ts`（新建）

## 🚫 禁止
- 不调后端 API
- 不改 `app/page.tsx`（Track C 做）

## ✅ 完成标准
- /jam/xxx 页面显示曲目信息
- 按 A-Z 键 → console 输出按键
- 390px 宽度显示"请使用电脑键盘体验合奏"
- 深色背景

---

# Step B1：音效播放 + 背景混音

## 📦 范围
- `src/hooks/useJam.ts`（新建）
- 复用 `public/sounds/` 和 `public/tracks/001.mp3`

## ✅ 完成标准
- 进入合奏页 → 背景播放 track 原曲
- 按 A-Z → 对应音效叠加在背景上
- 多键同时按不冲突
- 延迟 < 50ms

---

# Step B2：视觉反馈

## 📦 范围
- `src/components/jam/KeyVisual.tsx`（新建）
- `src/components/jam/JamCanvas.tsx`（新建）
- CSS 动画

## 🚫 禁止
- 不用 Canvas API（DOM + CSS 先够用）
- 不用动画库

## ✅ 完成标准
- 按键 → 屏幕出现彩色图形并 0.5-1s 淡出
- 不同键不同颜色
- 快速连按 10 次不卡

---

# Step B3：录制 + 回放

## 📦 范围
- `src/hooks/useRecorder.ts`（新建）
- 时间基准用 `performance.now()`

## ✅ 完成标准
- 点击"开始" → 录制，显示计时（最长 60 秒自动停止）
- 按键记录为 `KeyEvent`（key + time + duration）
- 最多 500 个事件（超过自动停止）
- 点击"停止" → 结束
- 点击"回放" → 按时间戳重放音效 + 视觉，节奏一致

---

# Step B4：完整 UI + 保存 + mobile 提示

## 📦 范围
- `src/components/jam/JamControls.tsx`（新建）
- `app/jam/[trackId]/page.tsx`（完善）

## ✅ 完成标准
- 完整流程：开始 → 演奏 → 停止 → 回放 → 保存/重录
- 保存调适配层 `saveScore()`（假保存，显示"已保存"）
- 未登录点保存 → 提示登录
- mobile 宽度显示提示文字
- UI 深色统一

---

## Track B 完成后

1. `bash scripts/verify.sh` 全绿
2. 所有 step 已 commit
3. 通知 Track A
