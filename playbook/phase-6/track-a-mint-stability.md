# Track A — 铸造链路稳定性

> **范围**：operator 全局串行锁 + ScoreNFT cron 恢复语义重做 + material failed 可区分重试 +
> 链上事件同步事务性 + 草稿保存原子化 + /score 链上灾备 + 我的乐谱语义（决策 gate）
>
> **前置**：A0 是 Phase 6 所有涉及 operator 钱包 cron 的前置；其他 step 在 A0 之后可并行
>
> **对应 findings**：#1 #3 #5（原 D4 升级）#17 #18 #19 #21 #22
>
> **核心交付物**：三条后端铸造链路 + 链上事件同步 + 草稿链路，全部达到"tester 公开 + 未来主网"的恢复语义 + 并发安全 + 幂等标准

---

## 冻结决策

### D-A1 — 所有 cron 接入 Full Durable Lease 模式（带 owner CAS）

claim 时生成唯一 `lease_owner` UUID 写入 DB。后续**所有**状态推进的 DB update 都必须带 CAS：

```
WHERE id = :row_id AND locked_by = :my_owner AND lease_expires_at > now()
```

长步骤（链上交易）触发 heartbeat 续租；失败或成功后显式释放锁。Lease 过期的 worker 不允许再写状态（CAS 会失败返回 0 行受影响）。

**为什么必须是 full spec**：半个 lease 模式（只加 `lease_expires_at` 没加 `lease_owner`）只能减少并发窗口，不能证明并发安全：A worker 拿锁 → 卡住 → lease 过期 → B 接手推进 → A 恢复后仍可能用 `.eq('id', row.id)` 覆盖 B 的状态。CAS 带 owner 是唯一可证明的并发安全模式。

### D-A2 — "tx 已发 DB 未落"一律标 failed + failure_kind='manual_review'，禁止自动重试

所有链上 writeContract 之后的 DB 写失败 **一律不 reset，也不能被前端 API 自动重试**。

失败类型（`failure_kind` 字段）：

| failure_kind | 含义 | 前端重试行为 |
|---|---|---|
| `'safe_retry'` | 链上 revert / chain send 未发出 / 其他明确安全可重试 | API 可自动 reset → pending，重新入队 |
| `'manual_review'` | 链上可能已发但 DB 未落 / 人工介入 | API 返 409 + "铸造失败，请联系运维"，**不重试** |

cron 写 failed 时必须同时写 `failure_kind`。API 重试路径只允许 `safe_retry`。

### D-A3 — receipt pending ≠ failed

`getTransactionReceipt` 抛错（tx 尚未被 RPC 返回）不算失败。返回 null 等下次 cron。retry_count 不增加。只有 `receipt.status !== 'success'` 才算显式链上失败。

### D-A4 — 运营钱包全局串行锁是 Phase 6 必修，与空投是否启用无关

material / score / airdrop 三条 cron 共用同一 operator EOA，任意两个同时发 tx 都可能 nonce race。因此 **A0 运营钱包全局锁是 Phase 6 必修 gate，不随 Track D 决策变化**。

A0 完成前不允许接通 B3（草稿铸造按钮）+ 不允许启用 airdrop cron。

### D-A5 — A6 /me 语义是产品决策，不是工程偏好

JOURNAL 2026-04-12 有决策 "/me 展示我铸造的"。A6 要改成 owner 投影等于推翻产品语义。Phase 6 kickoff 阶段由用户显式决策后再执行（见 [A6](#step-a6--我的乐谱语义决策--实现)）。

---

## 📋 Step 总览

| Step | Findings | 内容 | 工作量 | 依赖 |
|---|---|---|---|---|
| [A0](#step-a0--运营钱包全局串行锁) | 原 D4 (#5) | Redis 分布式锁 + 3 个 cron 入口包装 | 半天 | **Phase 6 必修 gate** |
| [A1](#step-a1--scorenft-cron-恢复语义重做带-full-durable-lease) | #17 #18 | ScoreNFT cron 四连 + 完整 durable lease（lease_owner + heartbeat + CAS）| 1-2 天 | A0 |
| [A2](#step-a2--material-failed-分类重试语义pre-tester-gate) | #1 | mint_queue 加 failure_kind + API 只重试 safe_retry | 1-2 小时 | 无（**Pre-tester**）|
| [A3](#step-a3--sync-chain-events-cursor-事务性) | #3 | 单条 upsert 失败不推进 cursor | 30-60 分 | 无 |
| [A4](#step-a4--草稿保存原子化) | #19 | pending_scores expired + insert 合并 RPC | 1 小时 | 无 |
| [A5](#step-a5--scoretokenid-链上灾备路径) | #21 | DB miss 时从 tokenURI 拉 Arweave | 半天 | 无 |
| [A6](#step-a6--我的乐谱语义决策--实现) | #22 | 产品决策 gate + 按决定实现 | 决策 10 分 + 实现 0-半天 | A3（若做 owner 投影）|

---

## Step A0 — 运营钱包全局串行锁

> **状态**：✅ 已实施（2026-05-08 audit 确认）
> **位置**：`src/lib/chain/operator-lock.ts`（Upstash SETNX + Lua 安全释放）+ 3 个 cron 入口都包装 acquireOpLock/releaseOpLock

### 概念简报
material / score / airdrop 三条 cron 共用 `operatorWalletClient`（同一 EOA）。只要任意两个 cron 同分钟发 tx，就会 nonce race：后发的 tx 可能 replace 前一笔、可能被 RPC 拒绝、可能互相覆盖。这是主网前硬门槛，**不是空投启用时才考虑的问题**。

### 📦 范围
- `src/lib/chain/operator-lock.ts`（新建，基于 Upstash Redis）
- `app/api/cron/process-mint-queue/route.ts`（入口包装）
- `app/api/cron/process-score-queue/route.ts`（入口包装）
- `app/api/cron/process-airdrop/route.ts`（入口包装）
- `docs/STACK.md`（白名单登记 `@upstash/redis` 的新用途 — 已装）
- `docs/LEARNING.md`（新增"分布式互斥锁"词条）

### 做什么

**1. 锁模块**

```ts
// src/lib/chain/operator-lock.ts
import 'server-only';
import { Redis } from '@upstash/redis';

const LOCK_KEY = 'op_wallet_lock';
const LEASE_MS = 30_000;

let redis: Redis | null = null;
function getRedis() {
  if (redis) return redis;
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL.replace(/^["']+|["']+$/g, '').trim(),
    token: process.env.UPSTASH_REDIS_REST_TOKEN!.replace(/^["']+|["']+$/g, '').trim(),
  });
  return redis;
}

export async function acquireOpLock(holder: string): Promise<boolean> {
  const r = getRedis();
  if (!r) {
    console.warn('[op-lock] Upstash 未配置，无法加锁，跳过（仅限本地开发）');
    return true; // 本地开发放行
  }
  const result = await r.set(LOCK_KEY, holder, { nx: true, px: LEASE_MS });
  return result === 'OK';
}

export async function releaseOpLock(holder: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  // Lua 脚本保证只释放自己的锁（避免误删别人的）
  await r.eval(
    `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`,
    [LOCK_KEY],
    [holder],
  );
}
```

**2. 3 个 cron 入口包装**

```ts
// 每个 cron route.ts 的 GET 入口
import { acquireOpLock, releaseOpLock } from '@/src/lib/chain/operator-lock';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return NextResponse.json({ error: '无效的 secret' }, { status: 401 });

  const holder = `mint-queue-${randomUUID()}`;
  if (!await acquireOpLock(holder)) {
    return NextResponse.json({ result: 'busy', holder: null });
  }
  try {
    // ... 原业务逻辑
  } finally {
    await releaseOpLock(holder);
  }
}
```

**3. 文档**

- `docs/LEARNING.md` 新增"分布式互斥锁（SETNX + Lua 安全释放）"
- `docs/ARCHITECTURE.md` 决策章节加"operator 钱包全局串行"

### 验证标准
- [ ] `@upstash/redis` 已在 STACK.md 白名单（已有，用途扩展）
- [ ] 3 个 cron 入口都有 acquire/release 包装
- [ ] 手动同时触发 3 个 cron → 只 1 个拿到锁，其余返 `{result:'busy'}`
- [ ] 30s 过期后新 cron 能接管
- [ ] 本地开发（无 UPSTASH env）→ console.warn + 放行
- [ ] `scripts/verify.sh` 通过

---

## Step A1 — ScoreNFT cron 恢复语义重做（带 Full Durable Lease）

> **状态**：✅ 已实施（2026-05-08 audit 确认）
> **位置**：migration `phase-6/track-a/024_claim_score_queue_durable_lease.sql` + `app/api/cron/process-score-queue/route.ts` (CAS owner + lease) + `steps-set-uri.ts` (uri_tx_hash 拆步)

### 概念简报
合并 #17 + #18，4 个子改动 + 完整 durable lease：
1. post-send rollback 修复（同 material 模式）
2. claim RPC 加 `lease_owner + lease_expires_at + CAS on all updates`
3. receipt pending 返 null 等下次
4. setTokenURI 拆步（加 `uri_tx_hash`）

### 📦 范围
- `app/api/cron/process-score-queue/steps-chain.ts`（两个 step 重写）
- `supabase/migrations/phase-6/021_score_nft_queue_lease.sql`（新建）
- `supabase/migrations/phase-6/022_score_nft_queue_uri_tx_hash.sql`（新建）
- `supabase/migrations/phase-6/023_claim_score_queue_durable_lease.sql`（新建，替换 `phase-3/hotfix/015`）
- `src/types/jam.ts`（`ScoreMintQueueRow` 新增 `locked_by / lease_expires_at / uri_tx_hash`）

### 做什么

**1. DB schema**

`021_score_nft_queue_lease.sql`：
```sql
alter table score_nft_queue
  add column locked_by uuid,
  add column lease_expires_at timestamptz;

create index idx_score_nft_queue_lease on score_nft_queue (lease_expires_at)
  where lease_expires_at is not null;
```

`022_score_nft_queue_uri_tx_hash.sql`：
```sql
alter table score_nft_queue add column uri_tx_hash text;
```

**2. claim RPC 重写（带 owner）**

`023_claim_score_queue_durable_lease.sql`：
```sql
create or replace function claim_score_queue_job(
  p_owner uuid,
  p_lease_minutes int default 5
) returns score_nft_queue as $$
declare
  r score_nft_queue;
begin
  update score_nft_queue set
    locked_by = p_owner,
    lease_expires_at = now() + (p_lease_minutes || ' minutes')::interval,
    updated_at = now()
  where id = (
    select id from score_nft_queue
    where status not in ('success', 'failed')
      and (lease_expires_at is null or lease_expires_at < now())
    order by updated_at asc
    limit 1
    for update skip locked
  )
  returning * into r;
  return r;
end;
$$ language plpgsql;
```

**3. route.ts 调用 RPC 时传 owner**

```ts
import { randomUUID } from 'crypto';
const leaseOwner = randomUUID();
const { data: row } = await supabaseAdmin.rpc('claim_score_queue_job', {
  p_owner: leaseOwner,
  p_lease_minutes: 5,
});
```

**4. stepMintOnchain + stepSetTokenUri 所有状态更新带 owner CAS**

```ts
// 推进到 uploading_metadata（或任何状态）
const { data: updated } = await supabaseAdmin
  .from('score_nft_queue')
  .update({ status: 'uploading_metadata', tx_hash: txHash, updated_at: now })
  .eq('id', row.id)
  .eq('locked_by', leaseOwner)           // ← CAS 1
  .gt('lease_expires_at', new Date().toISOString())  // ← CAS 2
  .select('id')
  .maybeSingle();
if (!updated) {
  // 锁已过期或被别人抢 — 放弃写入，日志记 WARN
  console.warn(`[score-cron] lease lost for ${row.id}，放弃本次状态推进`);
  return; // 下次 cron 会重新 claim
}
```

**5. Heartbeat（长步骤前后续租）**

```ts
// 在 stepUploadEvents / stepUploadMetadata 等可能 > 1 分钟的步骤前后调用
async function heartbeat(jobId: string, owner: string) {
  await supabaseAdmin
    .from('score_nft_queue')
    .update({ lease_expires_at: new Date(Date.now() + 5*60*1000).toISOString() })
    .eq('id', jobId)
    .eq('locked_by', owner);
}
```

**6. post-send rollback 修复 + receipt pending 兜底**

同 material/airdrop 模式，分离 chain send 和 DB 写：

```ts
if (!row.tx_hash) {
  let txHash: `0x${string}`;
  try {
    txHash = await operatorWalletClient.writeContract({...});
  } catch (err) {
    throw new Error(`chain send failed: ${err}`); // outer catch → resetToPending (safe_retry)
  }
  // tx 已广播 — DB 失败不 reset
  const { data: dbOk } = await supabaseAdmin.from('score_nft_queue')
    .update({ tx_hash: txHash, updated_at: now })
    .eq('id', row.id).eq('locked_by', leaseOwner).gt('lease_expires_at', now)
    .select('id').maybeSingle();
  if (!dbOk) {
    console.error(`CRITICAL: score tx ${txHash} DB 写失败 job=${row.id}`);
    await supabaseAdmin.from('score_nft_queue').update({
      status: 'failed',
      last_error: `CRITICAL: tx ${txHash} broadcast but DB write lost (lease ${leaseOwner})`,
    }).eq('id', row.id).eq('locked_by', leaseOwner);
    return 'failed';
  }
  return 'minting_onchain';
}

// 有 tx_hash → 查 receipt（pending 等下次）
let receipt;
try {
  receipt = await publicClient.getTransactionReceipt({ hash: row.tx_hash });
} catch {
  return 'minting_onchain'; // receipt 未出，不算失败
}
if (receipt.status !== 'success') throw new Error(`tx reverted: ${row.tx_hash}`);
// ... 提取 tokenId + 推进（带 CAS）
```

**7. 成功/失败后释放 lease**

```ts
// 终态 (success 或 failed) 的同时释放锁
.update({ status: 'success', locked_by: null, lease_expires_at: null, ... })
```

### 验证标准
- [ ] 3 条 migration 在 Supabase 执行
- [ ] 启动两个 cron 并发触发同一 job → 只 1 个能推进，另一个 claim 返 null
- [ ] 模拟 lease 过期 + stale worker 尝试写 → CAS 失败，不覆盖状态
- [ ] 模拟 DB 写失败 → status = failed + last_error 记录，job 不会被重 claim
- [ ] receipt pending 场景（tx 未被 RPC 返回）→ retry_count 不增加
- [ ] 端到端：手动触发一次乐谱铸造 → pending → uploading → minting_onchain → uploading_metadata → setting_uri → success
- [ ] `scripts/verify.sh` 通过

---

## Step A2 — material failed 分类重试语义【Pre-tester Gate】

### 概念简报
当前 `POST /api/mint/material` 对 failed job 直接返 `{result:"ok"}`，前端继续红心但后端不入队。**修复方式不能简单重置为 pending**，因为某些 failed 状态（post-send DB 失败 / stuck 无 tx_hash）含义是"链上可能已发但 DB 未落"，重置会导致重复 mint。

必须引入 `failure_kind` 字段区分两类失败。

### 📦 范围
- `app/api/mint/material/route.ts`
- `app/api/cron/process-mint-queue/steps.ts`（所有标 failed 的路径都写 failure_kind）
- `supabase/migrations/phase-6/024_mint_queue_failure_kind.sql`（新建）
- `src/types/tracks.ts`（若有相关类型）

### 做什么

**1. DB 加字段**

`024_mint_queue_failure_kind.sql`：
```sql
alter table mint_queue
  add column failure_kind text check (failure_kind in ('safe_retry', 'manual_review'));

create index idx_mint_queue_failure_kind on mint_queue (failure_kind) where failure_kind is not null;
```

**2. cron 写 failed 时分类**

`steps.ts` 的 resetToPending 改名为 `markFailed(jobId, kind, error)`，明确哪些情况走哪类：

| 场景 | failure_kind | 原因 |
|---|---|---|
| 链上 send failed（writeContract throw）| `safe_retry` | tx 未上链，可安全重发 |
| 链上 revert（receipt.status !== success）| `safe_retry` | tx 已结束，重新跑不会双 mint |
| post-send DB 写 tx_hash 失败 | `manual_review` | 链上可能已发，不得自动重试 |
| stuck（minting_onchain + 无 tx_hash + 超时）| `manual_review` | 链上状态未知 |
| user 不存在 | `manual_review` | 需要人工核查数据 |
| retry_count 耗尽 | `safe_retry` | 已重试 MAX 次，标 failed 保留（API 可选择继续重试或拒绝）|

**3. API 路径分流**

```ts
if (mintError.code === '23505') {
  const { data: existing } = await supabaseAdmin
    .from('mint_queue')
    .select('id, status, failure_kind, last_error')
    .eq('idempotency_key', idempotencyKey)
    .single();
  if (!existing) { throw mintError; }

  if (existing.status === 'success') {
    return NextResponse.json({ error: '你已经铸造过这个素材', alreadyMinted: true }, { status: 409 });
  }
  if (existing.status === 'pending' || existing.status === 'minting_onchain') {
    return NextResponse.json({ result: 'ok', mintId: existing.id, status: existing.status });
  }
  // status = 'failed'
  if (existing.failure_kind === 'safe_retry') {
    await supabaseAdmin.from('mint_queue').update({
      status: 'pending', tx_hash: null, retry_count: 0, failure_kind: null,
    }).eq('id', existing.id).eq('status', 'failed');  // CAS
    return NextResponse.json({ result: 'ok', mintId: existing.id, status: 'pending', retried: true });
  }
  // failure_kind = 'manual_review' 或 null（遗留数据）
  return NextResponse.json({
    error: '上次铸造未完成，需人工核查',
    alreadyMinted: false,
    needsReview: true,
  }, { status: 409 });
}
```

**4. 前端改造（useFavorite）**

收到 409 + needsReview → 显示"收藏失败，请联系客服"而非无限重试。

### 验证标准
- [ ] migration 执行
- [ ] 模拟 `failure_kind='safe_retry'` job → 再调 API → 重置为 pending，cron 继续
- [ ] 模拟 `failure_kind='manual_review'` job → 再调 API → 返 409 + needsReview
- [ ] Phase 5 修复的 Bug #7（idempotencyKey 稳定）仍然工作
- [ ] `scripts/verify.sh` 通过

---

## Step A3 — sync-chain-events cursor 事务性

> **状态**：✅ 已实施（2026-05-08 audit 确认）
> **位置**：`app/api/cron/sync-chain-events/route.ts:55+`（注释明确"Phase 6 A3：单条 upsert 失败立刻 return，不推进 cursor 越过失败 batch"，已成功 batch 持久化保留）

### 概念简报
`sync-chain-events` 循环里单条 upsert 失败只打日志仍推进 `last_synced_block`。一次 Supabase 抖动可能让某个 Transfer 永远漏扫。

### 📦 范围
- `app/api/cron/sync-chain-events/route.ts`

### 做什么
策略：任一 upsert 失败 → 立刻 return，不推进 cursor。

```ts
for (const event of events) {
  const { error } = await supabaseAdmin.from('chain_events').upsert(...);
  if (error) {
    console.error(`[sync] upsert failed at block ${event.blockNumber}:`, error);
    return NextResponse.json({ result: 'partial', stoppedAt: event.blockNumber });
  }
}
// 全部成功才推进 cursor
await supabaseAdmin.from('system_kv').update({ value: String(newCursor) }).eq('key', 'last_synced_block');
```

### 验证标准
- [ ] 模拟 upsert 错 → cursor 不前进
- [ ] 修复后下轮 cron → cursor 推进
- [ ] `scripts/verify.sh` 通过

---

## Step A4 — 草稿保存原子化

> **状态**：✅ 已实施（2026-05-08 audit 确认）
> **位置**：migration `phase-6/track-a/025_save_score_atomic_rpc.sql` + `app/api/score/save/route.ts:101` 调 RPC，单事务内 UPDATE 旧 → expired + INSERT 新，并发 unique 冲突 EXCEPTION 回退

### 概念简报
`POST /api/score/save` 先把旧 draft 标 expired 再插入新 draft。插入失败 = 用户丢旧草稿。

### 📦 范围
- `app/api/score/save/route.ts`
- `supabase/migrations/phase-6/025_save_score_rpc.sql`（新建 RPC）

### 做什么
写 Supabase RPC `save_score_atomic`：BEGIN → UPDATE old→expired → INSERT new → COMMIT。

route.ts 改为调用此 RPC。

### 验证标准
- [ ] RPC 内 throw → 旧 draft 仍保留
- [ ] 正常路径：旧 → expired，新插入

---

## Step A5 — /score/[id] 链上灾备路径

> **状态**：⏸ 挂 P7 重新设计（2026-05-08 B8 P3 决策）
> **理由**：B8 P3 改前端 inline 播放需要 `track.audio_url`，链上 metadata 拿不到完整 Track 对象（只有 ar:// 字符串）。原 score-fallback.ts 简化为 noop 后已删除（架构债务清理）。
> **下次重启时**：要么改 fallback 返"链上信息只读"模式（无播放），要么和 OpenSea NFT metadata standard 对齐重新设计。
> **路由变更**：B8 P3 后路径是 `/score/[id]`（双兼容 tokenId 数字 / queue.id UUID），原 step 标题已同步。

### 概念简报
ARCH 承诺永久可复现，但 `score-source.ts` 查不到 mint_events 返 null。DB 丢行 = 已上链 NFT 404。

### 📦 范围
- `src/data/score-source.ts`
- 复用 `src/lib/arweave/core.ts` 的 `fetchFromArweave`

### 做什么
DB miss 时：链上 `tokenURI(tokenId)` → `fetchFromArweave` metadata → 提取 events_ar_tx_id → fetch events.json。

### 验证标准
- [ ] 删一条 mint_events → 页面仍能渲染（从链上）
- [ ] 恢复 mint_events → 走回 DB 主路径

---

## Step A6 — 我的乐谱语义

### 📌 决策已冻结 @ 2026-04-25：保持"我铸造的"（选项 1）

见 `docs/JOURNAL.md` 2026-04-25 收尾段落 "A6 — /me 语义"。

**实际 Phase 6 工作量 = 0 代码** — 保持现状即"我铸造的"，`/api/me/score-nfts` 继续按 `score_nft_queue.user_id` 查。Finding P14-22 标 `deferred-justified`（理由见 JOURNAL）。

未来若产品方向改变（主网上线后二级市场活跃、社交分享需求出现），可作为独立 Phase 重新评估选项 2/3。届时重启：依赖 Track A3 完成（chain_events 新鲜度）。

### 原决策过程（保留供未来重评参考）

JOURNAL 2026-04-12 决策：`/me = 我铸造的`。当时理由是转手场景极少，不值得增加复杂度。Phase 1-4 回看 P14-22 建议改成"我持有的"，Phase 6 kickoff 复审后维持原决策。

### A6.0 — 决策 Gate

3 个选项：

**选项 1：保持"我铸造的"（推翻 A6 改动）**
- 优点：语义稳定，和现有代码一致，复杂度最低
- 缺点：ScoreNFT 转给朋友后，转出方仍看到，接收方看不到
- 适合场景：产品强调"创作者归属"而非"持有权"

**选项 2：改"我持有的"（按链上 owner）**
- 优点：和 NFT 标准语义一致，接收方能看到
- 缺点：需要依赖 chain_events 新鲜度（Track A3）+ 转出后原 minter 从 /me 消失
- 适合场景：产品强调"钱包就是你"

**选项 3：双分区 "我创作的 + 我持有的"**
- 优点：兼得两种语义
- 缺点：UI 更复杂，Phase 6 UI 重设计要跟进

### 📦 范围（按决策）

| 决策 | 范围 | 工作量 |
|---|---|---|
| 选项 1 | 无代码改动，更新 JOURNAL 说明 | 10 分钟 |
| 选项 2 | `app/api/me/score-nfts/route.ts` 改查 chain_events；依赖 A3 | 半天 |
| 选项 3 | 新 API `/api/me/score-nfts?kind=minted\|owned` + UI 加切换 | 1 天（UI 一起）|

### 依赖
选项 2/3 依赖 A3 完成（chain_events 是准确的链上事实）。

### 验证标准（选项 2 示例）
- [ ] 转手 ScoreNFT 给 B → B 的 /me 显示，A 的 /me 不显示
- [ ] 未转手 NFT 在 minter /me 正常显示
- [ ] JOURNAL 更新决策记录

---

## Track A 完结标准

- [ ] 7 steps 全绿（含 A0）
- [ ] 5 条 migration（021-025 + 替换 phase-3/hotfix/015）Supabase 执行
- [ ] Durable Lease 并发安全测试通过（手动模拟 stale worker）
- [ ] operator 全局锁在 3 个 cron 入口都生效
- [ ] 端到端：手动铸一张 ScoreNFT 走完整状态机（pending → success）
- [ ] A6 决策写进 JOURNAL，按决策完成对应代码
- [ ] `scripts/verify.sh` 通过
