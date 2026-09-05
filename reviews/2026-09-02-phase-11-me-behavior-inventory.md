# P11-C0 `/me` 行为与状态盘点

> 盘点日期：2026-09-02
> 范围：`app/me/`、`src/components/me/`、相关 hooks、data source、认证与 API route。
> 性质：只读盘点；本文不改变产品代码、schema、认证协议或 playbook。

## C2/C3 完成更新（当前权威）

用户随后批准了 C2/C3 所需的最小范围扩展，`/me` 档案迁移已经完成：

- `GET /api/me/score-nfts`、`OwnedScoreNFT` 与客户端 data source 已贯通真实 `status` / `failure_kind`；七种 `ScoreMintStatus` 逐态显示，不再根据 `tokenId` 猜生命周期。
- `success` 使用数字 Token 打开永久唱片；其余处理中状态使用 queue UUID 查看进度；`failed` 只提供真实存在的“查看详情”，没有伪造恢复或重试 API。
- 唱片、录音、素材均已迁入档案行；录音试听/停止、事件失败后的重试播放、制作唱片/重试制作、全局 BottomPlayer 与 Material 收藏能力均被保留。
- `fetchMyScoreNFTs`、`fetchMyScores`、`fetchMyNFTs` 对非 2xx 明确抛错；三个远端分区各自保留已有内容并显示局部错误，不再把 HTTP 失败吞成空数组或总空档案。
- 最小扩展只涉及既有 Score API/type、`jam-source.ts`、`nfts-source.ts`、状态轮询和 `src/hooks/me/` 编排；未改 schema、认证协议，也未新增 failed queue 写操作。
- 旧 Score/Draft/NFT 卡片与 section 在确认无消费者后删除；目标 TypeScript 与 ESLint 验证通过，文件 `≤220`、目录 `≤8`。
- 最终复核又修复了身份切换/并发请求竞态、缓存刷新提示、坏封面降级和损坏 Material 缓存；损坏缓存会整批放弃并继续读取远端，不会被显示成真实档案。
- 最终 `scripts/verify.sh` 全绿（production build 34/34、Forge 42/42）；隔离浏览器中的 `/me` 375/1440 未登录边界通过，无横向溢出、登录动作可见、BottomPlayer 不遮挡，最终矩阵 console 0。登录后真实三分区数据仍受测试会话边界约束，不由未登录证据冒充覆盖。

因此，下文关于“C2 前阻塞”“尚未建立七态”“data source 仍吞 HTTP 错误”的文字只保留为 C0 取证快照，不再代表当前产品状态。

## 原始 C0 结论（历史快照）

现有 `/me` 的四类真实数据都已接通，但页面还是“唱片卡片 → 素材卡片 → 草稿卡片”的后台列表，尚未形成 playbook 规定的“唱片 → 录音 → 素材”档案。旧动作可以全部迁移，不过 C2 前有两个必须先补齐的契约：`GET /api/me/score-nfts` 必须返回 `ScoreMintStatus`，且 Score 失败态目前没有用户可用的恢复入口。C3 还必须修正 data source 把 HTTP 错误吞成空数组的行为，否则无法可靠区分空档案与局部失败。

## 1. 当前页面结构

当前顺序与名称：

1. 标题“我的收藏”；Semi 登录显示外链“社区钱包”，Privy 登录显示“首页”。
2. “我的唱片”：`score_nft_queue` 的全部记录。
3. “音乐收藏”：`mint_events` 成功记录，加 `mint_queue` 的处理中记录。
4. “我的创作”：未入 Score 队列的服务端录音，加浏览器本地草稿。

目标顺序应改为“我的唱片 → 我的录音 → 我的素材”。“我的创作”应更名为“我的录音”，“音乐收藏”应更名为“我的素材”，避免把不同对象伪装成同一种收藏。

## 2. 旧入口与动作保全表

| 位置 | 当前触发条件 | 当前行为 | C1/C2 必须保留的新位置 |
|---|---|---|---|
| 未登录页“登录” | `ready=true`、未认证且没有匿名 NFT 缓存 | 调既有 `openLoginModal`，可选 Semi / Privy | `ArchiveHeader` 或未登录档案态的唯一主动作 |
| 未登录页“返回首页” | 同上 | `Link /` | `ArchiveHeader` 的“返回池塘” |
| 顶部“社区钱包” | `authSource='semi'` | 新窗口打开 `https://semi.ntdao.xyz/` | 登录身份摘要旁的次动作；保持 `noopener noreferrer` |
| 顶部“首页” | 非 Semi（实际为 Privy） | `Link /` | 统一为“返回池塘” |
| 唱片整行 | 每一条 Score | 始终链接 `/score/<id>`；`id` 当前由 `tokenId` 是否存在决定数字或 UUID | 成功态只用数字 Token；处理中用 UUID；失败态使用真实可访问详情入口 |
| 录音“▶ / ⏸” | 仅服务端录音、有关联 track 且事件数大于 0 | 首次按需加载事件，再用全局 `PlayerProvider.toggle(track)` 播放/停止底曲，`useEventsPlayback` 同步敲击事件 | `RecordingArchiveRow` 的主/次播放动作；不得创建第二个 audio |
| 录音播放错误 | 事件请求失败 | 行内显示“播放加载失败”；再次点播放按钮会重新请求，但 UI 没写“重试” | 保留为行内可恢复错误，并把动作明确标成“重试播放” |
| “铸造成唱片 NFT” | 服务端录音、`useMintScore=idle` | `POST /api/mint/score` 入 Score 队列 | `RecordingArchiveRow` 的唯一制作动作 |
| “重试” | `useMintScore=error` | 对同一 `pendingScoreId` 再调 `mint` | 录音行原位保留；注意这只是入队请求重试，不是已失败 Score 队列恢复 |
| “铸造中/成功” | 点击入队后的客户端乐观态 | 5 秒变成功，并轮询最多 60 秒确认录音从 `/api/me/scores` 消失 | 迁移为清楚的临时反馈；最终真值以 Score 队列状态为准 |
| 全局 BottomPlayer“停止” | 录音已开始播放 | 停止全局 HTMLAudio、清空当前曲目 | 页面底部必须预留安全区，最后一条不能被遮住 |
| 全局 BottomPlayer“收藏/已收藏” | 录音已开始播放 | 调 `useFavorite(track.week, track.id)`，乐观入 MaterialNFT 队列；未登录会先开 LoginModal | 这是 `/me` 播放带出的隐式素材铸造入口，迁移后仍会存在，不能遗漏 |
| MaterialNFT 条目 | 始终 | 仅展示，没有按钮、播放或外链 | `MaterialArchiveRow` 保留真实名称、Token、时间；不要声称“保留既有外链”，因为当前 `/me` 根本没有 Material 外链 |

补充：Score 卡当前没有独立播放或分享按钮；它只进入公开 Score 页面，播放、分享与链上凭证都在该页。C2 不应把这些详情动作复制进档案主行。

## 3. 四类数据真值与生命周期

| 档案对象 | 客户端入口 | 服务端 / 存储真值 | 筛选、排序与生命周期 | 当前缓存 / 降级 |
|---|---|---|---|---|
| localStorage 草稿 | `getDrafts()` | `ripples_drafts`，字段为 `trackId/eventsData/createdAt` | 同一 track 覆盖；24 小时 TTL；损坏 JSON 会清空；登录后逐条 `saveScore`，成功才 `removeDraft` | 未登录时存在但当前登录门会把它隐藏；上传失败保留本地并只写 console |
| 服务端录音 | `fetchMyScores(token)` | `pending_scores` 联 `tracks`；`GET /api/me/scores?light=1` | 只取本人、`status=draft`、未过期且未进入 `score_nft_queue`；按创建时间倒序；light 模式只给 `event_count`，点击播放再拉事件 | 无服务端录音缓存；局部请求失败应只影响录音区 |
| MaterialNFT | `fetchMyNFTs(token)` | 成功来自 `mint_events` 联 `tracks`；处理中来自 `mint_queue` 的 `pending/minting_onchain` | 成功按 `minted_at` 倒序并按 token 去重；处理中追加，tokenId 约定等于 `tracks.week` | 唯一有用户隔离 localStorage 缓存的远端分区；pending track 查不到时 route 用 `null` 强转，类型契约与运行时不一致 |
| ScoreNFT | `fetchMyScoreNFTs(token)` | `score_nft_queue` 全部行联 `tracks`、`pending_scores.event_count` | 不过滤状态，按 `created_at` 倒序；`token_id/tx_hash` 是渐进字段 | 无缓存；有 `tokenId=null` 时每 2 分钟轮询 |

重要语义：

- 本地草稿不是可试听的“服务端录音”：它没有 `pendingScoreId` 和完整 Track，当前只能显示“上传中”。
- 服务端录音一旦进入 Score 队列，就从录音接口排除、转入唱片区；数据库草稿仍保留，不 DELETE。
- MaterialNFT 的 `minted_at` 是成功铸造时间；处理中行暂用 `mint_queue.created_at`。
- Score 的当前 `mintedAt` 实际是 `score_nft_queue.created_at`（提交/入队时间），不是链上确认时间。新档案应称“提交于”，不能误称“铸造于”。
- `/api/me/score-nfts` 当前没有选择或返回 `status/failure_kind`，是七态 UI 的直接阻塞。

## 4. 认证组合

`useAuth` 的优先级是 Privy > Semi，`ready = privyReady || semiAuth`。

| Privy 状态 | Semi JWT | 输出组合 | `/me` 当前表现 | C3 目标 |
|---|---|---|---|---|
| 未 ready / 未认证 | 无 | `ready=false, authenticated=false, authSource=null` | Material 缓存为空时 `return null`，整页空白 | 稳定档案骨架 + “正在确认身份” |
| 未 ready / 未认证 | 有效 | `ready=true, authenticated=true, authSource=semi` | 可立即显示并发起三类请求 | 显示 Semi 身份摘要，后台刷新 |
| ready / 未认证 | 无 | `ready=true, authenticated=false, authSource=null` | 登录说明、登录按钮、返回首页 | 说明登录用于找回档案，复用 LoginModal |
| ready / 未认证 | 有效 | `ready=true, authenticated=true, authSource=semi` | Semi 档案 + 社区钱包外链 | 同上 |
| 已认证 | 任意 | `authenticated=true, authSource=privy` | Privy 覆盖 Semi；显示首页链接 | 显示 Privy 身份摘要，返回池塘 |

边缘组合：`privyAuth=true` 但 Privy user 尚无 `id` 时，`authenticated=true`、`userId=null`，页面不会发请求，却会永久显示唱片/录音骨架。C3 应把“认证成立但身份未解析”归入身份确认态，而不是空档案或无限 loading。

另一个现状风险：未登录判断只检查 `nfts.length`，如果匿名 Material 缓存非空，未登录用户会绕过登录态并看到缓存和本地草稿。缓存展示必须同时受当前身份键和“正在刷新”标识约束。

## 5. 七种 Score 状态映射

### 5.1 当前实际表现

当前 API 不返回 `ScoreMintStatus`，`ScoreCard` 只看 `tokenId != null`：

| 后端真值 | 常见 token 字段 | 当前文案 / 动作 | 问题 |
|---|---|---|---|
| `pending` | null | “Ripples · 上链中” → `/score/<UUID>` | 丢失“等待制作”语义 |
| `uploading_events` | null | 同上 | 丢失“保存演奏中”语义 |
| `minting_onchain` | 多数为 null | 同上 | 丢失“写入链上”语义 |
| `uploading_metadata` | 已可能有 token | 显示“Ripples #N” → `/score/<token>` | 在永久 metadata 未完成前伪装成完成 |
| `setting_uri` | 已有 token | 同上 | 永久播放器未绑定却伪装成完成 |
| `success` | 有 token | “Ripples #N” → `/score/<token>` | 这是唯一准确分支 |
| `failed` | 取决于失败阶段 | 无 token 时“上链中”；有 token 时像成功 | 没有失败文字、失败类型或真实恢复动作；无 token 还会每 2 分钟永久轮询 |

`useScoreNftPolling` 也只以 `tokenId == null` 判断 pending；因此 token 已写回但还在 `uploading_metadata/setting_uri` 时可能停止刷新，failed 且无 token 时则持续静默轮询。

### 5.2 C2 必须建立的直接映射

| `ScoreMintStatus` | 档案标签 | 路由 / 主动作 |
|---|---|---|
| `pending` | 等待制作 | `/score/<queue UUID>`：查看进度 |
| `uploading_events` | 保存演奏中 | `/score/<queue UUID>`：查看进度 |
| `minting_onchain` | 写入链上 | `/score/<queue UUID>`：查看进度 |
| `uploading_metadata` | 装配唱片 | `/score/<queue UUID>`：查看进度 |
| `setting_uri` | 绑定永久播放器 | `/score/<queue UUID>`：查看进度 |
| `success` | 永久唱片 | `/score/<tokenId>`：打开唱片 |
| `failed` | 制作未完成 | 先进入可说明失败类型的 UUID 详情；恢复动作必须来自真实 API |

所需最小契约：`OwnedScoreNFT` 增加 `status: ScoreMintStatus` 与用于失败分流的 `failureKind`（或等价受限类型）；API 显式 select/return；卡片和轮询改读 `status`，不得再从 token 是否存在猜状态。

阻塞决策：仓库目前没有 Score 队列的用户恢复 API。`POST /api/mint/score` 是“录音首次入队”，不能安全冒充 failed queue 的重试；`safe_retry/manual_review` 也需要不同处理。因此 playbook 的“查看既有恢复入口”与现状不一致。C2 可先保留“查看详情”，但若要按钮名叫“恢复制作”，必须先由后端定义真实、幂等且按 `failure_kind` 分流的入口。

## 6. 局部失败边界

| 故障 | 当前可继续显示 | 当前用户反馈 | C3 要求 |
|---|---|---|---|
| Score 网络拒绝 / JSON 解析失败 | Material、录音继续 | 唱片区行内错误 | 保持分区级错误，可独立重试 |
| Score HTTP 401/500 | Material、录音继续 | data source 返回 `[]`，常被误判为空 | 非 2xx 必须 throw 结构化错误；401 仍走统一认证失效 |
| Material 网络或 HTTP 失败 | 旧 Material 缓存、Score、录音继续 | 只写 console；没有素材区错误 | 独立 `materialsError` + 缓存“正在刷新/刷新失败”标签 |
| 录音网络拒绝 / JSON 解析失败 | Score、Material、本地草稿继续 | 录音区仅在没有条目时显示错误 | 有本地条目时也要显示非阻塞错误条，不能把远端失败藏掉 |
| 录音 HTTP 401/500 | 同上 | data source 返回 `[]`，常被误判为空 | 非 2xx 必须进入录音区错误态 |
| 单条录音事件加载失败 | 其他所有条目 | 该行“播放加载失败” | 行内明确“重试播放”，不升级成整区错误 |
| 单条本地草稿上传失败 | 其他所有分区 | 只写 console，本地草稿保留 | 该录音行标明“仅保存在此设备 / 上传失败” |
| 上传成功后的二次录音刷新失败 | 已有页面内容 | `await fetchMyScores` 位于未捕获的异步分支，可能形成未处理 rejection | 纳入录音分区刷新错误，不影响已成功上传事实 |
| Score 2 分钟轮询失败 | 页面已有内容 | 空 catch，完全静默 | 保留旧数据并标“更新暂不可用”；不可清空列表 |
| `getAccessToken()` 返回 null | 本地缓存 | 三个 loaded flag 不落地，骨架可永久存在 | 转成身份失效/身份确认态，不当作数据空或持续加载 |
| Track/Arweave 单行关联异常 | 取决于 route | Score 的 `resolveArUrl` 可能让整区失败；Material pending 用 null 强转 | 可安全局部化的单行异常应降级该行，不拖垮整个分区 |

空状态还有竞态：Material 请求先结束并把 `loaded=true` 后，Score/录音仍在加载时，当前总空态可能提前出现。档案总空态必须等三个远端分区都完成首次判定，或分别显示各自空态。

## 7. 建议目录与 220/8 核对

当前硬线：

- `app/me/page.tsx`：219 行，已贴近 220；`loading.tsx`：32 行；`app/me` 直属 2 文件。
- `src/components/me`：直属 7 文件（上限 8）；新增 `archive/` 目录不会增加直属“文件”数，但不应再加第 8 个临时桥接文件后继续扩张。
- `src/data`：直属 8 文件，已经满额；C2/C3 不得在这里新增直属 data source。
- `src/hooks`：直属 7 文件；若需要档案编排 hook，应建 `src/hooks/me/`，不要占满根层。
- 所有现有 `/me` 组件均低于 220 行；`page.tsx` 的重写必须在同一闭环内降到有余量，不能在 219 行上累加状态。

建议结构：

```text
src/components/me/archive/
  ArchiveHeader.tsx
  ArchiveSection.tsx
  ArchiveEmpty.tsx
  archive.css
  score/
    ScoreArchiveRow.tsx
    score-status.ts
  recording/
    RecordingArchiveRow.tsx
  material/
    MaterialArchiveRow.tsx
```

`archive/` 根层 4 个文件，各类别子目录 1–2 个文件，能容纳 C2 而不触碰 8 文件硬线。旧 `DraftCard/DraftSection/NFTCard/ScoreCard/ScoreNftSection/SkeletonRows/EmptyState` 应逐类迁移后删除，不保留两套长期并行 UI。

若 C3 的请求状态令 `page.tsx` 再次逼近上限，建议把纯编排放入 `src/hooks/me/useMeArchive.ts`；如需新的 data adapter，建 `src/data/me/`。这两个建议都需要在对应 step 的范围授权后执行，C0 不创建它们。

## 8. 可直接执行的迁移清单

1. C1 先建立档案骨架和固定顺序，数量分别取 `scoreNfts.length`、服务端录音 + 本地草稿、Material 列表；加载中数字不可暂报 0。
2. C2 先扩展 Score API/type 的 `status/failureKind` 契约，再写 `score-status.ts` 的七态穷尽映射；不从 `tokenId` 推断状态。
3. 迁移录音行的 lazy events 播放、全局 Player、铸造与重试；为 BottomPlayer 增加页面底部安全留白。
4. 迁移素材真实文本字段；当前没有素材外链，不新增假链接或假封面。
5. C3 让三个远端分区各自拥有 `loading/error/stale-or-refreshing`，data source 对非 2xx 抛错；总空态等待所有分区判定完成。
6. 对 Score failed 的恢复入口先做产品/后端决策；在真实入口出现前只允许“查看详情”，不做会误导用户的假恢复按钮。

## 证据索引

- 页面编排与认证门：`app/me/page.tsx`
- 当前按钮与卡片：`src/components/me/DraftCard.tsx`、`ScoreCard.tsx`、`NFTCard.tsx`
- 全局播放带出的动作：`src/components/player/PlayerProvider.tsx`、`BottomPlayer.tsx`、`src/hooks/useFavorite.ts`
- 本地草稿与 Material 缓存：`src/lib/draft-store.ts`、`src/lib/nft-cache.ts`
- 双源认证：`src/hooks/useAuth.ts`、`src/lib/auth/client-jwt.ts`、`src/lib/auth/middleware.ts`
- 客户端数据源：`src/data/jam-source.ts`、`src/data/nfts-source.ts`
- 服务端真值：`app/api/me/scores/route.ts`、`app/api/me/scores/[id]/events/route.ts`、`app/api/me/score-nfts/route.ts`、`app/api/me/nfts/route.ts`
- 状态类型：`src/types/jam.ts`
