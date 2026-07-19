# Phase 12 — Track D：数据切换 + 部署日执行 + 首周救火

> 上层：`00-overview.md`。**唯一的"执行日"track**：所有真金白银动作（主网广播/充值确认/env 切换）
> 集中在此。合约部署时序的权威 = `docs/MAINNET-RUNBOOK.md`（B4 增补后版本），本文件只补
> 应用侧步骤（数据/env/cron/smoke），不复制 runbook 内容。
> 前置：A/B/C 三 track 完成（硬 gate）；E 不阻塞。

---

## 0. 🛑 停点 D-0 — 两项拍板（部署日前一周）

### ① 测试网数据处置（DB 是同一个 Supabase，链却换了）

链衍生表现存的全是 OP Sepolia 数据，主网切换必须表态：

| 表 | 内容 | 处置 |
|---|---|---|
| `chain_events` / `system_kv.last_synced_block` | 测试网事件 + 游标 | 清空 + 游标重置为主网部署块（否则 sync cron 拿测试网块号扫主网） |
| `mint_queue` / `score_nft_queue` / `mint_events` | 测试网铸造记录（**score 队列行就是 /score/[id] 页面的数据源**） | 见下三选一 |
| `score_covers` 使用计数 | 绑测试网铸造 | 随上行方案同步重置 |
| `users` / `tracks` / `sounds` / `pending_scores` | 链无关（账号/资产/草稿） | 保留不动 |

- **方案 ①（推荐）**：清链衍生表 → 主网从零开始。测试网唱片页全部 404（藏品本就不带入主网，
  合约都是新的）；清库前先做全量快照留底（C5 备份流程）。
  细节：清 `score_nft_queue` 后，部署日前 24h 内入队的草稿会在 /me"复活"
  （`/api/me/scores` 按 NOT IN queue 过滤 + 24h expires_at，已核代码）——清库 SQL 顺手把这批标 expired
- 方案 ②：另开全新 Supabase 项目 —— 最干净但要迁 users/tracks/sounds + env 全换，成本高
- 方案 ③：数据共存 + 加 chain 标记列 —— 全部查询要改，复杂度最高，不推荐

**附带决策**：测试网环境保留方式。若 Vercel Preview 继续指 Sepolia 但共用同一个 DB，
测试写入会重新污染主网库 → 推荐：**Production 单一主网环境；测试回归走本地 dev +（需要时）
独立免费 Supabase 项目**。

### ② 部署日排期 + 软启动窗口

拍板具体日期；推荐**软启动**：部署完成后先不对外宣传，自用 + 小圈实测 2-3 天，
首周救火（§4）稳了再公开（前端/宣传随时可发，链上东西已定稿不受影响）。

## 1. D1 — 部署日前检查表（T-1）

- [ ] A track：音效换血完成（`10-a` A4）**或已拍板放弃换血窗口**（现音冻结为创世版）；
      解码器/音效表 txid 定稿
- [ ] **metadata 内容冻结**（Codex P1）：正式曲名已 UPDATE（现 5 首为数字占位，STATUS 悬空
      TODO；`track.title` 永久写进每枚 NFT 的 name/description/attributes）；封面池/描述过审；
      占位名曲目要么改完、要么不开放铸造、要么明示接受占位名永久
- [ ] B track：forge test 绿 + 停点 B-1 回归过 + runbook 增补完 + admin 演练（B5）完成
- [ ] C track：CRON_SECRET 已换 + Turbo 新钱包就绪 + operator 主网 ETH 到账 + 告警邮件实测过
      + OG/海报生产复验过（C10）+ DB 快照 ≤24h
- [ ] **env 三项硬校验**（都是"错了就永久"级，Codex P0/P1）：
      ① `NEXT_PUBLIC_APP_URL=https://pond-ripple.xyz` 生产读回确认（每枚 NFT external_url 来源）
      ② `SCORE_DECODER_AR_TX_ID` / `SOUNDS_MAP_AR_TX_ID` 三环境读回一致（server-only，
      env-sync 默认不查，见 `10-a` A2）
      ③ `OPERATOR_PRIVATE_KEY` 派生地址 == 部署用 `MINTER_ADDRESS`（不一致则 hasRole
      验收全过、cron 发交易全 revert）
- [ ] **P10 用户线下待办清零**：migration 043-046 已在生产执行 + cron Bearer 已随 C1 完成
- [ ] 铸造范围口径：无 `arweave_url` 的曲目（week 16+）铸造入口策略拍板——前端拦 or 接受 cron fail-fast + 文案
- [ ] 主网 env 值全部备妥未启用（B4 清单）；`AIRDROP_ENABLED` 确认**不设**
- [ ] 用户侧：部署日 2-3 小时整块时间 + admin 冷钱包可签（B5 已演练）

## 2. D2 — 部署日时序（T-0）

0. **写冻结（维护窗口，Codex P0）**：cron-job.org 4 个 active job 全部暂停 → 确认双队列
   无非终态行（processing / minting_onchain 等全部走完或手工终态化）→ 导出 Vercel 全量
   env 快照（回滚保险）→ 低流量时段执行，接受清库到上线间的短暂空窗（分享链接 404）
1. **合约**：照 `docs/MAINNET-RUNBOOK.md` §2-§3 执行（按 B-0 #9 定稿部署 3 或 4 个合约
   + revoke + 3.3.1 admin 授权 + §3.3.2 五项 hasRole 验收 + B4 增补的 verify-contract）
   ——五项验收不过**立刻停**
2. **数据切换**：按 D-0 ① 执行（清表 SQL 用户在 Supabase 跑；游标写主网部署块号）
3. **env 切换**：runbook §4.1 全项 + `NEXT_PUBLIC_CHAIN_ID=10` + Alchemy 主网 RPC；
   Vercel 三环境同步 → **manual redeploy 不带 Build Cache**（A2 先例）
4. **cron 恢复 + 验证**：重新启用 4 个 active job（airdrop 保持不存在/inactive，验证不可
   触发）→ runbook §4.2 ≥5 分钟全绿；`sync-chain-events` 确认从主网游标起扫、无报错
5. **端到端 smoke（真 gas）**：runbook §4.3 两通路 + 补充：/score/[id] 分享 OG 卡片、
   /api/health 全绿、Etherscan(OP) 上两枚 NFT 可查、metadata `external_url` 指生产域名、
   animation_url 播放正常（= A track 成果的链上首验）
6. **deployer 私钥销毁**：runbook §4.4 三步
7. **🛑 停点 D-gate**：对照 `00-overview.md` §3 永久性清单逐项勾 → 放行=进入软启动

**中止预案**：任何一步验收不过 → 停在原地不硬推。合约部署到一半可弃（重新走 §3 部一组新的，
测试网先复盘）；env 未切则线上仍是测试网原样，用户无感。

## 3. D3 — 回滚边界（先读懂再部署）

- 合约**不可回滚**（runbook §6）：补救=部新合约+切 env，代价=用户"NFT 消失"体感 → 视为灾难选项
- **前端随便回滚**：Vercel instant rollback，链上分毫不动（本会话已确证：视觉/页面与链解耦）
- ⚠ **env 回切 ≠ 恢复**（Codex 纠正）：链衍生数据已清，回切 env 也回不到测试网原状
  （队列/唱片页已空）。真正的回滚保险 = D2 步骤 0 的 **DB 快照 + env 快照**——
  所以"快照可恢复"是清库的**硬前置**，不是可选项

## 4. D4 — 首周救火（部署日起 7 天）

**节奏**：每日 2 次 `/api/health` + cron-job.org 面板 + Supabase 双队列扫一眼
（failed / manual_review / stuck）；告警邮箱保持在收；每日一行记 JOURNAL。

| 症状 | 第一反应 |
|---|---|
| cron 全红 | Bearer/CRON_SECRET 配错（C1 刚换过，首查）→ cron-job.org header |
| queue 卡 manual_review | 按 P10 修复后的分类处置；查 failure_kind + Resend 邮件详情 |
| 双铸嫌疑 | 查 `*_attempted_at` 时间窗 + tx_hash（P10 P1-3 防御已在，先取证再动） |
| Turbo 上传失败 | winc 余额（C4 阈值告警应先响）→ C2 充值流程 |
| RPC 报错/限流 | Alchemy dashboard CU 用量 → 降频或升级（C6 盘点过的预案） |
| 流量异常/被刷 | Upstash rate limit 阈值调整（middleware） |

**完成标准**：7 天无 P0；≥1 枚真实用户 ScoreNFT 全链路健康；告警通道收到过真实邮件；
产出 `reviews/2026-XX-XX-phase-12-launch-review.md`（部署记录 + 首周日志 + 遗留清单）。

## 5. 红线

- 部署日不引入任何计划外改动（代码冻结，只动 env/数据/链）
- 清库类 SQL 必须在快照确认可恢复之后执行；由用户在 Supabase 生产亲手跑
- deployer 私钥用完即毁；admin 冷钱包私钥全程不进 `.env.local`/Vercel/聊天
- process-airdrop 不配置、`AIRDROP_ENABLED` 不设（Phase 6 D1 决策，双保险）
