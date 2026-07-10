# P10-C — 债务收口

> 对应用户指定的"债务收口"。
> 上层：`playbook/phase-10/00-overview.md` §5；执行契约见 §8（**不到 🛑 停点默认不停**）。
> 本 track 无独立停点：C-now 各项归 Wave 3 自动连跑；灾备若只到"方案定稿"，定稿文本归 🛑 停点 3 一并给用户过目；TASKS.md 标签改写等 P8 收尾进程合并后做（共享文件协调，见 00-overview 文档同步注）。
> **背景**：旧"挂 P10"标签来自 2026-05-13 四段拆分（当时 P10 = 主网部署）。2026-06-04 九段拆分后主网挪到 P12，这些标签一直没重分诊。本 track 按"现在能做 / 必须等主网日"切开，逐项给结论。

---

## 收口原则

每一项债务必须落到三种结论之一，不留悬空：
1. **now** — 本 Phase 做
2. **→P12** — 归主网部署日清单（本 Phase 只做准备/文档化）
3. **不做 / 运营长期** — 明确划掉

与 P10-B 的关系：债务清单里的后端项如与 `reviews/2026-07-05-backend-review.md` 重叠，**以 review 编号为准，在 B track 做，这里只登记指向**，避免两处重复施工。

---

## C-now（进本 Phase）

| 项 | 说明 | 与 B track 关系 |
|---|---|---|
| **A16 heartbeat 接线** | operator-lock heartbeat 已实现但从未被 cron 长步骤调用 → 接入 `steps-set-uri` / receipt polling | ＝ review P2-2 / P3-6，**在 B track 做**，此处登记 |
| **401 自动 logout** | 新建 `src/lib/fetch-with-auth.ts`：包一层 fetch，响应 401 → 调 useAuth 的 logout 语义（清 JWT + storage event 广播）+ 跳登录提示。**改造范围先 grep 定界**：`Authorization: Bearer` 的 caller（useFavorite / useMintScore / jam-source / me 页三 fetch 等），逐个换 wrapper，一个 commit 一批。验收：手动把 JWT 加进 jwt_blacklist → 调任意 /me API → 自动登出 + 提示重登（D-B5 verify 原标准） | 前端，本 track 做 |
| **/score/[id] 链上灾备** | B8 P3 删 noop 后全押 Supabase → DB 抖动时所有分享链接 404（P10-A 上分享功能后这个敞口被放大，顺序上宜先/同期做）。**P10 至少方案定稿**，能落则落：`getScoreById` DB miss 且 id 是数字 tokenId 时，读链上 `tokenURI(tokenId)` → 拉 Arweave metadata → 渲染降级版（封面/标题/播放入口）。注意 CONVENTIONS §3.1：页面侧读链是 view call（不是交易），不违"前端不调合约"——走 server 侧 viem publicClient 即可 | 与 A track 同页，协同 |
| **9 项 strict review P1（SR-*）** | 逐条归宿见下表（⚠ 编号加 `SR-` 前缀区分——与 `reviews/2026-07-05-backend-review.md` 的 P1-x 是**两套编号空间**，别拿错条目） | 部分与 B track 重叠 |

### SR-* 逐条归宿（旧 strict review 2026-05-08/13 编号，原文见 `docs/JOURNAL.md` 2026-05-13 段）

| SR 编号 | 内容 | 归宿 |
|---|---|---|
| SR-P1-1 | `save_score_atomic` exception null check | **now**（小修，B track 顺路） |
| SR-P1-2 | `mint_score_enqueue` 错误信息友好度 | **now**（小修） |
| SR-P1-11 | `airdrop_recipients` CAS 状态推进 | **now**，并入 review P1-4/P1-5 的 airdrop 修复包（同文件同批施工） |
| SR-P1-12 | Deploy 脚本主网 fail-fast | ＝ review **CT-2**，在 B track 合约批做（脚本改动，不部署） |
| SR-P1-13 | forge verify-contract 进 runbook | **→P12**（纯 runbook 文档，部署日用） |
| SR-P1-14 | load-env.ps1 多行 value 支持 | **now**（本地工具小修；TURBO_WALLET_JWK 就是多行受害者） |
| SR-P1-24 | airdrop module 顶层 env 校验改 lazy | **now**（小修） |
| SR-P2-11 | `score_nft_queue.token_id` partial unique index | **now**，并入 B track migration 批（`phase-10/045` 或独立 046） |
| SR-P1-4 + lint 2 处 + OwnedScoreNFT.id 双语义 | 原挂"P8 UI 翻修"，但 P8 转向了水塘视觉没消化 | **→P11**（全局 UI 优化时做；启动时先核对是否已被顺手修过） |

---

## C-defer（登记去向，本 Phase 不做）

| 项 | 去向 |
|---|---|
| A5 换 Turbo wallet | **→P12** 主网部署日 |
| A7 operator 主网 ETH 充值 | **→P12** |
| 换生产 CRON_SECRET（调试时聊天泄露过） | **→P12** |
| A8 Resend 告警接 cron 基础设施 | **→P12**（P10-B 的 P2-3/P2-4 依赖它；就绪则提前做，否则归 P12） |
| Semi 正式授权 / 切 SIWE | **→P12**（主网 Semi 策略） |
| localStorage JWT → httpOnly 评估 | **→P12** |
| DB 备份预案（Supabase Free 无 PITR） | **→P12**（＝ review P3-5，写进 runbook） |
| A6 剩余 88 曲上链 | **运营长期**（艺术家补曲，不阻塞任何 Phase） |
| 深度性能优化（bundle splitting / mobile LCP） | **→P12**（roadmap 原口径） |

---

## 收口动作

1. 通读 TASKS.md:217-225「主网前必做」+ 全文 `[挂 P10]` 标签，逐条对到上面两张表
2. 与 `reviews/2026-07-05-backend-review.md`「已有清单对应关系」段去重
3. C-now 项排进施工（heartbeat/灾备并入 B/A track，401 wrapper 本 track 独立做）
4. C-defer 项统一写进 P12 起点清单（新建或更新 `playbook/phase-12/` 起点文档）
5. TASKS.md 里所有 `[挂 P10]` 标签替换为 `[P10-C-now]` / `[→P12]` / `[不做]`，消除悬空标签

---

## C track 完结标准

- [ ] TASKS.md 全部 `[挂 P10]` 标签有明确结论（now / →P12 / 不做），无悬空
- [ ] C-now 四项：401 wrapper 已做；heartbeat/灾备已在 B/A track 落地或定稿
- [ ] C-defer 项已汇入 P12 起点清单
- [ ] `bash scripts/verify.sh` 全绿
