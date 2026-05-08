# Track E — 认证 & 观测收口

> **📌 E2 决策已冻结 @ 2026-04-25：Semi 登录挂 Phase 7**（`docs/JOURNAL.md`）
>
> Phase 6 不等 Semi OAuth。主网首版 Privy-only。E2 挂起到 Phase 7 或更后。
> E3（health Semi 探针）降级：只实现 `not_configured` 状态占位，Semi 配置到位后再探真 API。
>
> **范围**：material health 视图 + ~~Semi OAuth 前端接入~~（挂起）+ health 加 Semi 探针（降级）+
> Score Decoder 多网关入口 fallback + 文档口径对齐
>
> **前置**：E1 是 Pre-tester gate；其余无
>
> **对应 findings**：#15 #26 #27 #28（4 项做）+ #24 Semi 前端（deferred-justified）
>
> **核心交付物**：线上运营可观测性闭环 + 文档一致性

---

## 冻结决策

### D-E1 — material health 视图 tester 前必做

E1（/api/health 暴露 material queue 的 failed / stuck / retry / oldest age）是 pre-tester gate 之一。tester 踩到问题时没有视图只能翻日志。

### D-E2 — Semi 前端条件性

E2 依赖 Semi 团队提供 OAuth 接入方式。Phase 6 期间：
- **Semi OAuth 就绪** → E2 接入，tester 阶段后期可体验
- **Semi OAuth 未就绪** → E2 挂起到 Phase 7，不阻塞 Phase 6 完结

E2 挂起不影响 Track E 其他 step 完结判断。

### D-E3 — Score Decoder 多网关入口不是重写 decoder

E4 改的是**入口 URL**层面的 fallback，不改 decoder HTML 本身。Decoder 内部已有多网关 fallback（用来拉 events.json）。问题是如果第一个网关连 decoder.html 都拉不到，内部 fallback 没机会运行。

---

## 📋 Step 总览

| Step | Findings | 内容 | 工作量 | 条件 |
|---|---|---|---|---|
| [E1](#step-e1--material-health-视图pre-tester-gate) | #27 | /api/health 暴露 mint_queue 的 failed / stuck / retry | 30-60 分 | 无（**Pre-tester**）|
| [E2](#step-e2--semi-oauth-前端接入) | #24 | 前端 Semi 登录按钮 + useAuth 兼容 + 端到端 | 1-2 天 | Semi OAuth 就绪 |
| [E3](#step-e3--health-加-semi-探针) | #26 | /api/health 探 Semi API 可达性 | 1 小时 | E2 或 Semi 配置已定 |
| [E4](#step-e4--score-decoder-多网关入口-fallback) | #15 | animation_url 支持多网关 fallback | 半天 | 无 |
| [E5](#step-e5--文档口径对齐) | #28 | playbook/phase-4-community.md 和 STATUS/JOURNAL 对齐 | 30 分钟 | E2 决策后 |

---

## Step E1 — material health 视图【Pre-tester Gate】

### 概念简报
`/api/health` 只暴露 mint_queue 的 `pending + minting_onchain` 数量。tester 踩到问题时我们只能翻 Vercel runtime log，没聚合视图。

### 📦 范围
- `app/api/health/route.ts`
- `src/types/tracks.ts`（HealthResponse 扩展）

### 做什么
health 新增 mintQueue 块：
```ts
const { data: mintBreakdown } = await supabaseAdmin.rpc('mint_queue_health_stats');
// RPC 返回：
// {
//   failed: number,
//   stuck: number,      // status=minting_onchain + tx_hash=null + age>3min
//   retry_avg: number,
//   oldest_age_seconds: number,
//   last_error: string | null,  // 最近 10 分钟内最后一次 failed 的 last_error
// }
```

或者不用 RPC，直接几个 query：
```ts
const [failed, stuck, oldest] = await Promise.all([
  supabaseAdmin.from('mint_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  supabaseAdmin.from('mint_queue').select('id', { count: 'exact', head: true })
    .eq('status', 'minting_onchain')
    .is('tx_hash', null)
    .lt('updated_at', new Date(Date.now() - 3*60*1000).toISOString()),
  supabaseAdmin.from('mint_queue').select('updated_at')
    .in('status', ['pending', 'minting_onchain'])
    .order('updated_at', { ascending: true }).limit(1),
]);
```

HealthResponse 扩展：
```ts
mintQueue: {
  failed: number;
  stuck: number;        // 卡在 minting_onchain 无 tx_hash 超 3 分钟
  oldestAgeSeconds: number | null;
}
```

### 验证标准
- [ ] `/api/health?secret=xxx` 返回新字段
- [ ] 模拟造 1 failed + 1 stuck → health 准确反映
- [ ] `scripts/verify.sh` 通过

---

## Step E2 — Semi OAuth 前端接入

### 概念简报
Phase 4A S3 挂起至今。当 Semi 团队给出 OAuth 接入方式（现在还没给 OAuth URL 和回调约定），这里要：
1. 改 `src/lib/auth/semi-client.ts` 适配 OAuth 流程
2. 前端加 "用 Semi 钱包登录" 按钮
3. OAuth callback 路由
4. `useAuth` 兼容 Semi token
5. 端到端验证

### 📦 范围
- `src/lib/auth/semi-client.ts`（改写为 OAuth）
- `app/api/auth/community/callback/route.ts`（新建）
- `src/components/auth/LoginButton.tsx`（加 Semi 按钮）
- `src/hooks/useAuth.ts`（适配 JWT localStorage）

### 做什么
**等 Semi 团队给文档后再定**。Phase 6 期间此 step 处于 gate 状态。

### 依赖
- Semi OAuth URL
- Client ID / Secret 配置方式
- 回调 URL 约定
- User info 字段（之前已对齐：`auth_token`, `id`, `evm_chain_address`）

### 验证标准（未来）
- [ ] Semi 用户登录走通完整路径（OAuth → callback → JWT → /me）
- [ ] Privy 和 Semi 登录共存，evm_address 相同 → 同一个 user
- [ ] 登出清理 JWT localStorage 和 blacklist 写入
- [ ] `scripts/verify.sh` 通过

---

## Step E3 — health 加 Semi 探针

### 概念简报
playbook/phase-4 原计划 health 覆盖 Semi API 可达性。当前没有。如果 Semi 配置缺失或服务不可达，监控不会反映登录链路风险。

### 📦 范围
- `app/api/health/route.ts`

### 做什么
```ts
// 若配了 SEMI_API_URL，探一次
let semiStatus: 'ok' | 'error' | 'not_configured' = 'not_configured';
if (process.env.SEMI_API_URL) {
  try {
    const res = await fetch(process.env.SEMI_API_URL, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    });
    semiStatus = res.ok ? 'ok' : 'error';
  } catch {
    semiStatus = 'error';
  }
}
```

HealthResponse 加 `semi: semiStatus`。

### 依赖
E2 完成或 Semi 配置已定。E2 挂起期间这一步可以只支持 `not_configured` 状态，不探真 API。

### 验证标准
- [ ] 配了 SEMI_API_URL → health 显示 ok / error
- [ ] 未配 → 显示 not_configured，不影响其他字段

---

## Step E4 — Score Decoder 多网关入口 fallback

> **状态**：❌ 废弃（2026-05-08 B8 P3 决策）
> **理由**：B8 P3 把 `/score/[id]` ScorePlayer 改成前端 inline 播放（PlayerProvider.toggle + useEventsPlayback），不再用 iframe 嵌入 Arweave decoder HTML。E4 的设计目标（详情页 iframe 不可达时的 fallback）已不存在。
> **OpenSea 端 metadata animation_url**：仍指向 `arweave.net/{decoder_tx}`（metadata 一旦上链不可改），主网用 `ario.permagate.io` 单网关风险接受；P7 重新评估时若需要再做。

### 概念简报
`animation_url` 和 `/score/[id]` iframe 指向 `https://arweave.net/{decoder_tx}`。Decoder HTML 内部有多网关 fallback 拉 events.json，但如果 `arweave.net` 本身不可达，HTML 都加载不到，内部 fallback 没机会跑。

### 📦 范围
- `app/api/cron/process-score-queue/steps-upload.ts`（生成 animation_url 时）
- `src/data/score-source.ts`（读取时）
- `src/score-decoder/index.html`（可选：入口检测逻辑）

### 做什么
有两种方案：

**方案 A：HTML 带 script 检查自身入口**
让 decoder HTML 加载后检测自己是不是从主网关加载的，若不是就 redirect 到 fallback。不实用（如果连 HTML 都加载不到就无解）。

**方案 B：animation_url 加 primary + fallback 参数**
```
https://ario.permagate.io/{decoder}#events={events}&fallback=arweave.net
```
Decoder HTML 内部首先尝试主入口的网关拉 events.json。**但主 HTML 拉不到根本不行**。

**方案 C（推荐）：两步走**
1. `/score/[id]` 页面（非 iframe）先探测哪个 Arweave 网关可达
2. 根据探测结果构造 iframe src

```tsx
// ScorePlayer.tsx
const [gateway, setGateway] = useState<string | null>(null);
useEffect(() => {
  probeArweaveGateways().then(setGateway);
}, []);
if (!gateway) return <Loading />;
return <iframe src={`${gateway}/${decoderTxId}#events=${eventsTxId}`} />;
```

`probeArweaveGateways()` 顺序试 `arweave.net` → `ario.permagate.io`，HEAD 请求 3s 超时选第一个成功的。

**对于 OpenSea 的 animation_url**：
- 只能写死一个入口 URL（metadata 不可改）
- 建议用 `ario.permagate.io`（社区运营，相对稳）
- 如果它挂了，OpenSea 端没法 fallback（需要接受这个风险，或者 metadata 写成特殊格式由 decoder 处理）

### 验证标准
- [ ] 手动屏蔽 `arweave.net` → `/score/[id]` 仍能加载
- [ ] 两个网关都挂 → 页面显示降级提示（不白屏）
- [ ] `scripts/verify.sh` 通过

---

## Step E5 — 文档口径对齐

> **状态**：✅ 已实施（2026-05-08 本次 commit 落地）
> **改动**：phase-4-community.md S3 顶部加挂起前言 + ARCHITECTURE.md `/score/[tokenId]` → `/score/[id]` + decoder 退役注释 + mint_events 降级注释 + 5 个 track 文件全部加 ✅ 完成标记
> **JOURNAL**：2026-05-08 段记录本次 audit 结论 + E4 废弃决策

### 概念简报
`playbook/phase-4-community.md` 还把 Semi 描述成 `/send_sms + /signin` Bearer API 的前端登录流程，但 `STATUS.md` 和 `JOURNAL.md` 2026-04-13 已说 Semi OAuth 挂起。下一位协作者只看 playbook 可能接一条已冻结路线。

### 📦 范围
- `playbook/phase-4-community.md`（S3 章节加 "挂起 / 等 OAuth" 前言）
- `docs/ARCHITECTURE.md`（Semi 相关段落）
- `STATUS.md`（如 E2 决策后）

### 做什么

**1. playbook/phase-4-community.md** 顶部加一段：
```markdown
> ⚠️ **Phase 4 S3（Semi 前端接入）自 2026-04-13 挂起至今**。
> 本 playbook 里 S3 章节描述的 `/send_sms + /signin` 流程是**初版设计**，
> Semi 团队后续转向 OAuth。续做时请先读：
> - `docs/JOURNAL.md` 2026-04-13 + 2026-04-25 段落
> - `reviews/2026-04-13-phase-4-completion-review.md`
> - Phase 6 Track E2 章节
```

**2. STATUS.md** "tester 范围" 段落加 Semi 明确条目（若 E2 挂起）：
> - 不含 Semi 社区钱包登录（Phase 6 E2 挂起，等 Semi OAuth 就绪）

**3. ARCHITECTURE.md** 认证章节同步（大约 5 行）

### 验证标准
- [ ] 读一遍 playbook/phase-4 → 不会误导
- [ ] STATUS 和 JOURNAL 口径一致
- [ ] `scripts/verify.sh` 通过

---

## Track E 完结标准

- [ ] E1 ✅（Pre-tester gate，必做）
- [ ] E3 ✅
- [ ] E4 ✅
- [ ] E5 ✅
- [ ] E2 ✅ 或明确挂起到 Phase 7
- [ ] `scripts/verify.sh` 通过
- [ ] `/api/health?secret=xxx` 返回完整观测字段（mintQueue / airdrop / semi）
