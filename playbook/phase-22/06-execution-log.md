# P22 执行记录

> 2026-10-30，分支 `feat/p22-score-pack`，全部本地提交，未 push、未部署、未写任何数据库。

## 已完成

| 步 | 状态 | 证据 |
|---|---|---|
| P22-0 查实与冻结 | 完成 | `01-chain-evidence.md`、`05-frozen-decisions.md` |
| P22-A 合约 | 完成 | `forge test` 128 全绿（P22 新增 35） |
| P22-C 服务端 | 代码完成，未联调 | 类型检查、ESLint、`scripts/p22/pack.test.ts` 通过 |
| P22-D 界面 | 代码完成，未目验 | `/score` 开通面板、`/me` OP 勾选框 |
| P22-E 可视化页 | 代码完成，未目验 | `/score/[chainId]/[contract]/[tokenId]/pack` |

## 用户决定（2026-10-30）

- **范围：只给用现行 33 个音效铸成的 Score 开包。** 用过旧版音频的 Score（如 ETH Token #1）不盘点旧音效，开包会被服务端以 MISSING_ASSETS 拒绝，属预期行为，不是缺陷。
- **ETH 用补开逻辑：** 不做"Score 确认后自动弹第二次钱包确认"，ETH 用户在 `/score` 页点"开通资产包"。OP 保持勾选后自动开包。

## 未做（需用户放行或前置条件）

- P22-0b 规则文档同步（`ARCHITECTURE.md` 决策 6/7、`STACK.md:33`、`CONVENTIONS.md:71`）：改前须用户确认。
- P22-A2 测试网部署、P22-B Arweave 上传（付费）、P22-G 主网：均为用户 Gate。
- migration `063_score_pack_orders.sql` 未跑，测试库与正式库都要用户放行。
- 浏览器实测（P22-D/E/F）：依赖测试网合约与 migration。
- 素材 metadata/图片尚未上传，`defineTokens` 还没调用。
- 并发测试（与旧 Score/素材/Pond Echo worker 同跑）与 cron 的 DB 路径无自动化测试。

## 新增环境变量（均未配置，代码对未配置安全降级为"该链不开放资产包"）

- 每链：`NEXT_PUBLIC_P22_OPENER_<chainId>`、`NEXT_PUBLIC_P22_SOUNDS_<chainId>`、`NEXT_PUBLIC_P22_TRACKS_<chainId>`、`NEXT_PUBLIC_P22_DEPLOY_BLOCK_<chainId>`
- 服务端：`P22_SIGNER_PRIVATE_KEY`、`P22_SIGNER_ADDRESS`（独立于 operator）
- 部署脚本：`P22_SCORE_ADDRESS`、`P22_ADMIN_ADDRESS`、`P22_SIGNER_ADDRESS`、`P22_PAUSER_ADDRESS`、`P22_SOUND_CONTRACT_URI`、`P22_TRACK_CONTRACT_URI`、`P22_ADMIN_DELAY_SECONDS`

## P22-A2 OP Sepolia 部署与端到端（2026-10-30，第一版，已被下方重部署取代）

| 合约 | 地址 |
|---|---|
| ScorePackOpener | `0x646d46312C0ad844d90a39C5c60bb3f8571391e4` |
| PondSoundNFT | `0xF8501Aa707899644b9943Ba2Fb9a2cBea2590Db0` |
| PondTrackNFT | `0xbc99085aeB238d5329640eB6c899A9C3Ee1b71aF` |

- 部署者 `0x306D…1633`（现有热钱包，部署后不持有任何角色，已读回确认）；admin / signer / pauser 为新生成的测试网专用钥匙，保存在桌面 `p22-testnet-keys.json`，**仅限测试网，主网必须另换**。
- 素材 URI 是占位地址（`ar://P22-testnet-placeholder-not-real-…`），登记了音效 1–33、背景音乐 1–35。主网换真实 Arweave 地址。
- 端到端（`scripts/p22/e2e-open.ts`）：服务端同一套凭证代码签名，由**非持有人**地址提交 `open`，Score #2 的账户 `0x5319…7b59` 收到背景音乐 1 份 + 音效 1/2/3 各 1 份，`opened=true`，gas 292972；第二次开包被拒绝。
- 未做：浏览器界面实测、cron 与数据库路径联调（无测试库）、ETH Sepolia（已决定跳过）。

## 安全修复后重部署 OP Sepolia（2026-10-30，当前有效）

开包合约构造函数新增绑定校验，旧版作废（旧地址 `0x646d…91e4` 等不再使用）。

| 合约 | 地址 |
|---|---|
| ScorePackOpener | `0x4Db23587222c2BDd3aa051558AB4e37F945d7399` |
| PondSoundNFT | `0xa269619706bD25B648a10Cd0AC32671847C572b9` |
| PondTrackNFT | `0xbF394442603447B022Bd7057F98CcEC386D8c35E` |

- `VerifyScorePack` 读真链核对通过；占位素材已登记（音效 1–33、背景音乐 1–35）。
- 端到端：Score #2 由非持有人提交 `open` 成功（gas 223578），TBA 同样地址 `0x5319…7b59`（账户地址只由 Score 决定，与 opener 无关），第二次开包被拒绝。
- 主网部署前置：全新部署钱包、运营钱包地址（`P22_OPERATOR_ADDRESS`）、独立 admin/signer/pauser。

## P22-0b 与 P22-B 准备（2026-10-30）

- P22-0b 已按用户授权完成：`docs/ARCHITECTURE.md` 决策 6/7、`docs/STACK.md`（链选择）、`docs/CONVENTIONS.md`（钱包写入例外）已同步，提交 `ee21ab2`。
- 素材 metadata 生成器 `scripts/p22/build-asset-metadata.ts`（只写本地，不上传）：音效 33/33、背景音乐 35/35，单个文件最大 525 字节。音频全部复用已有 Arweave 文件，只需新传 metadata 与图片。
- **上传成本估算**（Turbo 公开报价，1 GiB ≈ \$73.08；2026-10-30）：70 个 metadata（约 0.6 KB）合计约 \$0.005；2 张图片（各 ≤100 KB）各约 \$0.007；合计不到 \$0.02。过往 <105 KB 的文件在账本里 `costWinc` 为 0（免费档），实际可能为 \$0。
- **上传前提（未满足）**：①两张图片（音效共用一张、背景音乐共用一张）需要设计，当前为占位值；②Turbo 钱包已配置（`TURBO_WALLET_PATH` 指向存在的文件）；③上传属付费动作，需用户批准。
- 主网合约登记还需把 70 个 metadata 的 `ar://` 地址回填到 `defineTokens`。
- Turbo 余额实测（只读，`getTurboUploadBudget`）：可用 536,146,205,390 winc（约 \$2.5）；70 个 metadata + 2 张图片需约 3.9×10^9 winc（约 \$0.02），余额约为所需的 136 倍，无需充值。

## 素材图决定（2026-10-30）

- 用户决定：P22 素材图**先用旧版 Score 波浪封面**，新封面设计之后单开计划（见 TASKS Later）。
- 已生成两张候选 PNG（旧封面去掉右下角编号，1000×1000）：`sound.png`（取自 OP Score #1 的封面）、`track.png`（取自 ETH Token #1 的封面），放在桌面 `p22-asset-images/`，待用户过目；**用户满意前不上传 Arweave**。
- 用 PNG 而不是原 SVG：Semi 里旧封面显示异常，PNG 不依赖 SVG 渲染（原因仍待核实）。
- 满意后的步骤：上传 2 张图 → 拿到 `ar://` 地址 → 用 `--sound-image/--track-image` 重生成 70 个 metadata → 上传 → 回填登记脚本。登记到主网后不可改。

## 素材上传与主网彩排（2026-10-30，用户授权"全按推荐、不再审批"）

- 素材图片去掉了起笔折角（`data/p22/images/`）；2 张图 + 70 个 metadata + 2 个合集 metadata 已上传 Arweave（Turbo，账本 `data/p22/upload-ledger.json` 共 72 条，抽查 8 项读回哈希一致），登记地址在 `data/p22/asset-uris.json`。
- 新增 `scripts/p22/define-tokens.ts`（只追加、可 dry-run、读回核对）与 `scripts/p22/upload-assets.ts`。
- **OP 主网 fork 与以太坊主网 fork 各完整彩排一遍**：部署（模拟 11.1M gas）→ 登记（音效 2.93M + 背景音乐 3.10M gas）→ `VerifyScorePack` 通过 → 真实主网 Score（OP #2、ETH #1）由非持有人提交开包成功（gas 约 29.3 万）→ 第二次开包被拒绝。两条链的合约地址相同（全新部署钱包 nonce 确定）。
- 主网部署**未执行**：所有钱包在主网无可用 ETH（只有运营热钱包有约 0.01 OP-ETH，不动它以免触发余额告警）。手册 `07-mainnet-runbook.md`。
- 以太坊 gas 实测 1.2–1.3 gwei（早些时候 22 gwei 为短时高峰），主网总成本约 0.025 ETH。

## 主网部署完成（2026-10-30）

两条主网用同一全新部署钱包 `0x5Ea2…f888`（nonce 0），合约地址与彩排预测完全一致：

| 合约 | 地址（以太坊主网 / OP 主网相同） |
|---|---|
| ScorePackOpener | `0xa61f7fd863E255A0B96FfC53EfD5f1B974dB0941` |
| PondSoundNFT | `0x20dD346Ec1Fc763b5279a114DC4576e705B7D056` |
| PondTrackNFT | `0x8Ffb846ce8020eC519bc17235B704A62E0f7D7f2` |

- `VerifyScorePack` 读真链核对：两条链均通过（绑定、角色隔离、deployer 不持角色、未暂停）。
- 素材登记：音效 33/33、背景音乐 35/35（两条链）。以太坊登记 tx：音效 `0x3b4fc2d0…cbc`、背景音乐 `0x6aea3f48…ce`；OP 登记 tx：音效 `0xf9ddf5be…e66`、背景音乐 `0x048398f6…07f`。
- 实际花费：以太坊部署约 0.0012 ETH（gas 约 0.14 gwei）；OP 部署 <0.0001 ETH。
- 剩余资金已转回充值来源 `0x991b…1c63`（以太坊 tx `0xb228df21…4e45`，OP tx `0x68b55da4…4b34`）。
- 踩坑：公共 RPC 读回有延迟，登记后立刻读会误报"未登记"；`define-tokens.ts` 已加重试。别因此重发登记交易。
- **应用侧尚未上线**：migration 063 未跑、环境变量未配、cron 未建、分支未合并。用户账号验收后再对所有人开放。
