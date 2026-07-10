# Phase 10 — 分享/海报 + 债务收口 + 后端安全修复（2026-07-05 重定稿）

> **来源**：2026-07-05 用户拍板重做 P10 计划，取代 `playbook/roadmap-P8-P16.md` 里的旧 P10 定义。
> **并行背景**：定稿时 P8 正在收尾、P9 即将启动（另 2 个进程负责）。本 Phase 刻意选了与首页视觉零耦合的范围，可与 P8/P9 并行推进。
> **文档同步**：STATUS.md / TASKS.md / roadmap-P8-P16.md 当时被 P8 收尾进程占用，口径同步延后到其收尾合并后统一做，**以本文件为 P10 权威定义**。

---

## 1. 范围（仅保留三块）

1. **Track A — /score/[id] 便捷转发 + 海报下载**
   - Twitter/X、微博、复制链接
   - 海报 / link 下载方案
2. **Track B — 后端安全修复**（来源：2026-07-05 后端整体 review，findings 已落盘 `reviews/2026-07-05-backend-review.md`）
3. **Track C — 债务收口**（历史"挂 P10"项重新分诊，见 §5）

### 子文档索引（分步执行手册）

| 文件 | 内容 |
|---|---|
| `10-a-share-poster.md` | Track A：分享转发（Twitter/X、微博、复制链接）+ 海报 / link 下载 |
| `20-b-backend-fixes.md` | Track B：后端 bug 修复（按 review 编号 P0/P1/P2/P3 + 合约 CT） |
| `30-c-debt.md` | Track C：债务收口（历史「挂 P10」重新分诊） |
| `../../reviews/2026-07-05-backend-review.md` | **findings 唯一来源**：全部 P0-1~P3-14 + CT-1~CT-15，带勾选框 |

### 明确移出 P10（2026-07-05 用户拍板）

| 移出项 | 原 P10 内容 | 归宿 |
|---|---|---|
| 小球数量 36→35 | A/B/C 三组 = 35×3 = 105 首 + 占位音频 | **待定**（用户后续排期） |
| 1 个特殊小球 | 可点击 + 预留混音接口 | **待定**（接口预留分析已完成，要点见 §6，实施时直接取用） |

---

## 2. Track A — /score/[id] 分享转发 + 海报

**现状**：`app/score/[id]/page.tsx`（Server Component）+ `ScorePlayer.tsx`（前端 inline 播放）+ `opengraph-image.tsx`（动态 OG 图已存在）。页面数据走 `src/data/score-source.ts`。

### A1 分享按钮组

- 位置：`/score/[id]` 页面（客户端组件，建议新建 `app/score/[id]/ShareBar.tsx`）
- 三个动作：
  - **Twitter/X**：`https://twitter.com/intent/tweet?text=...&url=...`（纯 URL 跳转，零依赖）
  - **微博**：`https://service.weibo.com/share/share.php?url=...&title=...&pic=...`（纯 URL 跳转，零依赖）
  - **复制链接**：`navigator.clipboard.writeText` + 降级（`document.execCommand` 或提示手动复制）+ 成功 toast
- 分享文案 / URL 口径：用生产域名 `https://pond-ripple.xyz/score/[id]`，文案含曲目标题
- 零新依赖、零新 API

### A2 海报 / link 下载

**启动时先拍板方案**（三选一，各有取舍）：

| 方案 | 实现 | 优点 | 缺点 |
|---|---|---|---|
| ① 复用 OG 图管线 | 新建 `app/score/[id]/poster/route.tsx` 用 `next/og`（ImageResponse，内置零依赖）出竖版海报 PNG | 服务端出图稳定、可含封面+标题+二维码+链接；与现有 opengraph-image 同技术栈同 `runtime='nodejs'`（无 Edge 顾虑） | 品牌中文字体需内嵌字体文件（走 system-ui 可回避） |
| ② 前端 canvas 合成 | 客户端 canvas 画海报 → `toBlob` 下载 | 无服务端成本 | 字体/跨域图片(封面在 Arweave)易踩 CORS 污染 canvas |
| ③ 只做 link 卡片 | 不出图，复制带 OG 的链接（分享平台自动展开卡片） | 最小实现 | 没有"下载海报"实体 |

**推荐 ①**（与 opengraph-image.tsx 同栈复用、封面预取降级逻辑可直接搬）。海报内容元素待用户定：封面、标题、作者、二维码（指向 /score/[id]）、Ripples in the Pond 标识。
二维码若需库（如 `qrcode`）→ **先查 docs/STACK.md 白名单，装包前必须报批**。

### A3 验收

- verify.sh 全绿（TS/ESLint/build）
- 浏览器实测：三个分享动作 + 海报下载 + 移动端布局
- X/微博真机贴链接验 OG 卡片展开

**红线**：不碰首页（Archipelago / pond-gl*）任何文件 → 与 P8/P9 零冲突。

---

## 3. Track B — 后端安全修复（按优先级）

### B1 🔴 P0 — mint/material tokenId 越权铸造

- `app/api/mint/material/route.ts:23` 只验 tokenId 是整数，不验曲目存在 → 任何登录用户可让运营钱包替他铸任意 tokenId（烧 gas + 铸出无效 NFT）
- **修法（2026-07-05 二次核验后修正）**：入队前查 tracks 表**存在性校验**（`week = tokenId` 有行）。⚠ **不做 published 校验**——收藏 `published=false` 曲目是现有正常功能（BottomPlayer 对任何在播曲目可收藏，B/C 组 week 16-36 全是 unpublished）；tracks 列表路由**不加** published 过滤（`getGroupTracks` B/C 组依赖 week 1-36 全量行）。细节见 `20-b-backend-fixes.md` P0-1/P1-2

### B2 🔴 P1 — 全库无 RLS

- 36 个 migration 无任何 `enable row level security`；安全押在"anon key 没被前端 import"一层纸上，`.env.example` 注释"权限受 RLS 限制"是假的
- **修法**：新 migration 给所有表开 RLS、不加 policy（service-role 不受影响，anon 归零）；改 `.env.example` 注释与事实一致
- **验收**：用 anon key 实测 SELECT 任意表返回空/拒绝；现有 API（全走 service-role）回归正常

### B3 🟠 P1 — mint / airdrop 老队列吸收 score 队列改进

- tx 广播歧义：RPC 超时可能已进 mempool，老队列一律 resetToPending → 重发双铸。对齐 score 队列的 `attempted_at` 时间窗方案
- pending tx 悬挂：确认逻辑取"updated_at 最老"会让僵尸行永久占队首 → 三条队列统一加终局处理（超时转 manual_review + 告警字段）
- airdrop 无 retry 上限 → 加上限 + 超限转 manual_review

### B4 🟡 P2/P3（本 Phase 内做，小改动）

- cron-auth：常量时间比较 + 生产禁用 `?secret=` query 参数
- JWT 校验 audience
- send-code 按手机号限流（现只有 fail-open 的 IP 限流 → 短信轰炸）
- `.env.example` 补齐 JWT/UPSTASH 等 6+ 缺失键（限流静默 fail-open 的根源之一）
- migration 编号冲突（两个 015/016、两个 030）整理 + `sounds` 表补建表 migration（对齐现实）
- setTokenURI 空字符串防御（cron 侧上传前校验 uri 非空，合约不动）

### 移交 P12（主网部署日 / 合约层，本 Phase 不做但登记）

- 部署脚本硬编码 `"(Testnet)"` 名称 / `ADMIN_ADDRESS` 静默回退热钱包 / DEFAULT_ADMIN 单步移交
- `MintOrchestrator.mintScore` 无链上幂等键
- **合约决策 gate（P12 前必须拍板，错过永久不可加）**：ERC2981 版税 / 供应上限 / 可升级性 —— 主网合约是重新部署，还有一次机会
- 低余额告警接邮件（依赖 Resend 接入，挂主网日）
- DB 备份预案（Supabase Free 无 PITR）

### B 线验收

- forge test 全过 + **verify.sh 补跑 `forge test`**（review 指出缺失）+ MaterialNFT 补最小测试
- 每条修复配 curl/SQL 实测记录，产出 `reviews/2026-07-XX-phase-10-backend-fixes.md`

---

## 4. 后端 review 发现固化（已落盘）

> 2026-07-05 后端整体 review 已落盘 **`reviews/2026-07-05-backend-review.md`**（4 条并行子代理逐文件通读：API+认证 / cron+链 / 合约 / DB+基础设施），带勾选框的完整清单 P0-1~P3-14 + 合约 CT-1~CT-15。§3 的 B1~B4 是按归宿的摘要，**逐条修复以 review 编号为准**。
>
> 原始结论：核心防双铸主线扎实（幂等键+UNIQUE+tx_hash 先落库+CAS+Redis 锁）、`/me/*` 无越权、私钥暴露面控制好；问题集中在 ① mint 越权链路（P0-1）② 老队列未跟上新队列改进（P1-3/P1-4/P1-5）③ 主网切换日集中爆发的运维欠账（RLS/备份/告警接线/env/测试）。
>
> **§3 摘要 ↔ review 编号对照**：B1＝P0-1+P1-2 / B2＝P1-1 / B3＝P1-3+P1-4+P1-5 / B4＝P2-1+P3-1+P3-2+P3-3+P2-7+P2-8+CT-7 / 移交 P12＝CT-1~CT-4+P2-3+P3-5。

---

## 5. Track C — 债务收口（历史"挂 P10"重新分诊）

> 背景：旧"挂 P10"标签来自 2026-05-13 四段拆分（当时 P10=主网部署）。2026-06-04 九段拆分后主网挪到 P12，这些标签一直没重分诊。本次按"现在能做 / 必须等主网日"切开：

### C-now（进本 Phase）

| 项 | 说明 |
|---|---|
| A16 heartbeat 接线 | operator-lock heartbeat 已实现但从未被 cron 长步骤调用（review 也标了）→ 接入 `steps-set-uri` receipt polling |
| 401 自动 logout | fetch wrapper（fetchWithAuth）统一处理 JWT 失效，替代各 caller 自行 catch |
| /score/[id] 链上灾备 | B8 P3 删 noop 后全押 Supabase → 与 Track A 同页施工，顺路做真 tokenURI fallback 或至少方案定稿 |
| 9 项 strict review P1（**SR-** 前缀） | ⚠ 与 backend review 的 P1-x 是两套编号空间，统一加 SR- 前缀引用；逐条归宿表见 `30-c-debt.md`（SR-P1-12/13 → P12；SR-P1-4 组 → P11；其余 now） |

### C-defer（登记去向，本 Phase 不做）

| 项 | 去向 |
|---|---|
| A5 换 Turbo wallet / A7 operator 主网 ETH / CRON_SECRET 轮换 / Semi 正式授权或切 SIWE / Resend 团队邮箱 / localStorage JWT→httpOnly 评估 | **P12 主网部署日清单** |
| A6 剩余 88 曲上链 | 运营长期（艺术家补曲） |
| 深度性能优化（bundle splitting / mobile LCP） | P12（roadmap 原口径） |

---

## 6. 特殊小球接口预留分析存档（移出项，实施时取用）

> 2026-07-05 已完成的架构调研结论，防止将来重查：

- 现状：球 ≡ track、点击 ≡ 播放，`SimNode`（`src/components/archipelago/sphere-config.ts:37`）无类型/角色字段；DOM 版与 GL 版（`pond-gl-test3`）共享该模型
- P14 混音（钱包地址+唱片hash→节拍→合成→RemixNFT）在合约/队列层是"再来一套 ScoreNFT"，特殊球不碰链上
- 预留 4 缝：① `SimNode.kind?: 'normal' | 'special'` ② 点击分发分支（`SphereOverlay.tsx` onUp / `SphereNode.tsx` onClick）③ 混音种子来源（稳定 hash + useAuth 钱包地址可取到即可）④ 注入点在 `getGroupTracks`/`buildGlNodes` 之后追加 + flag 门控默认关

---

## 7. 自检记录（2026-07-05 二次核验，对照真实代码）

已逐条核验并**为真**：`heartbeatOpLock` 全项目零调用（P2-2）/ cron-auth `===` 比较 + 无条件接受 query secret（P3-2）/ verify.sh 无任何测试环节（P3-4）/ `NEXT_PUBLIC_APP_URL` 生产在用但 .env.example 缺（P3-3）/ page.tsx 有 ShareBar 全部所需字段 / OG 卡片管线今天已通（nodejs runtime）/ `fetchTrackById` 零真实调用方（详情 404 化安全）。

核验后**修正**了 3 处（已同步进各子文档）：
1. P0-1/P1-2 修法：published 校验会砸 B/C 组收藏与建球（BottomPlayer.tsx:24 用 week 收藏任意在播曲目；getGroupTracks B/C 依赖 week 1-36 全量）→ 改为存在性校验 + 产品决策
2. 新旧 review 编号撞名 → 旧 strict review 编号统一加 `SR-` 前缀
3. 海报"Edge 顾虑"不存在（opengraph-image 实为 nodejs runtime）

---

## 8. 执行节奏 — 波次 + 停点（2026-07-05 用户确认的执行契约）

> **默认规则：不到 🛑 停点不停。** 波内逐条自动连续执行（每条 commit + verify.sh 全绿再下一条，AGENTS.md 铁律不变），修复细节不逐条请示。只有三种情况允许计划外停下：① verify 挂了且修不动（真阻塞）；② 发现 playbook 与现场冲突且影响方案本身；③ 要做 playbook 没写的破坏性/外部可见动作。

| 停点 | 时机 | 需要用户做什么 |
|---|---|---|
| **🛑 停点 0** | 开工前 | 一次性拍板：① P1-2 published 口径（默认建议：接受"非权限位"）② 海报方案①/②/③ + 尺寸 + 元素 + 二维码装包与否 ③ 顺序确认（默认 B1 先行、A/B 并行） |
| **🛑 停点 1** | Wave 1 末（B2 RLS 落库后） | 生产库全站抽查放行：首页 / 收藏 / 草稿 / /me / /score / cron 各点一遍；migration 由用户在 Supabase 生产执行 |
| **🛑 停点 2** | Wave 2 中（A2 海报出图后） | 视觉验收：从 2-3 版海报里挑/改；X/微博真机贴链接验卡片 |
| **🛑 停点 3** | Wave 3 末（清扫完） | 收尾验收 + 外部动作确认（cron-job.org 五个 job 全走 Bearer） |
| **🛑 停点 4** | P10 尾或 P12 前 | 合约决策 gate 打包拍板：ERC2981 / 供应上限 / 可升级性 / CT-4 幂等键分期 |

**波次内容**：
- **Wave 1**（自动连跑 → 停点 1）：B1 存在性校验 → P1-1 RLS（040）→ P1-3/P1-4/P1-5 队列三修（041/042）
- **Wave 2**（自动连跑 → 停点 2）：A1 分享按钮组全套 → A2 海报出图（出图即停）→ 验收后 A2.3 下载接线
- **Wave 3**（自动连跑 → 停点 3）：P2 批（P2-8 重命名方案**波内口头确认**后执行）→ P3 批 → C-now（401 wrapper / 灾备 / SR 小项）→ 合约 CT 脚本类（CT-1/2/3/5，不部署）
- **收尾**：backend-fixes review 文档 + STATUS/TASKS/roadmap 口径统一（等 P8 收尾进程合并后）

**波间协调**：每个 wave 开跑前确认用户 dev server 状态（verify 跑 build 与 `npm run dev` 共用 `.next` 会互踩——历史坑）。
