# P10-B — 后端 Bug 修复

> 对应用户指定的"修复上述 bug"。
> **findings 唯一来源**：`reviews/2026-07-05-backend-review.md`（本 track 每条修复引用其编号，修一条勾一条）。
> 上层：`playbook/phase-10/00-overview.md` §3。
> **铁律**：改 DB schema / cron / 合约 必先说清"改哪张表/哪个文件、是否新 migration"，用户点头再动。途中发现新 bug → 追加进 review 留底并标注，不顺手改。
> **施工前置**：review 是 2026-07-05 快照——每条动手前先复核现场（文件/行号/行为可能已变）。2026-07-05 二次核验已确认 P0-1/P1-2/P2-2/P3-2/P3-3/P3-4 现场为真，但 **P0-1/P1-2 的修法必须按下方修正版执行**（review 原文的 published 校验会砸现有功能，见各条 ⚠）。

## 新 migration 归置约定

- 本 track 所有新 migration 放 `supabase/migrations/phase-10/`，编号从 **040** 起（现存最大 033，且有两组撞号 → 留 034-039 缓冲给 P2-8 重编号用，040 起保证全局唯一）
- 每个 migration 一件事、幂等可重跑（`if not exists` / `do $$` 守卫），文件头注释写清对应 review 编号

---

## 优先级与顺序

```text
P0-1（越权铸造，立即修，改动最小）
  → P1-1 RLS 🛑停点1 → P1-2 tracks published → P1-3 广播歧义 → P1-4 悬挂 tx → P1-5 airdrop retry
  → P2 批次 → P3 卫生批次
合约 CT 项：本 track 只改脚本 + 补测试 + 写 diff，不部署（部署归 P12）
```

> **执行契约（00-overview §8）：不到 🛑 停点默认不停**，波内逐条自动连跑（每条 commit + verify 全绿）。本文件内的停点/用户动作标记：
> - 🛑 **停点 1** = P1-1 RLS 落库后全站抽查放行（下方条目内标注）
> - 🛑 **停点 4** = CT 决策 gate（合约节标注）
> - ✋ **波内确认** = P2-8 重命名方案（口头过一遍即走，不算停点）
> - 🔧 **用户外部动作** = P1-1 migration 在 Supabase 生产执行 / P3-2 后去 cron-job.org 确认五个 job

---

## Batch 0 — P0（立即修）

- [ ] **P0-1 越权铸造任意 tokenId**（`mint/material/route.ts:23`）
  - ⚠ **修法修正（2026-07-05 核验，推翻 review 原文的 published 校验）**：
    收藏 `published=false` 曲目是**现有正常功能** —— `BottomPlayer.tsx:24` 用 `currentTrack.week` 当 tokenId，任何在播曲目（含 B/C 组 week 16-36、全部 `published=false`）都可收藏。要求 `published=true` 会直接砸掉 B/C 组收藏主流程。
  - **正确修法 = 存在性校验**：入队前 `select id from tracks where week = tokenId`（token_id≡week 隐式约定，见 review P3-13），查无此行返 400。这已封死漏洞的全部危害面（未来周次 / 任意大整数 / 不存在的 tokenId），越权面从"任意整数"缩到"首页本来就能收藏的 36 首"
  - 位置：`app/api/mint/material/route.ts:23-25` 校验块后插入一次 `supabaseAdmin` 查询；`route.ts` 行数上限 270，当前 129 行，余量充足
  - 验收：
    - `curl -X POST /api/mint/material -H "Authorization: Bearer <jwt>" -d '{"tokenId": 99999}'` → 400
    - `tokenId: 108`（tracks 表存在但 B/C 视野外）→ 按产品决策（见 P1-2 讨论，默认放行——它本就是合法曲目）
    - 正常收藏（首页任意球 → 爱心）回归通过；`mint_queue` 无新增脏行

---

## Batch 1 — P1（主网前硬门槛）

- [ ] **P1-1 全库开 RLS**（新 migration `phase-10/040_enable_rls_all_tables.sql`）🛑 **停点 1：本条落库 + 自动回归后停，等用户全站抽查放行再进 P1-2**；🔧 migration 由用户在 Supabase 生产执行
  - 修法：对全部现存表 `alter table ... enable row level security`，**不加任何 policy**（service-role 绕过 RLS 不受影响，anon 直接归零）；同步改 `.env.example` 的 RLS 注释与事实一致
  - 表清单从 migration 通读拉全（users / tracks / mint_queue / mint_events / pending_scores / score_nft_queue / score_covers / system_kv / chain_events / airdrop_rounds / airdrop_recipients / jwt_blacklist / auth_identities / sounds…以实际为准，漏一张 = 白做一张）
  - 验收：
    - anon key `curl https://<proj>.supabase.co/rest/v1/users -H "apikey: <anon>"` → `[]` 或 401（改前先跑一次记录"改前能读"作对照）
    - 全站回归：首页取数 / 收藏 / 草稿保存 / /me 三区 / /score/[id] / cron 手动触发一轮，全部正常（都走 service-role，理论无感——理论要实测）
- [ ] **P1-2 tracks 未发布曲目泄露**（`tracks/route.ts`、`tracks/[id]/route.ts`）
  - ⚠ **修法修正（2026-07-05 核验）**：列表路由**不能**加 `.eq('published', true)` —— `getGroupTracks`（sphere-config.ts:111-114）B/C 组依赖 week 1-36 **全量行**（published 只是 A 组的 demo 显示门控，不是权限位）。过滤后 B/C 组只剩 15 行，`padTracksToTarget` 会拿 A 组循环填充，曲目/音频悄悄变样
  - **产品决策（启动时拍板）**：
    - (a) **默认建议**：接受"published 非权限位"口径——列表路由维持现状；详情路由 `published=false` 返 404（`fetchTrackById` 全仓库零真实调用方，2026-07-05 grep 核验，404 化零影响）；真正的"未发布泄露"风险敞口=未来艺术家先传后发的新曲，等 P12 前有真实 draft 场景再引入独立可见性字段
    - (b) 引入 `visible` 独立字段区分"权限位"与"A 组显示门控"——改动大，除非用户明确要藏 B/C 组曲目，否则不选
  - 验收（按 a）：`curl /api/tracks/<unpublished-id>` → 404；首页 A/B/C 三组球数与曲目不变
- [ ] **P1-3 mint/airdrop 广播歧义 → 双铸**（`process-mint-queue/steps.ts:127-130`、`process-airdrop/route.ts:170-173`）
  - 修法：**照抄 score 队列已验证的模式**（`steps-mint.ts:52-60` 的 `mint_attempted_at` 时间窗）：发 tx 前先落 `attempted_at`，捕获异常时不 reset、留给时间窗逻辑判定"可能已广播"；migration `phase-10/041_queues_attempted_at.sql` 给 `mint_queue` / `airdrop_recipients` 各加一列
  - 施工顺序：先 041 migration → 再改两个 cron 文件 → 各自独立 commit（cron 文件是状态机核心，不与其他修复混提交）
  - 验收：单测不可行（链交互）→ 用 SQL 构造 `attempted_at` 新旧两种行 + 手动触发 cron，观察一行被跳过（窗口内）、一行被处理；正常铸造回归
- [ ] **P1-4 pending tx 悬挂 + 队首阻塞**（`process-mint-queue/steps.ts:52-59`、`process-airdrop/route.ts:83-90`、`process-score-queue/steps-mint.ts:96-101` + `steps-set-uri.ts:94-99`）
  - 修法两半：① "有 tx_hash 超 N 分钟（建议 15min）无 receipt" → 转 `manual_review` + 记 `failure_kind`（airdrop 表缺该列，并入 042 migration）；② 每次确认检查后 touch `updated_at`，让队首轮转不被僵尸行卡死
  - ⚠ 三条队列同型改动但**逐条独立改+验**，不抽公共函数（三个文件的行为差异是历史演化出来的，P10 不做统一重构——那是僵化味道但主网前求稳）
  - 验收：SQL 伪造一行"有 hash、updated_at 20 分钟前" → 跑 cron → 该行转 manual_review 且后续行被正常处理
- [ ] **P1-5 airdrop 无 retry 上限**（`process-airdrop/route.ts:129-131,198-203`）
  - 修法：migration `phase-10/042_airdrop_retry_failure_kind.sql` 加 `retry_count int default 0` + `failure_kind text`（与 P1-4 的 airdrop 需求合一个 migration）；cron 侧 `MAX_RETRY=3` 对齐 mint/score 两队列；超限标 `failed` + `failure_kind='manual_review'`
  - 验收：SQL 造一行 `retry_count=3` → cron 不再捞它；正常空投一轮回归（测试网 AIRDROP_ENABLED 开着）

---

## Batch 2 — P2（主网前应修）

- [ ] **P2-1 send-code 按手机号限流 + E.164 校验**（`send-code/route.ts`）
  - 修法：Upstash 按 `phone` 维度独立限流（如 3 次/号/10 分钟；沿用 middleware 里现成的 Ratelimit 用法）+ `^\+?[1-9]\d{6,14}$` 校验；该端点花真钱（短信）→ Upstash 不可用时 **fail-closed**（与全站 fail-open 相反，注释写明为什么）
  - 验收：同号连打 4 次 → 第 4 次 429；断 Upstash env 本地实测 → 直接 503 拒发
- [ ] **P2-2 operator-lock heartbeat 接线**（`operator-lock.ts:68` → cron 长步骤）＊与 C-now「A16 heartbeat」是同一件事，合并做
  - 2026-07-05 核验：`heartbeatOpLock` 全项目零调用属实
  - 修法：在 `withOperatorLock`（或各 cron 步骤内）给"发 tx + 等 receipt"段落包一个 `setInterval(60s) → heartbeatOpLock(holder)`，finally 清 timer；重点接 `steps-set-uri` receipt polling（历史上真超过 120s 的就是它）
  - 验收：本地把 TTL 临时调 10s + heartbeat 5s → 长任务期间锁不丢（Redis TTL 观测）；恢复 120s 后跑一轮真 cron
- [ ] **P2-3 低余额告警接 sendAlert**（`check-balance/route.ts:36-39`）＊`sendAlert`（Resend）已存在且 score 队列在用 → **不依赖新基础设施，本 Phase 直接做**；只有"切团队邮箱/多收件人"才归 P12
- [ ] **P2-4 manual_review/CRITICAL 统一发邮件**（`process-mint-queue/steps.ts:66-71`、`process-airdrop/route.ts:98-106` 对齐 `process-score-queue/route.ts:151-159`）——与 P1-4 的 manual_review 转档点同文件，合并施工
- [ ] **P2-5 score 队列非终态清 lease**（`process-score-queue/route.ts:98-100`）— 吞吐修复：步骤成功推进后同步清 `lease_expires_at`（副作用已 CAS 落库，清锁安全）；验收 = 一枚 NFT 全流水线从 ~25min 降到 ~5min（4 次 cron 间隔）
- [ ] **P2-6 mint_queue 状态机 CHECK 约束**（migration `phase-10/043_mint_queue_status_check.sql`）——先 `select distinct status` 确认存量无脏值再加约束
- [ ] **P2-7 sounds 表补建表 migration**（从生产 `pg_dump --schema-only` 反推，落 `phase-10/044_sounds_table.sql`，`create table if not exists` 保证对现库幂等）
- [ ] **P2-8 migration 编号冲突整理**（两组 015/016、两个 030）✋ 波内确认：动手前把重命名清单发用户口头过一遍（动"文件名=执行历史"）
  - 修法倾向：**重命名文件补后缀区分**（如 `030_xxx.sql → 030b_xxx.sql`）而非改号——这些 migration 已在生产执行过，重编号会破坏"文件名=执行历史"的追溯；README 的"编号唯一递增"口径改为"phase 子目录内递增，跨 phase 以子目录序为准"
  - ⚠ 只动文件名与 README，**绝不改已执行 SQL 的内容**

---

## Batch 3 — P3（卫生项，可随手或延后）

按 review P3-1 ~ P3-14 逐条过。低风险、可打包成 1-2 个 commit：
- [ ] P3-1 JWT audience / P3-2 cron-auth 常量时间比较 + 禁 query secret / P3-3 .env.example 补键 + doctor.sh
  - P3-2 注意：Web 标准 `Request` 下没有 Node `crypto.timingSafeEqual` 的直接等价 → 用 `crypto.subtle.digest` 比较哈希或引 Node runtime；`/api/health` 的 query 鉴权同步收掉；🔧 **用户外部动作：改完去 cron-job.org 确认五个 job 全走 Bearer**（P5 历史：有 job 曾配的是 query）——不阻塞波内后续条目，归入 🛑 停点 3 清单一并确认
- [ ] P3-4 verify.sh 加 `forge test` 一节（有 forge 才跑，无则 ℹ 跳过——CI/无 Foundry 机器不误伤）
  - 顺手项（可选）：verify.sh 行数检查现在只扫 `src/`，`app/`（route/page 所在地）不在扫描面；hooks 兜底所以不算漏洞，对齐与否听用户
- [ ] P3-6 老队列补 durable lease / P3-7 sync-events 加锁+batch
- [ ] P3-8 FK 索引 / P3-9 冗余索引 / P3-10 enqueue advisory lock / P3-11 UUID 断言 / P3-12 log.address 校验 / P3-13 token_id==week 注释 / P3-14 私钥少触碰
  - P3-8/P3-9/P3-10 涉及 SQL → 并成一个 migration `phase-10/045_index_hygiene.sql`
- [ ] P3-5 备份预案 → 写进主网 runbook，实际执行归 P12

---

## 合约 CT 项（本 track 只改脚本 + 补测试，不部署）

> 合约代码正确性风险低；改动集中在部署脚本与"不可升级架构下的最后决策"。**部署本身归 P12**，本 track 产出脚本改动 + 测试 + 决策记录。

- [ ] **CT-1/CT-2/CT-3（P1，脚本层可现在改）**：name/symbol 参数化、`ADMIN_ADDRESS` 主网 `envAddress` 硬失败、admin 两步移交（`AccessControlDefaultAdminRules` 或交权前链上探活）
- [ ] **CT-4（P1，需改合约 + 测试）**：`mintScore(address, bytes32 orderId)` + `mapping` 去重 + 事件带 orderId。⚠️ 改合约要同步改后端 cron 传参 → 一起做或明确分期
- [ ] **CT-5（P1）**：补 `MaterialNFT.t.sol`（对齐 ScoreNFT.t.sol）
- [ ] **CT-6/CT-7/CT-8/CT-9（P2 决策 gate）**🛑 **停点 4**：ERC2981 版税 / URI 空串防御 / MaterialNFT 冻结+事件 / 供应上限 —— **P12 部署前必须拍板，不可升级架构错过永久不可加**。本 track 先出决策备选一次性打包给用户（连同 CT-4 幂等键分期），拍板前 CT 决策类不动工；脚本类（CT-1/2/3/5）不受此停点约束，Wave 3 自动做
- [ ] **CT-10~CT-15（P3）**：测试覆盖缺口、foundry.toml pin、TestMintOrchestrator 主网护栏、Orchestrator setTokenURI、ERC1155Supply/contractURI、Deploy placeholder URI

---

## B track 完结标准

- [ ] review 的 **P0 + P1 全部修完**；P2/P3 逐项有结论（已修 / 归 P12 / 明确不做）
- [ ] 合约 CT 的 P1 级有脚本改动或明确归 P12；决策 gate 项用户已拍板
- [ ] `forge test` 全过 + MaterialNFT 有测试；`bash scripts/verify.sh` 全绿（含新增 forge test 节）
- [ ] 每条修复配 curl/SQL 实测记录，产出 `reviews/2026-07-XX-phase-10-backend-fixes.md`
- [ ] `reviews/2026-07-05-backend-review.md` 勾选框逐条更新
