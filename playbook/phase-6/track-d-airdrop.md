# Track D — 空投闭环（条件性）

> **📌 D1 决策已冻结 @ 2026-04-25：主网不做空投**（`docs/JOURNAL.md`）
>
> **本 Track 实际范围**：**只做 D2（admin header 鉴权）**，其余 D3/D4/D5 挂起到未来 Phase。
> cron-job.org 的 `process-airdrop` 定时触发在 Phase 6 完结时停用。
>
> D3/D4/D5 的详细设计保留在本 playbook 供未来重启参考，但当前状态 = `deferred-justified`。
>
> **前置**：无（D2 独立，不依赖 Track A0）
>
> **对应 findings**：#11（D2 做）+ #4 #10 #12 #25（已 deferred）
>
> **核心交付物**：
> - ✅ `/api/airdrop/trigger` 去掉 query token 泄露面（D2）
> - ✅ cron-job.org 停用 process-airdrop 定时触发
> - ✅ STATUS / ARCH 明确"空投代码挂起，主网不对外承诺"

---

## 冻结决策

### D-D1 — 空投是否进主网（kickoff 冻结，不能执行中"自然挂起"）

Phase 6 kickoff 阶段用户必须显式决策：**主网是否做空投？**

不做决策 = 默认视为"不做"。一旦决策写进 JOURNAL，**后续不允许执行中自然飘移**。

决策后果对齐：
- **做** → D2-D5 全修 + 主网发奖励
- **不做** → 只做 D2（admin header，因为 query token 是安全泄露点，无关空投启用）+ **停用 cron-job.org 的 `process-airdrop` 定时** + STATUS/ARCH 明确"空投代码挂起，主网不对外承诺"

### D-D2 — 运营钱包全局锁已升级到 Track A0

原 Track D 的"运营钱包串行锁"升级为 Phase 6 必修（Track A0），与空投启用无关。Track D 不再单独讨论锁。

### D-D3 — AirdropNFT metadata 生成是 ScoreNFT 同级别链路

做就按 ScoreNFT 的 5 步状态机：上传 metadata → setTokenURI → 等 receipt → 标 success。不是一句 mint 完事。

### D-D4 — D5（metadata）验证标准去 OpenSea testnet

项目长期决策：**OpenSea 已永久停 testnet**。D5 原写"OpenSea 可见名字+图"的验证不可执行。改为：
- 链上 `tokenURI(tokenId)` 可读
- Arweave metadata/image 可直接 `fetchFromArweave` 回
- Etherscan 交易和事件可核验
- 本地 / 脚本能渲染 metadata

主网 OpenSea 展示验证挪到 Phase 7 主网上线后。

---

## 📋 Step 总览

| Step | Findings | 内容 | 条件 | 工作量 |
|---|---|---|---|---|
| [D1](#step-d1--产品决策kickoff-冻结) | — | 决定主网是否做空投 | **kickoff 冻结，不能延后** | 10 分钟讨论 + JOURNAL 写入 |
| [D2](#step-d2--admin-header-鉴权无条件做) | #11 | `/api/airdrop/trigger` 从 query token 改 Authorization Bearer | **D1 无关，必做** | 30 分钟 |
| [D3](#step-d3--快照新鲜度--触发事务) | #4 #10 | trigger 检查 chain_events cursor + 合并三步成 RPC | D1 = 做 | 半天 |
| [D4](#step-d4--failed-round-判定--health--告警) | #12 | round 不因 failed recipient 被标 done + health 加 airdrop 指标 | D1 = 做 | 半天 |
| [D5](#step-d5--airdropnft-metadata-完整链路) | #25 | metadata 生成 + setTokenURI（验证用 Etherscan + Arweave direct，不用 OpenSea）| D1 = 做 | 1-2 天 |

---

## Step D1 — 产品决策【kickoff 冻结】

### 概念简报
空投是产品决策，不是技术决策。决策项：

1. **主网是否做空投？**（核心）
2. 若做，奖励对象是什么？
3. 若做，每轮 metadata 是共享一张封面还是每 tokenId 独立？
4. 若不做，什么时候可能重启（Phase 7? Phase 8? 永不）？

### 📦 范围
讨论 + 决策记录 + JOURNAL 更新

### 做什么

**1. 和用户对齐 3 分钟讨论**

**2. JOURNAL 写一条冻结决策**

```markdown
### 2026-04-XX — Phase 6 D1 空投决策

- 决定：做 / 不做（二选一）
- 理由：...
- 后果：
  - 若做：Track D D2-D5 全推进，主网奖励 NFT 对外展示
  - 若不做：
    1. D2 单做（admin header）
    2. cron-job.org 停用 process-airdrop 定时触发
    3. STATUS.md "tester 范围" + "主网承诺边界" 明确 "空投代码挂起"
    4. ARCH 空投章节加注解
    5. 未来重启空投需要新 Phase 或明确升级计划
```

### 验证标准
- [ ] JOURNAL 有决策条目
- [ ] STATUS.md 同步（若不做，"主网承诺边界"段更新）
- [ ] 若做 → 往下开 D3-D5
- [ ] 若不做 → 往下只开 D2，其余 steps 明确挂起

---

## Step D2 — admin header 鉴权【无条件做】

> **状态**：✅ 已实施（2026-05-08 audit 确认）
> **位置**：`src/lib/auth/admin-auth.ts` verifyAdminToken（仿 cron-auth 模式 Bearer-only）+ `app/api/airdrop/trigger/route.ts:20` 入口包装（注释明确"Phase 6 D2 改"）

### 概念简报
`app/api/airdrop/trigger/route.ts:9, 18-20` 用 `?token=` 读 `ADMIN_TOKEN`。query token 进浏览器历史、Vercel/代理日志、截图和复制链接，泄露面大。即使空投不启用，也不能留这个点。

### 📦 范围
- `app/api/airdrop/trigger/route.ts`
- `src/lib/auth/admin-auth.ts`（新建）

### 做什么

新建 `admin-auth.ts`（仿 cron-auth 模式，只认 Authorization Bearer）：
```ts
import 'server-only';
export function verifyAdminToken(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === expected;
  }
  return false; // 不接受 query param
}
```

trigger 路由替换：
```ts
if (!verifyAdminToken(req)) {
  return NextResponse.json({ error: '无效的 admin token' }, { status: 401 });
}
```

### 注意
- 如有 runbook 或运维工具在调此接口，同步改
- 旧 query token 调用将失效，需通知用户

### 验证标准
- [ ] `?token=xxx` 访问 → 401
- [ ] `Authorization: Bearer xxx` → 正常
- [ ] `scripts/verify.sh` 通过

---

## Step D3 — 快照新鲜度 + 触发事务

### 概念简报
合并两个问题：
- **#4**：trigger 从 chain_events 算当前 owner，但没检查 `system_kv.last_synced_block` 是否接近 `latest block`
- **#10**：触发按"插入 round → 插入 recipients → 标记 ready"三步非事务，中断留 draft round

### 📦 范围
- `app/api/airdrop/trigger/route.ts`
- `supabase/migrations/phase-6/026_airdrop_trigger_rpc.sql`（新建）

### 做什么

**1. 新鲜度门槛**

```ts
const { data: cursor } = await supabase.from('system_kv')
  .select('value').eq('key', 'last_synced_block').single();
const latest = await publicClient.getBlockNumber();
const gap = Number(latest) - Number(cursor.value);
if (gap > 10) {
  return NextResponse.json({
    error: `链上事件同步落后 ${gap} 区块，拒绝触发空投`,
    hint: '等 sync-chain-events cron 追上后重试',
  }, { status: 503 });
}
```

**2. 三步合成 RPC 事务**

`026_airdrop_trigger_rpc.sql`：
```sql
create or replace function trigger_airdrop_round(
  round_name text,
  recipients jsonb
) returns uuid as $$
declare new_round_id uuid;
begin
  insert into airdrop_rounds (name, status) values (round_name, 'draft')
    returning id into new_round_id;
  insert into airdrop_recipients (round_id, wallet_address, user_id)
    select new_round_id, r->>'wallet_address', (r->>'user_id')::uuid
    from jsonb_array_elements(recipients) r;
  update airdrop_rounds set status = 'ready' where id = new_round_id;
  return new_round_id;
end;
$$ language plpgsql;
```

### 验证标准
- [ ] 手动滞后 cursor 20 区块 → trigger 返 503
- [ ] 模拟 recipients 插入失败 → round 整体回滚
- [ ] 正常路径 → round 直接到 ready

---

## Step D4 — failed round 判定 + health + 告警

### 概念简报
`markRoundDoneIfComplete` 只看 pending/minting，有 failed recipient 也会 done。health 不暴露空投指标。

### 📦 范围
- `app/api/cron/process-airdrop/route.ts`
- `app/api/health/route.ts`（Track E 统一合并）
- `src/types/tracks.ts`（HealthResponse 扩展，**归 Track E ownership**，D4 只提需求）

### 做什么

**1. round 完成判定**

```ts
const { count: activeCount } = await supabase.from('airdrop_recipients')
  .select('id', { count: 'exact', head: true })
  .eq('round_id', roundId)
  .in('status', ['pending', 'minting']);
if ((activeCount ?? 0) > 0) return;

const { count: failedCount } = await supabase.from('airdrop_recipients')
  .select('id', { count: 'exact', head: true })
  .eq('round_id', roundId)
  .eq('status', 'failed');

const finalStatus = (failedCount ?? 0) > 0 ? 'done_with_failures' : 'done';
await supabase.from('airdrop_rounds').update({ status: finalStatus }).eq('id', roundId);
```

**2. health airdrop 字段需求（提给 Track E 合并）**

D4 产出一份字段规约写进 `track-e-auth-observability.md` E1 的需求清单：
```ts
airdrop: {
  activeRounds: number,
  failedRecipients: number,
  oldestMintingAgeSeconds: number | null,
}
```

### 验证标准
- [ ] 造 round 有 1 failed + 0 active → status = done_with_failures
- [ ] Track E 合并后 health 返回 airdrop 块

---

## Step D5 — AirdropNFT metadata 完整链路

### 概念简报
合约有 `setTokenURI`，cron 只调 `mint()`。tester / 主网拿到的是空壳 NFT。按 ScoreNFT 模式补完整链路。

### 📦 范围
- `app/api/cron/process-airdrop/route.ts`（扩展状态机）
- `supabase/migrations/phase-6/027_airdrop_recipients_metadata.sql`（新建，加 `metadata_ar_tx_id / uri_tx_hash`）
- `scripts/arweave/generate-airdrop-metadata.ts`（新建）

### 做什么

**1. Metadata 格式**

参考 Phase 4C 设计：
```json
{
  "name": "Ripples Airdrop #{round}",
  "description": "...",
  "image": "ar://{round_cover_tx_id}",
  "external_url": "https://pond-ripple.xyz",
  "attributes": [
    {"trait_type": "Round", "value": "..."},
    {"trait_type": "Recipient Type", "value": "..."}
  ]
}
```

每 round 一张共享 cover（上传一次，所有 recipient 共用同一 metadata URI）。

**2. 状态机扩展**

原来：pending → minting → success

扩展为：
- pending → minting (发 mint + 存 tx_hash)
- minting → metadata_uploading (查 mint receipt + 拿 token_id + 上传 metadata)
- metadata_uploading → setting_uri (setTokenURI + 存 uri_tx_hash)
- setting_uri → success (查 setTokenURI receipt)

**3. 迁移加字段**

```sql
alter table airdrop_recipients
  add column metadata_ar_tx_id text,
  add column uri_tx_hash text;
alter table airdrop_recipients
  drop constraint airdrop_recipients_status_check,
  add constraint airdrop_recipients_status_check
    check (status in ('pending', 'minting', 'metadata_uploading', 'setting_uri', 'success', 'failed'));
```

### 验证标准（**不依赖 OpenSea testnet**）
- [ ] 测试网触发一轮空投 → recipient 走完 5 状态到 success
- [ ] `tokenURI(tokenId)` 链上可读（`cast call` 验证）
- [ ] Arweave metadata URL `fetchFromArweave` 返回正确 JSON
- [ ] Arweave image 可直接浏览器访问
- [ ] Etherscan 交易 + Transfer 事件可核验
- [ ] 本地脚本渲染 metadata（`scripts/arweave/preview-airdrop-metadata.ts`）
- [ ] 失败场景（metadata 上传失败 / setTokenURI 失败）不会重复 mint

**OpenSea 展示验证挪到 Phase 7 主网上线后**，不作为 Phase 6 gate。

---

## Track D 完结标准

### 若 D1 = 做
- [ ] D1-D5 全部 steps 完成
- [ ] 3 条 migration（026 trigger RPC + 027 metadata fields + 可能其他）Supabase 执行
- [ ] 测试网端到端：trigger → mint → metadata → setTokenURI → success（全链路 Etherscan + Arweave 可验证）
- [ ] health 返回 airdrop 指标（由 Track E 合并）
- [ ] `scripts/verify.sh` 通过
- [ ] STATUS.md "主网承诺边界" 明确 "空投纳入主网"

### 若 D1 = 不做
- [ ] D2 完成（admin header 鉴权）
- [ ] STATUS.md "主网承诺边界" 明确 "空投代码挂起，主网不对外承诺"
- [ ] cron-job.org 停用 `process-airdrop` 定时（保留 URL，不触发）
- [ ] `docs/ARCHITECTURE.md` 空投章节加 "Phase 6 决定不进主网" 注解
- [ ] D3/D4/D5 挂起，reviews tracker 标 "deferred"
