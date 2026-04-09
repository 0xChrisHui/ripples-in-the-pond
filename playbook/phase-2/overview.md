# Phase 2 — 合奏 + 草稿系统

> 🎯 **目标**：用户能和曲目合奏、录制、保存草稿（24h）、预览回放
>
> 🚫 **不包含**：乐谱 NFT 铸造（Phase 3）/ Arweave 正式上传（Phase 3）/ AI remix / 社区钱包
>
> ✅ **完成标准**：首页 → 合奏 → 键盘演奏 + 视觉 → 录制 → 回放 → 保存草稿 → 个人页倒计时

---

## 关键决策

1. **Arweave 不在 Phase 2 主线** — 本轮用本地音频，Arweave 预上传后移到 Phase 3
2. **草稿预览策略：私有** — 只有本人能预览自己的草稿
3. **移动端策略** — 390px 宽度显示"请使用电脑键盘"提示，触控合奏后移
4. **录制上限** — 最长 60 秒，最多 500 事件，body < 100KB
5. **`pending_scores` 是状态机表** — status: draft/expired，禁止 DELETE（CONVENTIONS §3.1）

## 开发策略

```
Step 0 (Gate): 真实音频验证 — 串行，全部通过才分线
    ↓
Track A: ██████████████──┐  后端（sounds 表 + 草稿 API + /me 状态）
Track B: ██████████──────┤  前端（合奏 UI + 录制 + 回放）
                         ↓
Track C:                 ████████  集成（纯接线，不新增 API）
```

## 文件 ownership

| 归属 | 文件 |
|---|---|
| 只有 A | `supabase/` `app/api/**` `src/lib/` `src/types/`（类型变更需对齐） |
| 只有 B | `src/components/jam/**` `src/hooks/useJam.ts` `src/hooks/useRecorder.ts` `src/hooks/useKeyboard.ts` `app/jam/**` `src/data/jam-source.ts` `src/data/mock-sounds.ts` |
| 只有 C | `app/page.tsx` `src/components/archipelago/Island.tsx`（加合奏入口） `app/me/page.tsx`（加草稿区域） |

## 冻结的契约

- API 命名：见 `src/types/jam.ts` 文件头注释
- 数据适配层：`src/data/jam-source.ts`（函数签名冻结，内部实现 B 用 mock，C 换 fetch）
- 草稿预览权限：私有（只有本人）
