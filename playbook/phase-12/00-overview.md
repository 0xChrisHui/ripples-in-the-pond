# Phase 12 — OP Mainnet 上线准备与部署（Overview）

> **来源**：2026-07-11 会话定稿。`playbook/roadmap-P8-P16.md` P12 段展开 + P10 移交项归并
> + 2026-07-11 音效永久性拍板（`10-a`）。
> **文件组织**（2026-07-11 用户指示）：`10-a` 先行建档；`20-b` 起为主网部署本体。
> **与其他 Phase 的关系**：P12 **不依赖 P8/P9/P11 完成**——前端视觉/按键动画可重部署、
> 零链上影响，主网后继续迭代；依赖 **P10 实质完结**（2026-07-11 已到停点 3，
> 余 CT 合约项 → 本 Phase `-b`；migration 043-046 + cron Bearer → 用户线下待办）。
> **用户既定节奏**：后端先做好 → 可提前上主网 → 前端与音效慢慢修
> （音效换血例外：必须在开铸前，见 §3 硬 gate）。

---

## 1. Track 一览

| Track | 文件 | 内容 | Gate 属性 |
|---|---|---|---|
| A | `10-a-sound-extensibility.md` | 音效可扩展性 + 解码器锁死 + 换血 26 音效 | **硬 gate** |
| B | `20-b-contracts-mainnet.md` | 合约决策 gate + CT 修复 + 主网部署就绪 | **硬 gate** |
| C | `30-c-infra-security.md` | secrets/钱包/告警/备份/承载/Semi 策略 | **硬 gate** |
| D | `40-d-cutover-week1.md` | 数据切换拍板 + 部署日执行 + 首周救火 | **硬 gate**（执行日） |
| E | `50-e-perf-launch-check.md` | 深度性能优化 + 上线检查 | 软 gate |

**部署时序权威文档 = `docs/MAINNET-RUNBOOK.md`**（Phase 6 产出、P7 A4 补验收命令）。
本 playbook 不复制其内容，只做增补（B track 会更新它）；部署日照它执行。

## 2. 双 gate 模型

- **硬 gate = 开放公开铸造的前置**：错过即永久（链上/Arweave 不可改）或真金白银风险。
  A/B/C 全部完成 + D 走完部署日 smoke → 才能开放公开铸造。
- **软 gate = 公开宣传/拉新的前置**：E（性能）不阻塞开铸，建议对外推广前完成。
  与用户"提前上主网、前端慢慢修"的计划一致。

## 3. 永久性冻结清单（开铸后永远改不了，逐项对 track）

| # | 永久物 | 定稿动作 | 归属 |
|---|---|---|---|
| 1 | 合约 name/symbol（部署即焊死，CT-1 现在还写着 "(Testnet)"） | 主网正式名拍板 + 脚本参数化 | B |
| 2 | ERC2981 版税 / 供应上限 / 可升级性（合约不可升级，不加=永远没有） | 🛑 停点 B-0 拍板 | B |
| 3 | admin 冷钱包地址（DEFAULT_ADMIN 移交后热钱包无治理权） | 钱包形态拍板 + CT-3 两步移交 | B |
| 4 | 每枚 NFT 的解码器版本（animation_url 钉死） | 数量无关化 + 重传 + 验收 | A |
| 5 | 每枚 NFT 的音效表版本（同上） | v2 格式 + 换血 26 音效 | A |
| 6 | 每枚 NFT 的 metadata 全文（**曲名**/描述/封面/底曲/事件快照；现 5 首曲名是数字占位） | D1 内容冻结：正式曲名落库 + 就绪面确认 | D |
| 7 | metadata `external_url`（`NEXT_PUBLIC_APP_URL` 写进每枚 NFT） | D1 env 读回预检 + 域名长期持有承诺 | D |
| 8 | 音效 id ↔ 音频绑定规则 | `10-a` §4 五条规则拍板 | A |

## 4. 依赖图与推荐顺序

```
A 音效冻结（A4 换血素材 gated）──┐
B 合约（B-0 拍板 → Foundry → CT 修 → 测试网回归）──┼──► D 部署日 ──► 开放公开铸造 ──► D 首周救火
C 基建安全（钱包/告警/备份/secrets）──────────────┘
E 性能（软 gate，随时并行，不卡 D）
```

- A/B/C/E 相互独立可并行，且与 P8/P9 沙盒零文件冲突，可随时提前施工
- B 内部串行：不拍板不改合约；不装回 Foundry 不改脚本（不盲改，P10 已裁决）
- D 是唯一"执行日"track：集中主网**交易广播**与最终切换（充值类在 C 报金额确认后先行）
- 素材依赖：A4 换血等艺术家新音频 —— **这是最可能卡日历的外部项**，宜早启动；
  赶不上排期有 fallback（拍板放弃换血窗口，现音冻结为创世版，见 `10-a` A4 / D1）
- 顺序注 ①：A4 换血宜在 **P9 按键动画手感调优之前**完成（动画配声音性格调，先换音再调手感）
- 顺序注 ②：E 的首页相关项（bundle/LCP/GL）等 **P8 首页形态定稿后**再做，/me /score 等页可先行

## 5. 停点总表

| 停点 | 所在 | 时机 | 拍板内容 |
|---|---|---|---|
| 🛑 A-0/A-1/A-2 | `10-a` §5 | 见该文件 | 音效规则包 / 解码器验收 / 换血执行 |
| 🛑 B-0 | `20-b` | B 开工前 | 合约决策 gate 打包（承接 P10 停点 4）：ERC2981/上限/可升级/幂等键/正式名/admin 形态/Airdrop 部署与否 |
| 🛑 B-1 | `20-b` | CT 修完 | 测试网重部署回归验收 |
| 🛑 C-0 | `30-c` | C 开工前 | Semi 主网策略 / DB 备份方案 / 额度升级与否 |
| 🛑 D-0 | `40-d` | 部署日前 | 测试网数据处置 + 部署日排期 |
| 🛑 D-gate | `40-d` | smoke 后 | 开放公开铸造放行（对照 §3 清单逐项勾） |

## 6. 来源吸收对照（消灭所有悬空标签）

| 来源 | 项 | 归宿 |
|---|---|---|
| TASKS「主网前必做」 | Deploy admin/minter 分离 / save draft 事务化 | ✅ 已消化（P6-C2 / migration 025）；残余加固 = CT-2/3 → B |
| 同上 | Turbo credits 阈值告警 / A8 Resend 接 cron | C4 |
| 同上 | AirdropNFT metadata 补完 | B-0 附属决策（默认随空投启用再做，不进主网 gate） |
| 同上 | 换 CRON_SECRET / A7 operator 主网 ETH | C1 / C3 |
| 同上 | A3 长期方案（幂等键 + simulateContract） | CT-4 → B-0 拍板 |
| P10 C-defer 表（`30-c-debt.md`） | A5 Turbo wallet / Semi 策略 / httpOnly 评估 / DB 备份 / 深度性能 | C2 / C7 / C8 / C5 / E |
| P10 遗留 | CT-1/2/3/5 + CT-6~15（`phase-10/60-ct-contract-todo.md` 整体并入） | B |
| P10 遗留 | SR-P1-13 verify-contract 进 runbook | B4 |
| P10 边际未做 | SR-P1-1 / SR-P1-2 / SR-P1-14 | C9 清尾 |
| STATUS 悬空 TODO | `.env.local` 重复 CRON_SECRET | C1 顺手 |
| 本会话 2026-07-11 | 音效/解码器永久性 | A（已建档） |

## 7. 红线

- **真金白银**：主网**交易广播**只允许发生在 D track 部署日流程内；充值类（C2/C3）
  在 C 期报金额经用户确认后执行；B 施工期零主网交易
- deployer 私钥一次性：用完即毁（runbook §4.4），绝不进 Vercel
- `AIRDROP_ENABLED` 主网**不设**；process-airdrop cron 主网**不配置**（Phase 6 D1 决策）
- 合约部署不可回滚（runbook §6）：宁可推迟部署日，不带犹豫上链
- 沙盒不碰：不动 pond-gl* / test 页任何文件（与 P8/P9 并行安全）
- 装包先查 `docs/STACK.md` 报批；migration 由用户在 Supabase 生产执行
- 文档同步：STATUS/TASKS 的 P12 口径在本 playbook 定稿后统一改写（沿用 P10 先例）
