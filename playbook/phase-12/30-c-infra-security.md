# Phase 12 — Track C：基础设施与安全硬化（钱包 / secrets / 告警 / 备份 / 承载）

> 上层：`00-overview.md`。承接 P10-C C-defer 表（`playbook/phase-10/30-c-debt.md`）全部 →P12 项。
> 除 C3 充值外全部可立即施工，与 P8/P9 沙盒零冲突。
> 涉及真钱的只有 C2/C3（充值类，金额小），执行前向用户报金额确认。

---

## 0. 🛑 停点 C-0 — 三项开工拍板

| # | 决策 | 选项 | 默认建议 |
|---|---|---|---|
| 1 | **Semi 主网策略**（承 P7 Track B PoC） | ① 维持现状（PoC JWT 双通道）② 找 Semi 拿正式授权 ③ 切 SIWE | ①先上线 + 与 Semi 的正式化放 P13 生态合作一并谈（登录已实测可用，风险=对方 API 变更） |
| 2 | **DB 备份方案**（P3-5，Supabase Free 无 PITR） | ① 本机定时 `pg_dump`（Supabase 连接串）② 升级 Supabase Pro（PITR）③ 手动周期导出 + 部署日全量快照 | ③起步（零成本、纪律型），主网数据增长后升 ② |
| 3 | **免费额度是否升级**（见 C6 盘点结果） | 逐服务决定 | 盘点后再定，不预设 |

## 1. C1 — secrets 轮换（与 P10 遗留 Bearer 切换**合并为一次操作**）

- ⚠ 前置现状：P10 已禁生产 query secret，而 cron-job.org 各 job 尚未切 Bearer（P10 待办）——
  **先去面板确认生产 cron 是不是已经在 401**；两件事合并成一次编辑，别让用户改两遍
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

现状：Resend manual_review 邮件已接（P7 `a48f4de`）；低余额/queue stuck 仍只写 system_kv 无邮件。
- [ ] Resend 发信配置生产化：团队邮箱/发信域名核实（C-defer 项），收件人=用户
- [ ] `check-balance` 低余额（operator ETH + Turbo winc 双阈值）→ Resend 邮件
- [ ] queue stuck（oldestAgeSeconds 超阈值）→ Resend 邮件（复用 manual_review 通道，fire-and-forget 同款防御）
- 验证：**每类告警人为触发一封真实邮件收到**（阈值临时调高触发法），记录进 review

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

- 选 ① 维持：登录路径主网回归一遍（SemiLogin 7 步实测脚本复用 `docs/SEMI-DEMO-SCRIPT.md`）+ 风险记录
- 选 ②/③：另立子步骤（涉及 semi-client.ts / SIWE 新组件，工作量另估）
- [ ] **无论选哪个：Semi 故障 kill switch**（Codex P2）——LoginModal 默认入口可一键回退
      Privy / 隐藏 Semi（env flag 或配置常量即可）；上线周 Semi API 波动时保新用户能登录

## 8. C8 — localStorage JWT → httpOnly 评估

- [ ] 安全评估文档化：现状（localStorage `ripples_auth_jwt`，XSS 可读）vs httpOnly cookie 改造成本
      （涉及 useAuth/client-jwt/中间件三层）；**允许结论 = 维持现状 + 理由留档**，不强制改造
- [ ] 结论进 JOURNAL；若拍板改造则挂独立 step 排期

## 9. C9 — P10 边际清尾（三小项，一批 commit）

- [ ] SR-P1-1 `save_score_atomic` exception null check（SQL 小修）
- [ ] SR-P1-2 `mint_score_enqueue` 错误信息友好度
- [ ] SR-P1-14 `scripts/load-env.ps1` 多行 value 支持（TURBO_WALLET_JWK 受害者，C2 换钱包正好用上）

## 10. C10 — Node 版本 pin + OG/海报生产实测（memory 已知雷）

- 已知：`next/og` ImageResponse 在 Node 24 下 **dev+生产都崩**（failed-to-pipe，memory 记录）；
  `opengraph-image.tsx` 与海报 `poster/route.tsx` 都用它；`package.json` 现**无 `engines` 字段**
- [ ] pin Node 20 LTS：`package.json` `engines.node` + Vercel 项目设置 Node 版本核对一致
- [ ] 生产实测：`/score/<id>/opengraph-image` 与海报路由直接请求 → 200 + 出图内容正确
- [ ] 本机 dev 对策记录（无 nvm）：装 nvm-windows 或接受"本地出图不可用、只验生产"并留档

## 11. 完成标准

- [ ] C1-C5 全落地且各自验证过（含真实告警邮件 ≥ 3 封、备份恢复演练 1 次）
- [ ] C6 承载表产出、C-0 三项拍板落 JOURNAL
- [ ] C7 按拍板执行完（含 Semi kill switch 就位）；C8 评估结论留档；C9 三小项落地；
      C10 Node pin + OG/海报生产实测通过
- [ ] verify.sh 全绿；产出 `reviews/2026-XX-XX-phase-12-infra.md` 逐项记录

## 12. 红线

- 私钥/JWK/secret 永不进 git、不进聊天记录（CRON_SECRET 教训）；生成类脚本用完即删（S0.b 先例）
- 充值类动作先报金额获确认再执行；Vercel env 改动后必须 redeploy 才生效（历史坑）
- migration 类（如备份辅助表）由用户在 Supabase 生产执行
