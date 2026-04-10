# Phase 3 — 乐谱 NFT + 封面 + 分享 (v2)

> 目标：让用户的合奏草稿可以铸造为 ScoreNFT（ERC-721），在 OpenSea 可听、可分享
>
> 前置：Phase 2.5 已完成
> 原则：一步只做一件事，每步有独立验证标准
> 来源：`reviews/2026-04-10-phase-3-playbook-review.md`
>
> 核心交付物：
> - ScoreNFT 合约（ERC-721）+ MintOrchestrator（编排合约，TBA 默认关闭）
> - score-decoder.html（"网页唱片机"，一次性上传 Arweave）
> - POST /api/mint/score（乐谱铸造 API）
> - /score/[tokenId] 公开回放页（OG 分享卡）

---

## 冻结决策（开工前必须对齐）

### D1：TBA 不进 Phase 3 主链路
- ScoreNFT 作为独立 ERC-721 铸造，不关联 MaterialNFT
- MintOrchestrator 保留 TBA fallback 开关，**默认关闭**
- 理由：当前"用户无签名"铁律下无法做 approval/transfer，TBA 留给 Phase 4+

### D2：metadata 在 cron 侧生成（方案 A）
- API 只冻结输入 + 入队，不生成 metadata
- Cron 链上 mint → 拿到 tokenId → 生成 metadata.json → 上传 Arweave → setTokenURI
- 理由：tokenId 是合约自增，API 入队时不可知

### D3：108 底曲属于 Phase 3 前置资源
- S0 同时上传 26 音效 + 已有底曲 mp3 到 Arweave
- 理由：Score Decoder 的"脱离站内也能回放"承诺依赖底曲在 Arweave 上

### D4：封面分配 + 队列写入 + 草稿消费必须走事务
- S5 中封面 `FOR UPDATE SKIP LOCKED` + 队列 INSERT + pending_score UPDATE 包在同一个 Supabase RPC 里
- 同时收口 Phase 2.5 延后的 save draft 事务化

### D5：链上事件同步拆为 Phase 3B
- Phase 3A（本 playbook）= 铸造 + Decoder + 分享
- Phase 3B = 链上事件同步 + 运营侧可观测性
- ARCHITECTURE.md 需同步更新 Phase 3 边界

---

## 总览

| Step | 做什么 | 验证 |
|---|---|---|
| S0 | Arweave 工具链 + 音效/底曲预上传 | 26 音效 + 底曲 ar:// 可访问 |
| S1 | 封面系统（生成 + 上传 + score_covers 表） | 100 张封面在 Arweave，表有数据 |
| S2 | ScoreNFT 合约 + 部署 OP Sepolia | 合约可 mint + setTokenURI |
| S3 | MintOrchestrator（TBA 默认关闭）+ 权限配置 | mintScore 成功铸造 ScoreNFT |
| S4 | Score Decoder（HTML 播放器）+ 上传 Arweave | 传入 events 参数可回放 |
| S5 | 乐谱铸造 API + cron（含 metadata 生成） | 全链路：API 入队 → cron mint → metadata 上链 |
| S6 | 公开回放页 /score/[tokenId] + OG 分享卡 | 页面可回放，分享有封面 |
| S7 | 端到端集成验证 + 个人页升级 | 8 项清单全通 |

---

# Step S0：Arweave 工具链 + 音效/底曲预上传

## 📦 范围
- `src/lib/arweave.ts`（新建）
- `scripts/upload-sounds.ts`（新建，一次性脚本）
- `scripts/upload-tracks.ts`（新建，一次性脚本）
- `data/sound-arweave-map.json`（输出）
- `data/track-arweave-map.json`（输出）
- `docs/STACK.md`（登记 turbo-sdk）

## 做什么

### 1. Arweave 上传工具
- 安装 `@ardrive/turbo-sdk --legacy-peer-deps`
- 新建 `src/lib/arweave.ts`：
  - 多网关 fallback（arweave.net → ar-io.dev → gateway.irys.xyz）
  - `uploadBuffer(buffer, contentType)` → 返回 `ar://txid`
  - `resolveArweaveUrl(arTxId)` → 尝试多网关返回可访问的 https URL
  - `uploadJson(obj)` → JSON 序列化后上传，返回 `ar://txid`

### 2. 音效 mp3 预上传（26 个）
- `scripts/upload-sounds.ts` 读 `public/sounds/` 逐个上传
- 输出 `data/sound-arweave-map.json`：`{ "a": "ar://xxx", "b": "ar://yyy", ... }`

### 3. 底曲 mp3 预上传（已有曲目）
- `scripts/upload-tracks.ts` 读 tracks 表中已有的 audio_url，下载后上传 Arweave
- 输出 `data/track-arweave-map.json`：`{ "<trackId>": "ar://xxx", ... }`
- 后续每周新增曲目时也跑这个脚本

## ✅ 完成标准
- `arweave.ts` 导出上传 + 解析函数，加 `import 'server-only'`
- 26 个音效 + 已有底曲全部有 `ar://` 地址
- 通过多网关至少一个能访问到文件
- STACK.md 已登记 turbo-sdk
- `verify.sh` 全绿

---

# Step S1：封面系统

## 📦 范围
- `scripts/generate-covers.ts`（新建，一次性脚本）
- `scripts/upload-covers.ts`（新建，一次性脚本）
- `supabase/migrations/007_score_covers.sql`（新建）

## 做什么

### 1. 封面生成
- 用 Canvas API 或 SVG 生成算法生成测试封面
- 先生成 100 张（测试阶段够用，上线前扩到 10000+）
- 风格：深色背景 + 抽象纹理/波形 + 编号
- 输出到 `data/covers/`

> 💭 为什么不用 HashLips：100 张测试封面不需要那么重的工具。正式上线前再评估。

### 2. 批量上传 Arweave
- `scripts/upload-covers.ts` 读 `data/covers/` 逐张上传
- 输出 `data/cover-arweave-map.json`

### 3. score_covers 表
```sql
create table score_covers (
  id          uuid primary key default uuid_generate_v4(),
  ar_tx_id    text not null unique,
  usage_count integer not null default 0,
  created_at  timestamptz not null default now()
);
```
- 脚本把上传结果批量写入 score_covers

## ✅ 完成标准
- score_covers 表存在，有 100 条记录
- 每条 ar_tx_id 对应真实 Arweave 图片，可访问
- `verify.sh` 全绿

---

# Step S2：ScoreNFT 合约

## 📦 范围
- `contracts/src/ScoreNFT.sol`（新建）
- `contracts/script/DeployScore.s.sol`（新建）
- `src/lib/contracts.ts`（新增 ScoreNFT 地址 + ABI）
- `.env.local`（新增 `SCORE_NFT_ADDRESS`）

## 做什么

### 1. ScoreNFT 合约（ERC-721）
- 继承 OZ ERC721URIStorage + AccessControl
- `MINTER_ROLE`：mint 权限
- `mint(address to) → tokenId`：自增 tokenId，返回 ID（不设 tokenURI，由后续 setTokenURI 补）
- `setTokenURI(tokenId, uri)`：MINTER_ROLE 可调，cron mint 成功后补写 metadata
- `supportsInterface` 合并 ERC721 + AccessControl

### 2. 部署到 OP Sepolia
- 部署脚本接收 `MINTER_ADDRESS` 参数
- 先部署 ScoreNFT（minter 暂设为 operator，S3 部署 Orchestrator 后 grantRole 给它）

## ✅ 完成标准
- ScoreNFT 部署到 OP Sepolia，地址记入 `.env.local`
- `forge test` 通过：mint + setTokenURI + 权限检查
- Etherscan 可查到合约
- `contracts.ts` 导出 ScoreNFT 地址 + ABI 子集

---

# Step S3：MintOrchestrator + 权限配置

## 📦 范围
- `contracts/src/MintOrchestrator.sol`（新建）
- `contracts/script/DeployOrchestrator.s.sol`（新建）
- `src/lib/contracts.ts`（新增 Orchestrator 地址 + ABI）
- `.env.local`（新增 `ORCHESTRATOR_ADDRESS`）

## 做什么

### 1. MintOrchestrator 合约
核心函数 `mintScore(address to) → tokenId`：
1. 调 `ScoreNFT.mint(to)` → 拿到 tokenId
2. 返回 tokenId

TBA 相关逻辑：
- `bool public tbaEnabled = false`（**默认关闭**）
- admin 可 `setTbaEnabled(true)` 开启
- 开启后 `mintScore` 额外执行：ERC-6551 Registry.createAccount(...)
- 关闭时只做步骤 1

> 💭 为什么 TBA 默认关，不做素材转入：当前"用户无签名"原则下无法获得用户 MaterialNFT 的转移授权。TBA 作为实验能力保留，Phase 4+ 引入签名后再考虑启用。

### 2. 部署 + 权限配置
- 部署 MintOrchestrator（传入 ScoreNFT 地址）
- ScoreNFT `grantRole(MINTER_ROLE, orchestratorAddress)`
- 验证：operator 通过 Orchestrator 调 mintScore 成功

## ✅ 完成标准
- Orchestrator 部署到 OP Sepolia
- 调 `mintScore` 成功铸造 ScoreNFT，返回 tokenId
- `tbaEnabled = false` 时正常工作
- `forge test` 通过
- Etherscan 可查到合约

---

# Step S4：Score Decoder（HTML 播放器）

## 📦 范围
- `src/score-decoder/index.html`（新建，单文件）
- `scripts/upload-decoder.ts`（新建，一次性脚本）
- `.env.local`（新增 `SCORE_DECODER_AR_TX_ID`）

## 做什么

### 1. 开发 score-decoder.html
一个自包含的单文件 HTML + JS + CSS：
- 读 URL 参数：`?events=ar://...&base=ar://...&sounds=ar://...map.json`
- 从 Arweave 加载 events.json + 底曲 mp3 + 26 个音效 mp3（通过 sound map）
- 用 Web Audio API 按时间序列回放：背景曲 + 键盘音效叠加
- 简单 UI：播放/暂停 + 进度条 + 当前按键视觉反馈
- 无外部依赖，纯 vanilla JS
- 文件大小目标 < 100 KB

> 决策 13 的"网页唱片机"——上传一次 Arweave，所有 ScoreNFT 通过 URL 参数共享

### 2. 上传 Arweave
- `scripts/upload-decoder.ts` 上传 → 记录 `ar://txid`
- txid 写入 `.env.local` 的 `SCORE_DECODER_AR_TX_ID`

## ✅ 完成标准
- 本地浏览器打开 HTML，传入测试 events 数据可回放合奏
- 上传 Arweave 后通过网关访问可正常播放
- 文件 < 100 KB
- 底曲和音效都从 Arweave 加载（不依赖站内 URL）

---

# Step S5：乐谱铸造 API + Cron（含 metadata 生成）

## 📦 范围
- `supabase/migrations/008_score_nft_queue.sql`（新建）
- `supabase/migrations/009_mint_score_rpc.sql`（新建，事务 RPC）
- `supabase/migrations/010_extend_mint_events.sql`（新建）
- `app/api/mint/score/route.ts`（新建）
- `app/api/cron/process-score-queue/route.ts`（新建，独立 cron）
- `src/types/jam.ts`（扩展类型）
- `src/lib/contracts.ts`（扩展 ABI）

## 做什么

### 1. score_nft_queue 表（可完整重跑的队列）
```sql
create table score_nft_queue (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references users (id),
  pending_score_id  uuid not null references pending_scores (id),
  track_id          uuid not null references tracks (id),
  cover_ar_tx_id    text not null,
  events_ar_tx_id   text,           -- cron 上传后回填
  metadata_ar_tx_id text,           -- cron 生成后回填
  token_id          integer,        -- 链上 mint 后回填
  token_uri         text,           -- ar:// metadata 地址
  status            text not null default 'pending'
                    check (status in (
                      'pending',            -- API 入队
                      'uploading_events',   -- cron: 上传 events.json
                      'minting_onchain',    -- cron: 链上 mint
                      'uploading_metadata', -- cron: 生成+上传 metadata
                      'setting_uri',        -- cron: setTokenURI
                      'success',
                      'failed'
                    )),
  retry_count       integer not null default 0,
  last_error        text,
  tx_hash           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```

### 2. 事务 RPC：封面分配 + 入队 + 草稿消费
```sql
-- mint_score_enqueue(p_user_id, p_pending_score_id, p_track_id)
-- 原子操作：分配封面 + 写队列 + 标记草稿 expired
-- 返回 queue_id + cover_ar_tx_id
```
解决 Phase 2.5 延后的事务化问题，封面 `FOR UPDATE SKIP LOCKED` 在事务内才有意义。

### 3. POST /api/mint/score
- 验证登录
- 验证 pending_score 存在且是 draft 状态，属于当前用户
- 调 RPC `mint_score_enqueue(...)` → 原子入队
- 返回 `{ queueId, coverUrl }`
- 限流：同一用户每小时最多 5 次（数据库层面计数）

### 4. Cron：process-score-queue（独立 cron，不混入 material mint）
处理流程（每一步可断点续跑）：
1. **pending → uploading_events**：上传 events.json 到 Arweave → 回填 `events_ar_tx_id`
2. **uploading_events → minting_onchain**：调 `Orchestrator.mintScore(to)` → 回填 `token_id` + `tx_hash`
3. **minting_onchain → uploading_metadata**：生成 metadata.json（含 tokenId）→ 上传 Arweave → 回填 `metadata_ar_tx_id`
4. **uploading_metadata → setting_uri**：调 `ScoreNFT.setTokenURI(tokenId, ar://...)` → 回填 `token_uri`
5. **setting_uri → success**：写 mint_events（含 score_data 自包含字段）

每步失败 → 状态不变 + retry_count++ + last_error 记录 → 下次 cron 从断点续跑。

### 5. 扩展 mint_events
```sql
ALTER TABLE mint_events ADD COLUMN score_data jsonb;
ALTER TABLE mint_events ADD COLUMN score_nft_token_id integer;
ALTER TABLE mint_events ADD COLUMN metadata_ar_tx_id text;
ALTER TABLE mint_events ADD COLUMN score_queue_id uuid references score_nft_queue(id);
```

## ✅ 完成标准
- POST /api/mint/score 返回 201，队列有记录
- Cron 从 pending 一路跑到 success（5 步状态机）
- 链上有 ScoreNFT，tokenURI 指向 Arweave metadata
- metadata 包含 `image`（封面）+ `animation_url`（decoder + events）+ `external_url`
- mint_events 有 score_data 自包含数据
- 限流生效：同一用户短时间重复调用返回 429
- `verify.sh` 全绿

---

# Step S6：公开回放页 + OG 分享卡

## 📦 范围
- `app/score/[tokenId]/page.tsx`（新建）
- `app/score/[tokenId]/opengraph-image.tsx`（新建）
- `src/data/score-source.ts`（新建）

## 做什么

### 1. /score/[tokenId] 页面
- 数据主路径：mint_events.score_data（DB 内自包含）
- 灾备路径：链上 tokenURI → Arweave metadata → events.json
- Web Audio API 原地回放（复用 score-decoder 回放逻辑）
- 显示：封面图 + 曲目名 + 创作者 + 播放按钮 + 按键视觉
- 底部：合约地址 / tokenId / tx hash / Etherscan 链接

### 2. OG 分享卡
- Next.js 动态 OG image（`opengraph-image.tsx`）
- 封面图 + 曲目名 + "Ripples in the Pond" 品牌
- 微信/Twitter 分享时自动展示

### 3. meta tags
- `og:title` / `og:description` / `og:image` / `og:url`
- `twitter:card` = `summary_large_image`

## ✅ 完成标准
- `/score/[tokenId]` 可访问，可回放合奏
- 分享链接到社交平台有封面卡片
- `verify.sh` 全绿

---

# Step S7：端到端集成验证 + 个人页升级

## 📦 范围
- `app/me/page.tsx`（修改）
- `src/components/me/ScoreCard.tsx`（新建）
- STATUS.md / TASKS.md（更新）

## 做什么

### 1. 个人页升级
- 新增"我的乐谱"区域，展示已铸造的 ScoreNFT
- ScoreCard：封面缩略图 + 曲目名 + tokenId + 链上链接 + 回放入口
- 排列：ScoreNFT 在上 → 素材 NFT 在中 → 草稿在下

### 2. 端到端验证清单
1. 首页按键演奏 → 音效正常
2. 点击岛屿播放背景曲 → 自动录制
3. 演奏完成 → toast "已记录"
4. /me → 看到草稿（24h 倒计时）
5. 铸造乐谱 → POST /api/mint/score → 201
6. 手动触发 cron → 链上 ScoreNFT + metadata 上链
7. /me → 看到 ScoreNFT 卡片
8. /score/[tokenId] → 可回放 + OG 卡片

### 3. 文档更新
- STATUS.md 标记 Phase 3A 完成
- TASKS.md 移入 Done

## ✅ 完成标准
- 8 项验证清单全部通过
- `verify.sh` 全绿（含 build）
- STATUS.md / TASKS.md 更新

---

## Phase 3B（主线完成后紧接）

Phase 3A 上线就会遇到"OpenSea 转手后 DB 不知道"的问题，所以 3B 不能拖太久。

- **sync-chain-events cron**：每 5 分钟从 last_synced_block 拉 Transfer 事件
- **system_kv 表**：存 `last_synced_block`，保证幂等
- **chain_events 表**：`UNIQUE(tx_hash, log_index)` 防重复
- 详见 `docs/HARDENING.md` C4

---

## 延后项（Phase 3 不做）

- **10000 张正式封面** — S1 先 100 张测试，上线前扩量
- **API Rate Limiting 全套** — S5 加了基础限流，完整方案见 HARDENING.md A1
- **Deploy 脚本 admin/minter 分离** — 主网前做
- **唱片架视觉设计** — S7 先用列表
- **TBA 启用 + 素材转入** — Phase 4+ 引入签名后再做

---

## 风险提示

1. **Arweave 上传可靠性**：Turbo SDK 信用卡支付链路可能不稳定，S0 需要验证 retry + 错误处理。
2. **Cron 5 步状态机复杂度**：S5 的 cron 是整个 Phase 3 最复杂的一步，每步都要可断点续跑。建议 S5 拆成"API 入队"和"cron 处理"两个子 commit。
3. **score-decoder.html 大小**：目标 < 100 KB。如果 Web Audio 回放逻辑太大，音效映射分离为外部 JSON。
4. **ERC-6551 Registry 在 OP Sepolia 的可用性**：如果不可用，S3 直接删除 TBA 相关代码，Orchestrator 退化为简单 proxy。
