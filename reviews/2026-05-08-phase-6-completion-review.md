# Phase 6 Completion Review

日期：2026-05-08
范围：Phase 6 v2 全部范围（5 个 track ~20 step）+ 收尾对齐
HEAD：`d06a274`（docs phase-6 audit 收口对齐）
基线：Phase 5 完结 commit `1019dcb`（2026-04-25）

---

## 一、Phase 6 v2 范围 vs 实际产出

### 原范围（5 track ~ 20 step）
覆盖 29 个 review findings（来源：`reviews/2026-04-25-phase-1-4-strict-cto-review.md` + `reviews/2026-04-25-phase-5-strict-cto-review.md`）：
- **Track A** 铸造链路稳定性（A0-A6）
- **Track B** UI 收口 + 端到端验证（B1-B7，2026-05-08 删 B4 7→6）
- **Track C** 合约 & 部署硬化（C1-C4）
- **Track D** 空投闭环（D1 决策不做 + D2 admin Bearer + D3-D5 挂起）
- **Track E** 认证 & 观测收口（E1-E5）

### 关键决策点
- **2026-05-03 v2 缩减**：UI 重设计深度版（Claude Design 接入 + 6 周 4 阶段）整体迁 Phase 7；Phase 6 收缩到"稳定性收口 + 端到端跑通"；3-5 天目标
- **2026-05-04 B7 改放最后**：避免"测-修-重测"循环（中间 B7 出的 bug 清单会被后续修复过期）
- **2026-05-04 B6 加入**：艺术家反馈"音乐圆圈用数字代号" → A 组 5 球 demo + B/C 36 球循环音轨 + Modak 字体数字 badge
- **2026-05-07 B8 启动**：B2 Bug A/B（"录制上传中卡住" / "铸造不更新"）单点修补不够 → 整体重设 /me 数据流（5s 乐观 + 草稿入队即消失 + 唱片对齐 DB + 路由双兼容）
- **2026-05-08 B4 删除 + audit 收口**：B4 内容（PlayerProvider loadingRef）早已实施；audit 发现 8 个 playbook 列"待做"的 step 实际都已实施仅文档未对齐
- **2026-05-08 E4 废弃**：B8 P3 删 decoder iframe 后 E4（多网关 fallback）设计目标不存在；OpenSea 端 metadata 用 ario.permagate.io 单网关风险接受

---

## 二、所有 step 完成状态

| Track | Step | 状态 | 实施位置 / commit |
|---|---|---|---|
| **A** | A0 operator 锁 | ✅ | `src/lib/chain/operator-lock.ts` Upstash SETNX + 3 cron 入口包装 |
| | A1 ScoreNFT cron durable lease | ✅ | migration 024 + steps-set-uri.ts uri_tx_hash 拆步 |
| | A2 material failure_kind | ✅ | commit `8074d18` + migration 021 |
| | A3 sync cursor 事务性 | ✅ | sync-chain-events/route.ts:55+ |
| | A4 草稿原子化 | ✅ | migration 025 `save_score_atomic` RPC + score/save/route.ts:101 |
| | A5 链上灾备 | ⏸ P7 | B8 P3 删 score-fallback.ts noop 残留，待重新设计 |
| | A6 我的乐谱语义 | ✅ | 决策冻结 = "我铸造的"（0 代码） |
| **B** | B1 NFT cache 隔离 | ✅ | commit `c749b67` |
| | B2 /me /score 小修 | ✅ | Bug A/B 由 B8 实质收口 + Bug C 5/6 commit `faf73a4` 修 |
| | B3 草稿铸造按钮 | ✅ | commit `7e98696` 接通 + `40cf61d` B8 P3 整合 + 5/8 实测 token_id=12 |
| | ~~B4 音频叠加~~ | 删 | PlayerProvider:86-114 早已实施 loadingRef，2026-05-08 删 step |
| | B5 #7 tracks 韧性 | ✅ | route.ts:15 ISR + degraded header + Archipelago:133 占位 |
| | B5 #8 移动端首帧 | ❌ 废弃 | HomeJam 已 dead-code，移动端体验挂 P7 |
| | B5 #9 草稿自愈 | ✅ | draft-store.ts isValidDraft + try/catch |
| | B6 5 球 demo | ✅ | commit `a2ea22c` migration 027/028 + Modak 字体 |
| | B7 端到端冒烟 | ✅ | 本次 review 16/19 通过 |
| | B8 /me 数据流重设 | ✅ | P1 `63c807a` + P2 `38f7f37` + P3 `40cf61d` |
| **C** | C1-C4 全部 | ✅ | commit `086167d` ScoreNFT v2 `0x1C47...832F` + Orchestrator v2 `0x8A6D...C3a8` |
| **D** | D1 主网空投决策 | ✅ | 决策冻结 = 不做（cron 不调度 + trigger 不暴露） |
| | D2 admin Bearer | ✅ | admin-auth.ts + airdrop/trigger/route.ts |
| | D3-D5 | ⏸ | D1=不做，挂起（Phase 7 若启用空投再做） |
| **E** | E1 health mintQueue | ✅ | commit `f0725df` |
| | E2 Semi OAuth | ⏸ P7 | Semi 团队 OAuth 文档未出 |
| | E3 Semi 探针 | ⏸ P7 | 依赖 E2 |
| | ~~E4 decoder 多网关~~ | ❌ 废弃 | B8 P3 删 iframe，原设计目标不存在 |
| | E5 文档对齐 | ✅ | commit `d06a274` 本次落地 |

**汇总**：有效 step 22 项 → 实施 18 / 决策冻结 2 / 删除 1 / 废弃 2 / P7 挂起 4（与 22 略有重叠，B5 拆 3 子项算 1 step）

---

## 三、Phase 6 关键 commit 清单（基线后 24 commits）

### 收口主线
- `8074d18` A2 material failure_kind
- `c749b67` B1 NFT cache 隔离
- `f0725df` E1 health mintQueue
- `931f45f` G0 useFavorite 乐观回滚
- `086167d` Track C v2 合约重部署
- `7e98696` B3 草稿铸造接通
- `c7340d4` 后端小石头 4 项（B4 音频叠加 / A5 / B5 / E4 早期）
- `a2ea22c` B6 A 组 5 球 + B/C 36 球 demo
- `397defe` B8 准备 — mint_score_enqueue RPC 不再标 expired
- `74d8edc` B2 P1 服务端权威 mintingState
- `63c807a` B8 P1 5s 乐观 + 草稿入队即消失
- `38f7f37` B8 P2 草稿可播 + 唱片对齐 DB
- `40cf61d` B8 P3 路由 [tokenId]→[id] 双兼容 + ScorePlayer inline + 实测
- `d06a274` audit 收口对齐 + E5 文档对齐

### 文档支线
- `085e7b9` Phase 6 v2 缩减
- `faf73a4` B2 Bug C 主链路修复 5/6 实录
- `82ed620` migrations 拆 track-a/track-b 子目录
- `1a67978` 文件大小硬线 200→220

### Phase 6 B2 前端 25+ 轮迭代（v36-v87 visual 优化，独立技术栈）
`6eae4b1` / `b4698de` / `b315eaa` / `bf8e860` / `fb771df` / `9eab147` / `cd882aa` / `dde2058` / `d4f1aa2` 等 — 视觉系统（archipelago + sphere）打磨，与稳定性主线并行

---

## 四、Phase 6 质量评估

### 测试覆盖
- **Smoke test 16/19 通过**（详 `reviews/2026-05-08-phase-6-completion-smoke-test.md`）
  - A 基础 4/4 ✅ / B 业务 8/8 ✅ / C 韧性 2/3（C1 audit 验证）/ D 安全 2/2 ✅ / E 移动 0/2（挂 P7）
- **B8 P3 端到端实测**：queue 778a2904 走完 5 步状态机 → token_id=12 链上确认（mint tx + uri tx + metadata Arweave 三件套齐全）
- **Agent review 13 finding**：5 项合入修（P0×3 + P1×2）+ 8 项挂 P7

### 静态质量
- ✅ npx tsc --noEmit 0 errors
- ✅ npx eslint 0 errors（3 pre-existing warnings 来自 commit `cd882aa` v82，与 Phase 6 无关）
- ✅ npm run build 27 路由全过

### 主网承诺边界冻结（2026-04-25）
**包含**：Privy 邮箱登录 / 浏览 + 播放 108 曲 / 素材收藏 → MaterialNFT / 合奏录制 + 草稿 / 草稿 → ScoreNFT / 已铸造乐谱回放 + 分享卡 / 个人页（"我铸造的"）/ 艺术家页
**不包含**：空投（D1=不做）/ Semi 社区钱包登录（E2 挂 Phase 7）

---

## 五、主网前必做（Phase 7 起点清单）

### 硬阻塞（不修不能上主网）
1. **换 Turbo wallet** — 旧钱包私钥 5/6 调试时泄露在聊天 jsonl，余额极小；P7 主网前必须换新 EOA + 充 Base ETH 充 Turbo credits
2. **108 首底曲 arweave_url 全量上链** — 当前仅 5/108（B6 demo 5 球已上）；剩 103 曲跑 `scripts/arweave/upload-tracks.ts` 一次性补
3. **Operator wallet 主网 ETH 充值** — 当前测试网 0.009 ETH，主网前 faucet 不存在，需真金白银充
4. **Resend 邮件告警** — B8 P3 commit message 提了未做；主网生产环境失败必须有 alert 通道
5. **vercel-env-sync 脚本** — 防 NEXT_PUBLIC_* env var typo（5/6 Bug C 第二层根因 = `NEXT_PUBLIC_SCORE_NFT_ADDRES` 少一个 S）

### 性能优化（影响 UX）
6. **/api/me/score-nfts 35 秒慢** — events_data 联表大 JSON；改 generated column 或 RPC `jsonb_array_length`
7. **cron lease 5 分钟 × 5 步 = 25 分钟问题** — 选 ① 终态外推进步骤时一并清 lease ② cron 频率 1min → 30s ③ 保留设计但更新文档

### 数据 / 合约
8. **score_nft_queue.token_id partial unique index** — `CREATE UNIQUE INDEX uq_score_queue_token_id ON score_nft_queue(token_id) WHERE token_id IS NOT NULL`（B8 P3 已加 .order().limit(1) 代码侧防御，但 DB 约束更彻底）
9. **OP Mainnet 部署 ScoreNFT + Orchestrator + MaterialNFT** — 走 `docs/MAINNET-RUNBOOK.md`（Phase 6 C2 已建）
10. **AirdropNFT 主网不部署或不调度**（D1 决策）

### Phase 7 候选（已挂 STATUS.md）
- A5 链上灾备路径重设
- B5 #8 + E1/E2 移动端体验（UI 重设计深度版）
- E2 Semi OAuth（等 Semi 团队文档）
- E4 OpenSea 端 metadata 多网关（如真有问题）
- 慢网占位加 spinner / 重试按钮 UX
- 5 首正式曲名上架（艺术家未给）
- score-fallback / OwnedScoreNFT.id 双语义重构
- 艺术家反馈 5 条（视觉液态感 / 流动 + 扰动 / 键盘音阶 / 按键动画自定义）

---

## 六、风险评估

### 已识别风险
| 风险 | 严重度 | 缓解措施 | 主网前必做 |
|---|---|---|---|
| 新铸造 token_id race（理论） | 低 | 代码 .order().limit(1) + DB unique index | ✅ #8 |
| Vercel cron 超时杀进程（lease 25 分钟问题） | 中 | durable lease + uri_tx_hash 拆步 | 改 ② 30s 频率 |
| Arweave 网关单点（OpenSea 端） | 低 | 项目主路径不依赖（前端 inline）| 接受 |
| Operator wallet 私钥泄露 | 中 | 测试网余额极小可控 | ✅ #1 换钱包 |
| Resend / 监控缺失 | 中 | 当前靠 /api/health 人工巡查 | ✅ #4 |

### 未识别风险（Phase 7 监控）
- OP Mainnet gas spike 时铸造排队可控性
- Arweave 网关全部不可达时的全局降级
- Privy 邮箱登录服务可用性
- Supabase Free tier 用量上限

---

## 七、Phase 7 进入判定

### 满足条件 ✅
- [x] Phase 6 v2 所有有效 step 实施 / 决策冻结 / 挂 P7 显式标注
- [x] B7 端到端冒烟 ≥14/19 通过 + 0 P0 + 0 P1 bug
- [x] 24 commits 全部 push-ready（本地领先 origin/main，待用户 push 决定）
- [x] STATUS.md / TASKS.md / playbook 文档对齐真实代码
- [x] JOURNAL.md 决策日志连续（4-25 / 5-3 / 5-4 / 5-6 / 5-8 关键决策都有记录）

### Phase 7 启动建议
1. **Day 0**：用户 push 24 commits 到 origin/main + Vercel 自动部署观察 5 分钟（cron-job.org 5 个 job 全绿）
2. **Day 1**：硬阻塞清单 #1-#5 修完（换 wallet + 108 曲上链 + Resend + env-sync 脚本）
3. **Day 2-3**：OP Mainnet 部署 + 端到端再冒烟一遍（Phase 7 baseline）
4. **Day 4+**：UI 重设计深度版 / Semi OAuth（条件） / 监控告警 / 退出准备

---

## 八、决策记录引用

完整决策日志见 `docs/JOURNAL.md`：
- 2026-04-25 段 — Phase 5 收口 / Track C v2 重部署 / Pre-tester gate / 产品决策冻结（A6/D1/E2）
- 2026-04-29~30 段 — Phase 6 B2 前端 25 轮优化历程 + 经验教训 13-17
- 2026-05-03 段 — v2 缩减决策（UI 重设计深度版迁 P7）+ 艺术家反馈 5 条
- 2026-05-04 段 — B6 实施完成 + B7 改放最后
- 2026-05-06 段 — B2 Bug C 主链路修复（双根因 wallet purpose 中文 + env var typo）
- 2026-05-08 段 — B8 P3 + arweave_url 上链 + B4 删 + agent review 13 finding + audit 收口对齐 + E4 废弃决策

## 九、感谢

Phase 6 跨度 14 天（4-25 → 5-8），完成原计划 5-6 周的核心稳定性工作 + 视觉迭代 + B8 数据流重设。**Phase 6 完结。Phase 7 OP 主网启动条件具备。**
