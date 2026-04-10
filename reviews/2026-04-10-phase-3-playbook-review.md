# Phase 3 Playbook Review

日期：2026-04-10
对象：`playbook/phase-3-score-nft.md`

## 结论

这份 Phase 3 playbook 的方向是对的，产品想象力也够完整：它不是只想“多铸一个 NFT”，而是想把合奏草稿升级成可分享、可回放、可在 OpenSea 听到的作品资产。

但从 CTO 视角看，它现在还不是一份可以直接开工的执行手册。最大的问题不是“功能太难”，而是**有几处关键依赖顺序、资产语义和架构真理源之间还没有对齐**。如果不先收口，团队很容易在 S3-S5 这段进入“代码能写，但越写越发现前提不成立”的返工状态。

下面是我认为最值得优先处理的点。

---

## Findings

### [P0] S5 的 metadata 生成顺序和 ScoreNFT 的 tokenId 生成方式互相冲突，这条链路按当前写法跑不通

**证据**

- `playbook/phase-3-score-nft.md:104-106`：ScoreNFT 的 `tokenId` 是**自增**，`mint(to, tokenURI)` 时写入 `tokenURI`
- `playbook/phase-3-score-nft.md:199-205`：`POST /api/mint/score` 里先上传 `events.json`，再生成并上传 `metadata.json`
- `playbook/phase-3-score-nft.md:203`：metadata 里要写 `external_url: /score/{tokenId}`
- `playbook/phase-3-score-nft.md:181-193`：`score_nft_queue` 表里没有 `metadata_ar_tx_id`、`events_ar_tx_id`、`token_uri` 之类字段

**为什么这是问题**

这里存在一个硬依赖矛盾：

1. metadata 需要知道 `tokenId`，因为 `external_url` 要写 `/score/{tokenId}`
2. 但 `tokenId` 只有链上真正 `mint` 时才知道，因为合约是自增 ID
3. 当前 playbook 却要求在 API 入队阶段就把 metadata 上传完

这还不是唯一问题。即使你先不写 `external_url`，当前 `score_nft_queue` 也没有保存 `metadataArTxId`，cron 在后面根本没有稳定数据源去执行 `ScoreNFT.mint(to, tokenURI)`。

换句话说，**S5 现在缺的不是某个字段名，而是整条“谁先知道 tokenId、谁负责生成 metadata、哪一层持久化 mint 输入”的顺序设计**。

**建议**

- 先把这条链路明确成两种方案中的一种，不要模糊：
  - 方案 A：`POST /api/mint/score` 只做“冻结输入 + 入队”，真正的 `events.json / metadata.json` 生成放到 cron，链上 mint 成功拿到 tokenId 后再补 metadata
  - 方案 B：改成**可预知 tokenId** 的分配方式，再允许 API 预生成 metadata
- 无论选哪种，`score_nft_queue` 都必须升级成“可完整重跑”的队列表，而不是只存 `cover_ar_tx_id`

---

### [P0] S3 的 TBA 资产流转语义没有闭环，而且和当前“用户无签名”产品原则直接冲突

**证据**

- `docs/ARCHITECTURE.md:21-22`：项目明确写了“用户全程不需要 ETH / AR / 签名”
- `docs/JOURNAL.md:72`：已明确“Phase 3 做 ScoreNFT 时，Score 和 MaterialNFT 是独立资产，不互为前置条件”
- `playbook/phase-3-score-nft.md:125-127`：MintOrchestrator 要做 `MaterialNFT.safeTransferFrom(from, tba, ...)`
- `playbook/phase-3-score-nft.md:135-136`：又要求给 orchestrator `MaterialNFT` 的 `MINTER_ROLE`

**为什么这是问题**

当前写法把三种完全不同的资产语义混在了一起：

1. **转移用户已有的 MaterialNFT 到 TBA**
2. **由 orchestrator 新 mint 一份 MaterialNFT 到 TBA**
3. **ScoreNFT 和 MaterialNFT 独立存在，只做“关联”而不做转移**

这三种路径的安全模型、供应语义、用户理解都完全不同。

而且只要走 `safeTransferFrom(from, tba, ...)` 这条路，就会立刻撞上当前产品原则：  
用户现在没有签名环节，也没有链上 approval 流程，orchestrator 不可能凭空拿到用户 ERC-1155 的转移授权。

所以这不是“实现细节还没写”，而是**资产模型还没做最终选择**。

**建议**

- 在 playbook 顶部先单独冻结一个决策：
  - `TBA 里到底放什么`
  - `这些资产从哪里来`
  - `用户需不需要签名 / approval`
- 如果坚持“用户无签名”，那 Phase 3 最稳的方案通常是：
  - ScoreNFT 独立 mint
  - TBA 默认关闭，或只做可选实验能力
  - 不把 MaterialNFT 转移写进主链路
- 如果坚持主链路就带 TBA，那必须同步引入授权机制和用户交互改造，不能还沿用“无感收藏”的叙事

---

### [P1] `score_covers` 的分配方式和 `pending_score` 的消费方式都依赖事务/锁，但 playbook 还在按普通 API 步骤描述，执行层会失真

**证据**

- `playbook/phase-3-score-nft.md:87-88`：封面分配写的是 `ORDER BY usage_count ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
- `playbook/phase-3-score-nft.md:198-205`：`POST /api/mint/score` 里要分配封面、上传 Arweave、写队列、再把 `pending_score` 标成 `expired`
- `reviews/2026-04-10-phase-2.5-completion-review.md:69-90`：Phase 2.5 刚刚明确指出过，草稿消费链路最大的风险就是“缺事务边界”

**为什么这是问题**

这份 playbook 在产品层面已经开始写“锁”和“消费”，但在执行层面还没有把它们升级成数据库事务/RPC。

这会带来两个直接后果：

1. 封面分配看起来像“并发安全”，但如果只是普通 route 里写几步 Supabase 调用，实际并不具备 `FOR UPDATE SKIP LOCKED` 的原子语义
2. `pending_score` 一旦在 API 阶段被提早 `expired`，后面 Arweave 上传、队列写入、cron 铸造任一环失败，都可能把用户作品推进半成品状态

**建议**

- 不要把这部分写成“route.ts 里顺序执行几步”
- 直接在 playbook 里写明：  
  `封面分配 + 队列写入 + pending_score 消费` 必须走数据库事务或 RPC
- Phase 2.5 那条 `save draft` 事务化 deferred，也建议和这一步一起收口，否则你会在 ScoreNFT 链路里重复踩同一类坑

---

### [P1] Arweave 资源范围在同一份 playbook 里前后矛盾，当前版本无法同时满足“永久回放承诺”和“Phase 3 范围控制”

**证据**

- `docs/JOURNAL.md:32`：架构口径已经明确成“26 音效 + 10000 封面 + 108 底曲全部预上传一次性复用”
- `docs/ARCHITECTURE.md:296`：Phase 3 的定义里包含 `score-decoder.html 上传 Arweave`
- `playbook/phase-3-score-nft.md:153-155`：S4 写的是 decoder 从 Arweave 加载 `events.json + 底曲 mp3 + 26 个音效 mp3`
- `playbook/phase-3-score-nft.md:278`：延后项里又写“底曲 mp3 预上传 Arweave”不在 Phase 3 做，先继续用 `public/` URL

**为什么这是问题**

当前 playbook 里同时存在两种互相打架的说法：

1. decoder 的正式回放协议依赖 Arweave 上的底曲
2. 但底曲预上传又被后移出 Phase 3

如果真的按“先用站内 `public/` URL”落地，会直接削弱 Phase 3 最核心的价值承诺：

- OpenSea/外部回放是否还能稳定拿到底曲
- 项目退出后是否还能完全独立回放
- 成本模型里“静态资源一次性预上传、后续增量只加 events+metadata”的叙事是否仍然成立

**建议**

- 在 playbook 里二选一，不要两种都留：
  - 要么承认“108 底曲也属于 Phase 3 前置资源”，把它们前移进 S0
  - 要么承认“Phase 3 先做半永久版本”，并同步改 ARCHITECTURE/JOURNAL，不再宣称完整的 Arweave 复现链路已在 Phase 3 兑现

---

### [P1] playbook 和 `ARCHITECTURE.md` 的 Phase 3 边界已经出现冲突，尤其是链上事件同步被后移了

**证据**

- `docs/ARCHITECTURE.md:295-296`：架构把 Phase 3 定义为“ScoreNFT + MintOrchestrator + score_data 自包含 + score-decoder + 公开回放页 + ShareCard + 唱片架 / 链上事件同步”
- `playbook/phase-3-score-nft.md:277`：延后项明确把“链上事件同步 cron”推到 `Phase 4+`

**为什么这是问题**

这里不一定是谁对谁错，但它已经是一个明确冲突：

- 如果 Phase 3 真的不做链上事件同步，那 `ARCHITECTURE.md` 需要同步降级
- 如果 Phase 3 按架构必须做，那 playbook 当前就是缩 scope 了

按照项目规则，这种冲突不能默默带过。

**建议**

- 在开始写代码前先统一真理源
- 如果用户想缩小 Phase 3 范围，我建议显式改成：
  - `Phase 3A：可信铸造 + Decoder + 分享`
  - `Phase 3B：链上事件同步 + 运营侧可观测性`

这样既不骗自己“Phase 3 全做了”，也不会把主线价值拖慢

---

### [P2] 新的 sponsored mint 入口已经进入主链路，但 playbook 没把限流/熔断/资源池监控一并提到同优先级

**证据**

- `playbook/phase-3-score-nft.md:196-205`：新增 `POST /api/mint/score`
- `docs/HARDENING.md:8-12`：已经明确写了 `mint_score` 需要每用户每小时限流和全局积压熔断

**为什么这是问题**

`POST /api/mint/score` 不是普通 CRUD，而是新的“会消耗 Arweave 上传 + cron 处理 + 链上 gas + 封面池”的高成本入口。

如果 playbook 不在 API 设计阶段就把这些护栏放进完成标准，团队很容易等到“功能都通了”以后再补，最后变成线上接单口先裸奔。

**建议**

- 不一定要在 Phase 3 一开始就把所有 Hardening 全做完
- 但至少把下面三项写进 S5 的完成标准：
  - `mint_score` 限流
  - `score_nft_queue` 全局积压阈值
  - `score_covers` 余量监控 / usage_count 异常告警

---

## 我建议的重排顺序

当前 S0-S7 的“概念顺序”没问题，但“执行顺序”还可以更稳。更推荐的版本是：

1. **P3-0：冻结资产语义**
   - 先决定 ScoreNFT / MaterialNFT / TBA 的关系
   - 决定是否保留“用户无签名”作为硬约束

2. **P3-1：冻结 mint 输入协议**
   - 队列表到底要存什么
   - metadata 什么时候生成
   - tokenId 什么时候可知
   - `/score/[tokenId]` 的数据主路径与灾备路径

3. **P3-2：静态资源前置**
   - sounds / covers / base tracks / decoder 的 Arweave 策略一次讲清

4. **P3-3：合约层**
   - ScoreNFT
   - Orchestrator
   - TBA fallback

5. **P3-4：API + cron**
   - 在输入协议已经冻结后再落 route 和 queue

6. **P3-5：公开回放页 + 分享**
   - 这是 Phase 3 最直接的用户价值，应该尽量建立在稳定协议之上，而不是反过来逼协议改名

---

## 建议你让 Claude 先回答的 5 个问题

1. `external_url` 里的 `tokenId` 在链上 mint 之前不知道，这个问题准备用什么机制解？
2. `score_nft_queue` 准备保存哪些字段，才能保证 cron 失败后可以完整重跑？
3. TBA 里的 MaterialNFT 是“转移用户已有资产”，还是“系统另 mint 一份关联资产”，还是“暂时不进主链路”？
4. Phase 3 到底包不包含 108 底曲预上传 Arweave？如果不包含，是否同步修改 `ARCHITECTURE.md` 和 `JOURNAL.md`？
5. `chain events sync` 是真的后移到 Phase 4+，还是拆成 `Phase 3B`？

---

## 总评

这份 playbook 的产品 ambition 很强，方向上我认同，尤其是：

- 把 Score Decoder 放在 Phase 3 核心位置，而不是拖成“退出工具”
- 把公开回放页和分享卡纳入主线，而不是只做链上铸造
- 试图把 ScoreNFT 做成“作品资产”，不是单纯链上纪念章

但如果要我给一句 CTO 式结论，我会这么说：

**它已经是一份很好的“愿景型 playbook”，但还不是一份可以无风险开工的“执行型 playbook”。**  
现在最应该补的不是更多步骤，而是先把 `tokenId / metadata / queue / TBA / Arweave scope` 这 5 个根节点钉死。
