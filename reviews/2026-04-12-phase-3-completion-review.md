# Phase 3 Completion Review

日期：2026-04-12  
范围：Phase 3A + Phase 3B 已交付代码（Arweave / ScoreNFT / MintOrchestrator / score mint queue / `/score/[tokenId]` / chain sync）

## 结论

Phase 3 已经把产品从“草稿”推进到了“可铸造、可分享、可公开回放”的阶段，方向是对的，主干路径也已经跑通。  
但如果按“可长期运行、可主网承压、可对外承诺 permanence”的标准看，当前实现里仍有几处高后果问题，其中最危险的是 **score cron 没有原子 claim**，这会把单条队列任务放大成 **重复 mint / 孤儿 token / 永久 metadata 错位**。

下面只列我认为值得立刻进入修复清单的项，按严重度排序。

---

## Findings

### [P0] `process-score-queue` 没有原子 claim，同一条任务可以被并发 cron 重复 mint

位置：
- `app/api/cron/process-score-queue/route.ts:42`
- `app/api/cron/process-score-queue/route.ts:55`
- `app/api/cron/process-score-queue/steps-chain.ts:57`
- `app/api/cron/process-score-queue/steps-chain.ts:63`

问题：

当前 cron 是先 `select` 最老的一条可处理任务，再按内存里的 `row` 去执行后续 step。这里没有 `FOR UPDATE SKIP LOCKED`、没有 claim token、没有 `claimed_at / claimed_by` 字段，也没有“更新成功才算拿到任务”的 compare-and-swap。

这意味着只要出现下面任一情况，就可能有两个 worker 同时处理同一条记录：

- Vercel cron 重叠触发
- 人工重复点 cron URL
- 上一次请求超时但其实仍在执行
- 网络抖动导致平台重试

最危险的分支是 `minting_onchain`：

1. A/B 两个 worker 同时读到同一条 `row`
2. 两边看到的都是 `tx_hash = null`
3. 两边都发送 `mintScore`
4. 一边把 `tx_hash/token_id` 覆盖另一边
5. 链上实际出现两张 NFT，但 DB 只记住其中一张

后果：

- 多铸一张无法被 DB 正常追踪的孤儿 ScoreNFT
- 只有其中一张会走到 `setTokenURI`
- 另一张会永久停留在无 metadata 状态
- 后续 `/score/[tokenId]`、`/me`、观测接口都会出现“链上真相”和“DB 真相”分叉

建议：

- 把“取任务”改成事务级 claim，而不是普通 `select`
- 推荐新增一个 Supabase RPC：`claim_score_queue_job()`，内部做：
  - `select ... for update skip locked`
  - 原子写入 `claimed_at / claimed_by / updated_at`
  - 返回唯一被 claim 的一条记录
- 所有 step 结束时，状态推进也要带条件：`where id = ? and status = ?`

---

### [P1] `setting_uri` 不是真正幂等，重试会重复写 `mint_events`

位置：
- `app/api/cron/process-score-queue/steps-chain.ts:116`
- `app/api/cron/process-score-queue/steps-chain.ts:146`
- `src/data/score-source.ts:28`
- `src/data/score-source.ts:32`

问题：

`stepSetTokenUri()` 对链上 `setTokenURI` 做了“相同 URI 则跳过”的处理，但它对数据库侧的 `mint_events` 写入并不幂等。当前代码每次进入这个 step，都会直接 `insert` 一条新的 `mint_events`：

- 没有 `upsert`
- 没有 `unique(score_queue_id)`
- 没有 `unique(score_nft_token_id)`

所以只要出现下面这种很常见的时序，就会重复写：

1. `mint_events.insert(...)` 成功
2. 路由在把 `score_nft_queue.status` 更新成 `success` 之前超时/崩溃
3. 下次 cron 再次进入 `setting_uri`
4. 因为 `row.token_uri` 已经存在，链上调用被跳过
5. 但 `mint_events` 又被插入一遍

后果：

- 同一个 `score_nft_token_id` 出现多条永久记录
- `getScoreByTokenId()` 用 `.single()` 查询时会直接失败
- 公开页 `/score/[tokenId]` 会从“本来能打开”退化成 404

建议：

- 给 `mint_events.score_queue_id` 加唯一约束
- `stepSetTokenUri()` 改成 `upsert`，以 `score_queue_id` 为幂等键
- `/score/[tokenId]` 不要假设表里永远只有一条；至少要对“多条”做降级处理和日志告警

---

### [P1] 永久 metadata 里还在写占位域名，已经铸造出去的 NFT 会永远带错分享链接

位置：
- `app/api/cron/process-score-queue/steps-upload.ts:123`

问题：

`metadata.external_url` 现在写死成：

- `https://ripples.example/score/${row.token_id}`

这不是临时 UI 问题，而是 **永久 metadata 污染**。因为 metadata 一旦上传到 Arweave 并写进 `tokenURI`，这条错误链接就会跟着 NFT 永久存在。

后果：

- OpenSea / 任意 NFT 客户端点“外部链接”都会跳到假域名
- 以后就算站点正式上线，已经 minted 的这批 NFT 也无法自动修正
- 这直接损伤“可分享”这个 Phase 3 的核心承诺

建议：

- 立刻引入显式环境变量，例如 `NEXT_PUBLIC_APP_URL`
- metadata 生成时统一基于该变量拼接 `external_url`
- 没有配置正式 URL 时，`mint` 应该 fail fast，而不是写 placeholder

---

### [P1] 底曲缺失时被静默降级成 demo 曲目，会永久铸造出“标题对，声音错”的 ScoreNFT

位置：
- `app/api/cron/process-score-queue/steps-upload.ts:99`
- `src/data/score-source.ts:85`

问题：

现在只要某首 track 缺少 `arweave_url`，系统不会报错，而是自动 fallback 到一个硬编码 demo 底曲：

- `ar://qwL34NhT4fvuJHO9wLE2AcVwYrooXrkOSNRqiB1DSOE`

这和 Phase 3 冻结决策 D3 是相反的。D3 的意思是“底曲是前置资源，没准备好就不能 mint”；当前实现却把“缺底曲”静默伪装成“还能继续 mint”。

后果：

- 用户看到的 `track.title` 是 A
- 实际回放的 base track 是 demo B
- metadata / 分享页 / decoder 三处一起固化错误
- 这是不可逆的数据质量事故，不是普通 bug

建议：

- `track.arweave_url` 缺失时直接抛错并停在当前 step
- 把它当成运维配置错误，而不是产品降级路径
- demo 资源只能用于本地开发，不应进入铸造主链路

---

### [P1] Phase 3B 已经同步了链上事件，但“我的乐谱”仍按最初 mint 人展示，未按真实 owner 展示

位置：
- `app/api/me/score-nfts/route.ts:37`
- `app/api/me/score-nfts/route.ts:40`
- `app/api/cron/sync-chain-events/route.ts:62`

问题：

`sync-chain-events` 已经把 `Transfer` 事件同步到了 `chain_events`，说明项目已经承认“链上 owner 可能变化”。  
但 `/api/me/score-nfts` 仍然直接按 `score_nft_queue.user_id = 当前用户` 去取数据，这只是“最初是谁 mint 的”，不是“现在谁持有”。

后果：

- 用户把 ScoreNFT 转给别人后，原持有人 `/me` 里还会继续显示它
- 新持有人 `/me` 里却完全看不到它
- 产品语义从“我的乐谱”退化成了“我曾经铸造过的乐谱”
- 这和做了 Phase 3B 的初衷没有真正闭环

建议：

- 明确 `/me` 的语义到底是“我 mint 过的”还是“我当前持有的”
- 如果 UI 文案继续叫“我的乐谱”，那数据源就应该切到 owner projection
- 最小方案：基于 `chain_events` 维护一张 `score_nft_owners` 投影视图/表，再让 `/api/me/score-nfts` 读它

---

### [P2] `/score/[tokenId]` 还没有真正实现“链上灾备路径”，当前 permanence 仍依赖数据库完整性

位置：
- `src/data/score-source.ts:6`
- `src/data/score-source.ts:27`
- `src/data/score-source.ts:58`

问题：

文件注释写的是：

- 主路径：`mint_events.score_data`
- 灾备路径：`tokenURI -> Arweave metadata -> events`

但实现里只有前半句，没有后半句。当前代码只要碰到下面任一情况，就直接 `return null`：

- `mint_events` 丢行
- `score_nft_queue` 丢行
- `tracks` / `users` 关联丢失

换句话说，公开页现在仍然强依赖 DB，而不是强依赖链上 + Arweave。  
这和“永久可回放”的产品承诺还有一层差距。

建议：

- 真正实现链上 fallback：
  - 先读 `ScoreNFT.tokenURI(tokenId)`
  - 拉 metadata
  - 从 `animation_url` / `events` 参数恢复回放
- DB 不足时不要直接 404，至少要降级成“可播放但信息不完整”

---

## 正向评价

这轮 Phase 3 里有几件事我会明确给高分：

- `metadata` 改到 cron 侧生成，解决了 `tokenId` 先后顺序问题
- `MintOrchestrator` 保持了薄壳语义，没有把 TBA 强行塞进主链路
- `queue-status` 和 `sync-chain-events` 至少把“可观测性”和“链上事实同步”开了头
- `Score Decoder` 独立上 Arweave，这个产品方向是对的，未来很有传播潜力

---

## 我建议的修复顺序

### 第一优先级（进入 Phase 3.1 / Hotfix Sprint）

1. 先修 `process-score-queue` 的原子 claim
2. 再修 `mint_events` 的幂等写入
3. 再修 metadata 的 `external_url`
4. 再去掉 demo base track fallback

### 第二优先级（紧接着补齐）

1. 定义 `/me` 到底展示“minted by me”还是“owned by me”
2. 真正把 `chain_events` 接到 owner projection
3. 补上 `/score/[tokenId]` 的链上灾备路径

---

## CTO 总判断

如果把 Phase 3 定义为“已经证明产品方向成立”，我同意。  
如果把 Phase 3 定义为“现在就能放心把这条铸造链路往主网/真实用户量上推”，我不同意，至少还差一轮以 **并发安全、永久 metadata 正确性、owner 真理源** 为核心的收口。

这不是推翻重做，而是一次很典型的 **Phase 3.1 稳定性冲刺**。  
你们现在最该做的不是继续加新故事，而是先把这条已经非常接近产品化的主链路，修到“不会背刺自己”。
