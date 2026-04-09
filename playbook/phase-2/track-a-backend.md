# Phase 2 Track A — 后端：sounds + 草稿 API

> 🎯 **目标**：建好合奏所需的数据层 + 草稿保存/预览/列表 API
>
> **分支**：`feat/phase2-backend`
> **与 Track B 并行**
>
> **Arweave 不在 Phase 2 主线**：本轮用本地音频，Arweave 预上传后移到 Phase 3

---

## 🗺 总览

| Step | 做什么 | 验证 |
|---|---|---|
| A0 | sounds + pending_scores（含 status）表 | Dashboard 看到表 |
| A1 | sounds 种子数据 + GET /api/sounds | curl 返回 26 条 |
| A2 | POST /api/score/save（草稿保存 + 资源上限） | curl 返回 scoreId |
| A3 | GET /api/scores/[id]/preview（私有预览） | curl 返回草稿数据 |
| A4 | GET /api/me/scores（我的草稿列表） | curl 返回列表 |
| A5 | /me 展示 pending/failed 铸造状态（Phase 1 延后项） | 个人页有完整状态 |

---

# Step A0：sounds + pending_scores 表

## 🎯 目标
新增 2 张表。`pending_scores` 是状态机表（遵守 CONVENTIONS §3.1 禁止 DELETE 规则）。

## 📦 范围
- `supabase/migrations/005_sounds_and_pending_scores.sql`

## ✅ 完成标准
- `sounds` 表：token_id (109-134), name, audio_url, duration_ms, category, key
- `pending_scores` 表：id, user_id, track_id, events_data (jsonb), **status** (draft/expired), created_at, **updated_at**, expires_at
- `pending_scores` 有 unique 约束：同一 user_id + track_id + status='draft' 只允许一条

---

# Step A1：sounds 种子数据 + GET /api/sounds

## 🎯 目标
填入 26 个音效，写正式的列表 API。

## 📦 范围
- `supabase/seeds/sounds.sql`
- `app/api/sounds/route.ts`（新建）
- `public/sounds/` 下放 26 个短音效 mp3

## ✅ 完成标准
- Dashboard sounds 表有 26 条记录，每条有 key (a-z)
- `GET /api/sounds` 返回 `SoundsListResponse`
- 不需要登录

---

# Step A2：POST /api/score/save

## 🎯 目标
保存合奏草稿。同一用户对同一 track 只保留最新草稿（upsert）。

## 📦 范围
- `app/api/score/save/route.ts`（新建）

## 🚫 禁止
- 不上传 Arweave
- 不铸造 NFT

## ✅ 完成标准
- 必须登录
- body: `SaveScoreRequest`
- **资源上限**：
  - eventsData 最大 500 条事件
  - 单条 time 必须 >= 0 且 <= 60000（60 秒）
  - 单条 duration 必须 >= 0 且 <= 5000
  - body 总大小 < 100KB
  - 非法数据返回 400
- 同一 user+track 已有 draft → 旧的 status 改为 'expired'，插入新的
- 返回 `SaveScoreResponse`

---

# Step A3：GET /api/scores/[id]/preview

## 🎯 目标
返回草稿数据供回放。**私有预览：只有本人能看**。

## 📦 范围
- `app/api/scores/[id]/preview/route.ts`（新建）

## ✅ 完成标准
- 必须登录
- 只返回本人的草稿
- 过期草稿（status='expired'）返回 404
- 返回 `ScorePreviewResponse`

---

# Step A4：GET /api/me/scores

## 🎯 目标
返回当前用户的未过期草稿列表，个人页草稿区域消费。

## 📦 范围
- `app/api/me/scores/route.ts`（新建）

## ✅ 完成标准
- 必须登录
- 只返回 status='draft' 且 expires_at > now() 的记录
- 返回 `MyScoresResponse`

---

# Step A5：/me 展示 pending/failed 铸造状态

## 📦 范围
- `app/api/me/nfts/route.ts`（修改）
- `src/types/tracks.ts`（OwnedNFT 加 status 字段）

## ✅ 完成标准
- 个人页 NFT 卡片显示 pending → "铸造中"
- failed → "铸造失败"
- success → 不变

---

## Track A 完成后

1. `bash scripts/verify.sh` 全绿
2. 所有 step 已 commit
3. 等 Track B 完成 → Track C
