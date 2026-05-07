# Track B — UI 收口 + 端到端验证

> **范围（v2 缩减后）**：NFT cache 用户隔离 + /me /score /artist 小修 + 草稿铸造按钮 +
> 音频叠加修复 + 前端韧性 + 主页 5 球 demo + 端到端冒烟跑通
>
> **前置**：B3 依赖 Track A1（ScoreNFT cron 四连）+ A0（operator 锁）；其他 step 无前置
>
> **对应 findings**：#2 #7 #8 #9 #23 #29
>
> **核心交付物**：端到端跑通 + 紧急 bug 修复 + A 界面 demo 简化（深度 UI 重设计推迟 P7）

---

## v2 缩减说明（2026-05-03）

原 v1 含 13 个 step（含 B2.0-B2.5 整条 Claude Design UI 重设计流水线 / 4 页深度重设计 / 跨浏览器截图验收）。

基于 2026-05-03 用户决策：

- **投资人只看链上技术**，不看 UI → P6 不需要"可以给外人看"的视觉门槛
- **艺术家反馈集中在主页**（漂浮液态感 / 动态 / 音阶 / 按键动画）→ 全部迁 P7 处理
- **/me /score /artist** 三个页面 P6 只小修 + 修 bug，深度重设计迁 P7
- **端到端跑通**优先于视觉打磨

**v2 step 数**：13 → 7
**迁 P7 的工作**：B2.0 / B2.0.5 / B2.0.7 / B2.1 / B2.2 / B2.3 / B2.4 / B2.4.5 / B2.5（全部废弃）
**新增**：B6（A 组 5 球 demo）+ B7（端到端冒烟）

---

## 冻结决策

### D-B1 — UI 重设计深度版迁 P7（取代原 D-B1）

P6 不做 UI 重设计深度版。/me /score /artist 只修 bug + 小视觉调整。
原 B2.x 流水线（含 Claude Design 接入）全部废弃，迁 P7。

### D-B2 — 非 UI 收口的前端 bug 可立即开工（保留原 D-B2）

B1 / B3 / B5 / B6 / B7 与"等 stakeholder 反馈"无关，可立即开工。

### D-B3 — B3 草稿铸造按钮有硬前置（保留原 D-B3）

B3 接通草稿铸造前必须完成 Track A0（operator 锁）+ A1（ScoreNFT cron 四连）。
否则踩到双 mint / 孤儿 NFT / 覆盖 metadata 等 P0。

### D-B4 — 端到端冒烟优先于视觉优化

Phase 6 完结的 gate 是"所有功能端到端跑通"，不是"视觉打磨完美"。
B7 产出的 bug 清单是 Phase 6 completion review 的强制输入。

### D-B5 — B7 放最后做（2026-05-04 推翻原 v2 序列）

原 v2 把 B7 放第 2 步驱动 B2 修复。复盘后改放最后：
- /me 2 个已知 bug 用户已经知道，不需要 B7 发现（B2 直接修）
- 中间 B7 的 bug 清单会被 B2/B3/B5/A 后续修复过期（"测-修-重测"循环）
- 放最后一次性覆盖所有功能（含 B3 草稿铸造 + Track A 改动），直接进 completion review

---

## 📋 Step 总览

| Step | Findings | 内容 | 工作量 | 依赖 |
|---|---|---|---|---|
| [B1](#step-b1--nft-localstorage-按用户隔离) | #2 | NFT cache key 加 user_id 命名空间 | 30 分 | ✅ 已完成 |
| [B2](#step-b2--me-score-artist-小修--bug-清扫) | — | /me /score /artist 小修 + bug 清扫 | 1-2 天 | B7 产出的 bug 清单 |
| [B3](#step-b3--接通草稿铸造按钮) | #23 | DraftCard 加铸造按钮 + jam-source mintScore | 半天 | **A0 + A1** |
| [B5](#step-b5--前端韧性3-项打包) | #7 #8 #9 | tracks ISR + 移动端首帧 + localStorage 恢复 | 半天 | 无 |
| [**B6**](#step-b6--a-组-5-球简化--音乐圆圈数字代号) | — | A 组 5 球简化 + 音乐圆圈数字代号 + B/C 36 球 demo | 1-2 小时（含用户操作 + Vercel 部署） | 无 |
| [**B7**](#step-b7--端到端冒烟--bug-清单产出) | — | 端到端冒烟 + bug 清单产出 | 半天-1天 | **放最后**（依赖 B2/B3/B5 + Track A 全部完成；2026-05-04 调整）|

---

## Step B1 — NFT localStorage 按用户隔离

### 概念简报

`ripples_minted_token_ids` / `ripples_cached_nfts` 是浏览器全局 key。共享浏览器 / 多账号切换时新用户看到旧用户的红心和 NFT 缓存 → 资产错乱感。

### 📦 范围
- `src/lib/nft-cache.ts`
- `src/components/archipelago/Archipelago.tsx`
- `app/me/page.tsx`
- `src/hooks/useAuth.ts`（logout 挂钩清缓存）

### 做什么

所有 localStorage key 加 user_id 前缀；logout 时清当前 user 的 key（不清其他 user，便于重登恢复）。

### 验证标准

- [x] 用户 A 登录收藏 → 登出 → B 登录 → /me 不显示 A 的 NFT
- [x] A 重登 → 仍看得到（不清，只隔离）
- [x] `scripts/verify.sh` 通过

**已完成**：commit `c749b67`（2026-04-26）

---

## Step B2 — /me /score /artist 小修 + bug 清扫

### 概念简报

P6 范围内对 /me /score /artist 三个页面只做"小修 + bug 清扫"，不做深度重设计（迁 P7）。

输入来自两处：
1. **B7 端到端冒烟产出的 bug 清单**（系统输入）
2. **用户已知的 2 个 /me bug**（直接输入）：
   - 录制音频一直显示"上传中"卡住
   - 完全铸造专辑一直不更新

### 📦 范围
- `app/me/page.tsx`
- `src/components/me/*`
- `src/data/jam-source.ts`（如涉及录制 / 铸造状态同步）
- `app/score/[tokenId]/page.tsx`
- `app/artist/page.tsx`

### 做什么

1. **加 debug 日志**给 /me 关键流程（录制保存 / 上传 Arweave / mint_queue 状态拉取），定位 2 个已知 bug 根因
2. 跟着 B7 输出的 bug 清单逐条修
3. 修完每个 bug 立即跑端到端验证

### ❓ 待答问题（实施时和用户对齐）

**Q2 — /me 2 个 bug 的复现路径**：
- "录制音频一直显示上传中"：是哪个 UI 元素显示？是录制后保存草稿，还是上传 Arweave，还是铸造提交？哪一步卡住？
- "完全铸造专辑一直不更新"：是 mint_queue 处理后 /me 不刷新？还是 mint_queue 卡 pending？需要给出最近发生这个问题的 mint_id / token_id 让我去 Supabase 查日志

### 验证标准

- [ ] /me 2 个已知 bug 修复，端到端跑通
- [ ] B7 清单中标 P0 / P1 的 /me /score /artist 类 bug 全部闭环
- [ ] `scripts/verify.sh` 通过

### 不做（明确边界）

- 不做 /me /score /artist 的视觉重设计（迁 P7）
- 不做 Claude Design 接入（v2 决策已废弃）
- 不做跨浏览器截图验收（迁 P7）
- 不引入新 npm 依赖

---

## Step B3 — 接通草稿铸造按钮

### 概念简报

后端 `/api/mint/score` 和 score_nft_queue 从 Phase 3 就 ready，但前端 UI 没按钮。Phase 3 遗留至今。

### 📦 范围
- `src/components/me/DraftCard.tsx`
- `src/data/jam-source.ts`
- `src/hooks/useMintScore.ts`（新建）

### 依赖（硬性）
- **Track A0**（operator 锁）
- **Track A1**（ScoreNFT cron 四连 + durable lease）

若 A0/A1 未完成就开 B3，tester 立刻踩到双 mint / 孤儿 NFT。

### 做什么

**1. jam-source.ts 加函数**
```ts
export async function mintScore(token: string, pendingScoreId: string): Promise<MintScoreResponse> {
  const res = await fetch('/api/mint/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pendingScoreId }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? '铸造请求失败');
  return res.json();
}
```

**2. useMintScore hook**

状态：idle / loading / queued / error

**3. DraftCard 按钮**
- idle → "铸造成乐谱 NFT" 按钮
- loading → spinner
- queued → "铸造中..."（草稿灰掉，不可点）
- error → 红色 + 重试

### 验证标准

- [ ] Phase 5 S5 B9 冒烟项通过（录制 → 保存 → 铸造 → 上链 → /score/[id] 打开）
- [ ] 端到端耗时 ≤ 5 分钟
- [ ] 并发点同一草稿 → 不会双铸造（后端 UNIQUE + 前端 disable）
- [ ] A0 锁在该场景下确认生效
- [ ] `scripts/verify.sh` 通过

---

## Step B5 — 前端韧性（3 项打包）

### 📦 范围
- `app/api/tracks/route.ts` + `src/components/archipelago/Archipelago.tsx`（#7）
- `src/components/jam/HomeJam.tsx`（#8）
- `src/lib/draft-store.ts`（#9）

### 做什么

**#7 tracks 韧性**：`export const revalidate = 300; // ISR 5 分钟` + DB 失败返 empty 数组 + 错误 header 而非 500；Archipelago 在 tracks 空时显示占位态而非 null。

**#8 移动端首帧**：useState 默认 null + useEffect 探测 → 加载完才决定渲染哪个组件。

**#9 草稿恢复**：localStorage 损坏 try/catch 自愈，清掉非数组 / 非 JSON 的脏数据。

### 验证标准
- [ ] 手动模拟 Supabase 错 → /api/tracks 返空 + header，Archipelago 占位
- [ ] UA 伪装移动端首帧 → 直接移动提示，不加载 HomeJamDesktop
- [ ] `ripples_drafts` 改成 `"not json"` → /me 正常（drafts 空）
- [ ] `scripts/verify.sh` 通过

---

## Step B6 — A 组 5 球简化 + 音乐圆圈数字代号

### 概念简报

艺术家做好 5 首正式音乐 (No.1-5)。主页 A tab 只显这 5 首给艺术家 + 早期 demo 用，B/C tab 仍 36 球但所有球的 audio_url 在 SQL 层循环到 No.1-5（让 demo "视觉满 + 听觉都是新音乐"）。

整个改动**纯前端 filter + SQL 数据替换**，不动 PlayerProvider / BottomPlayer / 任何收藏铸造逻辑。

### 📦 范围

**前端代码（3 个文件，~10 行）**
- `src/types/tracks.ts` — Track 接口加 `published: boolean`
- `app/api/tracks/route.ts` — SELECT 加 `published` 字段
- `src/components/archipelago/sphere-config.ts` — `getGroupTracks` 函数加 group 分支

**数据库**
- `supabase/migrations/phase-6/022_tracks_add_published.sql`（新建）
- 数据替换 SQL（用户在 Supabase Dashboard 跑）

**资产**
- `public/tracks/No.1.mp3 ~ No.5.mp3`（用户手动复制 5 个 mp3）

### ❓ 待答问题（实施前必答）

**Q1 — 音乐圆圈代号形式**（艺术家反馈"不需要名字，可以用数字代号"）：
- (a) `No.1 ~ No.5`（已是数字代号的一种）
- (b) 纯数字 `1, 2, 3, 4, 5`
- (c) 球 hover 时**完全不显示 title**（更极简）

实施前用户确认。

### 做什么

> ⚠️ **实施前必须先答 Q1**（音乐圆圈代号形式）。下面 SQL 默认按 (a) `No.1~No.5` 写。
> - 选 (b) 纯数字 `1~5` → SQL UPDATE 里的 `title='No.1'` 改成 `title='1'`，依此类推
> - 选 (c) 不显示 title → SQL 保留 (a) 写法，但前端 SphereNode 加 `hideTitle` prop（A 组 group=A 时不渲染 title 文本）+ 多 ~5 行代码

**1. migration 022（用户在 Supabase Dashboard 跑）**

```sql
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_tracks_published ON tracks(week) WHERE published = TRUE;
```

**2. 数据替换 SQL（独立一段，用户在 Dashboard 跑）**

```sql
-- A 组 5 首正式发布
UPDATE tracks SET published = TRUE WHERE week BETWEEN 1 AND 5;

-- 36 行循环替换 audio_url 到 No.1-5（按 (week-1)%5 公式）
UPDATE tracks SET title='No.1', audio_url='/tracks/No.1.mp3', cover='#D8A878', arweave_url=NULL WHERE week IN (1, 6, 11, 16, 21, 26, 31, 36);
UPDATE tracks SET title='No.2', audio_url='/tracks/No.2.mp3', cover='#7EA898', arweave_url=NULL WHERE week IN (2, 7, 12, 17, 22, 27, 32);
UPDATE tracks SET title='No.3', audio_url='/tracks/No.3.mp3', cover='#A83A3A', arweave_url=NULL WHERE week IN (3, 8, 13, 18, 23, 28, 33);
UPDATE tracks SET title='No.4', audio_url='/tracks/No.4.mp3', cover='#6A7898', arweave_url=NULL WHERE week IN (4, 9, 14, 19, 24, 29, 34);
UPDATE tracks SET title='No.5', audio_url='/tracks/No.5.mp3', cover='#E8D8B8', arweave_url=NULL WHERE week IN (5, 10, 15, 20, 25, 30, 35);

-- 一次性清旧 mint 数据
DELETE FROM mint_events WHERE token_id BETWEEN 1 AND 36;
DELETE FROM mint_queue WHERE mint_type='material' AND token_id BETWEEN 1 AND 36;
```

> 若 Q1 选 (b) 纯数字，title 字段改成 `'1' / '2' / '3' / '4' / '5'`；若选 (c) 不显示 title，前端 SphereNode 加 props 控制。

**3. 前端代码**

```ts
// src/types/tracks.ts
export interface Track {
  // ...existing
  published: boolean;
}

// app/api/tracks/route.ts
.select('id, title, week, audio_url, cover, island, created_at, published')

// src/components/archipelago/sphere-config.ts
export function getGroupTracks(tracks: Track[], groupId: GroupId): Track[] {
  if (groupId === 'A') {
    return tracks.filter(t => t.published);  // 5 球
  }
  return tracks.filter(t => t.week >= 1 && t.week <= 36);  // B/C 仍 36 球
}
```

### 副作用（已和用户多轮确认接受）

1. A/B/C 三组前 5 球数据共享（同一份 tracks 行）—— 已接受
2. B/C 组后 31 球 audio_url 也是 No.1-5 之一（艺术家要求"36 球都听新音乐"）—— 已接受
3. B/C 组收藏按钮真走后端 + 真上链（token_id 6-36 元数据指向 No.X.mp3，链上语义混乱但合法）—— 测试网不在乎
4. 链上 token_id 1-36 旧 holder NFT 不变（不可改）—— 已接受
5. /me 个人页可能出现重复 NFT 展示（多个 token_id 指向同一 audio）—— 测试网不在乎
6. **DELETE FROM mint_events / mint_queue WHERE token_id BETWEEN 1 AND 36 会抹掉所有用户的历史铸造记录**（包括其他 tester 在 Phase 5 / Pre-tester gate 期间的铸造）。所有用户切到 /me 页"我铸造的"列表会丢失这部分数据 —— 测试网 demo 阶段已和用户确认接受，但实施前再次提醒

### 验证标准

- [ ] migration 022 在 Supabase 跑通
- [ ] 数据替换 SQL 跑完，前 36 行符合预期
- [ ] mint_events / mint_queue 旧记录清空
- [ ] 5 个 mp3 文件在 `public/tracks/` 存在
- [ ] A 组（"1" tab）显 5 球，颜色 D8A878 / 7EA898 / A83A3A / 6A7898 / E8D8B8
- [ ] B 组（"2" tab）显 36 球，点任意球播放 No.1-5 之一
- [ ] C 组（"3" tab）显 36 球，同 B 但 C 配色
- [ ] BottomPlayer 收藏按钮在三组都正常工作
- [ ] / 和 /test 同步看到这些变化
- [ ] `bash scripts/verify.sh` 通过

### 不做（明确边界）

- 不做 group-aware 的 BottomPlayer / PlayerProvider 改造
- 不做 5 球专属 d3-force CFG override（迁 P7 视觉重做时一起做）
- 不动 GROUPS / GROUP_PALETTES（迁 P7）
- 不做漂浮液态感视觉重做（迁 P7）

---

## Step B7 — 端到端冒烟 + bug 清单产出

### 依赖（硬性）

**B6 必须先完成**。B7 验证清单含"A tab 显 5 球 / B/C tab 显 36 球都能播 No.1-5"，这些只有 B6 上线后才存在。

### 概念简报

Phase 6 完结的 gate 是"所有功能端到端跑通"。B7 是把整个产品当真实用户用一遍，输出 bug 清单作为 B2 / 其他修复 step 的输入。

不写代码，只验证 + 产出报告。

### 📦 范围
- `reviews/2026-05-XX-phase-6-completion-smoke-test.md`（新建，实施时按当天日期填日期占位）

### ❓ 待答问题（启动前确认）

**Q3 — smoke test 清单来源**：
- (a) 沿用 Phase 5 的 9 条（`reviews/2026-04-24-phase-5-s5-smoke-test.md`）
- (b) 新建 Phase 6 版本（含 B6 5 球 + 音乐圆圈名字 + /me 已知 bug）

推荐 (b)，因为 Phase 5 smoke 不含 5 球 demo 模式。

### 做什么

照清单跑通核心场景（10+ 条），用真实账号 + 浏览器：

```
1. 打开 / → 看到 5 球（A）+ 36 球（B/C）→ 颜色对、能漂浮
2. 点 1 个球 → 听到音乐 → BottomPlayer 弹出
3. 点收藏（爱心）→ 红心亮 → 1-2 分钟内 /me 出现 NFT
4. 录制合奏 → 保存草稿 → 出现在 /me 草稿区
5. 草稿点"铸造" → mint_queue 处理 → 上链 → /score/[id] 能打开
6. 切到 /artist 页面 → 看到统计数据
7. 切到 B/C tab → 36 球都能播 → 颜色对
8. 退出登录 → 重登 → /me 还能看到自己的 NFT
9. 移动端打开 / → 不崩 + 显示移动提示
10. 不登录直接刷 / → 球还能漂、能播
```

每步勾 / 叉。叉的就是 bug，列到 `reviews/2026-05-XX-phase-6-completion-smoke-test.md`。

### 输出

- bug 清单（每条标 P0 / P1 / P2）
- 每个 bug 归属（B2 修 / 推 P7 / deferred-justified）
- 用户决策每个 bug 的优先级（实施时和用户对齐）

### 验证标准

- [ ] 10+ 条核心场景跑完，每条勾 / 叉清晰
- [ ] bug 清单产出，所有条目有归属
- [ ] B7 报告归档到 `reviews/`
- [ ] B2 实施时输入完整

---

## Track B 完结标准（v2）

- [ ] 6 steps 全绿（B1 + B2 + B3 + B5 + B6 + B7）
- [ ] B7 产出的 bug 清单 P0 / P1 全部闭环（修了 / 推 P7 / deferred-justified）
- [ ] /me 2 个已知 bug 修复（录制"上传中" / 铸造不更新）
- [ ] B6 上线，艺术家能在 A tab 看到 5 球 demo
- [ ] B3 草稿铸造按钮接通 + S5 B9 冒烟通过
- [ ] `scripts/verify.sh` 通过

---

## P7 候选（v2 缩减时迁出，作为 P7 计划输入）

| 工作 | 来源 |
|---|---|
| 主页深度视觉重做（漂浮液态感 / 透明度 / 球体质感）| 艺术家反馈 1 |
| 主页动态扩展（流动 + 随机扰动事件） | 艺术家反馈 2 |
| 键盘音阶系统（A=钢琴 1-0 / Q=提琴）| 艺术家反馈 3 |
| 按键动画自定义 + 与岛屿/日食交互 | 艺术家反馈 5 |
| /me /score /artist 深度重设计 | v2 决策 1 |
| Claude Design 接入（条件评估）| 原 B2.0.7 迁出 |
| 跨浏览器截图验收 | 原 B2.5 迁出 |
