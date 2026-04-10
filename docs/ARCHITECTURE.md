# Ripples in the Pond — 技术架构

> **本文件是项目的"形状和意图"，不是代码模板。** AI 写代码时不要把这里的字段名或接口签名当成必须照抄的规范——那些细节由每个 step 现场决定。
>
> 如果你来读这份文件是为了"我现在该怎么写代码"，**走错了**——去读 `playbook/phase-0-minimal.md` 当前 step。
>
> 本文件存在的理由：让 AI 在做技术决策时知道**项目要去哪里**，不至于在 Phase 0 写出会被 Phase 3 推翻的代码。
>
> 实际版本以 `package.json` 为准。当前：Next.js 16 + React 19 + TypeScript 5 + Tailwind 4。

---

## 一、产品定位

一位艺术家用两年时间，将 108 首音乐逐周刻进区块链。每位用户可与艺术家合奏，并将生成的音乐永久存储进自己的钱包。

### 核心体验路径

```
首页 = 全屏乐器 + 群岛
  → 随时按 A-Z 键触发音效 + 视觉反馈（无需登录，纯玩）
  → 点击岛屿 = 播放背景曲 + 自动开始录制（用户无感）
  → 曲子播完 / 点停止 → 提示"你的创作已记录，24h 可铸造"
  → 草稿存 localStorage（不需要登录）
  → 岛屿上方爱心 = 收藏 = 触发铸造（此时才需登录）
  → 个人页：收藏列表 / 草稿倒计时 / 空投开箱
```

**用户全程不需要 ETH / AR / 签名。甚至不需要登录就能体验合奏。只有铸造/收藏时才需要登录。**

### 三大模块

| 模块 | 说明 |
|---|---|
| 聆听 | 108 首音乐 × 群岛结构，爱心收藏 = 铸造素材 NFT |
| 共创 | 首页即乐器，按键合奏 + 无感录制 → 乐谱 NFT |
| 重组 | 每 36 首 AI 再创作，空投参与者 |

---

## 二、技术栈

详见 `docs/STACK.md`（白名单 / 黑名单 / 灰名单 / Phase 演进）。本文件不重复。

---

## 三、核心架构决策（"形状"）

### 决策 1：用户零钱包负担 = 运营钱包代签 + 队列异步铸造

```
用户点击 → API 写一条 mint_queue 记录 → 立即返回成功
                                          ↓
                                  Vercel Cron 每分钟取一条
                                          ↓
                                  运营钱包发交易付 Gas
                                          ↓
                                  写 mint_events
```

**为什么**：
- 用户无需持有 ETH，无需在弹窗里签名 — 像 web2 一样
- API 不等链上确认 → 用户感觉极快（乐观 UI）
- 串行处理 → nonce 不会冲突
- 失败可重试 → 偶发 RPC 抖动不影响用户

**约束**：API Route（除 `cron/` 外）禁止 `await waitForTransactionReceipt`。这条由 hook 强制。

### 决策 2：合约权限用 allowlist，不用 onlyOwner

热钱包私钥泄露时，攻击者最多 mint 没价值的 NFT，**不能改 allowlist 本身**。

### 决策 3：合约部署在 OP（Optimism）+ 护栏简化

**链选择**：OP Mainnet（生产）+ OP Sepolia（测试）。**不部署到 Ethereum L1 主网**。

**为什么 OP**：
- 单笔铸造成本约 ETH 主网的 1/8（~$0.10 vs ~$0.78）
- gas 几乎不会突然飙升（OP L2 gas 极少波动）
- EVM 等价：合约代码、Foundry / viem / Privy / OpenSea / ERC-6551 Registry 全部不变
- 安全性等同 ETH 主网：OP 是 Optimistic Rollup，最终结算到 L1，不是侧链
- ERC-6551 Registry 已部署到 OP（链上地址全网统一）

**护栏简化**：
- ❌ 删除"全局每日 mint 上限"：OP 上烧不出灾难，daily limit 失去防爆火意义。`MaterialNFT` 合约里**不写**这个机制
- ❌ 删除"gas price guard"：OP gas 不飙
- ✅ 保留 **allowlist**：与链无关的安全模型，热钱包泄露限制损失（决策 2）
- ✅ 保留 **balance alert**：cron 每小时检查运营钱包余额，< 0.05 OP-ETH 时 Telegram 告警

**未来扩展**：如果需要"产品意义上的限量发售"（每天 N 张创造稀缺感），可以在**应用层**（API Route 或 Supabase）实现，不要写进合约——应用层规则可改，合约规则不可改。

### 决策 4：数据库按 Phase 递增建表

不在 Phase 1 就建 12 张表。每个 Phase 只建那个 Phase 真正用到的表：

- **Phase 1**：tracks / users / mint_queue / mint_events（4 张）
- **Phase 2**：+ sounds / pending_scores
- **Phase 3**：+ score_covers / airdrop_events / chain_events / system_kv
- **Phase 4**：扩展 users 加社区登录字段

字段约束的具体 SQL 由各 Phase 的 playbook step 现场决定。

### 决策 5：Privy JWT 直接使用，不自建 JWT

后端用 `@privy-io/server-auth` 验证 token。Phase 4 引入社区钱包时再加自签 JWT 双验证。

### 决策 6：乐谱 NFT 数据自包含 + "母 NFT 装子 NFT"结构

**结构**：
- ScoreNFT (ERC-721) 是**母 NFT**。它的"脸"是封面图（metadata.image），它的"灵魂"是合奏数据（events.json，存在 metadata.animation_url 或 attributes 里）
- ScoreNFT 配套一个 ERC-6551 TBA（智能合约账户）
- TBA 里"装着"几个 MaterialNFT (ERC-1155)：1 份底曲 + N 份音效。这些是**子 NFT**
- ScoreNFT 转手 → TBA 跟着转手 → 子 NFT 跟着转手

**澄清两个常见误解**：
1. **封面图不是单独的 NFT**——它是 ScoreNFT 的视觉外观（PNG 文件），不是一个独立 token
2. **乐谱不是子 NFT**——乐谱是一段 events JSON，描述"哪个键在第几毫秒按下、用了哪个 sound"。它**就是**母 NFT 的内容，不是装在母 NFT 里的另一个 token

**回放数据的 4 层冗余**：
1. Arweave 主网关
2. Arweave 多网关 fallback（决策 9）
3. 我们的 Supabase `mint_events.score_data` 自包含拷贝
4. OP 主网上的 tokenURI 字符串（永远在，但不可读取内容；OP 数据最终结算到 ETH L1，不灭）

`pending_scores` 24h 过期不影响已铸造乐谱的回放——铸造时数据已被复制到 `mint_events.score_data`。

### 决策 7：ERC-6551 设 fallback 开关

ERC-6551 是未定稿标准，是最大技术赌注。代码中 TBA 逻辑隔离到可关闭模块。如果标准变更或实现有 bug，乐谱 NFT 退化为普通 ERC-721，核心体验不受影响。

### 决策 8：所有"原料资源"预上传 Arweave + 复用

**预上传一次，永远复用**：
- 26 个音效 mp3（tokenId 109-134）
- 108 首底曲 mp3（每周上架时一首）
- 10,000+ 张封面图（HashLips 预生成 → Turbo SDK 批量 → score_covers 表，按 usage_count 升序分配）
- score-decoder.html（见决策 13）

**每次铸造真正"新增"的 Arweave 内容只有 2 个**：
- `events.json`（~3 KB，这次合奏的按键时间序列）
- `metadata.json`（~500 B，索引卡，指向 cover/events/decoder 的 ar:// 地址）

每次铸造的 Arweave 增量成本 ≈ **$0.002**，不是 $15。

### 决策 9：Arweave 多网关 fallback

合约存 `ar://txid`（不绑定特定网关）。`src/lib/arweave.ts` 维护多个网关，主网关失败自动切换。

### 决策 10：Vercel Cron 而非独立 Worker（Phase 1-3）

一个人项目减少运维。用户量大了再迁移到 Railway/Fly.io（见 `docs/HARDENING.md` 里程碑 B1）。

### 决策 11：ISR 缓存 tracks

数据库故障时浏览仍可用。

### 决策 12：合约升级 = allowlist 切换，不用代理模式

部署新 Orchestrator → allowlist 加新地址 → 移除旧地址。简单、可审计、零状态迁移。

### 决策 13：Score Decoder 是 Phase 3 核心组件，不是退出工具

**它是什么**：一个**单文件 HTML 播放器**（约 50-100 KB），上传 Arweave 一次，所有 ScoreNFT 通过 URL 参数共用同一个 decoder 地址。

**用户的比喻**："网页唱片机，每个人都可以带着自己的唱片去播放"。

**机制**：
```
ScoreNFT #42 的 metadata.animation_url:
  ar://Qm....decoder.html?events=ar://Qm....events-42.json&base=12

OpenSea 看到 animation_url 是 HTML
  → 自动用 iframe 嵌入这个 decoder
  → decoder 读 query 参数里的 events.json + base track id
  → 调用 26 个音效 mp3（也都在 Arweave 上）按时间序列播放
  → 用户在 OpenSea 直接听到合奏
```

**为什么必须 Phase 3 就做**（不能拖到退出阶段）：
- 没有 decoder = OpenSea 上的分享卡只有图无声 = 损失 50% 病毒传播力
- 微信/Twitter 分享时 OG 卡片只能展示封面，无法预览内容
- decoder 同时是"永久可复现"承诺的兑现：项目结束时把 HTML 开源到 GitHub，任何人能脱离 108cyber.xyz 独立播放

**成本**：HTML 一次性上传 ~$0.05，之后无增量。比"每张唱片渲染一个 mp3 上传 Arweave"（每张 ~$15）便宜 7500 倍。

---

### 决策 14：首页即乐器（Patatap 融合）

**首页不是"导航到合奏页"的入口，首页本身就是乐器。** 岛屿群和键盘乐器共存于同一个页面。

- 一进来就能按 A-Z 触发音效 + 视觉反馈，零门槛
- 没有 `/jam/[trackId]` 路由，不跳转
- 参考实现：`references/patatap/`

**为什么**：Patatap 的设计哲学——打开即玩，没有学习成本。用户不需要理解"合奏"是什么功能，按键盘就有反馈。

### 决策 15：无感录制（播放即录制）

用户不主动"开始录制"。**点击岛屿播放背景曲 = 自动开始录制。** 曲子播完或点停止 = 录制结束 → 弹出提示"你的创作已记录"。

- 没播放背景曲时：按键只触发音效，不录制
- 录制全程用户无感知，结束后才告知
- 上限不变：60 秒 / 500 事件

**为什么**：消除"我要不要录"的决策负担。让创作自然发生，而不是刻意启动。

### 决策 16：收藏 = 铸造（爱心按钮）

用户看到的是"收藏"（岛屿上方的爱心），背后触发的是 NFT 铸造。

- "铸造"对普通用户陌生，"收藏"所有人都懂
- 点击爱心 → 变红 → 未登录则触发 Privy 登录 → 登录后自动铸造
- 不点爱心 = 不铸造 = 不需要登录，完全 OK

### 决策 17：草稿存 localStorage，登录后上传

录制结束后草稿立即存浏览器 localStorage（附时间戳），不需要登录。

- 刷新页面 / 关浏览器 / 重启电脑：**不丢**
- 清浏览器缓存 / 换设备：**会丢**（即兴创作场景可接受）
- 用户点收藏/铸造 → 登录成功 → 自动从 localStorage 取出草稿上传后端
- 24h 过期由前端根据时间戳计算

**为什么不存服务端**：不需要匿名用户机制，不改后端，零延迟。

### ⚠️ AI 编码约定（不可绕过的硬约束）

上面 12 条决策是项目的**形状骨架**，AI 在写代码时不允许默默偏离：

1. **不容妥协**：如果某条决策在当前 step 无法实现，**立刻停下来告诉用户**，不允许"绕一下"或"先这样以后再改"。
2. **细节自由**：决策不规定字段名 / 函数签名 / SQL 列类型 / 目录布局。AI 现场按 PostgreSQL / Solidity / Next.js 标准写法决定，不需要找文档求证。
3. **冲突上报**：如果决策之间出现矛盾（比如 Phase 1 的某个需求看起来必须 await 链上确认才能完成），**立刻停下来告诉用户**，让用户更新决策或调整需求。
4. **决策即铁律**：本文件的 trade-off 速查表（第十二节）是争议解决依据。当用户和 AI 对某个实现方式有分歧时，先翻速查表看决策原始理由。

---

## 四、合约（设计意图，不是代码）

### MaterialNFT — ERC-1155
- tokenId 1–108 = 音乐，109–134 = 音效
- allowlist 权限模型
- **不写** daily mint limit（决策 3 已说明：OP 上没必要）
- 函数签名由 Phase 1 / Phase 2 写代码时决定

### ScoreNFT — ERC-721
- tokenId 自增
- 仅 MintOrchestrator 可调用 mint
- Metadata 必须 OpenSea 兼容（`image` / `animation_url` / `external_url` 三件套）
- `external_url` 指向公开回放页 `/score/[tokenId]`，分享时微信/Twitter 自动展示封面

### MintOrchestrator
- 编排合约：一次调用完成 ScoreNFT.mint + ERC-6551 TBA 创建 + 素材 NFT 转入 TBA
- ERC-6551 fallback：TBA 模块可一键关闭，退化为普通 ERC-721

---

## 五、API 端点一览

请求/响应字段、TS 类型、错误码 → 由各 Phase 写代码时现场决定。

### 公开
- `GET /api/tracks` — 素材列表（ISR 1h，DB 故障时返回缓存）
- `GET /api/score/:tokenId` — 公开乐谱数据
- `GET /api/artist/stats` — 发布进度 / 总铸造数
- `GET /api/health` — Supabase + RPC + 余额检查

### 需鉴权（Bearer JWT）
- `POST /api/mint/material` — 写队列 → 立即返回 `{ mintId }`
- `POST /api/mint/score` — 写队列 → 返回 `{ mintId, coverUrl }`
- `POST /api/score/save` — 暂存乐谱（24h TTL）
- `GET /api/user/nfts` — 已铸造 + 待铸造 + 进行中
- `POST /api/auth/community` — Phase 4

### Cron（带 CRON_SECRET）
- `process-mint-queue` — 每 1 分钟，串行铸造
- `sync-chain-events` — 每 5 分钟，从 last_synced_block 拉日志
- `check-balance` — 每小时，热钱包 < 0.1 ETH 或队列 > 50 时告警

---

## 六、前端体验关键点

### 首页 = 全屏乐器 + 群岛（决策 14）
首页融合两个身份：Patatap 风格键盘乐器 + 群岛浏览。
- 随时按键有音效+视觉反馈，零门槛
- 岛屿群展示曲目，点击播放背景曲
- 深色背景，沉浸式体验

### 群岛（渐进式生长）
1首→孤岛 / 2-5→散落 / 6-36→岛群 / 37-72→双岛群 / 73-108→完整群岛
颜色=情绪，大小=铸造热度。
**岛屿上方爱心 = 收藏/铸造**（决策 16）。

### 合奏 + 无感录制（决策 15）
按键 = 音效叠加在背景曲上 + 视觉反馈。
播放背景曲 = 自动开始录制 → 播完/停止 → 提示"已记录"。
Phase 2 spike 已验证 Web Audio 可行（commit `da9210d`）。

### 收藏（乐观 UI）
爱心变红 → 立即"收藏成功" → 后台铸造
**只有彻底失败才弹通知**（极低概率）

### 24h TTL 可视化
草稿存 localStorage，个人页显示倒计时。
过期 = 沉入海底动画（不是静默删除）。

### 底部播放条
固定底部，显示当前曲目 + 进度条 + 停止按钮。
播放中 = 录制中（用户无感）。

### 公开回放页 `/score/[tokenId]`
任何人可访问。OG meta tags 三件套。数据来源 `mint_events.score_data`，灾备链路 = 链上 tokenURI → Arweave。

---

## 七、认证

**Launch（Phase 1-3）**：Privy JWT 直接验证。后端 `privy.verifyAuthToken(token)` → userId + wallet.address。

**Future（Phase 4）**：社区钱包 → 代理登录 → 拿 evm_address → 签发本站 JWT。后端先 Privy 验证 → 失败再自签验证。社区 API 5 秒超时降级。首次后 evm_address 入库，后续不再依赖社区 API。

---

## 八、Arweave + 封面 + 成本结构

**Arweave**：用户无感，后端全包。Turbo SDK 信用卡支付，无需 AR 代币。`src/lib/arweave.ts` 多网关 fallback。

**封面**：HashLips 预生成 10,000+ 张 → Arweave 上传 → score_covers 表。铸造时 `ORDER BY usage_count ASC LIMIT 1 FOR UPDATE SKIP LOCKED`，允许复用。

### 真实成本分布（按决策 8 复用机制后）

**一次性投入**（项目启动前完成）：

| 资源 | 估算成本 | 复用次数 |
|---|---:|---|
| 26 个音效 mp3 上传 | ~$2-5 | 永久复用 |
| 10,000 张封面图上传 | ~$20-30 | 复用直到用完 |
| 108 首底曲 mp3 上传 | ~$15-20 | 一次性 + 每周新增 1 首 |
| score-decoder.html 上传 | ~$0.05 | 永久复用 |
| **一次性合计** | **~$40-55** | |

**每张 ScoreNFT 增量成本**（部署在 OP Mainnet）：

| 项 | 成本 |
|---|---:|
| Arweave 新增（events.json + metadata.json）| ~$0.002 |
| Gas（OP 典型，~561k gas，含 L2 execution + L1 data fee）| ~$0.10 |
| **每张合计** | **~$0.10** |

> 范围：OP 上典型成本 $0.05-0.30，受 L1 拥堵程度影响。极端情况（L1 大爆发时）可能触及 $0.50。

### $500 预算能 mint 多少张

```
$500 - $50（一次性 Arweave 资产）= $450 动态预算
$450 / $0.10 ≈ 4500 张（典型）
$450 / $0.30 ≈ 1500 张（L1 拥堵时）
```

**预算瓶颈消失**：OP 上 $500 够整个项目使用还有大量富余。这是 daily mint limit 和 gas price guard 都被降级为"可选"的根本原因（决策 3）。

---

## 九、运营成本预算

```
== 免费 ==
Vercel Hobby + Supabase Free + Alchemy Free + Privy Free   $0

== 必须付费 ==
域名                $12/年
香港反代服务器       $5-20/月（国内访问）
ETH Gas             $50-200/月（合约每日上限控制上界）
Arweave             ~$35 一次性

== 月均（初期）==
$55-220/月

== 用户增长后升级路径 ==
Vercel Pro $20/月 / Supabase Pro $25/月 / 独立 Worker $5/月
```

详细演进路线见 `docs/HARDENING.md`。

---

## 十、退出策略

**低成本维持模式**（推荐）：
1. 铸造切换为"用户自付 Gas"（前端连钱包签名，传统 dApp）
2. 停掉运营钱包 / Worker / 付费服务
3. 保留 Vercel Hobby + Supabase Free
4. 运营成本 → $0

**Score Decoder**（已在决策 13 提升为 Phase 3 核心组件，本节只是兑现"永久可复现"的最后一环）：
- 项目结束时把 score-decoder.html 开源到 GitHub
- 任何人可独立部署，输入 ScoreNFT tokenId → 从 Arweave 读 metadata → 用 Web Audio 回放
- 即使 108cyber.xyz 关站，所有 ScoreNFT 仍可被任何人复现

**数据永久性**：Arweave（音频+Metadata）+ OP Mainnet 合约（最终结算到 ETH L1）+ Score Decoder（开源）= 完整复现，不依赖任何中心化服务。

---

## 十一、Phase 路线图

### Phase 0 — Minimal Closed Loop（当前）
1 笔 mint 上链。详见 `playbook/phase-0-minimal.md`。

### Phase 1 — MVP
数据库 4 张表 / MaterialNFT 部署 **OP Sepolia** / 单岛屿 + 首次引导 / 单曲播放 + 底部播放条 / Privy 登录 / mint API + Cron / 个人页基础版 / 端到端测试

### Phase 2 — 首页融合合奏
Patatap spike ✅ / 首页 = 全屏乐器 + 岛屿群 / 无感录制（播放即录制）/ 爱心收藏 = 铸造 / localStorage 草稿 + 24h TTL / 个人页草稿倒计时

### Phase 3 — 乐谱 NFT + 封面 + 分享
封面预生成 / ScoreNFT + MintOrchestrator / ERC-6551 TBA（含 fallback）/ mint_events.score_data 自包含 / **score-decoder.html 上传 Arweave**（决策 13）/ 公开回放页 + ShareCard / 唱片架 / 链上事件同步

### Phase 4 — 社区钱包 + 空投
社区 API 封装 / 自签 JWT 双验证 / 艺术家页面动态化 / 空投开箱 / 余额告警 + 健康检查

### Phase 5 — OP 主网 + 安全 + 退出准备
**OP Mainnet 部署** / 冷热钱包分离 / 私钥环境隔离 / 香港 Nginx 反代 / 安全审计 / Score Decoder 开源到 GitHub（Phase 3 已上 Arweave，这里只是开源代码）/ 低成本维持模式开关

---

## 十二、关键 trade-off 速查

| 决策 | 选了 | 没选 | 理由 |
|---|---|---|---|
| 队列处理器 | Vercel Cron | 独立 Worker | 一个人项目，减少运维 |
| 认证 | Privy JWT 直接 | 自建 JWT | 减少一半复杂度 |
| 合约权限 | allowlist | onlyOwner | 私钥泄露损失更小 |
| Mint 上限 | 全局每日 | 用户每日 | 防爆火烧 Gas |
| 数据库 | 按 Phase 递增 | 一次建全 | 不背没用的字段 |
| Mint UI | 乐观 UI | 等链上确认 | 用户秒级反馈 |
| 封面 | HashLips 预生成 + 复用 | 每张独一无二 | 永远不会用完 |
| 乐谱数据 | mint_events 自包含 | 外键依赖 pending_scores | 数据可永久回放 |
| TBA | ERC-6551 + fallback 开关 | 强制使用 ERC-6551 | 标准未定稿的赌注隔离 |
| 缓存 | ISR tracks | SSR | DB 故障时浏览可用 |
| 退出 | 用户自付 Gas + Score Decoder | 关站 | 兑现永久可复现 |
| Patatap | Phase 2 前 1 天 spike ✅ | 直接集成 | 2014 年库的集成风险隔离 |
| 合奏页面 | 首页融合（决策 14）| 单独 /jam 路由 | 零跳转，Patatap 设计哲学 |
| 录制触发 | 无感自动（决策 15）| 手动点击 | 消除决策负担 |
| 铸造入口 | 爱心收藏（决策 16）| "铸造"按钮 | 用户理解零成本 |
| 草稿存储 | localStorage（决策 17）| 服务端匿名 session | 简单、不改后端 |
| Arweave 资源 | 26 音效 + 10000 封面 + 108 底曲全部预上传复用 | 每次铸造重新上传 | 单张成本 $15 → $0.002 |
| 合奏播放 | score-decoder.html 一次性上传 + URL 参数 | 每张渲染独立 mp3 | 成本 $15/张 → $0.05 一次性 |
| 部署链 | OP Mainnet（L2）| Ethereum L1 主网 | 单笔成本 $0.78 → $0.10；gas 不飙；安全性等同 |
| 限量护栏 | 应用层（API/DB）软限制 | 合约硬编码 daily limit | 应用层可改，合约不可改 |

---

## 十三、AI 阅读须知

**写代码时**：本文件给你"项目去哪里"的方向感，但**不要把字段名/接口签名当模板照抄**。具体代码以当前 playbook step 的 🤖 执行指引为准。

**做技术决策时**：先看本文件第三节"核心架构决策"，再看 `docs/STACK.md`，再看 `docs/CONVENTIONS.md`。三者冲突时按 `AGENTS.md` §9 解决。

**发现矛盾时**：立刻告诉用户，让用户决定改哪一份。**不要默默偏向某一份**。
