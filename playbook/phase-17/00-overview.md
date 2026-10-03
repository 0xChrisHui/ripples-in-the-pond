# P17 — 35 首原曲永久收藏与曲目馆

> 制定日期：2026-10-02。状态：执行计划，尚未据此开发、部署或铸造。
> 本次仅编写 Markdown；不得据此启动功能开发、提交、stash、建立 worktree 或修改架构。
> 后续夜间执行必须先进入[总控](../parallel-2026-10/00-orchestration.md)，遵守[共享合同](../parallel-2026-10/10-shared-contracts.md)、[启动提示词](../parallel-2026-10/20-launch-prompts.md)与[共同验收](../parallel-2026-10/30-acceptance.md)。

## 1. 用户可验收的结果

1. 首页“艺术家”旁有“曲目”入口，打开后能逐首选择 35 首原曲并聆听。
2. 每首曲目有真实曲名/编号、创作手记状态、永久音频来源、链上凭证和收藏入口。手记由用户以后提供，缺失不编造。
3. 外部链上地址登录可选 OP 或 Ethereum；SEMI 社区身份、邮箱登录沿用 OP。每次明确展示接收地址和付款方式。
4. 单曲公开页采用 `/score/material/[chainId]/[contract]/[tokenId]`，延续现有唱片体验；原 Score 链接继续有效。
5. 35 首原曲在 OP、Ethereum 两条生产链分别完成留存，总计 **70 个“曲目 × 网络”验收项**。每项必须有真实合约、永久 metadata、指定接收地址及已确认 mint 证据。
6. 曲目页与 P13 提交给 SEMI 的合约/单曲清单来自同一份资产目录、同一个 `revision`。SEMI 播放实际验收归 P13。

“70 项”不是 70 份新合约，也不要求重复上传 70 份音频。推荐每链一份 ERC-1155 原曲合约，复用永久音频；已有且满足留存条件的 mint 直接计入。

## 2. 已核对的代码事实与 K0 重定位要求

本表记录当前工作目录的可见实现，不代表最终发布基线。编写时 `HEAD=3c5fa6f`，与本地缓存 `origin/main` 分叉 `15/155`；缓存并非实时远端结果。

| 事实 | 当前路径/符号 | 对实施的约束 |
|---|---|---|
| OP 原曲是 ERC-1155；`mint(to,id,amount,data)` 需要 `MINTER_ROLE` | `contracts/src/MaterialNFT.sol` | 不重新包装为 Score，不默认重部署 OP |
| URI 全局一次冻结 | 同文件 `uriFrozen`、`freezeURI` | 已冻结 URI 不能为新页面、手记或钱包适配而覆盖 |
| 原曲 metadata 的 `animation_url` 直接是 `ar://` 音频 | `scripts/arweave/material/upload-metadata.ts:metadataBuffer` | SEMI 应识别音频资源，不能只接受 HTML Decoder |
| 原曲编号约定为 `tracks.week`，素材收藏走异步队列 | `app/api/mint/material/route.ts:POST` | 保留既有 OP 身份/幂等路径，不把 ETH 写进旧队列 |
| 35 首本地母文件为 `public/tracks/No.1.mp3` 至 `No.35.mp3` | 同目录另有 `001.mp3` | 不能按目录文件数认定 35 首，不能混入 Track 36 或 36 段碎片 |
| `buildAssetId` / `parseAssetId` 硬编码 `erc721` | `src/lib/chain/chain-registry.ts` | 原曲使用新 typed 身份层，禁止把 ERC-1155 标为 ERC-721 |
| Score 多链路由首段目前名为 `[id]` | `app/score/[id]/[contract]/[tokenId]/page.tsx` | 新静态 `material` 子树与它并存，不重命名旧动态段 |
| 登录与付款选择已有 P16 实现 | `src/hooks/useAuth.ts`、`src/hooks/useEthereumScoreMint.ts` | 用最终 BASE 的实际接口，不机械照搬旧 P16 计划 |
| 播放器、Score 场景已有未提交修改 | `src/components/player/PlayerProvider.tsx`、`app/score/[id]/components/*` | 只读消费；共享改动由总控单写 |

P17-A0 必须在总控指定的最终 `BASE_SHA` 重新定位以上符号，给出路径、签名和文件 blob SHA。找到更新实现时沿用更新实现，禁止用本表对应的旧文件内容覆盖它。

## 3. 文件所有权

### P17 可写范围（仅在后续执行获得授权后）

- `src/lib/music-catalog/**`：唯一资产目录、schema、标准化、身份和公开选择器。
- `public/music-catalog/**`：由目录生成的公开 JSON，禁止手改。
- `src/lib/material-mint/**`、`src/features/material-player/**`、`src/features/material-catalog/**`。
- `src/data/material/**`、`src/components/music-catalog/**`。
- `app/tracks/**`、`app/score/material/**`、`app/api/music-catalog/**`、`app/api/material-mint/**`、`app/api/cron/reconcile-material-mints/**`。
- `contracts/src/p17/**`、`contracts/test/p17/**`、`contracts/script/p17/**`。
- `scripts/p17/**`；新 SQL 先写入 `scripts/p17/database/` 供总控分配迁移号。
- `playbook/phase-17/**`；本线状态、决定、证据使用下述统一交接路径。

### 只读和接线请求

| 文件/领域 | 单写者 | P17 的动作 |
|---|---|---|
| 全局 `STATUS.md`、`TASKS.md`、`JOURNAL.md`、架构、技术栈、规范、package/lock、部署配置、migration 序号 | 总控 | 在 handoff 提交精确修改请求，不能直接更新 |
| 现有 PondHeader、auth 文案、网络选择面板、`/me`、原 Score 视觉/ShareActions | P15；最终公共接线归总控 | 新曲目入口和公共视觉适配提交请求 |
| 第 36 枚访客独立运动/渲染模块 | P14-H | 不读写其可变状态，不复用其曲目 ID |
| `chain-registry`、`PlayerProvider`、PondGL/shared spheres/water | 总控 | 提交所需 API 和调用点，不先行修改 |
| `docs/integrations/semi/**` | P13 | 只提供目录及 commit/revision，不写第二份地址清单 |
| 现有 OP 原曲 API/worker | 默认只读复用 | 确需改动时先由总控确认独占文件，按差异移交，不能扩成队列重构 |

未来每条线只在总控交付的独立 worktree/branch 工作。worker 不在 `E:\Projects\nft-music` 脏目录开发，不自动创建第二个环境，不 cherry-pick 其他线任意 WIP。

## 4. 推荐产品与技术方案

- **OP**：保留现有 MaterialNFT 和冻结 metadata，沿用平台代付/后台队列。原部署记录中的地址只是审计线索，P17-A1 读链后才提升为 verified。
- **ETH**：经架构 Gate 批准后新增不可升级 ERC-1155 原曲合约，外部钱包自付 Gas、零额外 mint 价、服务端 EIP-712 凭证、订单防重放与正确接收地址校验。无需桥接，不扩展 P14 空投触发条件。
- **发行政策待确认**：OP 保留现有应用用户每曲一次语义。ETH 的每地址/每曲次数、转出后能否再次领取、发行总量尚未获产品确认；不默认“终身一次”，也不默认无限发行。只有明确确认后才实施相应合约字段、订单唯一约束和政策测试。未确认只阻断该政策定稿及依赖它的生产启用/不可变部署；页面、数据和通用安全实现继续，ETH 签发保持关闭。
- **永久内容**：优先逐字节复用已冻结的 35 份 metadata 与音频。新创作手记默认网站可更新，未确认前不塞进不可变 metadata。
- **页面**：先实现安静的唱片目录作为可运行候选；上午验收布局和文字气质。不开独立视觉研究/新技术栈。
- **公开播放**：使用真实单曲音频及已有唱片组件；不构造空 events 冒充 Score，不凭空产生 Token 或假链地址。

## 5. 执行图与早交付

```text
P17-A0 基线/边界 → A1 资产盘点 → A2 目录合同 C1 ─────────→ P13 开发
                         ├─ A3 架构提案/批准 ─→ C 合约 → D 订单
                         └─ B 永久资料复用 ───────────────┘
C1 + B 可读数据 → E 曲目馆/公开播放 → G 本地验收/接线交付
C/D/E 验收 + 外部授权 → F 测试网/主网/70项留存 → C2 → P13 正式导出
```

单个 P17 进程按 `A0 → A1 → A2 → A3 → B → C → D → E → F → G` 连续执行。某项缺真实授权/输入时写清 `external_pending`，立即执行其余独立步骤；不循环等待，不把测试替身称为完成。A3 未批准时可完成 B 的只读与本地部分、E 的目录/播放、F 的账本与 dry-run、G 的相应证据；不得开始 ETH 生产能力实施。

| 里程碑 | 必需内容 | 明确不代表 |
|---|---|---|
| **C1** | 可编译 schema/选择器、真实已知数据与显式缺失状态、规范化 revision、校验脚本；独立本地 commit SHA 发给总控/P13 | 不要求 70 项已铸；不代表 Mainnet ETH 已部署 |
| **code_ready** | 获授权部分代码及定向验证通过、可运行本地页面、具体公共接线请求 | 不等于完整双链功能已经上线 |
| **external_pending** | 缺少架构批准、手记、钱包签名、地址、预算、环境或 SEMI 接入的明确依赖 | 不得写“全部完成” |
| **C2** | 实际生产部署和数据重新核验，生成生产 revision 与对应 commit | 必须逐项说明 70 项 mint 是否完成；部署就绪和留存完成分开 |
| **archive_complete** | 70/70 真实留存证据，unknown=0；P13收到同 revision | SEMI 团队尚未验收时仍不可宣布 SEMI 已支持 |

C1/C2 是跨线交付名称；与本文档中 `P17-C01` 等合约 Step 编号不同。

## 6. 分册与夜间出口

| 顺序 | 文档 | 主要产物 |
|---|---|---|
| A | [基线、盘点与 C1](10-a-inventory-contracts.md) | 路径重定位、35 曲对应表、schema、架构提案 |
| B | [永久音频与 metadata](20-b-permanent-assets.md) | URI 解析、复用证据、上传恢复账本 |
| C | [Ethereum 原曲合约](30-c-ethereum-material.md) | ERC-1155、typed data、安全测试、部署 dry-run |
| D | [收藏与异步恢复](40-d-mint-pipeline.md) | OP 适配、ETH 订单/鉴权/凭证/对账 |
| E | [曲目馆与单曲播放](50-e-catalog-playback.md) | 35 曲目录、新公开路由、总控接线合同 |
| F | [双链留存与 C2](60-f-archive-release.md) | 70 项账本、测试网/主网 Gate、生产目录 |
| G | [验收与交接](70-g-acceptance-handoff.md) | 本线证据、可运行入口、待授权清单 |

所有执行状态、步骤结果、验证引用和非显然决定集中写 `reviews/evidence/parallel-2026-10/<runId>/p17-handoff.md`，不逐 Step 另写报告，不改全局看板。仅需机器可读输入、较大日志或安全追溯时，才按需附到 `reviews/evidence/parallel-2026-10/<runId>/p17/{inventory,catalog,contracts,pipeline,ui,archive}/`。后续分册以 `P17_EVIDENCE` 指代这一证据根，`P17_HANDOFF` 指代唯一 handoff；分册普通报告文件名是可选附件位置，不是必建清单。交易/永久上传账本以及权限、防重放、正确 recipient、事务和 unknown 恢复的安全证明必须保留，可引用已有可信记录，不得因简化报告删除。这些是未来产物路径，当前未生成、未验证。敏感账户资料只引用受控位置，不写入公开目录。

handoff 顶层状态只用总控规定的 `working / code_ready / integration_ready / external_pending / blocked`；C1、C2、archive_complete 另记为里程碑，不替代状态字段。

当前文档编写仅做 Markdown diff、链接与静态检查。未来执行统一遵守：

- **先复用再补差异**：先复用已有鉴权、linked-wallet 校验、钱包发送、账本与验证基础；各分册文件/脚本清单仅是职责定位建议。只有现有能力确实缺失才最小新增，不为凑清单造工具、拆文件或大重构；等效现有检查可替代示例命令。
- **按影响复用证据**：以相关源码、依赖/配置、目标数据和环境为判断依据，commit SHA 仅用于追溯。无关代码/文档提交或纯合并不使已通过证明失效；只重跑变化影响的断言。余额、权限等易变事实在真实发送前做必要的新鲜核验，不能用旧快照替代。
- **普通 Step 不跑全量**：只做直接相关静态检查/测试；只有路由、打包或部署风险确需构建时，由总控在 K2 集中构建一次。无此风险就跳过，不默认执行全仓 verify 或旧合约全回归。
- **P17 独占资产证明**：链上身份/URI、媒体与 70 项留存证明只由 P17 生成/维护，P13 默认按 revision 和资产坐标复用。相同永久资源只核验一次，后续只补缺失、变化或失效部分；P13 只做清单一致性与钱包特有兼容验收，不多线重验 70 项。
- **安全与附加资料分开**：合约、交易、数据库仍保留相关安全 Gate。collection 级附加 metadata 缺失不得阻断 35 首既有音频播放和目录交付；新不可变内容写入仍需相应权利与授权。
