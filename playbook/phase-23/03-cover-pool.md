# P23-B — Score 封面池（存档）

> 2026-11-13～14 的工作记录 + 执行计划。状态：**图已生成并校验；Turbo 已充值（§8）；用户 2026-11-14 授权夜间任务做完 AI 目验 → 上传 → 读回 → 写生产库（§7）**。总览与夜间规则见 `00-overview.md` §3。

> **最新授权覆盖旧条款：B生产替换采用明确生产ref的单事务EXCLUSIVE锁＋静态快照断言→ROLLBACK演练→COMMIT；不再采用旧B5的多次PostgREST请求。C已获准只读取证，实际调查见§6与05-night-report.md，显示仍未恢复。**

## 1. 需求

- 日食版音乐圆圈（黑盘 + 白环 + 日冕光晕，与应用内播放日食同一套视觉），每张封面的差异在圆圈周边的白色波浪（线条 + 色块，比旧版更丰富）。
- 用户希望每次铸造自动匹配一张封面，尽量不重复。
- 原始提出：2026-10-30（见 TASKS Later）。2026-11-13 用户确认需求描述无误。

## 2. 风格定稿

出过 25 种候选（A–Y，每种 3 张样图），用户分三轮筛选，**保留 12 种**：

| 代号 | 风格 | 代号 | 风格 |
|---|---|---|---|
| A | 涟漪环 | N | 点阵波纹 |
| E | 绕流线 | O | 剪纸波层 |
| F | 螺旋波 | S | 涡街 |
| J | 唱片纹 | U | 极光帘 |
| K | 墨流 | V | 星尘环 |
| M | 引力网格 | X | 圆相笔触 |

未选的 13 种（B C D G H I L P Q R T W Y）代码仍保留在 `scripts/p23/cover-gen/`，需要时可重出。

## 3. 池的规格（已定）

- **600 张 = 12 种风格 × 每种 50 张**。用户原计划 1200 张（每种 100），2026-11-14 决定砍半。
- **格式 JPG，800×800，质量 85（mozjpeg）**。2026-11-14 用户定。实测 600 张共 52.4MB，单张均值 89KB、最大 190KB，其中 384 张 ≤105KiB（22.5MiB）、216 张更大（29.9MiB）。**费用与余额见 §8。**
- **不用 SVG**：新设计的 SVG 平均 292KB（K 墨流 1.2MB），比 JPG 大；旧封面 SVG 只有约 8KB 是因为只有 6 条线。
- **不用 WebP**：只比 JPG 小一点，部分钱包和市场支持不完整；Semi 的显示问题未查清前不再多引入变量。
- **每种风格取 1–50 号**，保留了用户看过的样图（序号 1–3）。种子 = `(风格字母码 × 1000 + 序号) × 7919`，可逐字节复现（已用 K 验证）。
- **轮转顺序**：`manifest.json` 的 `order` 为 1…600，第 1 轮 A…X 各第 1 张，第 2 轮各第 2 张……相邻两张必为不同风格，同一风格每 12 张才出现一次。

## 4. 产物位置

| 内容 | 位置 | 入库 |
|---|---|---|
| 生成器（含全部 25 种风格） | `scripts/p23/cover-gen/`：`lib.ts`（工具、画框、A/B）、`styles/`、`batch.ts`（出 PNG 母版）、`tojpg.ts`（转 JPG + 轮转 manifest）、`verify-jpg.ts`（校验） | 是（尚未 commit） |
| JPG 池（600 张 + `manifest.json`） | `data/p23/cover-pool/` | 否（gitignore） |
| PNG 母版（1200 张，1000×1000，481MB） | `data/p23/cover-masters/` | 否（gitignore） |
| 样图预览页（25 种 × 3 张） | 桌面 `score-cover-samples/preview.html` | 否 |

重生成：`npx tsx scripts/p23/cover-gen/batch.ts <字母> data/p23/cover-masters 100`，再 `npx tsx scripts/p23/cover-gen/tojpg.ts data/p23/cover-masters data/p23/cover-pool 50`。

## 5. 校验结果

- 600 张全部存在，规格均为 800×800 JPEG，sha256 与 manifest 一致且互不相同。
- 同风格内亮度无离群（3σ），无近乎空白或过曝的图；相邻两张风格不同，零违例。
- `scripts/p23` 通过全项目 `tsc --noEmit`（0 错误）。
- **只做了数据层校验，没有逐张目验**，也没有在 Semi 或任何钱包里看过。

## 6. Semi 显示（最新授权已允许调查，仍未恢复）

2026-11-14夜间由主代理完成只读取证：Alchemy对已铸Score返回空metadata/图片字段，Semi的补全/重定向链路未恢复；永久metadata与封面可读，未发现本站可修缺陷。详见`reviews/2026-11-14-p23-semi-cover-investigation.md`与`05-night-report.md`。下述为开工前的历史调查存档。

读了 Semi 公开仓库 `nantang-dao/semi-app`，事实如下，**原因仍未确认**：

- NFT 图取自 Alchemy，字段顺序 `originalUrl → pngUrl → cachedUrl`（`server/utils/nft.ts`），Semi 不做格式白名单，直接放进 `<img src>`（`components/NFTItem.client.vue`）。
- 图加载出错会换成 `public/images/placeholder.png`，该文件是 **1×1 纯绿像素（RGB 0,255,0）**。因此用户看到的“全绿”**很可能是加载失败后的占位图，而不是 SVG 渲染问题**——这是推断。
- 一张现有封面经 `arweave.net` 返回 302 → 子域名 → `image/svg+xml`，从开发机可正常打开；用户所在网络下的表现未测。
- 没查：Alchemy 对已铸 Score 返回的 `image` 三个字段、arweave.net 在国内的可达性、缓存。**换成 JPG 不一定能修好**，用户已决定先不查。

## 7. 执行计划 B0–B7（2026-11-14 夜间任务授权全部执行）

### 已核实的前提（2026-11-14，只读）

- **取图规则**：所有取封面的函数都是 `order by usage_count asc, created_at asc limit 1 for update skip locked`（现行：`052_permanent_core_queue_and_snapshots.sql`、`054_op_score_claim.sql`、`058_score_token_counters.sql`；更早的 010/029/046/055 同规则）。**600 张按 `order` 插入、`created_at` 严格递增，用完一圈自动循环，不改任何 RPC。**
- **`score_covers` 现状**：正好 100 行，全部是 `data/cover-arweave-map.json` 里的旧 SVG；只有 10 张用过（usage 0 或 1）。表只有 `id / ar_tx_id(unique) / usage_count / created_at`，无“停用”字段，无外键；队列表 `cover_ar_tx_id` 存的是文本。**旧 100 张用户 11-14 决定不要了。**
- **封面在代码里的去处**：metadata `image` 用 `resolveArUrl`（arweave.net）；作品页唱片盒是 CSS 背景图（`src/components/p11/RecordAnchor.tsx`）；OG 图和海报的 `availableCover` 只要求 `content-type` 以 `image/` 开头。**换成 JPEG 不用改代码。**
- **脚本目录**：`scripts/p23/cover-gen/` 现有 `lib.ts batch.ts tojpg.ts verify-jpg.ts styles/`，本节新增 3 个（`review-sheet.ts upload-pool.ts write-covers.ts`），合计 8 项，**不能再加**（目录 8 项硬线；读回核对做成 `upload-pool.ts --verify`）。每个代码文件 ≤220 行。
- **`data/p23/` 规划**（≤8 项）：`cover-pool/`、`cover-masters/`、`review/`（这三个 gitignore）+ `cover-replacements.json`、`cover-upload-ledger.json`、`cover-uris.json`、`score-covers-before.json`、`score-covers-after.json`（这五个入库）。开工时先把 `data/p23/review/` 加进 `.gitignore`。

### B0 前置检查（只读）

1. `git status`：除本线文件外，只允许已知的未跟踪项 `playbook/phase-25/`、`reviews/evidence/lens-gate-failure.png`（别的会话的，**不要 stage、不要动**）。
2. `npx tsx scripts/p23/cover-gen/verify-jpg.ts data/p23/cover-pool` → 600 张、唯一 600、问题 0。
3. Turbo 余额 ≥ 600 张报价（见 B2 的分批报价）；不够就停 B 线，**不得再充值**。

### B1 AI 目验与替换坏图

1. 新脚本 `review-sheet.ts`：每种风格一张总览图 `data/p23/review/sheet-<风格>.jpg`（50 张，10 列 × 5 行，每格 160px，格下标文件名），另出 `data/p23/review/index.html`（600 张缩略图按风格分组，点开 800px 原图），留给用户早上目验。
2. 逐张看 12 张总览图（用 Read 看图片），拿不准的打开 800px 原图。**坏图标准**：①近乎空白或整片发灰；②日食黑盘被遮挡、出画或明显变形；③几何错误：折线、锯齿、尖刺、网格折叠、线条缠成一团；④大块色块压住画面、发闷；⑤光晕上明显的 JPEG 色带或噪点。**以下是设计本身，不算坏图**：S 涡街的日食偏离中心、K 墨流最密、O 剪纸波层色块大、X 圆相笔触不闭合、V 星尘以点为主、U 极光帘只在下方垂丝。
3. 替换：同风格用母版 51–100 号依次补位，**文件名与轮转位置不变**（例如 `K-007.jpg` 换成母版 K #51 的内容）。实现：给 `tojpg.ts` 加可选参数 `--replace data/p23/cover-replacements.json`（格式 `{"K-007": 51}`），manifest 里该项记录实际的 `n`、`seed` 和 `replacedFrom`；重跑 `tojpg.ts` 后再跑 `verify-jpg.ts`，必须全绿。
4. **上限**：某一风格坏图超过 10 张（20%）说明风格本身有问题 → 不替换、**B 线停在上传前**，记入早上待决；A、D 照常继续。
5. 夜间报告里逐张列出坏图与原因，并附替换后的总览图路径。

### B2 上传 Arweave

新脚本 `upload-pool.ts`，照 `scripts/p22/upload-assets.ts` 的账本模式：

- 账本 `data/p23/cover-upload-ledger.json`，键 = 文件名，字段 `state`（pending / uploaded）、`sha256`、`bytes`、`txId`、`attempts`；每传完一张立即写账本，中途出错保存后退出，**重跑同一命令即续传**。
- 开传前**按 50 个一批**调 `getUploadCosts` 汇总，与 `getBalance().effectiveBalance` 比较，不够就停。不要用 `getTurboUploadBudget` 一次传 600 个大小（实测会 ECONNRESET）。
- `Content-Type: image/jpeg`；tags：`App-Name=ripples-p23-cover`、`Ripples-Cover-File=<文件名>`、`Ripples-Cover-Sha256=<sha256>`。并发 1，顺序上传。
- **pending 处理（与 P22 不同，避免夜里卡死）**：重跑时 pending 项允许自动重传一次（`attempts` 到 2），代价是可能多一份内容相同的永久副本（单张 ≤190KB，约 \$0.013）；第二次仍失败 → 停 B 线。
- 命令：`HTTPS_PROXY=http://127.0.0.1:7897 NODE_USE_ENV_PROXY=1 npx tsx scripts/p23/cover-gen/upload-pool.ts`。记录上传前后的 Turbo 余额。

### B3 读回核对

- `upload-pool.ts --verify`：对每个 txId 取回，**arweave.net 必须通过**（metadata、钱包、Alchemy 都用它），ardrive.net / arweave.tokyo 至少再有一家通过；通过 = HTTP 200、`content-type` 以 `image/jpeg` 开头、sha256 与账本一致。
- 没通过的按 1、2、4、8…分钟退避重查，最长 2 小时；**超时仍有未通过的 → 不写库，停 B 线**。等待期间可以放后台，先去做 A 线，通过后再回来做 B4–B6。
- 全部通过后写 `data/p23/cover-uris.json`：按 `order` 排序的数组，每项 `{order, file, style, n, seed, sha256, bytes, txId}`。

### B4 写库前快照与事务演练（不提交）

脚本`write-covers.ts`默认完整演练后ROLLBACK，加`--execute`才COMMIT。运行方式`npx tsx --conditions=react-server scripts/p23/cover-gen/write-covers.ts`；使用已认证Supabase CLI Management API，并显式指定生产ref `uupobbgnhpattyxhxvmc`（CLI要求`--linked --project-ref`组合，明确ref覆盖本地linked测试项目，不修改link）。

1. 导出 `score_covers` 全表到 `data/p23/score-covers-before.json`（id、ar_tx_id、usage_count、created_at）。**该文件已存在则拒绝覆盖并停下**：它是回滚的唯一依据，不能被后来的状态冲掉。
2. 断言：正好 100 行，且全部属于 `data/cover-arweave-map.json` 的旧 txId；**不符就停**（说明表被别人动过，需要人看）。
3. 断言 `cover-uris.json` 正好 600 项、txId 互不相同、都不在现表里。
4. 打印演练：将插入的前 3 行与最后 1 行（txId、created_at），将删除的 100 个 id。

### B5 写生产库（最新授权：单事务）

**本节为实际执行流程，覆盖旧版“分多次PostgREST请求、不用事务”的历史方案。不得再按旧的先插请求/再删请求操作。**

前置条件：600 JPG全部完成双网关MIME/哈希核验；账本、600唯一txId、旧100行及旧txId集合均通过。第一次运行生成不可覆盖的`score-covers-before.json`；正式执行必须已有成功演练记录。

1. 默认命令执行完整事务演练：`BEGIN`，设置`lock_timeout='10s'`，对`public.score_covers`取`EXCLUSIVE`锁。它仍允许普通SELECT，阻止与取封面RPC的`SELECT FOR UPDATE`竞争，避免锁顺序冲突。
2. 锁后再次断言正好100行，并逐项对比演练快照的`id/ar_tx_id/created_at`；只允许`usage_count`自然变化。任一静态差异立即抛错回滚。
3. 在同一事务中插入600行：`usage_count=0`、`created_at=T0+order秒`，然后只按快照100个id删除旧行。不存在空池对外可见的窗口。
4. 仍在事务内断言：正好600行，txId集合与按created_at排序的完整序列严格等于`cover-uris.json`的1–600轮转序。任何断言失败都会中止整笔事务，不留下部分替换。
5. 演练以`ROLLBACK`结束，再读全表与演练前完全一致，保存`data/p23/review/write-dry-run.json`。默认演练拒绝覆盖已有before快照。
6. 前置条件仍满足时，运行同一脚本加`--execute`，使用相同锁与断言，最后`COMMIT`。随后独立读回600集合、顺序与使用量，写`score-covers-after.json`的`phase=verified`。
7. 任何响应结果未知时先读回，不能猜测事务未提交后直接重发。正式执行发现当前已600行时会拒绝按旧100方案再次替换。

本夜实际结果：演练ROLLBACK后旧100完全不变；正式COMMIT后读回600、顺序完全一致、usage当时全0；无回滚。已铸Score metadata与永久资源不动。

**显式恢复工具**：`write-covers.ts --rollback`先演练，加`--execute`才提交。恢复也取EXCLUSIVE锁、在一笔事务内按快照补回缺失旧行（已存在旧行保留最新usage），确认旧100都在后，只删除本批`usage_count=0`的新行；已被自然铸造取用的新行保留。恢复不是日常重跑命令，应在明确决定恢复时使用。

历史说明：旧计划的两次PostgREST插入/删除是为避免空池而设计；本夜按最新授权改用整笔事务，已经不再采用。

### B6 线上只读验证

1. 只读查“下一张会分配的封面”：`select ar_tx_id from score_covers order by usage_count, created_at limit 1`（不加锁）应等于“按当前 `usage_count`、`created_at` 排序的第一行”（夜里没人铸造时就是 order 1 的 txId；有人铸造则以当前排序为准，报告里写明）。
2. `https://arweave.net/<该 txId>` 返回 `image/jpeg`。
3. **不触发真实铸造**（花钱、占运营钱包）；第一张新铸 Score 的封面留给用户日后自然验收，也作为 C 线（Semi 纯绿）的第一个样本。

### B7 收尾

- 按文件 stage 并提交：`scripts/p23/`、`.gitignore`、`data/p23/` 下的 5 个 json、`playbook/phase-23/`、`TASKS.md`、`STATUS.md`、`docs/JOURNAL.md`。**不要 `git add src` / `git add -A`**；`data/p23/cover-pool|cover-masters|review` 不入库。
- TASKS 勾掉 B 线、STATUS 与 JOURNAL 写结果（替换了哪些、上传前后余额、写库前后行数、是否回滚）。
- 夜间报告（`05-night-report.md`）B 线一节写清楚证据路径。

## 8. Turbo 费用与余额（2026-11-14 只读核实）

- **余额**：534,433,397,055 winc ≈ **\$2.63**（P22 上传前的 10-30 实测为 536,146,205,390，差额 1.71e9 与 P22 里那张 118KB 图的报价 1.65e9 基本吻合，说明当时只有它被收费、其余走了免费档）。
- **报价**（按 \$73.08/GiB 折算，600 个文件分批查询）：
  - **全额付费**：764,843,481,319 winc ≈ **\$3.76** → **不够，缺约 \$1.13**。
  - **只付 >105KiB 的 216 张**：435,933,366,416 winc ≈ \$2.14 → 够，余 \$0.48。
- **免费档不能指望覆盖那 384 张**：Turbo 免费档是“单个文件 ≤105 KiB，且每个钱包**终身累计 10 MiB**，不重置”（来源见下）。这 384 张合计 22.5 MiB，即使额度一点没用过，也最多 10 MiB 免费，其余约 12.5 MiB 仍要付费；而这个钱包以前传过音效、封面、P14/P22 素材，已用掉多少未知。**当前 SDK（1.41.0）没有 `getFreeStatus`，查不到剩余额度。**
- **结论**：最好情况（10 MiB 全免）约需 **\$3.0**，最坏情况（额度已用完）约 **\$3.76**，余额 \$2.63，**都不够**，缺约 \$0.4–1.1。需要给 Turbo 钱包充值（`scripts/arweave/topup-turbo.ts`，用 Base ETH 换 credits）。建议充到可用余额 ≥ \$5（留出日常铸造的 Arweave 上传，约 \$0.002/张）。**充值是花钱动作，需用户批准。**（→ 已于 2026-11-14 批准并完成，见本节末。）
- 若不想充值：把池压到约 ≤34MiB（均值约 58KB），例如 q75 或 700px；会损失画质，不推荐。
- 来源：turbo-sdk PR #526（免费上限 105 KiB）、PR #535 及相关 Turbo 文档（10 MiB 终身额度，按钱包和子网累计）。
- **2026-11-14 已充值**（用户批准并转入 0.002 ETH 到 Turbo 钱包 Base 地址 `0xD9AE…4582`）：`scripts/arweave/topup-turbo.ts 1800000000000000` 充 0.0018 ETH，交易 `0x340287a45c2d9b6adac64232822109221e3c3ad962a9ae3297d28dd81f07e3af`（Base，confirmed）。Turbo 余额 534,433,397,055 → **1,279,968,307,778 winc（约 \$6.29）**，是最坏报价的 1.67 倍；Base 上留约 0.0003 ETH 作 gas。夜间任务**不得再充值**。

## 9. 2026-11-14 夜间执行结果

B0–B7已完成：600 JPG检查与逐张总览目验通过，无替换；余额1,279,968,307,778→618,378,244,996 winc，600文件均只上传1次；600/600双网关哈希/MIME核验通过。按最新授权覆盖本文B5旧的非事务方案：显式生产ref、EXCLUSIVE表锁、逐项核对旧池静态字段，完整插600/删100/顺序断言ROLLBACK演练通过后，单事务COMMIT，生产读回600且轮转序一致。无回滚，不动已铸metadata。下一张当时为order1/A-001.jpg，独立200 image/jpeg。工具c59dc45、生产账本6a8692e；完整证据和恢复命令见`05-night-report.md`。C由主代理按最新授权只读取证，尚未恢复显示，详见同报告。
