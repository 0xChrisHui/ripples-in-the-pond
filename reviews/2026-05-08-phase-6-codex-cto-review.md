# Phase 6 严格 CTO Review (Codex 独立视角)

日期：2026-05-08
审查范围：Phase 6 v2 全量（基线 1019dcb → HEAD b418ade）
立场：独立第二意见，不复述 Claude completion review

## 摘要

Phase 6 可以进入 Phase 7 的工程整理阶段，但不能直接进入主网或公开测试。当前没有发现“用户资金立即丢失”的 P0 业务漏洞；但发现一个明确主网阻塞：服务端链配置仍硬编码 OP Sepolia。只要这个问题存在，主网环境变量和主网合约地址都无法保证交易真的发到 OP Mainnet。

主要担忧不是单点功能是否能跑通，而是恢复语义和运营兜底还不够硬。score 队列的 durable lease、步骤内状态跳转、Upstash 全局 EOA 锁三者叠加后，表面上是“可重试状态机”，实际会把正常流程拉长到分钟级，并在超时、广播后崩溃、锁过期等路径上留下人工难以识别的半成功状态。

Phase 7 起点必须先修三类债：链配置和环境变量 fail-fast、score 队列恢复与告警、公开产品语义收口。视觉 demo、空投和 `/test` 沙箱可以保留为材料，但不能继续以“已经完成”的方式进入主网叙事。

## 维度 1：正确性与边界

**[P0] src/lib/chain/operator-wallet.ts:6 — 服务端链固定为 OP Sepolia，主网环境无法生效**

问题：`operator-wallet.ts` 直接 import `optimismSepolia`，并在 `walletClient`、`publicClient` 中固定使用它。即使部署时把 `NEXT_PUBLIC_CHAIN_ID` 设为 `10`、合约地址设为 OP Mainnet，cron 交易和链上读取仍会走 OP Sepolia。这会导致主网部署出现“数据库认为在主网、交易实际在测试网”的灾难性分裂。

建议：新增唯一链配置模块，从服务端环境读取 chain id，只允许 `10` 或 `11155420`，并让 operator wallet、public client、explorer link、合约地址校验都从同一配置派生。生产环境如果不是 `10` 直接启动失败。

**[P1] src/data/score-source.ts:99 — `pending_scores.events_data` 被当作可选项，实际已是播放真值**

问题：`Promise.allSettled` 中 `pending_scores` 查询失败后只是记录日志，然后把 `events` 置为空数组。上层 `ScorePlayer.tsx:45` 会显示“无事件数据”。但 B8 后 `/score/[id]` 已经删除 `score-fallback.ts`，播放依赖 DB 的 `events_data`；如果 Supabase 超时、行被误删、JSON 损坏，即使 NFT metadata 或 Arweave 上还有 `events_ar_tx_id`，用户看到的仍是不可播放页面。

建议：对已完成铸造的 score，`pending_scores` 缺失不能静默降级为空事件。应按 `events_ar_tx_id` 或 metadata Arweave 做灾备读取；灾备也失败时显示可重试错误，而不是“无事件数据”。

**[P1] src/hooks/useEventsPlayback.ts:34 — 首次播放时事件时序会被音效解码队列压扁**

问题：`useEventsPlayback` 在 `ready` 为真后按 `performance.now()` 触发事件，但 `useJam.ts:56` 的 ready 只代表 MP3 ArrayBuffer 已取回，不代表 AudioBuffer 已 decode。首次播放时 `useJam.ts:76` 才创建 AudioContext 并 decode，期间 `playSound` 把 key 放入队列；decode 完成后 `useJam.ts:94` 会立即播放队列里的所有 key。慢网或低性能设备上，乐谱前几秒的事件会集中爆发，和底轨时间线错位。

建议：Score 播放按钮点击后先预热并完成全部音效 decode，再启动底轨和事件时钟；或者改用 AudioContext 时间调度，让事件和声音 buffer 的 ready 状态显式绑定。

**[P2] app/score/[id]/page.tsx:73 — 路由 id 边界处理能抗注入，但仍缺少规范化策略**

问题：`/score/[id]` 对纯数字走 token id，对 UUID 走 queue id，其他字符返回 null。SQL 注入字符不会进入动态 SQL，基本安全。但 `id="0001"`、超长数字、大写 UUID、带空白字符的分享链接会出现不一致行为：有些可解析、有些 404、有些在 OpenGraph 和页面之间生成不同 URL。

建议：在路由入口集中 normalize：trim、限制长度、数字去前导零或重定向到规范 token path、UUID 统一小写。非法格式直接 `notFound()`，不要继续进入数据层。

**[P1] src/data/score-source.ts:61 — token_id 重复只靠 `.order().limit(1)` 掩盖**

问题：`getScoreByTokenId` 对同一个 `token_id` 只取最新一条，但 `supabase/migrations/phase-3/009_score_nft_queue.sql:39` 只保证 `pending_score_id` 唯一，未保证 `token_id` 唯一。migration 029 只是改 enqueue 不再 expire draft，没有补 token 唯一约束。只要出现重复 token 行，页面、分享卡、metadata 和 `/me` 会随机偏向一条记录。

建议：先写一次性检查脚本清理重复 token，再加 `score_nft_queue(token_id)` 的 partial unique index（例如 `where token_id is not null`）。代码里的 `.order().limit(1)` 可以保留为防御，但不能替代 DB 约束。

## 维度 2：架构一致性

**[P1] docs/ARCHITECTURE.md:257 — A5 链上灾备承诺与当前 `/score` 实现脱节**

问题：架构文档承诺 chain first，数据库只是缓存；但 B8 后 `/score/[id]` 事实上完全依赖 DB row。`src/data/score-source.ts:137` 在 pending score 查询失败时降级为空事件，没有从链上 tokenURI 或 Arweave metadata 重建 score。这不是单个缺陷，而是架构承诺和实现方向已经分叉。

建议：Phase 7 开始先重写 score-source 的数据来源优先级：URL token id → 链上 owner/tokenURI → metadata/events Arweave → DB cache。DB 可以加速，但不能是唯一真值。

**[P2] src/lib/effects/ 与 src/hooks/effects/ — 视觉系统拆分缺少新人可执行的边界说明**

问题：B2 后效果逻辑分散在 `src/lib/effects/`、`src/hooks/effects/`、`src/lib/render/`、`src/components/animations-svg/effects/`。从命名看不出“纯算法、React 生命周期、SVG 渲染、沙箱实验”的边界。新人要加一个效果时，很容易把状态、渲染和物理参数混在一起。

建议：补一页 `docs/effects.md` 或在目录 README 里写清楚：哪些目录只放纯函数，哪些目录允许 hook，哪些是生产组件，哪些只服务 `/test`。同时给新增效果提供一个最小模板。

**[P2] src/components/animations-svg/effects — 目录文件数例外没有进入规范文档**

问题：`.claude/hooks/check-folder-size.js:54` 对 `src/components/animations-svg/effects` 放了目录文件数例外，但 `docs/CONVENTIONS.md` 仍写单层目录最多 8 个文件。当前目录已经约 20 个文件。hook 和文档冲突会让后续 AI 或新人不知道该拆还是不拆。

建议：要么把 effects 目录拆为更小分组，要么把这个例外正式写入 `docs/CONVENTIONS.md`，说明为什么允许、什么时候必须再拆。

**[P2] app/test/page.tsx:1 — `/test` 已是线上可访问沙箱，不再只是内部实验**

问题：主页已经切到 fullscreen Archipelago，但 `/test` 仍作为生产路由存在，且导入生产动画组件和测试 hook。公开测试时用户或搜索引擎可以直接进入 `.xyz/test`，看到未承诺体验；未来重构视觉系统时也必须顾及这个隐形入口。

建议：Phase 7 前决定其身份。若是内部工具，放到 admin/dev feature flag 后；若是公开 demo，纳入导航、文案和验收；若无用，删除路由和专用测试 hook。

**[P2] src/lib/chain/contracts.ts:111 — TBA 已删除但前端 ABI 仍保留 TBA 函数**

问题：合约 `contracts/src/MintOrchestrator.sol:20` 已说明 TBA support removed，但 `contracts.ts` ABI 仍暴露 `tbaEnabled`、`setTbaEnabled`。未来开发者看到 ABI 会误以为生产合约支持开关，写出运行时必 revert 的代码。

建议：删除 dead ABI 项，并在架构文档保留“为什么删除 TBA”的决策说明即可。再加 grep 检查，避免 TBA 调用重新进入生产路径。

## 维度 3：幂等性、事务性、并发安全、恢复语义

**[P1] app/api/cron/process-score-queue/route.ts:83 — step 内状态跳转和 route CAS 冲突，正常流程会被 lease 拖慢**

问题：`steps-upload.ts:31` 在 step 内把 `pending` 改成 `uploading_events`，但 route 结束时仍用原始 `row.status` 做 CAS：`.eq('status', row.status)`。这次 CAS 会失败，row 保持 `uploading_events` 且 lease 不释放，只能等 5 分钟后下一轮 claim。`minting_onchain` 和 `setting_uri` 的“receipt not ready”也返回非 final 状态并保留 lease。结果不是一个请求内推进状态机，而是每个中间状态至少等一次 lease 过期。

建议：把状态推进收敛到一个地方。简单修法是非 final step 完成后主动释放 lease；更硬的修法是同一 owner 可继续 claim 自己的 lease，并在一次 cron 内循环推进到需要等待链上确认的边界。

**[P1] src/lib/chain/operator-lock.ts:10 — 全局 EOA 锁 30 秒无续期，长请求会发生 nonce 竞争**

问题：Upstash SETNX 锁 TTL 是 30 秒，cron 里包含 Arweave 上传、RPC 广播、receipt 查询和 Supabase 写入。任何一次请求超过 30 秒，另一个 cron 就能拿到同一个 operator EOA 的锁并发交易。此时 material、score、airdrop 三条 mint cron 会发生 nonce race，失败路径还不一定能归类为可恢复错误。

建议：锁 TTL 至少覆盖平台最大函数时长，或实现续期 heartbeat。更推荐把“使用 EOA 发交易”抽成单独的短临界区，并引入持久 nonce/tx 表，而不是用一个短 Redis 锁包住整段业务。

**[P1] app/api/cron/process-score-queue/steps-mint.ts:55 — 广播后崩溃被标 failed，人工恢复信息不足**

问题：mint 交易广播成功但数据库写 tx_hash 失败时，代码抛出 CRITICAL。route 捕获后会把 row 标为 `failed`，清掉 lease。链上可能已经 mint 成功，但系统只剩一条 failed row 和日志文本；score queue 没有 material queue 那种 `failure_kind`、`manual_review` 字段，health 也不会突出这种半成功状态。

建议：score queue 增加 `failure_kind`、`manual_action`、`last_tx_hash`、`manual_review_at`。CRITICAL 路径不能只写 failed，应进入 `manual_review`，并在 health 中作为 P1 告警暴露。

**[P1] app/api/cron/process-score-queue/steps-set-uri.ts:99 — `mint_events` 写入失败被忽略**

问题：`mint_events` upsert 的返回值没有检查 error，随后 step 仍返回 success，route 会把 score 标为 completed。链上和 score queue 都成功，但运营审计、同步或展示依赖的 mint event 可能永久缺失。material mint 流程在同类位置会检查并抛错，score 流程不一致。

建议：像 material queue 一样检查 event upsert error。失败时保持 `setting_uri` 或进入可重试状态，不能标 completed。

**[P2] supabase/migrations/phase-6/026_save_score_atomic.sql:21 — save_score_atomic 是事务性的，但并发语义不够确定**

问题：RPC 把“expire 旧 draft”和“insert 新 draft”放在一个函数里，确实减少半写入；但两个同用户同 track 的保存并发时，彼此可能把对方刚写入的 draft expire 掉。`unique_violation` 分支再 `limit 1` 取 draft，也没有确定排序。

建议：按 `user_id + track_id` 加 advisory lock，或引入客户端 idempotency key。异常分支必须按 `created_at desc` 或明确版本号选最新。

**[P2] supabase/migrations/phase-6/029_mint_score_enqueue_keep_draft.sql:119 — pending_scores 不再 expire 后缺少生命周期设计**

问题：029 为了 `/me` 灰卡保留 draft，不再标 expired。这对已 enqueue 的 row 是合理的，因为它现在承载永久 playback 数据；但未 enqueue 的过期草稿、失败草稿、用户反复保存的大 JSON 没有清理策略。`events_data` 变成永久资产后，pending_scores 同时承担草稿和已铸造来源两种角色，生命周期混乱。

建议：把 pending score 状态拆清楚：draft、queued、minted_source、expired。只清理未关联 queue 的旧 draft，已 mint 的 source row 加强引用和备份。

## 维度 4：上线风险与可运营性

**[P1] src/lib/chain/contracts.ts:149 — airdrop 地址在模块 import 时强校验，会拖垮无关 cron**

问题：`AIRDROP_NFT_ADDRESS` 使用 `NEXT_PUBLIC_AIRDROP_NFT_ADDRESS` 并在模块顶层 `getAddress()`。如果主网按文档选择“不部署或不调度空投”，或者只设置了 runbook 中的 `AIRDROP_NFT_ADDRESS`，任何 import `contracts.ts` 的服务端路径都可能启动即 throw，包括 score 和 material cron。

建议：合约地址按 feature lazy validate。score cron 不应该因为 airdrop env 缺失失败。runbook、`.env.example`、代码必须统一变量名，并增加部署前 env 校验脚本。

**[P1] app/api/health/route.ts:54 — health 只能看 score 状态分布，不能诊断三类生产事故**

问题：`/api/health` 对 score queue 只返回 status count；material queue 才有 oldest、stuck、failed 等更细信号。运营上无法区分“队列持续堆积”、“全部失败”、“cron 没跑或 lease 卡住”。这三种事故处理方式不同，但当前 health 给不出判断依据。

建议：给 score queue 增加 oldest age、stuck lease count、failed/manual_review count、last success time、last cron heartbeat、最近错误摘要。check-balance 也应基于这些字段触发告警。

**[P1] app/api/cron/check-balance/route.ts:9 — 没有真实告警通道，失败只写日志和 KV**

问题：文件注释写“未来可扩展 Telegram”，当前实现只 console.error 并写 `system_kv`。`useMintScore.ts:20` 文案说“后台正在自动重试并会邮件提醒我们”，但代码库没有 Resend 依赖、发送逻辑或告警 worker。主网事故只有在人主动看日志或 health 时才会被发现。

建议：公开测试前至少接入一个真实外部告警通道：Resend、Slack、Telegram、Sentry 任一即可。告警条件包括 queue failed、manual_review、stuck lease、cron heartbeat missing、operator balance low。

**[P1] docs/MAINNET-RUNBOOK.md:120 — 主网环境变量 typo 缺少机器兜底**

问题：历史 Bug C 是 `NEXT_PUBLIC_SCORE_NFT_ADDRES` 少一个 S。当前 runbook 仍主要靠人工配置，没有脚本从白名单读取 Vercel env 并验证必填项、地址格式、chain id 和合约网络匹配。更严重的是 airdrop 变量名在文档和代码里已经不一致。

建议：恢复或新增 `scripts/vercel-env-validate`，在 deploy 前读取 Vercel env，强制检查变量名、checksum address、chain id、explorer network、合约 code 是否存在。

**[P2] app/api/airdrop/trigger/route.ts:19 — “主网不调度空投”只是文档承诺，代码仍可执行**

问题：只要有 `ADMIN_TOKEN`，trigger route 可以创建 ready round；只要有人调用 cron，`process-airdrop` 就会 mint。没有 `AIRDROP_ENABLED=false` 的生产强制门。与此同时 `app/artist/page.tsx:70` 仍展示“每36首触发空投”的公开语义。

建议：生产默认禁用空投 route 和 cron，必须显式 `AIRDROP_ENABLED=true` 才返回 200。前端 artist 页同样按 feature flag 隐藏空投承诺。

**[P2] docs/MAINNET-RUNBOOK.md:132 — Turbo wallet 私钥泄露后的恢复计划不完整**

问题：文档说泄露后“换钱包”，但已上传到 Arweave/Irys 的产物 ownership、历史 bundle 付款账户、后续续费或追溯证明如何处理没有说明。对于音乐 NFT，上传资产是产品资产的一部分，不能只换 EOA。

建议：补一段资产层应急流程：冻结旧 key、记录已上传 tx 清单、验证 metadata 可访问性、把新上传统一切到新 signer，并在运营记录里保留 key rotation 时间线。

## 维度 5：用户体验与产品语义

**[P1] src/hooks/useMintScore.ts:37 — 5 秒乐观成功可能在后端失败时继续显示成功**

问题：hook 在 token 和 enqueue API 完成前就启动 5 秒成功计时。若 Privy token 获取失败、POST `/api/scores/mint` 失败或网络断开，catch 只记录日志，不回滚 UI。用户看到“铸造成功”，刷新却可能没有灰卡或仍是草稿。

建议：只有 POST 返回 queue id 后才进入“已提交铸造”状态。失败时显示重试按钮，并保留草稿。5 秒可以是“提交成功”的动效，不应暗示链上或队列已可靠落库。

**[P1] src/hooks/useFavorite.ts:30 — 喜欢按钮失败后永久保持红心且不可重试**

问题：`useFavorite` 先乐观加入本地 Set，再异步调用 API；失败只 console.error，不 rollback、不 toast、不重试。`FavoriteButton.tsx:23` 看到红心后禁用按钮。用户以为已收藏，实际后端可能没有记录。

建议：至少区分 optimistic pending 和 confirmed favorite。失败时恢复按钮、提示重试；如果用户明确选择强乐观 UI，也要接入后台告警或本地重放队列。

**[P2] app/score/[id]/page.tsx:16 — 数字 URL 和 UUID URL 形成重复分享入口**

问题：完成铸造后的 metadata external_url 使用 `/score/{token_id}`，而页面 metadata 的 `openGraph.url` 可能变成 `/score/{queue_uuid}`。`/me` 中已完成卡片走数字，灰卡走 UUID。公开传播后同一个作品会有两种永久链接，SEO、分享卡缓存和用户口径都会重复。

建议：已完成作品 canonical 一律 token path。UUID path 只服务铸造前状态；一旦有 token_id，UUID route 301/308 到数字 route。

**[P2] app/page.tsx:1 — 慢网占位没有可恢复交互**

问题：慢网时用户看到“正在唤醒群岛...”，没有 spinner、重试或轻量 fallback。completion smoke 已记 P2，但从公开测试角度这会被误判为站点卡死，尤其首页是第一触点。

建议：10 秒内显示可见加载反馈，超过阈值给重试按钮或进入简化列表模式。动画资源失败不应阻塞用户试听和登录。

**[P2] app/artist/page.tsx:70 — 空投承诺与当前主网边界冲突**

问题：STATUS 明确 D1 主网只部署不调度空投，但 artist 页仍用进度节点和文案强化“36 首触发空投”。这不是视觉小问题，而是公开承诺和运营计划相矛盾。

建议：主网前把空投文案改成“实验功能/暂未开放”，或用 feature flag 完全隐藏。不要让用户为一个被运营禁用的机制创作。

**[P3] B6 曲名 1-5 — 链上 metadata 一旦发布，临时名会变成永久历史**

问题：B6 五球 demo 使用数字占位名。如果这些曲目进入 NFT metadata，后续艺术家给正式曲名时，旧 NFT 的 metadata 历史仍会留下“1-5”的版本。用户会看到同一首歌在不同页面叫法不同。

建议：主网前必须冻结曲名策略。若艺术家名未定，metadata 里使用稳定中性名（例如 Track 01）并在 UI 单独显示营销名，避免把临时中文名写死进不可变资产。

## 维度 6：下一阶段债务

**[P1] app/api/me/score-nfts/route.ts:26 — `/me` 为每张卡联表拉完整 events_data，用户量上来会先崩在个人页**

问题：API 只需要 `events.length`，却选择了完整 `pending_scores(events_data)`。既然已有 35 秒慢查询记录，Phase 7 如果公开测试，重度用户或大 JSON 会让 `/me` 超时，导致用户看不到自己的铸造状态。

建议：立刻改为 DB 层 `jsonb_array_length` 字段、RPC 或 materialized count。完整 events 只在进入 score 播放页时读取。

**[P1] src/data/score-source.ts:37 — explorer 链接仍硬编码 Sepolia**

问题：score 页的 `contractAddressUrl` 和 metadata 里的链浏览器链接固定 `sepolia-optimism.etherscan.io`。即使修了 operator wallet，如果这些链接不跟 chain config 走，主网用户仍会被带到测试网浏览器，降低信任。

建议：explorer base url 必须从同一 chain config 生成。禁止业务文件里直接拼 explorer host。

**[P2] references/dead-code 与 app/test — 视觉支线未收口会拖慢 P7 判断**

问题：仓库保留 `references/dead-code`，同时 `/test` 和 HomeJam/TestJam 相关文件仍存在。它们可能有保留价值，但现在没有“保留原因、删除条件、负责人”。Phase 7 做性能、mainnet、SEO 时，每次 grep 都会被实验代码干扰。

建议：建立一张 P7 cleanup 清单：生产必需、内部沙箱、历史参考、可删除四类。沙箱代码必须有 route gate，历史参考移出 app 构建路径。

**[P2] contracts/src/ScoreNFT.sol:1 — AirdropNFT 已部署但无代码级主网禁用，误操作风险延后到 P7**

问题：空投合约和 cron 已经存在，主网“不调度”只靠文档和人工不配置。P7 一旦整理 cron-job.org 或复制 staging job，很容易把 airdrop 也打开。

建议：主网部署前在代码层强制默认关闭；合约层如已部署，也要把执行权限、后台 route 和 scheduler 三层都加门。

**[P2] contracts/src/MintOrchestrator.sol:20 — TBA 删除后未来回归成本没有记录**

问题：C4 删除 TBA 是正确降复杂度，但合约保留的空钩子和前端 ABI 残留会让未来“加回 TBA”看似容易，实际需要重新设计 ownership、metadata、前端展示和迁移。这个债如果不写清，P7/P8 会反复返工。

建议：在架构决策里明确：TBA 回归不是开关，而是新阶段合约设计任务。删除前端 ABI 残留，保留文档决策即可。

**[P3] docs/CONVENTIONS.md:49 — 文件 220 行放宽是临时治理，不是长期容量**

问题：Phase 6 把单文件硬线放宽到 220 行，视觉系统已有多个文件接近线。Phase 7 如果继续加状态、监控、fallback，很容易形成“每个文件都贴着上限”的维护模式。

建议：把 220 行视为过渡期。P7 修改任何接近 200 行的生产文件时，先拆出纯函数或小组件，再加功能。

## 综合判定

- 能进 Phase 7：是但带条件。可以进入 Phase 7 的整理和主网准备；不能直接公开测试或主网。
- P0 阻塞：1 项。服务端链配置硬编码 OP Sepolia，必须先修。
- P1 必修：12 项。集中在链配置、score 数据源、队列 lease、operator 锁、告警、env 校验、`/me` 性能、乐观 UI 失败路径。
- P2 / P3 跟踪：14 项。主要是架构文档一致性、沙箱/dead code 收口、空投语义、视觉目录治理和长期债务记录。

