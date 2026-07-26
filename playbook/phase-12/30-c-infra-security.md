# Phase 12 — Track C：基础设施与安全硬化（钱包 / secrets / 告警 / 备份 / 承载）

> 上层：`00-overview.md`。承接 P10-C C-defer 表（`playbook/phase-10/30-c-debt.md`）全部 →P12 项。
> 除 C3 充值外全部可立即施工，与 P8/P9 沙盒零冲突。
> 涉及真钱的只有 C2/C3（充值类，金额小），执行前向用户报金额确认。

---

## 0. ✅ 停点 C-0 — 已拍板（2026-07-19 用户）

### C-0 最终结论（本块为准）

| # | 决策 | 最终结论 |
|---|---|---|
| 1 | Semi 主网策略 | **① 维持现状**（PoC JWT 双通道先上线；正式化放 P13 生态合作一并谈。C7 仍做主网回归 + kill switch） |
| 2 | DB 备份方案 | **③ 手动周期导出 + 部署日全量快照**（零成本纪律型起步；主网数据增长后再评估 Supabase Pro/PITR） |
| 3 | 免费额度升级 | **不升级**（C6 盘点仍跑一遍核对；发现硬阻塞再回禀用户，否则全线维持免费档） |

下方原始决策表保留追溯上下文。

| # | 决策 | 选项 | 默认建议 |
|---|---|---|---|
| 1 | **Semi 主网策略**（承 P7 Track B PoC） | ① 维持现状（PoC JWT 双通道）② 找 Semi 拿正式授权 ③ 切 SIWE | ①先上线 + 与 Semi 的正式化放 P13 生态合作一并谈（登录已实测可用，风险=对方 API 变更） |
| 2 | **DB 备份方案**（P3-5，Supabase Free 无 PITR） | ① 本机定时 `pg_dump`（Supabase 连接串）② 升级 Supabase Pro（PITR）③ 手动周期导出 + 部署日全量快照 | ③起步（零成本、纪律型），主网数据增长后升 ② |
| 3 | **免费额度是否升级**（见 C6 盘点结果） | 逐服务决定 | 盘点后再定，不预设 |

## 1. C1 — secrets 轮换（与 P10 遗留 Bearer 切换**合并为一次操作**）

- ✅ **前置已澄清（2026-07-26 反证，无需再去面板确认）**：生产 `?secret=` 被硬拒
  （`src/lib/auth/cron-auth.ts:29`）而生产 cron 同步游标持续新鲜（实测 74 秒前刚更新）
  → **各 job 早已在用 Bearer**，P10 那条"待切 Bearer"待办实际早已完成。
  故 C1 只需换密钥**值**（面板里改 header 的 value），不涉及鉴权方式迁移
- [ ] **CRON_SECRET 换新**（2026-05-08 调试时在聊天泄露）：生成新值 → Vercel 三环境 →
      cron-job.org 各 job 改 Authorization Bearer（顺手完成 Bearer 切换）→ 旧值调用返 401 验证
- [ ] **主网 cron 口径定死**：active job = **4**（mint / score / sync / balance）；
      `process-airdrop` job **删除或 inactive**，单独验证"不可触发"（与 overview 红线对齐）
- [ ] **ADMIN_TOKEN 评估顺换**（同批操作成本最低）
- [ ] 顺手：清理 `.env.local` 重复 CRON_SECRET 定义（第二行覆盖第一行，STATUS 悬空 TODO）
- 验证：换后 active cron 全绿 ≥ 10 分钟 + `/api/health` Bearer 正常

## 2. C2 — A5 换 Turbo wallet

- [ ] 新 EOA 生成（恢复 `scripts/arweave/generate-eth-wallet.ts` 一次性使用，用完再 git rm，沿 S0.b 先例）
- [ ] 新钱包 JWK → `TURBO_WALLET_JWK`（本地 + Vercel）；Base ETH 充值 → Turbo credits
- [ ] 旧钱包（`0xdE788249...9Fba8`，约 3.3T winc）处置：**实施时先查 Turbo 文档 credits 能否迁移**；
      不能迁则旧钱包用完为止/留测试网用，新钱包供主网
- 验证：用新钱包实跑一次小上传（如重传 sounds map 测试件）成功扣费

## 3. C3 — A7 operator（minter 热钱包）主网 ETH

- [ ] OP Mainnet 充值 ≥ 0.05 ETH（runbook §2.1 口径；金额与 gas 现价核对后向用户报数）
- [ ] `check-balance` 告警阈值按主网 gas 水平复核（现值是测试网拍的）

## 4. C4 — 告警接线（A8 基础设施 + P2-3/P2-4）

现状订正（2026-07-24 核实）：低余额+双队列积压 → 邮件 **P10 P2-3 已接**（先前"仍无邮件"的现状描述过时）。
- [ ] Resend 发信配置生产化：`RESEND_API_KEY`/`ALERT_TO_EMAIL`/`ALERT_FROM_EMAIL` 本地三项全未配，Vercel 待确认（C-defer 项），收件人=用户
- [x] `check-balance` 低余额 → Resend 邮件（P10 P2-3 已在；Turbo winc 阈值挂 C2 换钱包后补）
- [x] queue stuck → Resend 邮件（2026-07-24 补 `checkStuckAge`：活跃行 >30min 无 updated_at 更新即告警，抓"数量正常但管道卡死"盲区）
- 验证：**每类告警人为触发一封真实邮件收到**（阈值临时调高触发法），记录进 review——待 Resend env 配好执行

## 5. C5 — DB 备份落地（按 C-0 #2 拍板执行）

- [ ] 首次全量快照立即做一份（无论选哪方案）；部署日前一天再做一份（D1 检查表引用）
- [ ] 备份产物存放与恢复步骤写进 `docs/MAINNET-RUNBOOK.md` 新增 §（恢复没演练过=没有备份：本地恢复演练一次）

## 6. C6 — 免费额度承载盘点（上线检查的基建半）

逐服务查**当前**额度与超限行为（额度会变，不背历史数字），产出一张表进 review：
- [ ] Vercel Hobby：带宽 / serverless 时长 / cron 限制（外部 cron-job.org 已绕）
- [ ] Supabase Free：存储 / 连接数 / 项目暂停策略
- [ ] Upstash 免费档：日命令数（rate limit 中间件依赖它，超限 fail-open 已知）
- [ ] Alchemy 免费档：CU 额度；主网 RPC 与 `sync-chain-events` 10 区块/批的节奏复核
- [ ] cron-job.org：频率/时长限制维持满足（1min job）
- [ ] Resend 免费档：日发信额 vs 告警量预估
- 输出：每行"够用 / 要升级 / 要降频"结论 → 回 C-0 #3 拍板

## 7. C7 — Semi 主网策略执行（按 C-0 #1 拍板）

- 选 ① 维持（✅ C-0 已拍板）：登录路径主网回归一遍（SemiLogin 7 步实测脚本复用 `docs/SEMI-DEMO-SCRIPT.md`）+ 风险记录——挂 D 部署日后
- [x] **Semi 故障 kill switch**（Codex P2）——✅ 2026-07-24：`NEXT_PUBLIC_SEMI_DISABLED=1`
      → LoginModal 隐藏 Semi、邮箱(Privy)转正主按钮；`.env.example` 已登记

## 8. C8 — localStorage JWT → httpOnly 评估

- [x] 安全评估文档化 ✅ 2026-07-24：**结论 = 维持现状 + 理由留档**（XSS 面窄无 UGC 富文本 /
      被窃 JWT 爆炸半径不含资金 / 改造 1-1.5 天三层回归不划算）；触发升级条件 = 引入 UGC
      富文本 / P13 Semi 正式化 / 出现链下资产。全文见 `reviews/2026-07-24-phase-12-infra.md` C8 段
- [x] 结论进 JOURNAL ✅（2026-07-24 段）

## 9. C9 — P10 边际清尾（三小项，一批 commit）

- [x] SR-P1-1 `save_score_atomic` exception null check ✅ 2026-07-24 —— 迁移
      `supabase/migrations/phase-12/048_save_score_atomic_null_check.sql`（**待用户生产执行**）
- [x] SR-P1-2 `mint_score_enqueue` 错误信息友好度 ✅ —— 不动 SQL，API 边界拆文案
      （already enqueued→409 已在铸造 / status=→已过期 / 其余→不存在或不属于你）
- [x] SR-P1-14 `scripts/load-env.ps1` 多行 value 支持 ✅ —— 引号未闭合续读至闭合；
      注：本地实际用 TURBO_WALLET_PATH 单行，此项属未来防御（C2 换钱包用 JWK 时生效）

## 10. C10 — OG/海报出图生产复验（Satori 坑已修，上线前再确认一次）

- **订正（2026-07-19）**：先前把出图崩归因于 Node 24 是**误判**。真凶=Satori 要求"多子节点
  `<div>` 显式 `display:flex`"（"变量+文字"混排会被拆成多子节点），**与 Node 版本无关**；
  `poster/route.tsx` 与 `opengraph-image.tsx` 已于 2026-07-11 用"合成模板字符串"修复
  （见 memory `project_nextog_satori_multichild`）。**无需 pin Node，也无需改 `engines`。**
- [x] 生产实测 ✅ 2026-07-24：`/score/12/opengraph-image` **200 image/png 53KB** +
      `/score/12/poster` **200 image/png 132KB**（探测记录进 `reviews/2026-07-24-phase-12-infra.md`）；
      内容人眼复核（封面/标题/二维码/短链）挂 E3 上线检查一并看
- [ ] 回归防线（改出图 JSX 时守三条，同 memory）：多子节点 div 必 `display:flex` /
      变量+文字合成单模板串 / 外链图预取校验 `content-type` 以 `image/` 开头

## 11. 完成标准

- [ ] C1-C5 全落地且各自验证过（含真实告警邮件 ≥ 3 封、备份恢复演练 1 次）
- [ ] C6 承载表产出、C-0 三项拍板落 JOURNAL
- [ ] C7 按拍板执行完（含 Semi kill switch 就位）；C8 评估结论留档；C9 三小项落地；
      C10 OG/海报生产复验通过
- [ ] verify.sh 全绿；产出 `reviews/2026-XX-XX-phase-12-infra.md` 逐项记录

## 12. 红线

- 私钥/JWK/secret 永不进 git、不进聊天记录（CRON_SECRET 教训）；生成类脚本用完即删（S0.b 先例）
- 充值类动作先报金额获确认再执行；Vercel env 改动后必须 redeploy 才生效（历史坑）
- migration 类（如备份辅助表）由用户在 Supabase 生产执行
