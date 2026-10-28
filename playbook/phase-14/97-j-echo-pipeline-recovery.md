# P14-J — Echo 流水线恢复 + 已铸唱片补发 #36

> **建立日期**：2026-10-28。状态：**J-A 方案已由用户确认（2026-10-28）；J-A0 只读核实已完成；J-A1 待开工**。未写库、未改线上配置。分支 `feat/p14-j`（基于含 P14-I 与 P19 的 main 5ec72b4，已补入 P14-I 上线记录）。J-B 的规则仍待用户回答。
> **来源**：P14-I 上线后用户实测 `0x991b…1c63`、`0x414c…9cea` 首页与 /me 均无 Echo；只读排查发现 OP 免费铸造与 Echo 空投两条线上流水线都已停摆。
> **用户已定（2026-10-28）**：两件事合成一个 P14-J；**J-A 修复先上线**，J-B 手动补发的细节稍后再定，不阻塞 J-A。
> **不改**：P14-I 的首页规则（I-1~I-6：只显示 origin == 登录钱包 的那一枚）、Pond Echoes 合约、recipe v1 算法、已上链与已上传的永久产物（含 Arweave 上的 score-decoder v3）。

---

## 1. 现状与证据（2026-10-28 只读排查）

### F1 — OP 免费铸造自 9/23 起全部失败（阻塞新用户拿到 Score，也就拿不到 Echo）

| 订单（score_nft_queue） | 钱包 | 状态 | 卡在哪一步 |
|---|---|---|---|
| f345bc2c 2026-09-23 | `0x991b…1c63` | failed / safe_retry | events 已上传，双网关校验失败 |
| 19bd7235 2026-09-23 | `0x991b…1c63` | failed / safe_retry | 同上 |
| 5b0064f2 2026-09-24 | `0x19da…bA54` | failed / safe_retry | 同上 |
| 511ed2ca 2026-10-21 | `0xBEEC…9654` | failed / safe_retry | 同上 |
| 167d6699 2026-10-28 | `0x414c…9cea` | failed / safe_retry | 同上 |

- 五笔都只完成了“上传演奏动作（events）”，`package / metadata` 未开始，**均未发过链上交易**（2026-10-28 逐笔核对：`tx_hash`、`token_id`、`mint_attempted_at`、`uri_tx_hash` 全为空，`retry_count = 3`）——复位重跑不会重复铸造。
- OP 最后一次成功是 2026-09-21（Score #4）。
- **根因 1：`ario.permagate.io` 已下线。** 根路径返回 `{"message":"Application not found"}`；本项目所有历史文件（含 8/23、9/11、9/21 成功铸造的）在它上面均 404。`arweave.net`、`ardrive.net`、`arweave.tokyo` 三家对全部文件返回 200。
- **根因 2：OP 校验只认两家且必须都成功。** `src/lib/permanent-core/attestation.ts` 的 `attestPermanentResource` 只读 `ARWEAVE_GATEWAYS = [arweave.net, ario.permagate.io]`（`src/lib/arweave/shared.ts`），要求两家字节一致。permagate 不可用 → 永远凑不齐。
- **放大因素：OP 队列重试太快。** `app/api/cron/process-score-queue/route.ts` 的 `MAX_RETRY = 3`、无退避，每分钟一次，约 8 分钟内耗尽即判 failed。即使网关正常，新上传的文件在 `arweave.net` 上也可能几分钟后才可读（10/28 当时 arweave.net 也是 404，现在 200）。
- **ETH 自付路径同样依赖它**：`src/lib/self-mint/assets.ts` 也调用 `attestPermanentResource`，但失败时返回“稍后再试”而不是判失败——所以 ETH 新订单不会报错，而是**无限等待**。9/26 那笔 ETH 能成功，推测当时 permagate 只是慢、尚未下线。

### F2 — Echo 自动空投处理器停在“只观察”（已有合格用户 5 周没收到 Echo）

- `wallet_recipe_queue` 中 `0xBEEC…9654`（OP Score #4，9/21）的任务 `eligible / pending`，`updated_at` 仍是 2026-09-21，`retry_count = 0`——**从未被领取**。
- `process-wallet-recipe` cron 心跳正常（`system_kv` 的 `p14:last-cron-success` 今天 05:43 仍在更新）。live 模式下 cron 会 claim 这条 pending；只有 observe 模式会“发现 + 记成功 + 不处理”。
- **推断**：生产 `WALLET_RECIPE_MODE=observe`。JOURNAL 曾记“P14 保持 observe”，此后未见切回 live 的记录。**需在 Vercel 核实实际值**（J-A0）。

### F3 — 名单规模（为 J-B 估量）

| 钱包 | 唱片 | Echo 现状 |
|---|---|---|
| `0x456b…7708` | OP Score #3 | 已有 ECHO #1（主网唯一一枚，totalSupply = 1） |
| `0xBEEC…9654` | OP Score #4（+10/21 失败单） | 合格，pending 卡在 F2 |
| `0x19da…bA54` | OP Score #1（+9/24 失败单） | `excluded_prelaunch`（上线前铸造，当初按规则不给） |
| `0xFD86…7f20` | OP Score #2 | `excluded_prelaunch` |
| `0x991b…1c63` | ETH 主网 Score #1（OP 两次失败） | 无队列记录（只有 ETH 唱片，原规则 D5 不触发） |
| `0x414c…9cea` | 无（10/28 OP 失败） | 无 |

### 不受影响 / 无需改的部分

- **Arweave 上的永久播放器（score-decoder v3）**内置 `["arweave.net","ario.permagate.io"]`，但它按顺序逐个尝试、`arweave.net` 在前，permagate 失效只少一个备用，播放不受影响。永久产物不可改，也无需改。
- Echo 自己的网关组 `WALLET_RECIPE_GATEWAYS`（ardrive / tokyo / arweave.net）不含 permagate，Echo 的上传与校验不受 F1 影响。
- `src/data/score/snapshot-contract.ts` 的 `AR_HOSTS` 与 `src/data/score/metadata.ts` 的 `GATEWAY_HOSTS` 用来**识别**历史地址里的网关域名，permagate 应继续保留在“可识别”名单里（历史引用可能写着它），只是不再去它那里**取数据**。

---

## 2. 决策

### 已定

| # | 决定 |
|---|---|
| J-D1 | 两件事合成 P14-J；J-A（修复 + 补投 + 恢复空投）先做先上线，J-B（手动补发）后定细节。 |

### J-A 方案（**用户 2026-10-28 全部按推荐确认**：J-R1、J-R2（约 2 小时）、J-R4、J-R5；J-R5 由 AI 操作 Vercel）

| # | 推荐 |
|---|---|
| J-R1 | **双网关校验改为“三家里任意两家字节一致”**：arweave.net + ardrive.net + arweave.tokyo（与 Echo、长音频已在生产验证的同一组）。permagate 从“取数据”的名单中彻底移除，但保留在“可识别域名”名单里。校验强度不降（仍要求两个独立网关同字节）。 |
| J-R2 | **OP 队列：校验未通过 ≠ 失败**。“文件已上传、网关暂时读不到”改为不消耗重试次数的等待，并加退避（例如 1、2、5、10、20 分钟…最长等待约 2 小时，超时才判 failed）；真正的错误（字节不一致、上传结果未知等）仍走原 manual_review。实现时优先不加 migration；如必须加列，停下来问。 |
| J-R3 | **补投 5 笔失败订单**：用一个带 dry-run 的脚本，按 `status=failed AND failure_kind=safe_retry AND mint_attempted_at IS NULL` 逐笔 CAS 复位为 `uploading_events`（events 已上传，会直接进校验），重试计数清零。先 dry-run 列出，用户逐笔确认后才写生产库。 |
| J-R4 | **`0x991b` 的两笔重复单只补投较新的那一笔**（19bd7235），较早的一笔保持 failed。理由：用户当时是因为失败才重录一次，两笔都补会多铸一张他未必想要的唱片。（待确认） |
| J-R5 | **Echo 空投切回 live**：在 Vercel 把生产 `WALLET_RECIPE_MODE` 改为 `live` 并重新部署。切换后会真实发生：上传 Echo 素材到 Arweave（Turbo 余额）、运营钱包在 OP 主网发铸造交易（OP 余额）。先只读核对两项余额。 |

### J-B 待用户拍板（细节稍后定，不阻塞 J-A）

1. **“已铸造过唱片”指谁**：OP Score 持有者？ETH 主网自付铸造者（如 `0x991b`）？都算的话，等于推翻原规则 D5（只有 OP 首铸触发）。
2. **上线前排除的老用户**（`0x19da`、`0xFD86`）：当初是有意不给（activation 之前铸造）。这次是否放开？
3. **发给谁**：发给当初铸造唱片的钱包（推荐，与首页“按 origin 显示”一致；合约一钱包终身一枚），还是现在持有唱片的钱包？
4. **ETH-only 钱包的技术路径**：现有登记函数 `register_wallet_recipe_origin` 要求来源是 OP ScoreNFT 的链上事件（chain_id=10、source tx/log/block 必填）。给 ETH 唱片持有者补发需要新的登记来源（例如“人工补发”类型 + 引用 ETH 交易），可能涉及 migration——J-B 细化时设计。
5. **费用**：按 F3 名单，最多 3–4 枚 Echo（每枚一次 Arweave 上传 + 一次 OP 交易），J-B1 先给出实际估算。

---

## 3. Steps

### J-A0 — 只读核实（不改代码、不写库）—— **已完成（2026-10-28）**
- ✅ 生产 `WALLET_RECIPE_MODE = "observe"`（`vercel env pull` 到临时目录、只取该键，用后删除；`NEXT_PUBLIC_CHAIN_ID=10`、`WALLET_RECIPE_EXPECTED_ACTIVATION_BLOCK=156738598`）。F2 推断成立：observe 只发现、不处理，所以 `0xBEEC…9654` 一直 pending。该变量 47 天前（约 9/11）设置，之后未改。
- ✅ 运营钱包（由 Echo #1 铸造交易反查）`0x306d…1633`：OP 主网余额 0.0101 ETH；当前 gas 约 0.001 gwei，一次铸造约 3×10⁻⁷ ETH，余额足够覆盖 J-A3/J-A4 全部笔数。
- ✅ Turbo 上传钱包（由 Arweave 数据项签名者反查）`0xD9AE…4582`：余额 536,146,205,390 winc（约 0.54 credit）。Score/Echo 的上传文件多为 KB 级、落在 Turbo 免费额度内，约 5 张唱片 + 几枚 Echo 足够；J-A3 执行前复查一次。
- ✅ 5 笔失败订单的 events 在 `arweave.net`、`ardrive.net`、`arweave.tokyo` 三家均返回 200，且字节数、MIME、SHA-256 与库中记录完全一致（5/5 × 3/3）——J-R1 三选二对它们必然通过。
- ~~只读核对：ETH 自付是否有正在“无限等待”的订单~~ —— 2026-10-28 已核：`score_self_mint_orders` 无非终态订单。
- 📦 范围：无代码改动；结果写入本文 §1 与 JOURNAL。

### J-A1 — 网关校验与重试修复（代码）
- 📦 范围（实现时可微调，越界先问）：`src/lib/arweave/shared.ts`（取数据网关组）、`src/lib/permanent-core/attestation.ts`（三选二）、`app/api/cron/process-score-queue/route.ts`（等待不计重试 + 退避）、必要时 `app/api/cron/process-score-queue/_shared.ts`、`src/lib/arweave/core.ts`（注释与上传后读回）、`scripts/p14-j/`（新，单测）。
- 不改：`src/score-decoder/`（永久产物源码）、`snapshot-contract.ts` / `metadata.ts` 的可识别域名名单。
- 验收：
  - 单测：三家中任一家 404 仍能通过；两家 404 不通过；两家字节不一致判冲突；ETH 自付路径行为同步受益。
  - 单测：OP 队列“已上传未可读”时不消耗重试、按退避重排；超过最长等待才判 failed；真实错误照旧 manual_review。
  - 只读联调：对 5 笔失败订单的 events 跑新校验函数，全部通过。
  - `tsc` / `eslint` / `verify.sh`（dev 关闭时）与基线一致；Codex 只读审查。
- 推送 / 部署需用户放行。

### J-A2 — 上线修复
- 用户放行后推送部署；部署后只读确认 cron 正常、无新增报错。

### J-A3 — 补投失败订单（写生产库，逐笔放行）
- 脚本 `scripts/p14-j/requeue-failed-scores.ts`：默认 dry-run，列出候选与将写入的字段；`--execute --id=<前缀>` 才写，CAS 条件不满足即放弃。
- 用户确认名单（含 J-R4）后逐笔执行；观察 cron 推进到 `success`、链上 Score 铸出。
- 验收：每笔对应钱包在 /me 看到新唱片；OP ScoreNFT 链上可查。

### J-A4 — Echo 空投恢复 live（改生产配置，用户放行）
- 用户在 Vercel 切 `WALLET_RECIPE_MODE=live` 并重新部署（或明确授权 AI 代为操作）。
- 预期：`0xBEEC…9654` 的 pending 先被处理；J-A3 补投成功的 OP 首铸由 `sync-chain-events` 发现，按原规则登记（合格者进入 pending）。
- 验收（**真实端到端，P14-I 未能覆盖的那条**）：用户在正式站登录相应钱包，首页 #36 渐显、/me 出现 Echo；`/echo/<id>` 可播放。

### J-B0 — 补发规则拍板（§2 J-B 五个问题）
### J-B1 — 名单与费用 dry-run（只读）
### J-B2 — 实现补发登记路径（如需 migration，先问）
### J-B3 — 小批执行（1 个钱包）→ 用户目验 → J-B4 全量（每批放行）

---

## 4. 风险与边界

- **写生产库 / 改生产配置**：J-A3、J-A4、J-B 的执行步骤都会真实写库或发交易，**逐步单独放行**；AI 不自行切 `WALLET_RECIPE_MODE`、不自行复位订单。
- **不可逆的链上动作**：Score 与 Echo 铸造不可撤回。补投前必须确认“未发过交易”（`mint_attempted_at` 为空、链上无对应 orderId），J-R3 的 CAS 条件即为此设。
- **余额**：OP 运营钱包与 Turbo 余额不足会让流水线进入 safe_retry；J-A0 先核对。
- **ETH 自付**：本修复会让 ETH 自付路径的校验也换成三选二；2026-10-28 核对时没有等待中的 ETH 订单，修复上线不会意外推进任何订单。
- **permagate 只是第一个出问题的网关**：三选二仍依赖外部网关。若将来再有一家下线，系统会降级为“剩两家都必须可用”。可考虑把网关组改为配置项并加健康告警，放入 Later，不在本轮扩展。
- **与 P14-I 的关系**：P14-I 规则不变；J-A4 完成后才第一次在线上真实走通“首铸 → 空投 → 首页渐显”。
- **测试凭证**：如 J-A4 目验需要在本地登录，按 TASKS Later 中“测试登录凭证隔离”的做法另议，不沿用 P14-I 的 2 小时生产密钥凭证。

## 5. 拍板记录

**已定（2026-10-28，用户“全部按照你的建议来，vercel 优先你来改”）**：
1. J-R1 三选二（arweave.net / ardrive.net / arweave.tokyo），停用 permagate 取数据。
2. J-R2 “已上传未可读”不计重试 + 退避，最长约 2 小时。
3. J-R4 `0x991b` 只补投较新的一笔（19bd7235）。
4. J-R5 Echo 空投切回 live，**AI 通过 Vercel CLI 操作**。执行顺序仍按 J-A4（修复上线、补投之后），**改之前先告知用户、改之后只读核验**；不自行扩大到其他环境变量。

**仍待用户回答**：J-B 的五个问题（§2）；另有用户提到“/score 页面即便没有成功铸造也可以点击播放聆听”——该说明与本方案的关系待用户澄清（见 JOURNAL）。
