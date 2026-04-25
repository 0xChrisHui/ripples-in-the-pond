# Track B — UI 重设计 + 前端体验

> **范围**：NFT cache 用户隔离 + UI 重设计（**Claude Design 接入** + IA 讨论 + 按页面拆解 + 截图验收） + 草稿铸造按钮 +
> 音频叠加修复 + 前端韧性
>
> **前置**：B2 系列等 tester 反馈；B3 依赖 Track A1（ScoreNFT cron 四连）+ A0（operator 锁）
>
> **对应 findings**：#2 #7 #8 #9 #23 #29
>
> **核心交付物**：产品视觉/交互达到"可以给外人看"水准 + 每个页面都有可验证截图 + 前端层面对常见失败兜底
>
> **设计工具**：[Claude Design](https://claude.ai/design)（Anthropic 2026-04-17 发布的 web-only 工具，由 Opus 4.7 驱动，onboarding 阶段读 codebase 自动建 design system）+ Claude Code（我，负责把产出迁回项目）

---

## 冻结决策

### D-B1 — UI 重设计按页面拆解，每页单独验收

B2 不是"整体重设计一次交付"。按页面拆成 B2.0-B2.5，每个页面：
- 反馈优先级输入
- 低保真 / 草图确认方向
- 实施
- 截图验收（桌面 + 移动 + 3 种浏览器）
- 用户确认点

**不允许**："用户审核通过" 这种主观收口。

### D-B2 — 非 UI 重设计的前端 bug 可和 tester 并行

B1 / B3 / B4 / B5 与 UI 重设计方向解耦，可和 tester 反馈轮并行开工。

### D-B3 — B3 草稿铸造按钮有硬前置

B3 接通草稿铸造前必须完成 Track A0（operator 锁）+ A1（ScoreNFT cron 四连）。否则 tester 踩到双 mint / 孤儿 NFT / 覆盖 metadata 等 P0。

### D-B4 — UI 重设计范围界定

B2 只改：`/`（首页）+ `/me` + `/score/[tokenId]` + `/artist`。
不改：`/_not-found`、`/error`、其他页面。

### D-B5 — B2 不改后端 API 契约

UI 重设计期间后端 API 契约不变。若重设计过程发现 API 缺字段，列入 Track A 或额外 issue，不塞进 B2。

### D-B6 — Claude Design 工作流

Claude Design 是 web-only 工具（`claude.ai/design`），无 API / CLI 集成。工作流：

```
用户在 claude.ai/design 里设计 + 迭代
  ↓ export 代码
  ↓ 贴给 Claude Code（我）
  ↓ 我做：迁路径 + 接 hook + 修 directive + verify.sh + commit
```

**设计前必有 IA spec**：B2.0.5 产出的 `reviews/phase-6-ia-spec.md` 是 Claude Design 的输入约束，避免它产出"视觉漂亮但流程错"的页面。

**Onboarding**：B2.0.7 让 Claude Design 读项目 codebase（GitHub 连接或上传），自动提取 Tailwind tokens / 组件 / 类型契约 — 不需要手写 design handoff bundle。

---

## 📋 Step 总览

| Step | Findings | 内容 | 工作量 | 依赖 |
|---|---|---|---|---|
| [B1](#step-b1--nft-localstorage-按用户隔离pre-tester-gate) | #2 | NFT cache key 加 user_id 命名空间 | 30 分 | 无（**Pre-tester**）|
| [B2.0](#step-b20--反馈归档--优先级) | — | tester 反馈汇总 + 优先级分类 | 半天 | Tester 反馈窗口结束 |
| **[B2.0.5](#step-b205--页面架构讨论ia-spec)** | — | **4 页 IA spec 讨论 + 文档**（Claude Design 输入约束） | **1-2 小时** | B2.0 |
| **[B2.0.7](#step-b207--claude-design-onboarding)** | — | **Claude Design 接入项目仓库 + 验证 design system 提取** | **1 小时** | B2.0.5 |
| [B2.1](#step-b21--首页-重设计) | — | 首页 — 在 Claude Design 里迭代 + 我实施 | 2-3 天 | B2.0.7 |
| [B2.2](#step-b22--me-重设计) | — | /me — 同上（配合 B3）| 1-2 天 | B2.0.7 + B3（若一起改）|
| [B2.3](#step-b23--scoretokenid-重设计) | — | /score/[id] — 同上 | 1 天 | B2.0.7 |
| [B2.4](#step-b24--artist-重设计) | — | /artist — 同上 | 半天 | B2.0.7 |
| **[B2.4.5](#step-b245--claude-design-产出迁项目)** | — | **每页产出 paste 进 `app/_design/` → 迁真路径 + 接 hook** | **每页 0.5-1 天，与 B2.1-B2.4 并行** | B2.1-B2.4 各自启动 |
| [B2.5](#step-b25--跨浏览器截图验收) | — | 3 种浏览器 + 桌面/移动断点截图归档 | 半天 | B2.4.5 |
| [B3](#step-b3--接通草稿铸造按钮) | #23 | DraftCard 加铸造按钮 + jam-source mintScore | 半天 | **A0 + A1** |
| [B4](#step-b4--音频叠加修复) | #29 | 快速连点岛屿不叠加 | 2-3 小时 | 无 |
| [B5](#step-b5--前端韧性3-项打包) | #7 #8 #9 | tracks ISR + 移动端首帧 + localStorage 恢复 | 半天 | 无 |

**B2 子步骤数从 6 增到 9**（加 B2.0.5 / B2.0.7 / B2.4.5），覆盖 Claude Design 接入完整链路。Track B 总 step 数 13。

---

## Step B1 — NFT localStorage 按用户隔离【Pre-tester Gate】

### 概念简报
`ripples_minted_token_ids` / `ripples_cached_nfts` 是浏览器全局 key。共享浏览器 / 多账号切换时新用户看到旧用户的红心和 NFT 缓存 → 资产错乱感。

### 📦 范围
- `src/lib/nft-cache.ts`
- `src/components/archipelago/Archipelago.tsx`
- `app/me/page.tsx`
- `src/hooks/useAuth.ts`（logout 挂钩清缓存）

### 做什么
所有 localStorage key 加 user_id 前缀：
```ts
function getCacheKey(userId: string | undefined) {
  return userId ? `ripples_cached_nfts_${userId}` : 'ripples_cached_nfts_anon';
}
```

logout 时清当前 user 的 key：
```ts
export function clearNftCache(userId: string) {
  localStorage.removeItem(`ripples_cached_nfts_${userId}`);
  localStorage.removeItem(`ripples_minted_token_ids_${userId}`);
}
```

### 验证标准
- [ ] 用户 A 登录收藏 → 登出 → B 登录 → /me 不显示 A 的 NFT
- [ ] A 重登 → 仍看得到（不清，只隔离）
- [ ] `scripts/verify.sh` 通过

---

## Step B2.0 — 反馈归档 + 优先级

### 概念简报
Tester 反馈窗口（1-2 周）结束后，不应直接进入 UI 重设计实施，先做反馈归档 + 优先级决策，把"模糊的反馈"变成"可执行的设计需求"。

### 📦 范围
- `reviews/2026-04-XX-phase-6-tester-feedback.md`（新建）
- 和用户讨论优先级

### 做什么

**1. 从反馈渠道（微信/飞书/GitHub）汇总所有反馈**

**2. 按类型分类**

| 类型 | 示例 | 归属 |
|---|---|---|
| 视觉 | "首页岛屿太暗 / 配色不舒服" | B2.1-B2.4 |
| 交互 | "收藏后不知道在哪看 / 登录流程打断" | B2.1-B2.4 |
| 信息架构 | "/me 草稿区找不到入口" | B2.1-B2.2 |
| 文案 | "收藏按钮叫什么不清楚" | B2.0 的文案子任务 |
| 功能缺失 | "想导出 NFT 图 / 想分享给别人" | 非 B2 范围，挂起或列 issue |
| Bug | "某页白屏 / 某按钮没反应" | 列到 B4/B5 或 Track A |

**3. 优先级决策（和用户一起）**

每条反馈标 P0 / P1 / P2 / "明确不做"。
"明确不做" 必须写原因，避免后续反复讨论。

**4. 汇总为设计需求清单**

按页面分：首页有哪些优先级反馈 → 进 B2.1；/me 有哪些 → 进 B2.2；等等。

### 验证标准
- [ ] `reviews/2026-04-XX-phase-6-tester-feedback.md` 包含完整反馈列表 + 分类 + 优先级
- [ ] 用户确认优先级
- [ ] 每条 tester 反馈都有一个归属（B2.X / 其他 track / 明确不做）

---

## Step B2.0.5 — 页面架构讨论（IA Spec）

### 概念简报
Claude Design 擅长视觉，但**信息架构 / 用户路径 / primary action 决策**应该先想清楚再喂进去。否则它会基于自己理解的产品生成漂亮但流程错的页面。

这一步用 1-2 小时和我（Claude Code）讨论，输出 `reviews/2026-04-XX-phase-6-ia-spec.md`。

### 📦 范围
- `reviews/2026-04-XX-phase-6-ia-spec.md`（新建）

### 做什么
4 页（`/`、`/me`、`/score/[tokenId]`、`/artist`）每页填这些字段：

```markdown
## 页面 X

**Job to be done**：用户来这页要做什么
**Primary action**：最显眼的那个按钮 / 交互
**Secondary actions**：次要操作（≤3 个）
**信息层级**：从上到下 / 从中心向外的优先级
**进入路径**：用户从哪里来
**离开路径**：用户去哪里
**B2.0 反馈里属于 IA 的**：要在这步改，不在视觉打磨
**该页不做的事**：明确边界（防 Claude Design 加多余功能）
```

### 验证标准
- [ ] 4 页 IA spec 全部写完
- [ ] 用户确认每页的 primary action + 信息层级
- [ ] B2.0 反馈每条都标"属于 IA 还是视觉"，IA 的归到对应页 IA spec
- [ ] 文档作为 B2.0.7 onboarding 输入的一部分

---

## Step B2.0.7 — Claude Design Onboarding

### 概念简报
Claude Design onboarding 阶段会读项目 codebase + 设计文件，自动建立 design system（颜色、字体、组件、类型契约）。这一步把项目接入并验证它正确提取了我们已有的设计 token。

### 📦 范围
- 用户操作：在 claude.ai/design onboarding 流程
- 验证：`app/_design/page.tsx`（**新建** — preview sandbox）+ `app/_design/stubs.ts`（假数据）

### 做什么

**1. 接入 Claude Design**
- 用户访问 `claude.ai/design`
- 按 onboarding 流程接入 GitHub 仓库 `0xChrisHui/ripples-in-the-pond`（或上传 zip）
- 等待它读完 codebase

**2. 验证它正确提取了 design system**

让 Claude Design 输出一个 "项目 design system 摘要"，检查：
- 颜色：`bg-black` / `text-white` / `text-white/70` / `text-white/40` / `border-white/20` / `text-rose-400` / `text-amber-400/70` 等是否被识别
- 字体：`Geist Sans` / `Geist Mono`（layout.tsx 定义）
- 形状：`rounded-full` / `rounded-lg` / `px-6 py-12`
- 类型契约：能否引用 `Track / OwnedNFT / OwnedScoreNFT / KeyEvent`
- 组件：`FavoriteButton / NFTCard / DraftCard / Archipelago` 等已有组件

**3. 建项目内的 preview sandbox**

由我（Claude Code）建：
```
app/_design/                           # 不在 sitemap，开发用
├── page.tsx                           # 列出所有 preview 组件
├── components/                        # 待评估的设计（迁真路径前的暂存）
└── stubs.ts                           # 假数据，类型契约对齐
```

`stubs.ts` 提供：
- 1 个示例 Track
- 1 个示例 OwnedNFT
- 1 个示例 OwnedScoreNFT（含 Arweave URL）
- 1 个示例 PendingScore（草稿）
- 1 个示例 evmAddress

### 验证标准
- [ ] Claude Design 提取的 design system 摘要 ≥ 80% 命中项目 token
- [ ] 摘要里没出现项目没用的颜色 / 字体（避免它瞎加）
- [ ] `app/_design/page.tsx` 路由可访问（dev only）
- [ ] `stubs.ts` 类型 import 跑通
- [ ] `scripts/verify.sh` 通过

---

## Step B2.1 — `/` 首页重设计

### 📦 范围
- 用户在 Claude Design 里迭代（输入：B2.0.5 IA spec 首页段 + B2.0 反馈里首页 P0/P1）
- 我（Claude Code）实施时改动：
  - `src/components/archipelago/*`
  - `src/components/player/BottomPlayer.tsx`
  - `src/components/auth/LoginButton.tsx`（视觉层）
  - `src/components/FavoriteButton.tsx`（视觉层）

### 做什么

**用户在 Claude Design 里**（你做）：
1. 进 `claude.ai/design`，新对话或新 design
2. 输入 prompt：「按 `reviews/2026-04-XX-phase-6-ia-spec.md` 首页段 + 这些反馈做首页设计：[贴 B2.0 首页 P0/P1 反馈]」
3. 在 design 标签里 conversation refine 直到满意
4. Export React + Tailwind 代码，贴给我

**我（Claude Code）实施时**：
1. 把 paste 内容放 `app/_design/components/HomePagePreview.tsx`
2. 用 `stubs.ts` 跑通 → 你浏览器看效果
3. 接真实 hook（`useAuth` / `usePlayer` / 真 tracks 数据）
4. 验证桌面 + 移动断点
5. 迁到真路径，替换旧组件

### 验证标准
- [ ] Claude Design 产出在 `_design/` 跑通（stub 数据）
- [ ] 接真 hook 后跑通
- [ ] 桌面 + 移动端分别截图
- [ ] B2.0 归档里 "P0 / P1 首页反馈" 全部闭环
- [ ] `scripts/verify.sh` 通过

---

## Step B2.2 — `/me` 重设计

### 📦 范围
- `app/me/page.tsx`
- `src/components/me/NFTCard.tsx`
- `src/components/me/ScoreCard.tsx`
- `src/components/me/DraftCard.tsx`（如 B3 一起做，按钮集成）
- `src/components/me/EmptyState.tsx`

### 做什么
- 三区（乐谱 / 素材 / 草稿）视觉统一
- 空态文案优化
- 草稿区接 B3 按钮（或 B3 独立完成后本 step 只负责视觉）

### 验证标准
- [ ] 三区有内容 / 部分空 / 全空三种场景截图
- [ ] P0 / P1 /me 反馈全部闭环
- [ ] `scripts/verify.sh` 通过

---

## Step B2.3 — `/score/[tokenId]` 重设计

### 📦 范围
- `app/score/[tokenId]/page.tsx`
- `app/score/[tokenId]/ScorePlayer.tsx`
- `app/score/[tokenId]/opengraph-image.tsx`

### 做什么
- 分享卡视觉（OG image）
- 播放器按钮 + 信息密度
- iframe 加载态优化

### 验证标准
- [ ] OG image 在 Twitter Card Validator / Facebook Debugger 渲染正确
- [ ] 桌面 + 移动截图
- [ ] `scripts/verify.sh` 通过

---

## Step B2.4 — `/artist` 重设计

### 📦 范围
- `app/artist/page.tsx`

### 做什么
- 统计块 + 108 首进度条 + 空投标记点视觉调整
- 响应式（可能简化为只桌面友好）

### 验证标准
- [ ] 桌面截图
- [ ] 移动端是否 in-scope 由用户定，in-scope 就截图，不 in-scope 文档说明

---

## Step B2.4.5 — Claude Design 产出迁项目

### 概念简报
B2.1-B2.4 每页在 Claude Design 里设计完，需要把产出迁回项目真路径。这一步是我（Claude Code）的核心工作，**和 B2.1-B2.4 并行做**（每页设计完成就立刻迁，不要等 4 页全做完再批迁）。

### 📦 范围（每页一遍）
- `app/_design/components/<Page>Preview.tsx`（暂存 Claude Design 产出）
- 真路径替换（每页清单见 B2.1-B2.4 各 step）

### 做什么（每页流程）

1. **Paste 产出到 `_design/`**
   用户把 Claude Design 输出贴给我 → 我创建 `_design/components/<Page>Preview.tsx`

2. **检查项目约定**
   - `'use client'` directive（交互组件首行）
   - 文件 ≤ 220 行（超了拆分）
   - 没引入新 npm 包（如有，先讨论是否值得）
   - 没用项目外的颜色 / 字体 token

3. **Stub 数据跑通**
   - import `stubs.ts` 给假数据
   - `npm run dev` 访问 `/_design`，浏览器看效果
   - 用户确认视觉 OK

4. **接真 hook 替换 stub**
   - useAuth / usePlayer / fetchSounds / fetchMyNFTs 等
   - 注意 Server / Client Component 边界
   - 跑 `verify.sh` 全绿

5. **迁真路径**
   - 替换 `src/components/...` 旧组件 或 `app/<page>/page.tsx`
   - 删除 `_design/components/<Page>Preview.tsx`
   - commit "feat(phase6-b2.X): <page> 重设计上线"

6. **回归测试**
   - 该页面相关功能（登录 / 收藏 / 草稿 / 回放）端到端跑一遍
   - 跑 `verify.sh`

### 验证标准（每页）
- [ ] `_design/` 暂存版 stub 数据跑通
- [ ] 真 hook 接入后跑通
- [ ] 真路径替换完成，旧组件删除
- [ ] 该页关联功能端到端 OK
- [ ] commit 推送
- [ ] `verify.sh` 全绿

---

## Step B2.5 — 跨浏览器截图验收

### 📦 范围
- `reviews/2026-04-XX-phase-6-ui-screenshots.md`（新建）

### 做什么
对 B2.1-B2.4 四个页面在 3 种浏览器（Chrome / Safari / Firefox）+ 2 种断点（桌面 1440 / 移动 375）拍截图归档。总共 4 页 × 3 浏览器 × 2 断点 = 24 张。

视觉不一致 → 开新 issue 或就地修。

### 验证标准
- [ ] 24 张截图归档到 reviews/
- [ ] 用户审核通过（最终主观但有截图作证）
- [ ] 视觉不一致项全部闭环

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

## Step B4 — 音频叠加修复（bug #1）

### 概念简报
`PlayerProvider.toggle()` 同步判断 state，但 `play()` 异步。快速连点：两次 toggle 都看到 `playing === false` → 两个 play 并发。

### 📦 范围
- `src/components/player/PlayerProvider.tsx`

### 做什么
加 loadingRef 拦截重复加载 + 加载期间若目标变了则放弃：

```ts
async function play(trackId: string) {
  if (loadingRef.current === trackId) return;
  loadingRef.current = trackId;
  try {
    sourceRef.current?.stop();
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    const buffer = await fetchAndDecode(trackId);
    if (loadingRef.current !== trackId) return; // 期间变了
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start();
    sourceRef.current = src;
  } finally {
    loadingRef.current = null;
  }
}
```

### 验证标准
- [ ] 快速连点同岛屿 10 次 → 只 1 个音频播放
- [ ] 快速在 3 个岛屿切换 → 始终只 1 个播放
- [ ] `scripts/verify.sh` 通过

---

## Step B5 — 前端韧性（3 项打包）

### 📦 范围
- `app/api/tracks/route.ts` + `src/components/archipelago/Archipelago.tsx`（#7）
- `src/components/jam/HomeJam.tsx`（#8）
- `src/lib/draft-store.ts`（#9）

### 做什么

**#7 tracks 韧性**
```ts
export const revalidate = 300; // ISR 5 分钟
// DB 失败返 empty 数组 + 错误 header 而非 500
```
`Archipelago` 在 tracks 空时显示占位态而非 null。

**#8 移动端首帧**
```tsx
const [isMobile, setIsMobile] = useState<boolean | null>(null);
useEffect(() => { setIsMobile(window.innerWidth < 768); }, []);
if (isMobile === null) return <Loading />;
if (isMobile) return <HomeJamMobileHint />;
return <HomeJamDesktop />;
```

**#9 草稿恢复**
```ts
export function getDrafts(): Draft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('not array');
    return parsed.filter(isValidDraft);
  } catch (err) {
    console.warn('[draft-store] 损坏 localStorage 已清:', err);
    localStorage.removeItem(DRAFTS_KEY);
    return [];
  }
}
```

### 验证标准
- [ ] 手动模拟 Supabase 错 → /api/tracks 返空 + header，Archipelago 占位
- [ ] UA 伪装移动端首帧 → 直接移动提示，不加载 HomeJamDesktop
- [ ] `ripples_drafts` 改成 `"not json"` → /me 正常（drafts 空）
- [ ] `scripts/verify.sh` 通过

---

## Track B 完结标准

- [ ] 13 steps 全绿（B1 + B2.0/0.5/0.7/1/2/3/4/4.5/5 + B3 + B4 + B5）
- [ ] `reviews/2026-04-XX-phase-6-ia-spec.md` 4 页都填完
- [ ] Claude Design onboarding 完成，design system 摘要 ≥ 80% 命中项目 token
- [ ] `app/_design/` sandbox 在 Phase 6 完结时**保留**（之后还有用）
- [ ] B9 冒烟项（草稿铸造端到端）通过
- [ ] Tester 反馈窗口所有 "视觉 / 交互" 类条目闭环
- [ ] 24 张跨浏览器截图归档
- [ ] `scripts/verify.sh` 通过
