# Supabase Migrations

Migration 文件按 **Phase** 分子目录（目录文件数 ≤ 8 硬线触发的重组，见 CONVENTIONS.md §1.2）。

> ⚠ Supabase CLI 只自动扫描 `supabase/migrations/` 顶层，不会递归发现这些 Phase 子目录。禁止从仓库根直接用 `db push` 判断或部署嵌套 migration，也不要按 CLI 提示把已落地版本 `repair --status reverted`。发布时应在隔离临时工作区只放本次单个 migration，先 dry-run 确认唯一文件，再 push 和 read-back。

## 按编号顺序执行

执行顺序 = **phase 子目录序（001-006 → phase-3 → phase-4 → … → phase-10）→ 子目录内编号递增**。

> **编号口径（P10-B P2-8 修订）**：编号在「子目录内」递增唯一即可，不再要求全局唯一。历史上跨 phase 出现过撞号（015/016/030），已给后来者补字母后缀消歧：
> - `phase-3/hotfix/015h_…` `016h_…`（h=hotfix，与 phase-4 的 015/016 区分）
> - `phase-7/track-a/030b_…`（与 phase-6/track-a 的 030 区分）
>
> ⚠ 已在生产执行过的 migration **只改文件名不改 SQL**——文件名即执行历史，重编号会破坏追溯。

### Phase 0-2（`phase-0-2/`）
- `001_initial_minimal.sql` — users + mint_queue 基础表
- `002_claim_pending_job.sql` — 原子抢单 RPC
- `003_tracks_and_mint_events.sql` — Phase 1 tracks + mint_events
- `004_mint_uniqueness_and_colors.sql` — Phase 1 review 修复
- `005_pending_scores.sql` — Phase 2 合奏草稿
- `006_pending_scores_unique.sql` — Phase 2.5 唯一索引

### Phase 3（`phase-3/`）
- `007_tracks_add_arweave_url.sql` — S0.a tracks 表加 arweave_url 列
- `008_score_covers.sql` — S1 封面复用池
- `009_score_nft_queue.sql` — S5.a 乐谱 NFT 铸造队列
- `010_mint_score_rpc.sql` — S5.a 事务 RPC（封面分配 + 入队 + 草稿 expired）
- `011_extend_mint_events.sql` — S5.a mint_events 扩展字段
- `012_mint_events_nullable_queue_id.sql` — S6 mint_queue_id 改可空
- `013_system_kv.sql` — 3B 系统 KV 表（last_synced_block 等）
- `014_chain_events.sql` — 3B 链上事件表（Transfer 同步）

### Phase 4（`phase-4/`）
- `015_jwt_blacklist.sql` — S0 JWT 撤销黑名单
- `016_auth_identities.sql` — S1 多源身份表 + 现有 Privy 用户迁移
- `017_users_privy_nullable.sql` — S1 privy_user_id 改可空
- `018_airdrop_rounds.sql` — S6 空投轮次表
- `019_airdrop_recipients.sql` — S6 空投接收者表
- `020_airdrop_recipients_updated_at.sql` — Review Fix F7 加 updated_at 列

### Phase 6（`phase-6/`）

按 `playbook/phase-6/` 5 个 track 分子目录（顶层 8 文件硬线触发的二次拆分）。
**跨子目录仍按编号顺序执行**——子目录只是归档维度。

#### `phase-6/track-a/`（mint 后端稳定性 + 草稿原子化）
- `021_mint_queue_failure_kind.sql` — A2 mint_queue 失败分类（safe_retry / manual_review）
- `022_score_nft_queue_lease.sql` — A1 score_nft_queue 加 locked_by + lease_expires_at + 部分索引
- `023_score_nft_queue_uri_tx_hash.sql` — A1 score_nft_queue 加 uri_tx_hash（setTokenURI 拆步用）
- `024_claim_score_queue_durable_lease.sql` — A1 claim_score_queue_job RPC 重写（durable lease 版）
- `025_drop_legacy_claim_rpc.sql` — A1 cleanup 移除旧无参 claim_score_queue_job（PostgreSQL 函数重载残留）
- `026_save_score_atomic.sql` — A4 草稿保存原子化 RPC（UPDATE expired + INSERT new 同事务，防 insert 失败丢旧 draft）
- `030_score_nft_queue_failure_kind.sql` — P1-8 修复（2026-05-08 strict CTO review）：score_nft_queue 加 failure_kind 列（与 mint_queue 对称）
- `031_pending_scores_event_count.sql` — P1-19 修复（2026-05-08 strict CTO review）：pending_scores 加 event_count generated column（避免 N+1 拉整个 jsonb 算 length）

#### `phase-6/track-b/`（前端 + 数据 + B2 RPC）
- `027_tracks_add_published.sql` — B6 tracks 加 published 列
- `028_b6_seed_data.sql` — B6 5 球数据 + 安全清旧 mint
- `029_mint_score_enqueue_keep_draft.sql` — B2 P1 改 mint_score_enqueue：入队后**不再**标 pending_score expired（让 GET /api/me/scores 能联表 queue 拿"铸造中"显示）

### Phase 7（`phase-7/`）

#### `phase-7/track-a/`（修严重 BUG）
- `032_score_queue_state_machine.sql` — A3+A12 score_nft_queue 加 mint_attempted_at + uri_attempted_at（双 mint 防御 10min 窗口）+ token_id partial unique index（P2-11）

### Phase 15（`phase-15/`）

- `050_pending_scores_client_draft_id.sql` — C3 为本机草稿增加用户内幂等身份，并串行化同曲目并发保存；2026-09-13 已应用到 P14 test 与 production，远端 history/read-back 及 test RPC 重放幂等均通过

## 新人第一次建库

在 Supabase Dashboard → SQL Editor 按下列顺序执行。不得用
`find ... | sort`：字典序会把 `phase-10/12/14` 错排到 `phase-3` 前面。

```text
phase-0-2/001–006
phase-3/007–014
phase-3/hotfix/015h–016h
phase-4/015–020
phase-6/track-a/021–026
phase-6/track-b/027–029
phase-6/track-a/030–031
phase-7/track-a/030b, 032–033
phase-10/040–047
phase-12/048
phase-14/049
phase-15/050
```

新空库可以按 Phase 分事务执行并逐批 read-back。对非空库不得重放整链：
`028_b6_seed_data.sql` 包含历史 Material mint 清理，且多个早期 migration 不是幂等的。

## 新增 migration

1. 找到当前最大编号（跨所有子目录），`+1`
2. 放到对应 Phase 的子目录下
3. 如果子目录满了（≥ 8 文件），新开子目录
4. 更新本 README 的清单

## 为什么按 Phase 分组

- 目录文件数 ≤ 8 硬线（`check-folder-size.js`）
- Phase 3 会新增很多 migration，只拆 Phase 3 不如全部拆到统一风格
- 同 Phase migration 有语义关联，便于回顾历史
