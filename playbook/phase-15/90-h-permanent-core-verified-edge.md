# P15-H — Permanent Core + Verified Edge

> **授权日期**：2026-09-21
> **状态**：执行中
> **目标**：把 33 键声音版本、永久依赖闭包、全部已铸 Score 兼容恢复和首屏加速统一成一条可核验链路；用户正常打开 Score 时不再等待 Arweave JSON。
> **执行顺序**：H0 → H1 → H2 → H3 → H4 → H5 → H6 → H7 → H8，连续执行；不可逆写入前按本文件 Gate 自动核验。

---

## 1. 冻结架构

```text
Permanent Core（真相层）
OP tokenURI → Arweave metadata / events / base / sounds / decoder
                         │ txid + sha256 + bytes + MIME
                         ▼
Verified Snapshot（验证层）
每枚 Score 一条不可变快照；保存原始引用、读回哈希和兼容证明
                         │ 服务端读取并由 React 安全序列化
                         ▼
Score HTML / RSC（启动层）
内嵌 events + 已解析 sounds；浏览器不再请求两个 JSON
                         │
                         ▼
Verified Edge（加速层）
Vercel Blob `media/<arTxId>` 直接完整 GET ──慢 1.2s──▶ Arweave hedge
首个完整且哈希正确的音频获胜；任一路径都不能改变资源身份
```

### H-D1 — 永久真相不被加速层替代

- 链上 `tokenURI` 和它引用的 Arweave 对象仍是作品原始真相。
- Supabase 快照、HTML bootstrap 和 Vercel Blob 都必须保留原始 txid 与读回哈希；它们可重建、可关闭，不得冒充链上原件。
- 历史对象没有在原 metadata 中钉 hash 时，校验等级写作 `attested`（项目读回见证），不能写作 `canonical`。

### H-D2 — 新 33 键是一个版本，不是给旧 26 表打补丁

- 2026-08-23 不仅增加 `space + 3–8`，还替换了 `a–z` 全部 26 个本地 MP3；因此新永久表必须上传并核验**当前 33 个文件**。
- 旧 26 键表 `NQsgcCSPJjeRzvXHnXNWbUsovDCjkO5xHJBX7Eu_kl8` 永久保留，历史 NFT 不被偷偷改写。
- 禁止用 `--force` 覆盖历史 `data/sounds-ar-map.json`；所有新账本都版本化保存。

### H-D3 — 历史兼容是显式、精确、可审计的恢复

- 兼容身份至少绑定 `(chainId, ScoreNFT contract, tokenId, original tokenURI)`，不能只按旧 sounds txid 泛化。
- 原表已有键默认优先；只有录制版本证据证明当时实际听到新版音色，才对该 Token 的已用键做 override。
- 生产部署与链上时间证据已裁决：#1 铸造早于新版 Production，保持旧声音；#2/#3 铸造时新版 33 键已在 Production，因此分别把全部 10/18 个实际使用键恢复为新版声音。规则仍逐 Token 登记，不按旧 map txid 泛化。
- 原 `animation_url` 不可改，旧 decoder 也不会自动读取兼容清单。主站和单独的永久兼容播放器可以恢复，但凭证区必须明确区分“原始永久档案”和“签名兼容恢复”。

### H-D4 — 页面快照而不是 10,000 个 HTML 文件

- 仓库只保留一个动态页面模板；每枚 Score 保存一条小型不可变快照。
- 数字 Token 页从快照生成并缓存 HTML/RSC；UUID processing 页保持动态。
- 当前持有人是可变态，独立短缓存刷新，不冻结进作品快照。

### H-D5 — 铸造之前证明依赖闭包

- 队列创建时固定 `sound_set / sounds map / decoder`，环境变量之后变化不能改变在途任务。
- 在任何 `mintScore` 主网交易前证明：事件键属于固定声音表，events/base/sounds/decoder 均可从 Arweave 读回且 hash/bytes/MIME 符合固定清单。
- 未来 metadata 增加 `properties.playback`，永久记录 events/base/sounds/decoder 的 URI、SHA-256 与字节数。
- 现有合约必须先 mint 才知道 tokenId，因此 metadata 上传与 `setTokenURI` 仍发生在 mint 后；P15-H 不偷改合约，这一残余风险必须在 Gate 与运维中诚实保留。

---

## 2. H0 — 生产真相与版本证据

1. `fetch` 并比较当前分支与 `origin/main`，只保留一个干净发布工作树。
2. 枚举主网全部 Score，逐枚核对链上 tokenURI、metadata、events、base、sounds、decoder 与数据库队列记录。
3. 从链上/索引动态枚举全部已铸 Token（不得写死 #1–#3）：ready Token 冻结事件键/原始引用并重建录制时声音版本；已 mint 但未设 URI 的 Token 记录真实队列生命周期，不伪造成可播放作品。
4. 对 33 个当前本地 MP3 生成 key、bytes、SHA-256、时长、MIME 清单；对旧 26 个 AR 对象生成独立历史账本。
5. 核对现有 Blob 63 个对象的真实库存，不把 STATUS 文案当作对象仍存在的证明。

**Gate H0**：版本证据能回答全部 ready Token 应保持旧音色还是应用兼容 override，并能解释所有未 ready Token 的队列状态；所有外部检查均为只读。

**交付**：`reviews/evidence/p15-h/` 机器可读账本 + H0 审计报告。

---

## 3. H1 — 33 键单一注册表

1. 建立版本化 `SoundSet` 注册表：`a–z + space + 3–8`，每项包含本地路径、hash、bytes、duration、MIME、AR txid 与 Blob key。
2. 录音、保存 API、P9、上传工具、永久 manifest、铸造 Gate 和播放器全部从注册表派生允许键，删除散落手写数组/正则。
3. 测试 33/33、重复键、缺文件、hash 漂移、无法解码和 P9 映射缺口。

**Gate H1**：33 个键、33 个当前 MP3、33 个 P9 identity 严格一一对应；旧 26 账本完全不变。

**回滚**：只回退代码与新注册表，未产生永久写入。

---

## 4. H2 — 队列 pin 与铸造前闭包

1. additive migration 为队列固定 `sound_set_id / sounds_map_tx_id / decoder_tx_id / base_tx_id` 与每项 hash/bytes/MIME；由新版 enqueue RPC 在插行时原子写入，cron 不再读取可变 track/env 决定在途任务。
2. 保存时拒绝未知键；入队时固定版本；events 上传后进入永久闭包验证，验证成功才允许 `minting_onchain`。
3. 新增 durable `preparing_package` 状态；同步数据库 CHECK、`SCORE_STATUSES`、claim RPC、route switch、health、`/me` 文案和测试。`uploading_events` 不得再直接越过 package Gate 进入 mint。
4. 在 mint 前生成 `ripples.score-package.v3`：包含稳定 queue/content id，以及 events/base/soundSet/decoder 四个唯一角色的 `arTxId + sha256 + bytes + mime`；新版 decoder 只需 `?package=ar://<txid>`。
5. package 使用 RFC 8785 JSON Canonicalization、SHA-256 小写 hex、最大 64KB；JSON 只允许 `application/json`，音频只允许 `audio/mpeg`。事件键必须被 pinned SoundSet 完整覆盖；legacy 三参数和 v3 package 是互斥联合类型，混合参数硬拒绝。
6. package 不依赖 tokenId，上传并双网关读回成功后才允许 mint；队列持久化 `package_ar_tx_id/package_sha256/upload_state/verified_at`，worker 失租或传播等待可安全恢复。
7. events/package/metadata 每类上传都记录 content hash 与明确结果状态；外部响应未知转 `upload_result_unknown/manual_review`，禁止依赖“同内容同 txid”盲重传。
8. 新 metadata 的 `animation_url` 指向 decoder v3 + package，并在 `properties.playback` 永久记录 package identity 与组成资源摘要。

**Gate H2**：`space/3–8` 正例、未知键/缺键/资源损坏/环境中途切换反例通过；失败发生在广播 mint tx 之前。

**回滚**：关闭新任务入口并回退代码；additive 列保留不用，不删除数据。

---

## 5. H3 — Permanent Core 永久写入

### H3a 当前 33 个音频

1. 不可逆预检：Turbo 身份/余额、33 个输入 hash、旧 26 档案备份、预计对象与费用。
2. 将当前 33 个 MP3 作为新 SoundSet 上传；每成功一项立即写入版本化账本。
3. **不得假设同字节重传得到同 txid**。外部响应未知时标记 `unknown` 并先查询/对账，禁止盲目重传。
4. 每项至少两个独立网关完整读回、全字节 SHA-256/MIME/可解码一致。

### H3b manifest、decoder 与历史兼容清单

1. 生成并上传带逐项 txid/hash/bytes/duration/MIME 的 33 键 manifest，以及能读取并校验 `ripples.score-package.v3` 的新版永久 decoder。
2. 按 H0 版本证据为全部 ready Token 生成 token-scoped 兼容清单；至少使 #2 使用真实 `space`。未设 URI 的 Token 不生成伪兼容清单。
3. 兼容清单记录原引用、逐键 addition/override、理由、hash、项目签名与兼容播放器 URL。签名固定为 EIP-712：domain 使用 `RipplesCompatibility`、chainId 与 ScoreNFT verifyingContract；message 覆盖 tokenId、originalTokenURI、原/新引用、canonical digest、publishedAt。签名者必须在发布 Gate 时持有 ScoreNFT admin role，并把地址、区块与角色证明写入证据。

**Gate H3**：33 音频 + manifest + decoder + compatibility objects 均完成独立网关 readback；每个不可逆批次立即提交 txid 与证据。

**回滚**：Arweave 对象不可删；不启用新 txid即可回退。旧 26 和旧 NFT 永不覆盖。

---

## 6. H4 — Verified Edge 音频副本

1. 严格按“AR 已读回字节 → Blob `media/<arTxId>`”方向复制，禁止本地文件分别上传两端。
2. 上传当前 33 音频、新版 decoder 所需音频及实际缺失的 base；按 txid 去重，不按 Score 重复。
3. Blob 读回验证全字节 hash、bytes、MIME、CORS；Range 只作为发布能力检查，不作为 WebAudio 完整 GET 的播放前提。
4. 生成可审计 mirror inventory；JSON 不需要 Blob 镜像，因为正常页面从已验证快照内嵌。

**Gate H4**：每个 Edge 对象与对应 AR 读回字节一致；无长期静态写凭证残留。

**回滚**：停用 mirror base 即回到 AR；Blob 可由永久账本重建。

---

## 7. H5 — Verified Snapshot 与 HTML bootstrap

1. 新建 server-only append-only `score_playback_snapshot_revisions`，主键为 `(environment, chain_id, contract, token_id, revision)`；另有唯一 verified active pointer，保存 schema、原始 refs、规范化 metadata/events/sounds、逐资源 attestation、compatibility 与 verifiedAt。
2. service role 才能写；关键内容不可原地覆盖，重建插入新 revision 并在完整验证后原子切 active pointer。
3. 为全部 ready Token 有界回填；未来 Score 的 `setting_uri` 确认后进入 durable `finalizing_snapshot`，只有 snapshot verified 才能变为 `success`；未设 URI 的 Token 保持真实生命周期。同步 queue CHECK、claim/route/health/告警与恢复测试。
4. `ScoreReadyData` 携带 `playbackBootstrap`；React props 安全序列化 events 与 effective sounds，禁止 `dangerouslySetInnerHTML`。
5. 页面常规请求只查一条快照，不回源 AR；快照 miss/损坏 fail closed 并保留身份/凭证，不伪造可播放状态。

**Gate H5**：屏蔽 AR 后全部 ready 数字 Score 仍能从快照生成完整页面 bootstrap；未 ready Token 显示真实生命周期；浏览器网络 0 次 events/sounds JSON 请求；篡改 hash 被拒绝。

**回滚**：关闭 snapshot/bootstrap 读路径回旧加载器；additive 表保留。

---

## 8. H6 — 直接请求、竞速回退与兼容播放

1. 播放器直接消费 HTML bootstrap，只下载 base 和实际用到的声音。
2. 立即启动 Blob 完整 GET；1.2 秒仍未得到完整有效对象时启动一条 AR hedge；明确 404/429/5xx/网络失败则立即回退。
3. 首个完整且 hash 正确的响应获胜并 abort 败方；完整音频 `200` 不再因缺少 `Accept-Ranges` 被拒绝。
4. 删除热路径一字节探针；移除最长 24h 的持久 origin 冷却，bump/清理 `ripples:media-mirror-health:v1`，仅保留标签页内短期连续失败保护。
5. #2 按精确兼容身份补真实 `space`；#1/#3 严格按 H0 证据；凭证 UI 同时展示原始档案与兼容恢复。

**Gate H6**：#1 保真、#2 在约 3780ms 播放真实 space、#3 版本正确；Blob 慢/坏/断、单/双 AR 故障、离页 abort 全部有界。

**回滚**：独立关闭 compat/new resolver/bootstrap，回到旧永久回退路径。

---

## 9. H7 — 未来铸造切换与历史回填

1. 回填全部已铸 Score 快照并生成逐 Token 结果；未知项进入人工复核，不泛化兼容。
2. 确认无活跃旧队列后，将 Development/Preview/Production 的 sounds/decoder 默认值切到新版本；旧在途任务继续使用已 pin 版本。
3. Preview 先验证全部 ready 数字 Score、未 ready Token 生命周期、33 键新 fixture、HTML 零 JSON与所有故障回退，再允许 Production。

**Gate H7**：环境 readback 一致；新任务 33 键闭包在 mint 前通过；旧任务不会因 env 切换改变永久输入。

**回滚**：env 恢复只影响未来任务；已 pin 任务和历史 Token 不变。

---

## 10. H8 — 发布、故障演练与封存

1. 完整 `scripts/verify.sh` 只跑一次；失败只重跑受影响层。
2. 快进推送、Vercel Preview/Production Ready、正式域名最小 smoke。
3. 正常路径：全部 ready 数字 Score 的 HTML 有 bootstrap，音频命中 Blob；AR 全屏蔽仍可打开并播放；未 ready Token 不伪造播放。
4. Blob 屏蔽：自动回退 AR；Blob 与 AR 同时失败：页面与永久凭证仍可见，播放诚实报错。
5. #2 的 space 与 P9 同步，旧 `animation_url` 的限制在 UI/证据中透明说明。
6. 写最终 review、更新 STATUS/TASKS/Architecture/Runbook，封存 P15-H。

**完成线**：已验证 commit 推送成功、Production Ready、`/score/1–4` 正式域名 Gate 通过即结束，不扩张为全站 review。

---

## 11. 明确不做

- 不修改历史 tokenURI、metadata 或旧 decoder。
- 不用静音占位替代 `space`，也不把错误音色包装成兼容。
- 不生成或提交 10,000 个 HTML 文件。
- 不把 Supabase/Vercel 称作永久真相，也不在 hash 未验证时展示“已核验”。
- 不为本轨新增音频库、状态库或第二套对象存储。
- 不在 P15-H 修改主网合约；mint 后 metadata/setURI 的残余风险留给未来合约版本。
