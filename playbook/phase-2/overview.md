# Phase 2 — 首页融合合奏 + 草稿系统

> 🎯 **目标**：首页即乐器 + 岛屿群共存，用户按键合奏，播放即录制，收藏即铸造
>
> 🚫 **不包含**：乐谱 NFT 铸造合约（Phase 3）/ Arweave 正式上传（Phase 3）/ AI remix / 社区钱包
>
> ✅ **完成标准**：首页按键有音效+视觉 → 点岛屿播放 → 自动录制 → 播完提示 → 爱心收藏 → 个人页看到

---

## 关键决策

1. **首页即乐器**（ARCH 决策 14）— 不跳转，Patatap 风格融合
2. **无感录制**（ARCH 决策 15）— 播放背景曲 = 自动开始录制
3. **收藏 = 铸造**（ARCH 决策 16）— 爱心按钮，用户不需要理解"铸造"
4. **草稿存 localStorage**（ARCH 决策 17）— 不需要登录，登录后上传
5. **Arweave 不在 Phase 2 主线** — 本轮用本地音频
6. **录制上限** — 最长 60 秒，最多 500 事件，body < 100KB
7. **参考实现** — `references/patatap/`

## 开发策略

```
Track A: ████████████────┐  后端（sounds API + 草稿 API）
Track B: ████████████────┤  前端（首页融合乐器 + 录制 + 视觉）
                         ↓
Track C:                 ████████  集成（适配层切换 + 草稿管理 + e2e）
```

Track A 和 Track B 并行开发。B 用假数据，C 换真实 API。

## 文件 ownership

| 归属 | 文件 |
|---|---|
| 只有 A | `supabase/` `app/api/**` `src/lib/` `src/types/`（类型变更需对齐） |
| 只有 B | `src/components/jam/**`（HomeJam + KeyVisual）`src/hooks/useJam.ts` `src/hooks/useRecorder.ts` `src/hooks/useKeyboard.ts` `src/data/jam-source.ts` `src/data/mock-sounds.ts` `src/lib/draft-store.ts` |
| 只有 C | `app/page.tsx`（接入 HomeJam）`src/components/archipelago/Island.tsx`（爱心收藏）`app/me/page.tsx`（草稿区域）`src/components/player/BottomPlayer.tsx`（进度条）`src/data/jam-source.ts`（切换实现） |
| 共享 | `src/components/player/PlayerProvider.tsx`（B 加录制生命周期，C 可调整） |

**注意**：Track B **不碰** `app/page.tsx`。B 做 `src/components/jam/HomeJam.tsx` 组件，C 负责接入首页。

## 冻结的契约

- API 命名：见 `src/types/jam.ts` 文件头注释
- 数据适配层：`src/data/jam-source.ts`（函数签名冻结，内部实现 B 用 mock，C 换 fetch）
- 草稿预览权限：私有（只有本人）
- localStorage key：`ripples_drafts`（draft-store.ts 管理）
- 24h TTL 从 `createdAt`（创作时间）算起，不是上传时间
- 录制时间基准：`AudioContext.currentTime`（音频时钟，非 performance.now()）
- 移动端策略：Phase 2 = 仅浏览不可演奏，触控合奏后移
