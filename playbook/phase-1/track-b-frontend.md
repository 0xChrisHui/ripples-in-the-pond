# Phase 1 Track B — 前端体验

> 🎯 **目标**：首页从"技术 demo"变成"有氛围感的作品入口"，加底部播放条和个人页骨架
>
> **分支**：`feat/phase1-frontend`（worktree `../nft-music-frontend`）
>
> **与 Track A 并行**，用假数据开发，不依赖后端 API
>
> **关键约定**：页面不直接 import mock 文件，而是通过薄适配函数获取数据。
> Track C 只需替换适配函数内部实现（mock → fetch），页面组件不改。

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| B0 | 首页改版：岛屿列表 + 引导文字 | 浏览器看到多个岛屿 |
| B1 | 底部播放条（全局固定） | 点击岛屿 → 底部出现播放条 |
| B2 | 个人页 UI 骨架 | 访问 /me 看到布局 |

---

## 数据适配层约定

Track B 所有数据消费都通过 `src/data/` 下的适配函数，不直接在组件里 hardcode：

```ts
// src/data/tracks-source.ts
// Phase 1 Track B: 返回假数据
// Track C 替换为: fetch('/api/tracks').then(r => r.json())
export async function fetchTracks(): Promise<Track[]> { ... }
export async function fetchTrackById(id: string): Promise<Track | null> { ... }

// src/data/nfts-source.ts
export async function fetchMyNFTs(): Promise<OwnedNFT[]> { ... }
```

这样 Track C 集成时是"替换函数体"，不是"重写页面"。

---

# Step B0：首页改版 — 岛屿列表 + 引导文字

## 🎯 目标
首页从"单个呼吸圆"变成"多个岛屿"。用假数据（3-5 条 track）。首次访问有引导文字。

## 📦 范围
- `src/data/tracks-source.ts`（新建，假数据适配层）
- `src/data/mock-tracks.ts`（新建，假数据）
- `src/components/archipelago/Archipelago.tsx`（新建，岛屿列表容器）
- `src/components/archipelago/Island.tsx`（改造，接收 track prop）
- `app/page.tsx`（改造）

## 🚫 禁止
- 不调后端 API（通过 tracks-source.ts 吃假数据）
- 不引入 framer-motion（用 Tailwind animate + CSS transition）
- 不做路由跳转（先单页）

## ✅ 完成标准
- 首页显示 3-5 个岛屿，每个有标题和颜色
- 有一行引导文字（"点击岛屿，聆听音乐"）
- 点击岛屿能播放对应音频（复用 useAudioPlayer）
- 深色背景，有群岛氛围感
- 控制台 0 报错

## ⏪ 回滚点
```bash
git checkout HEAD -- src/ app/
```

---

# Step B1：底部播放条

## 🎯 目标
全局固定底部播放条。点击岛屿后出现，显示当前曲目 + 播放/暂停。切页不中断。

## 📦 范围
- `src/components/player/BottomPlayer.tsx`（新建）
- `src/components/player/PlayerProvider.tsx`（新建，音频状态 Context）
- `src/hooks/useAudioPlayer.ts`（改造，支持全局状态）
- `app/layout.tsx`（修改，加入 PlayerProvider + BottomPlayer）

## 🚫 禁止
- 不引入音频库（继续用 Web Audio API）
- 不做播放列表 / 上下曲（Phase 2）
- 不做进度条拖拽

## ✅ 完成标准
- 点击岛屿 → 底部出现播放条，显示曲目名
- 播放/暂停按钮可切换
- 点击另一个岛屿 → 切歌，播放条更新
- 没播放时播放条隐藏
- 深色风格统一

## ⏪ 回滚点
```bash
git checkout HEAD -- src/ app/
```

---

# Step B2：个人页 UI 骨架

## 🎯 目标
新建 /me 页面，通过 nfts-source.ts 吃假数据渲染。Track C 替换为真实 API。

## 📦 范围
- `src/data/nfts-source.ts`（新建，假数据适配层）
- `src/data/mock-nfts.ts`（新建，假数据）
- `app/me/page.tsx`（新建）
- `src/components/me/NFTCard.tsx`（新建）
- `src/components/me/EmptyState.tsx`（新建）
- LoginButton 或 layout 加一个跳转 /me 的入口

## 🚫 禁止
- 不调后端 API（通过 nfts-source.ts 吃假数据）
- 不做 NFT 详情弹窗（Phase 2）

## ✅ 完成标准
- 登录后右上角能跳转到 /me
- /me 显示 NFT 卡片列表（假数据 2-3 条）
- 每张卡片显示 track 名称 + 铸造时间
- 无 NFT 时显示 EmptyState
- 未登录访问 /me 提示登录

## ⏪ 回滚点
```bash
git checkout HEAD -- src/ app/
```

---

## Track B 完成后

1. 确认 `bash scripts/verify.sh` 全绿
2. 所有 step 已 commit
3. 通知 Track A："TB 完成，可以 merge"
